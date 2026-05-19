#!/usr/bin/env python3
import os
import sys
import json
import base64
import argparse
import urllib.request
import urllib.parse
from PIL import Image, ImageDraw, ImageFont

def download_image(url):
    """Descarga una imagen de una URL y devuelve su contenido binario y content-type."""
    print(f"Descargando imagen desde: {url}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            content_type = response.info().get_content_type()
            return response.read(), content_type
    except Exception as e:
        print(f"Error al descargar la imagen: {e}", file=sys.stderr)
        sys.exit(1)

def call_gemini_api(api_key, image_bytes, mime_type, model="gemini-1.5-flash"):
    """Llama a la API de Gemini para obtener las coordenadas y traducciones de los textos."""
    print(f"Llamando a la API de Gemini ({model}) para analizar la imagen...")
    
    base64_data = base64.b64encode(image_bytes).decode('utf-8')
    
    prompt = """Identify all English text bubbles/boxes on this comic or manga page. For each detected text box, perform the following:
1. Detect and transcribe the English text.
2. Translate the text accurately into natural, context-aware Spanish, preserving manga conventions, pacing, and tone.
3. Determine its bounding box coordinates in the format [ymin, xmin, ymax, xmax] on a normalized scale of 0 to 1000 (where [0, 0, 1000, 1000] corresponds to the full image top-left to bottom-right).

Return ONLY a JSON object that adheres strictly to the following schema:
{
  "blocks": [
    {
      "box_2d": [ymin, xmin, ymax, xmax],
      "english_text": "Transcribed English text",
      "spanish_text": "Texto traducido al español"
    }
  ]
}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": base64_data
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            
            # Extraer el texto de la respuesta de Gemini
            candidates = res_data.get('candidates', [])
            if not candidates:
                print("Error: No se recibieron candidatos de respuesta de Gemini.", file=sys.stderr)
                sys.exit(1)
                
            text_result = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            if not text_result:
                print("Error: La respuesta de Gemini está vacía.", file=sys.stderr)
                sys.exit(1)
                
            return json.loads(text_result)
    except Exception as e:
        print(f"Error al conectar con la API de Gemini: {e}", file=sys.stderr)
        sys.exit(1)

def wrap_text(text, font, max_width, draw):
    """Divide el texto en líneas para que quepa en un ancho determinado."""
    words = text.split()
    lines = []
    current_line = []
    
    for word in words:
        test_line = ' '.join(current_line + [word])
        # Calcular el tamaño del texto de prueba de forma retrocompatible
        try:
            bbox = draw.textbbox((0, 0), test_line, font=font)
            line_width = bbox[2] - bbox[0]
        except AttributeError:
            line_width = draw.textsize(test_line, font=font)[0]
            
        if line_width <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
                current_line = [word]
            else:
                # Si una sola palabra es más ancha que el máximo, forzarla en su propia línea
                lines.append(word)
                current_line = []
                
    if current_line:
        lines.append(' '.join(current_line))
        
    return lines

def process_image_and_draw(image_path_or_bytes, blocks, output_pdf_path):
    """Dibuja parches blancos sobre el texto original y escribe la traducción en español."""
    print("Procesando imagen localmente con Pillow...")
    
    if isinstance(image_path_or_bytes, bytes):
        import io
        img = Image.open(io.BytesIO(image_path_or_bytes))
    else:
        img = Image.open(image_path_or_bytes)
        
    img_width, img_height = img.size
    draw = ImageDraw.Draw(img)
    
    # Intentar cargar una fuente de cómic o una fuente estándar del sistema
    font = None
    font_paths = [
        "Comic Neue Bold.ttf",
        "Comic Neue.ttf",
        "arialbd.ttf",
        "arial.ttf",
        "DejaVuSans-Bold.ttf",
        "DejaVuSans.ttf"
    ]
    
    for font_name in font_paths:
        try:
            # En Windows las fuentes del sistema están en C:\Windows\Fonts
            if os.name == 'nt':
                font_path = os.path.join("C:\\Windows\\Fonts", font_name)
                if os.path.exists(font_path):
                    font = ImageFont.truetype(font_path, 16)
                    print(f"Fuente cargada: {font_name}")
                    break
            # Cargar por nombre en la carpeta de ejecución
            font = ImageFont.truetype(font_name, 16)
            print(f"Fuente cargada de forma local: {font_name}")
            break
        except Exception:
            continue
            
    if font is None:
        font = ImageFont.load_default()
        print("Usando fuente predeterminada (puede verse pequeña).")

    print(f"Traduciendo y aplicando {len(blocks)} globos de texto...")
    
    for i, block in enumerate(blocks):
        box_2d = block.get('box_2d')
        if not box_2d or len(box_2d) != 4:
            continue
            
        spanish_text = block.get('spanish_text', '').upper() # Las mayúsculas son estándar en cómics
        english_text = block.get('english_text', '')
        
        # Las coordenadas están normalizadas de 0 a 1000 [ymin, xmin, ymax, xmax]
        ymin, xmin, ymax, xmax = box_2d
        
        ymin_px = int(ymin / 1000.0 * img_height)
        xmin_px = int(xmin / 1000.0 * img_width)
        ymax_px = int(ymax / 1000.0 * img_height)
        xmax_px = int(xmax / 1000.0 * img_width)
        
        box_width = xmax_px - xmin_px
        box_height = ymax_px - ymin_px
        
        # 1. Cubrir el texto original con un parche blanco de fondo (elipse o rectángulo redondeado)
        # Reducir ligeramente el área del parche o usar la caja completa
        # Dibujamos un elipse para simular un bocadillo de diálogo clásico
        draw.ellipse([xmin_px - 2, ymin_px - 2, xmax_px + 2, ymax_px + 2], fill="white", outline="black", width=2)
        
        # Ajustar dinámicamente el tamaño de fuente para que el texto quepa en la caja
        current_font_size = 18
        temp_font = font
        lines = []
        
        # Iterar reduciendo el tamaño de la letra si el texto no cabe vertical u horizontalmente
        while current_font_size > 8:
            try:
                # Intentar recrear la fuente con el tamaño adecuado
                if font.path:
                    temp_font = ImageFont.truetype(font.path, current_font_size)
            except AttributeError:
                pass # Si es la fuente predeterminada, no podemos cambiar el tamaño
                
            # Ajustar texto al ancho de la caja (con un margen de 10px a los lados)
            lines = wrap_text(spanish_text, temp_font, box_width - 16, draw)
            
            # Calcular altura total requerida
            total_text_height = 0
            for line in lines:
                try:
                    bbox = draw.textbbox((0, 0), line, font=temp_font)
                    h = bbox[3] - bbox[1]
                except AttributeError:
                    h = draw.textsize(line, font=temp_font)[1]
                total_text_height += h + 2
                
            if total_text_height <= box_height - 10:
                # ¡Cabe perfectamente!
                break
                
            current_font_size -= 2
            
        # 2. Dibujar las líneas de texto en español centradas horizontal y verticalmente
        total_text_height = 0
        line_heights = []
        for line in lines:
            try:
                bbox = draw.textbbox((0, 0), line, font=temp_font)
                h = bbox[3] - bbox[1]
            except AttributeError:
                h = draw.textsize(line, font=temp_font)[1]
            line_heights.append(h)
            total_text_height += h + 2
            
        # Coordenada y inicial centrada verticalmente
        y_start = ymin_px + (box_height - total_text_height) / 2
        
        for idx, line in enumerate(lines):
            try:
                bbox = draw.textbbox((0, 0), line, font=temp_font)
                w = bbox[2] - bbox[0]
                h = bbox[3] - bbox[1]
            except AttributeError:
                w, h = draw.textsize(line, font=temp_font)
                
            # Coordenada x inicial centrada horizontalmente
            x_start = xmin_px + (box_width - w) / 2
            
            # Dibujar texto
            draw.text((x_start, y_start), line, fill="black", font=temp_font)
            y_start += h + 2
            
    # Guardar como PDF
    print(f"Guardando PDF final en: {output_pdf_path}...")
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
        
    img.save(output_pdf_path, "PDF")
    print("¡Proceso completado con éxito!")

def main():
    parser = argparse.ArgumentParser(description="Traduce automáticamente páginas de cómic/manga de inglés a español y genera un PDF.")
    parser.add_argument("input", help="URL de la imagen o ruta del archivo local JPG/PNG en inglés.")
    parser.add_argument("-k", "--api-key", help="Gemini API Key. También se puede configurar como variable de entorno GEMINI_API_KEY.")
    parser.add_argument("-o", "--output", default="translated_comic.pdf", help="Ruta del archivo PDF de salida (predeterminado: translated_comic.pdf).")
    parser.add_argument("-m", "--model", default="gemini-2.0-flash", help="Modelo de Gemini a usar (predeterminado: gemini-2.0-flash).")
    
    args = parser.parse_args()
    
    # Obtener API Key
    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: Se requiere una Gemini API Key. Proporciónala con -k/--api-key o configura la variable de entorno GEMINI_API_KEY.", file=sys.stderr)
        sys.exit(1)
        
    image_bytes = None
    mime_type = "image/jpeg"
    
    # Determinar si la entrada es una URL o un archivo local
    is_url = args.input.startswith("http://") or args.input.startswith("https://")
    
    if is_url:
        image_bytes, mime_type = download_image(args.input)
    else:
        if not os.path.exists(args.input):
            print(f"Error: El archivo local '{args.input}' no existe.", file=sys.stderr)
            sys.exit(1)
        print(f"Cargando archivo local: {args.input}...")
        with open(args.input, "rb") as f:
            image_bytes = f.read()
        # Intentar determinar el tipo de imagen
        ext = os.path.splitext(args.input)[1].lower()
        if ext in (".png"):
            mime_type = "image/png"
        elif ext in (".webp"):
            mime_type = "image/webp"
            
    # Llamar a Gemini API
    result_data = call_gemini_api(api_key, image_bytes, mime_type, model=args.model)
    
    # Procesar imagen y generar PDF
    blocks = result_data.get('blocks', [])
    if not blocks:
        print("Advertencia: No se detectaron globos de texto en la imagen.")
        
    process_image_and_draw(image_bytes, blocks, args.output)

if __name__ == "__main__":
    main()
