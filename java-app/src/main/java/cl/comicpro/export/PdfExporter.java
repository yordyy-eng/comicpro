package cl.comicpro.export;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

public class PdfExporter {

    public void export(List<BufferedImage> pages, Path outputPath) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            for (BufferedImage img : pages) {
                PDImageXObject pdImage = LosslessFactory.createFromImage(doc, img);
                PDRectangle rect = new PDRectangle(img.getWidth(), img.getHeight());
                PDPage page = new PDPage(rect);
                doc.addPage(page);

                try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                    cs.drawImage(pdImage, 0, 0, img.getWidth(), img.getHeight());
                }
            }
            doc.save(outputPath.toFile());
        }
    }
}
