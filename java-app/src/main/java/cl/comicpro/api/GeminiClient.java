package cl.comicpro.api;

import cl.comicpro.model.ComicBlock;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

public class GeminiClient {

    private static final String API_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";

    private static final String PROMPT = """
        Identify all English text bubbles/boxes on this comic or manga page.
        For each detected text box:
        1. Transcribe the English text.
        2. Translate accurately into natural Spanish, preserving manga tone and pacing.
        3. Provide bounding box [ymin, xmin, ymax, xmax] normalized 0-1000.

        Return ONLY valid JSON:
        {"blocks":[{"box_2d":[ymin,xmin,ymax,xmax],"english_text":"...","spanish_text":"..."}]}
        """;

    private final String apiKey;
    private final String model;
    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    public GeminiClient(String apiKey, String model) {
        this.apiKey = apiKey;
        this.model = model;
    }

    public List<ComicBlock> translate(Path imagePath) throws IOException, InterruptedException {
        byte[] imageBytes = Files.readAllBytes(imagePath);
        String base64 = Base64.getEncoder().encodeToString(imageBytes);
        String mimeType = detectMime(imagePath);

        ObjectNode inlineData = mapper.createObjectNode()
            .put("mimeType", mimeType)
            .put("data", base64);
        ObjectNode imagePart = mapper.createObjectNode();
        imagePart.set("inlineData", inlineData);

        ObjectNode textPart = mapper.createObjectNode().put("text", PROMPT);

        ObjectNode content = mapper.createObjectNode();
        content.set("parts", mapper.createArrayNode().add(textPart).add(imagePart));

        ObjectNode genConfig = mapper.createObjectNode()
            .put("responseMimeType", "application/json");

        ObjectNode requestNode = mapper.createObjectNode();
        requestNode.set("contents", mapper.createArrayNode().add(content));
        requestNode.set("generationConfig", genConfig);

        String body = mapper.writeValueAsString(requestNode);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_URL.formatted(model, apiKey)))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> response = sendWithRetry(request, 4);

        JsonNode root = mapper.readTree(response.body());
        String text = root.at("/candidates/0/content/parts/0/text").asText();
        if (text.isBlank()) {
            throw new IOException("Gemini returned empty text response");
        }
        JsonNode blocksNode = mapper.readTree(text).get("blocks");

        List<ComicBlock> blocks = new ArrayList<>();
        if (blocksNode != null && blocksNode.isArray()) {
            for (JsonNode n : blocksNode) {
                JsonNode box = n.get("box_2d");
                if (box == null || !box.isArray() || box.size() < 4) continue;
                int[] coords = {box.get(0).asInt(), box.get(1).asInt(),
                                box.get(2).asInt(), box.get(3).asInt()};
                blocks.add(new ComicBlock(coords,
                    n.path("english_text").asText(),
                    n.path("spanish_text").asText()));
            }
        }
        return blocks;
    }

    private HttpResponse<String> sendWithRetry(HttpRequest request, int maxRetries)
            throws IOException, InterruptedException {
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            HttpResponse<String> resp = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) return resp;

            if (resp.statusCode() == 429 && attempt < maxRetries) {
                long delayMs = parseRetryDelay(resp.body());
                System.out.printf("[Gemini] Rate limited. Waiting %ds before retry %d/%d...%n",
                    delayMs / 1000, attempt + 1, maxRetries);
                Thread.sleep(delayMs);
                continue;
            }

            throw new IOException("Gemini API error %d: %s".formatted(resp.statusCode(), resp.body()));
        }
        throw new IOException("Gemini: max retries exceeded");
    }

    private long parseRetryDelay(String body) {
        try {
            JsonNode root = mapper.readTree(body);
            for (JsonNode detail : root.at("/error/details")) {
                JsonNode delay = detail.get("retryDelay");
                if (delay != null) {
                    String s = delay.asText().replace("s", "").trim();
                    double seconds = Double.parseDouble(s);
                    return Math.max((long)(seconds * 1000) + 2000, 65_000);
                }
            }
        } catch (Exception ignored) {}
        return 65_000; // default: wait 65s if can't parse
    }

    private String detectMime(Path path) {
        String name = path.getFileName().toString().toLowerCase();
        if (name.endsWith(".png"))  return "image/png";
        if (name.endsWith(".webp")) return "image/webp";
        return "image/jpeg";
    }
}
