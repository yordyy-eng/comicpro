package cl.comicpro.ui;

import cl.comicpro.api.GeminiClient;
import cl.comicpro.export.PdfExporter;
import cl.comicpro.model.ComicBlock;
import cl.comicpro.render.ComicRenderer;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.control.*;
import javafx.stage.DirectoryChooser;
import javafx.stage.FileChooser;

import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainController {

    @FXML private TextField apiKeyField;
    @FXML private ComboBox<String> modelCombo;
    @FXML private Label folderLabel;
    @FXML private ListView<String> pageList;
    @FXML private ProgressBar progressBar;
    @FXML private Label statusLabel;
    @FXML private Button translateBtn;

    private Path selectedFolder;
    private List<Path> imageFiles = new ArrayList<>();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private static final List<String> MODELS = List.of(
        "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"
    );

    private static final List<String> IMAGE_EXTS = List.of(".jpg", ".jpeg", ".png", ".webp");

    @FXML
    public void initialize() {
        modelCombo.getItems().addAll(MODELS);
        modelCombo.setValue(MODELS.get(0));

        // Load saved API key
        String saved = System.getProperty("comicpro.apikey", "");
        if (!saved.isBlank()) apiKeyField.setText(saved);
    }

    @FXML
    private void onSelectFolder() {
        DirectoryChooser chooser = new DirectoryChooser();
        chooser.setTitle("Selecciona carpeta descargada por JDownloader");
        File dir = chooser.showDialog(null);
        if (dir == null) return;

        selectedFolder = dir.toPath();
        folderLabel.setText(selectedFolder.toString());
        loadImages();
    }

    private void loadImages() {
        imageFiles.clear();
        pageList.getItems().clear();

        try (var stream = Files.list(selectedFolder)) {
            stream.filter(p -> IMAGE_EXTS.stream().anyMatch(
                    ext -> p.getFileName().toString().toLowerCase().endsWith(ext)))
                .sorted(Comparator.comparing(p -> p.getFileName().toString()))
                .forEach(p -> {
                    imageFiles.add(p);
                    pageList.getItems().add(p.getFileName().toString());
                });
        } catch (Exception e) {
            setStatus("Error al leer carpeta: " + e.getMessage(), true);
        }

        setStatus(imageFiles.size() + " página(s) encontradas. Listas para traducir.", false);
        translateBtn.setDisable(imageFiles.isEmpty());
    }

    @FXML
    private void onTranslate() {
        String apiKey = apiKeyField.getText().trim();
        if (apiKey.isBlank()) {
            setStatus("Ingresa tu Gemini API Key.", true);
            return;
        }

        FileChooser save = new FileChooser();
        save.setTitle("Guardar PDF traducido");
        save.getExtensionFilters().add(new FileChooser.ExtensionFilter("PDF", "*.pdf"));
        save.setInitialFileName("translated_comic.pdf");
        File out = save.showSaveDialog(null);
        if (out == null) return;

        translateBtn.setDisable(true);
        progressBar.setProgress(0);

        GeminiClient gemini = new GeminiClient(apiKey, modelCombo.getValue());
        ComicRenderer renderer = new ComicRenderer();
        PdfExporter exporter = new PdfExporter();
        List<Path> pages = List.copyOf(imageFiles);
        Path outputPath = out.toPath();

        executor.submit(() -> {
            List<BufferedImage> rendered = new ArrayList<>();
            for (int i = 0; i < pages.size(); i++) {
                Path page = pages.get(i);
                final int idx = i;
                Platform.runLater(() -> {
                    setStatus("Traduciendo página " + (idx + 1) + "/" + pages.size() + ": " + page.getFileName(), false);
                    progressBar.setProgress((double) idx / pages.size());
                });

                try {
                    List<ComicBlock> blocks = gemini.translate(page);
                    BufferedImage img = renderer.render(page, blocks);
                    rendered.add(img);
                } catch (Exception e) {
                    Platform.runLater(() -> setStatus("Error en página " + page.getFileName() + ": " + e.getMessage(), true));
                }
            }

            try {
                exporter.export(rendered, outputPath);
                Platform.runLater(() -> {
                    progressBar.setProgress(1.0);
                    setStatus("PDF generado: " + outputPath.getFileName(), false);
                    translateBtn.setDisable(false);
                });
            } catch (Exception e) {
                Platform.runLater(() -> setStatus("Error al exportar PDF: " + e.getMessage(), true));
            }
        });
    }

    private void setStatus(String msg, boolean error) {
        statusLabel.setText(msg);
        statusLabel.setStyle(error ? "-fx-text-fill: #ff6b6b;" : "-fx-text-fill: #a8d8a8;");
    }
}
