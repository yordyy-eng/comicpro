package cl.comicpro.render;

import cl.comicpro.model.ComicBlock;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

public class ComicRenderer {

    public BufferedImage render(Path imagePath, List<ComicBlock> blocks) throws IOException {
        BufferedImage img = ImageIO.read(imagePath.toFile());
        int w = img.getWidth();
        int h = img.getHeight();

        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        for (ComicBlock block : blocks) {
            int[] box = block.box2d();
            int y1 = (int)(box[0] / 1000.0 * h);
            int x1 = (int)(box[1] / 1000.0 * w);
            int y2 = (int)(box[2] / 1000.0 * h);
            int x2 = (int)(box[3] / 1000.0 * w);
            int bw = x2 - x1;
            int bh = y2 - y1;

            // White ellipse patch over original text
            g.setColor(Color.WHITE);
            g.fillOval(x1 - 2, y1 - 2, bw + 4, bh + 4);
            g.setColor(Color.BLACK);
            g.setStroke(new BasicStroke(2f));
            g.drawOval(x1 - 2, y1 - 2, bw + 4, bh + 4);

            // Fit text inside box
            String text = block.spanishText().toUpperCase();
            Font font = fitFont(g, text, bw - 12, bh - 8);
            g.setFont(font);
            g.setColor(Color.BLACK);
            drawCentered(g, text, x1, y1, bw, bh, font);
        }

        g.dispose();
        return img;
    }

    private Font fitFont(Graphics2D g, String text, int maxW, int maxH) {
        for (int size = 18; size >= 8; size -= 2) {
            Font f = new Font("Arial", Font.BOLD, size);
            FontMetrics fm = g.getFontMetrics(f);
            List<String> lines = wrapText(text, fm, maxW);
            int totalH = lines.size() * (fm.getHeight() + 2);
            if (totalH <= maxH) return f;
        }
        return new Font("Arial", Font.BOLD, 8);
    }

    private void drawCentered(Graphics2D g, String text, int bx, int by, int bw, int bh, Font font) {
        FontMetrics fm = g.getFontMetrics(font);
        List<String> lines = wrapText(text, fm, bw - 12);
        int lineH = fm.getHeight() + 2;
        int totalH = lines.size() * lineH;
        int yStart = by + (bh - totalH) / 2 + fm.getAscent();

        for (String line : lines) {
            int lineW = fm.stringWidth(line);
            int x = bx + (bw - lineW) / 2;
            g.drawString(line, x, yStart);
            yStart += lineH;
        }
    }

    private List<String> wrapText(String text, FontMetrics fm, int maxW) {
        List<String> lines = new java.util.ArrayList<>();
        String[] words = text.split(" ");
        StringBuilder current = new StringBuilder();
        for (String word : words) {
            String test = current.isEmpty() ? word : current + " " + word;
            if (fm.stringWidth(test) <= maxW) {
                current = new StringBuilder(test);
            } else {
                if (!current.isEmpty()) lines.add(current.toString());
                current = new StringBuilder(word);
            }
        }
        if (!current.isEmpty()) lines.add(current.toString());
        return lines;
    }
}
