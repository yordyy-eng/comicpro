package cl.comicpro.ui;

import cl.comicpro.api.ChapterDownloader;
import cl.comicpro.api.GeminiClient;
import cl.comicpro.export.PdfExporter;
import cl.comicpro.model.ComicBlock;
import cl.comicpro.render.ComicRenderer;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.control.*;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.stage.FileChooser;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.prefs.Preferences;

public class MainController {

    @FXML private TextField apiKeyField;
    @FXML private ComboBox<String> modelCombo;
    @FXML private TextArea urlInput;
    @FXML private ProgressBar downloadBar;
    @FXML private ProgressBar translateBar;
    @FXML private Label phaseLabel;
    @FXML private Label counterLabel;
    @FXML private TextArea logArea;
    @FXML private Button runBtn;
    @FXML private CheckBox testModeCheck;
    @FXML private ImageView pagePreview;
    @FXML private Label previewLabel;

    private static final List<String> MODELS = List.of(
        "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash-latest"
    );

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Preferences prefs = Preferences.userNodeForPackage(MainController.class);

    @FXML
    public void initialize() {
        modelCombo.getItems().addAll(MODELS);
        modelCombo.setValue(MODELS.get(0));
        apiKeyField.setText(loadApiKey());
    }

    @FXML
    private void onRun() {
        String apiKey = apiKeyField.getText().trim();
        String input  = urlInput.getText().trim();

        if (apiKey.isBlank()) { log("ERROR: Ingresa tu Gemini API Key."); return; }
        if (input.isBlank())  { log("ERROR: Ingresa URL del capítulo."); return; }

        FileChooser save = new FileChooser();
        save.setTitle("Guardar PDF traducido");
        save.getExtensionFilters().add(new FileChooser.ExtensionFilter("PDF", "*.pdf"));
        save.setInitialFileName("manga_traducido.pdf");
        var out = save.showSaveDialog(null);
        if (out == null) return;

        prefs.put("apiKey", apiKey);
        runBtn.setDisable(true);
        logArea.clear();
        downloadBar.setProgress(0);
        translateBar.setProgress(0);
        setPhase("Iniciando...", "");

        Path outputPath = out.toPath();
        String model = modelCombo.getValue();

        executor.submit(() -> {
            try {
                // ── FASE 1: Extraer URLs ──────────────────────────
                setPhase("Extrayendo URLs...", "");
                log("Analizando página del capítulo...");
                ChapterDownloader downloader = new ChapterDownloader();
                List<String> imageUrls = downloader.extractImageUrls(input);

                if (imageUrls.isEmpty()) {
                    log("ERROR: No se encontraron imágenes.");
                    resetUI();
                    return;
                }
                log("Encontradas " + imageUrls.size() + " páginas.");

                // ── FASE 2: Descargar ─────────────────────────────
                setPhase("⬇ Descargando", "0 / " + imageUrls.size());
                log("Iniciando descarga de " + imageUrls.size() + " páginas...");

                final int[] dlCount = {0};
                List<Path> imageFiles = downloader.downloadAll(imageUrls, msg -> {
                    dlCount[0]++;
                    double p = (double) dlCount[0] / imageUrls.size();
                    Platform.runLater(() -> {
                        downloadBar.setProgress(p);
                        counterLabel.setText(dlCount[0] + " / " + imageUrls.size());
                    });
                    log(msg);
                });

                Platform.runLater(() -> downloadBar.setProgress(1.0));
                log("Descarga completa: " + imageFiles.size() + " páginas guardadas.");

                if (testModeCheck.isSelected()) {
                    int limit = Math.min(3, imageFiles.size());
                    imageFiles = imageFiles.subList(0, limit);
                    log("Modo Prueba: limitado a " + limit + " páginas.");
                }

                if (imageFiles.isEmpty()) {
                    log("ERROR: Ninguna página descargada exitosamente. Revisa la URL.");
                    resetUI();
                    return;
                }

                // ── FASE 3: Traducir con Gemini ───────────────────
                GeminiClient gemini = new GeminiClient(apiKey, model);
                ComicRenderer renderer = new ComicRenderer();
                List<BufferedImage> rendered = new ArrayList<>();
                int total = imageFiles.size();

                for (int i = 0; i < total; i++) {
                    Path page = imageFiles.get(i);
                    final int idx = i;
                    final double prog = (double) i / total;

                    Platform.runLater(() -> {
                        translateBar.setProgress(prog);
                        setPhase("🤖 Gemini traduciendo", (idx + 1) + " / " + total);
                        previewLabel.setText("Página " + (idx + 1) + ": " + page.getFileName());
                        // Show preview of current page
                        try (InputStream is = Files.newInputStream(page)) {
                            pagePreview.setImage(new Image(is));
                        } catch (IOException ignored) {}
                    });

                    log("Traduciendo página " + (idx + 1) + "/" + total + " → " + page.getFileName());

                    try {
                        List<ComicBlock> blocks = gemini.translate(page);
                        log("  ✓ " + blocks.size() + " globo(s) detectado(s) y traducido(s)");
                        rendered.add(renderer.render(page, blocks));
                    } catch (Exception e) {
                        log("  ⚠ Error página " + (idx + 1) + ": " + e.getMessage());
                    }
                }

                // ── FASE 4: Exportar PDF ──────────────────────────
                setPhase("📄 Exportando PDF...", rendered.size() + " páginas");
                log("Compilando PDF con " + rendered.size() + " páginas...");
                new PdfExporter().export(rendered, outputPath);

                // Cleanup temp
                imageFiles.forEach(p -> { try { Files.deleteIfExists(p); } catch (IOException ignored) {} });

                Platform.runLater(() -> {
                    translateBar.setProgress(1.0);
                    setPhase("✅ LISTO", rendered.size() + " páginas");
                    log("──────────────────────────────────");
                    log("PDF guardado en: " + outputPath);
                    runBtn.setDisable(false);
                });

            } catch (Exception e) {
                log("ERROR FATAL: " + e.getMessage());
                resetUI();
            }
        });
    }

    private void setPhase(String phase, String counter) {
        Platform.runLater(() -> {
            phaseLabel.setText(phase);
            counterLabel.setText(counter);
        });
    }

    private void resetUI() {
        Platform.runLater(() -> {
            runBtn.setDisable(false);
            setPhase("Error — revisa el log", "");
        });
    }

    private void log(String msg) {
        Platform.runLater(() -> logArea.appendText(msg + "\n"));
    }

    private String loadApiKey() {
        String saved = prefs.get("apiKey", "");
        if (!saved.isBlank()) return saved;

        String env = System.getenv("GEMINI_API_KEY");
        if (env != null && !env.isBlank()) return env;

        for (String candidate : List.of(".env", "../.env", "../../.env")) {
            Path p = Paths.get(candidate);
            if (Files.exists(p)) {
                try {
                    for (String line : Files.readAllLines(p)) {
                        if (line.startsWith("GEMINI_API_KEY=")) {
                            return line.substring("GEMINI_API_KEY=".length()).trim();
                        }
                    }
                } catch (IOException ignored) {}
            }
        }
        return "";
    }
}
