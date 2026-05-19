package cl.comicpro.api;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public class ChapterDownloader {

    private static final String UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
    private static final List<String> IMG_EXTS = List.of(".jpg", ".jpeg", ".png", ".webp");

    private final HttpClient http = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NORMAL)
        .connectTimeout(Duration.ofSeconds(15))
        .build();

    // Stores the original chapter page URL to use as Referer when downloading
    private String pageReferer = "";

    /**
     * Given a chapter page URL, scrape all manga image URLs.
     * If input contains newlines, treat each line as a direct image URL.
     */
    public List<String> extractImageUrls(String input) throws IOException, InterruptedException {
        String trimmed = input.trim();

        // Multi-line = direct URLs pasted by user
        if (trimmed.contains("\n")) {
            pageReferer = "";
            return trimmed.lines()
                .map(String::trim)
                .filter(l -> !l.isBlank() && l.startsWith("http"))
                .toList();
        }

        // Single URL — scrape the chapter page, store as Referer for downloads
        pageReferer = trimmed;

        Document doc = Jsoup.connect(trimmed)
            .userAgent(UA)
            .referrer("https://www.google.com")
            .timeout(20_000)
            .get();

        List<String> urls = new ArrayList<>();
        for (Element img : doc.select("img")) {
            String src = img.absUrl("src");
            if (src.isBlank()) src = img.absUrl("data-src");
            if (src.isBlank()) continue;
            String lower = src.toLowerCase();
            if (IMG_EXTS.stream().anyMatch(lower::contains)) {
                urls.add(src);
            }
        }

        // Deduplicate preserving order
        return urls.stream().distinct().toList();
    }

    /**
     * Download a list of image URLs to a temp directory.
     * Calls progress callback with (index, total, filename).
     */
    public List<Path> downloadAll(List<String> urls, Consumer<String> progress)
            throws IOException, InterruptedException {

        Path tempDir = Files.createTempDirectory("comicpro_");
        List<Path> files = new ArrayList<>();

        for (int i = 0; i < urls.size(); i++) {
            String url = urls.get(i);
            String filename = String.format("%03d_%s", i + 1, sanitizeFilename(url));
            Path dest = tempDir.resolve(filename);
            progress.accept("Descargando %d/%d: %s".formatted(i + 1, urls.size(), filename));

            // Use chapter page as Referer — CDNs require this to allow hotlinking
            String referer = pageReferer.isBlank() ? extractBase(url) : pageReferer;

            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("User-Agent", UA)
                .header("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
                .header("Accept-Language", "es-CL,es;q=0.9,en;q=0.8")
                .header("Referer", referer)
                .header("Origin", extractBase(referer))
                .header("Sec-Fetch-Dest", "image")
                .header("Sec-Fetch-Mode", "no-cors")
                .header("Sec-Fetch-Site", "cross-site")
                .GET().build();

            HttpResponse<InputStream> resp = http.send(req, HttpResponse.BodyHandlers.ofInputStream());
            int status = resp.statusCode();
            if (status >= 200 && status < 300) {
                try (InputStream in = resp.body()) {
                    Files.copy(in, dest);
                }
                files.add(dest);
            } else {
                progress.accept("  WARN HTTP " + status + " → " + url);
            }
        }
        return files;
    }

    private String sanitizeFilename(String url) {
        String name = url.replaceAll(".*[/]", "").replaceAll("[^a-zA-Z0-9._-]", "_");
        if (name.length() > 60) name = name.substring(0, 60);
        return name.isBlank() ? "page.jpg" : name;
    }

    private String extractBase(String url) {
        try {
            URI uri = URI.create(url);
            return uri.getScheme() + "://" + uri.getHost();
        } catch (Exception e) {
            return "https://google.com";
        }
    }
}
