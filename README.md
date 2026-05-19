# ComicPro Translation Studio - Documentación Oficial

Bienvenido a la documentación técnica oficial de **ComicPro Translation Studio**, una plataforma premium y ligera diseñada para la traducción automática e interactiva de páginas de cómic y manga de inglés a español, con compilación final a documentos PDF de alta definición.

Esta suite proporciona dos metodologías de traducción complementarias:
1. **Estudio Web Interactivo (GUI):** Basado en Node.js, Express y Vanilla HTML5/CSS3/JavaScript, que te permite editar diálogos, re-ubicar globos de texto y afinar la tipografía en tiempo real en un entorno oscuro glassmorphic muy sofisticado.
2. **Script de Consola en Python (CLI):** Un programa de automatización directo que descarga, procesa mediante IA, redibuja bocadillos mediante Pillow y genera el PDF de forma autónoma desde tu terminal.

---

## 📂 Arquitectura de Archivos del Proyecto

```text
c:\comicpro\
├── public/                 # Carpeta estática servida por Express (Frontend)
│   ├── index.html          # Interfaz estructurada del Estudio de Traducción
│   ├── style.css           # Diseño premium glassmorphic Fintech-Nocturno
│   └── app.js              # Lógica de manipulación interactiva de globos y jsPDF
├── package.json            # Gestión de dependencias de Node.js
├── server.js               # Servidor Express, Proxy CORS y Conector de Gemini
├── translate_comic.py      # Script automatizado de terminal escrito en Python
└── README.md               # Este archivo de documentación técnica completa
```

---

## 🔌 Documentación Detallada de los Endpoints de la API

El servidor Express (`server.js`) levanta por defecto en el puerto **`3000`** e implementa los siguientes endpoints públicos para dar soporte al cliente web y a integraciones externas:

### 1. Proxy de Imágenes CORS
* **Ruta:** `GET /proxy-image`
* **Descripción:** Descarga imágenes de servidores web externos y las devuelve directamente al cliente bajo el mismo dominio de origen de la aplicación. Esto es un requisito indispensable para evitar bloqueos por políticas de **CORS (Cross-Origin Resource Sharing)** en los navegadores cuando librerías como `html2canvas` intentan rasterizar la mesa de trabajo.
* **Parámetros de Consulta (Query Params):**
  * `url` (String, Obligatorio): La dirección URL pública de la imagen de cómic a descargar (ej: `https://dominio.com/manga.jpg`).
* **Headers del Servidor Proxy:**
  * Envía un `User-Agent` simulando un navegador Chrome moderno y cabeceras de aceptación generales para prevenir que servidores anti-hotlinking básicos rechacen la petición.
* **Respuestas del Endpoint:**
  * **`200 OK` (Cuerpo Binario):** Devuelve la imagen descargada en su formato binario original con la cabecera `Content-Type` correspondiente (ej: `image/jpeg`, `image/png`) y `Cache-Control: public, max-age=86400` para reducir tráfico repetido.
  * **`400 Bad Request`:** Ocurre si falta el parámetro en la petición.
    ```json
    { "error": "URL parameter is required" }
    ```
  * **`403 Forbidden`:** Ocurre si el servidor de la imagen (por ejemplo, Cloudflare o un CDN protegido) detecta la solicitud automatizada y bloquea la descarga.
    ```json
    { "error": "El servidor de la imagen (Cloudflare/CDN) bloqueó la descarga automática (Error 403). Te recomendamos descargar la imagen a tu computadora y subirla manualmente." }
    ```
  * **`500 Internal Server Error`:**
    ```json
    { "error": "Internal server error: [Mensaje del error]" }
    ```

---

### 2. Detección, Grounding y Traducción por IA
* **Ruta:** `POST /translate`
* **Descripción:** El motor central del proyecto. Recibe una imagen (en URL o archivo binario), la codifica a Base64, realiza la llamada HTTPS directa a la API de Gemini (aprovechando sus capacidades de *visual grounding* y OCR), y devuelve una estructura JSON limpia con las coordenadas normalizadas `0-1000` de los globos de diálogo detectados, su contenido en inglés y su traducción correspondiente adaptada al español.
* **Formato de Petición:** `multipart/form-data`
* **Parámetros del Cuerpo (Request Body):**
  * `image` (Archivo Binario, Opcional): El archivo de imagen local (JPG, PNG, WebP) subido desde el navegador.
  * `imageUrl` (String, Opcional): La URL de la imagen externa si el usuario no subió un archivo físico. *Nota: Se requiere `image` o `imageUrl` obligatoriamente.*
  * `apiKey` (String, Obligatorio): Tu Gemini API Key. Si no se provee por parámetro de red, el endpoint intentará tomarla automáticamente del archivo de configuración del servidor (`process.env.GEMINI_API_KEY`).
  * `model` (String, Opcional): El identificador del modelo de Gemini a usar. Por defecto es `gemini-2.0-flash`. Soportados: `gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-1.5-pro`.
* **Respuestas del Endpoint:**
  * **`200 OK` (JSON):** Devuelve una lista estructurada de bloques de diálogo con sus coordenadas exactas en escala de `0` a `1000` (donde `[ymin, xmin, ymax, xmax]` describe las esquinas superior-izquierda e inferior-derecha relativas al tamaño total de la página).
    ```json
    {
      "blocks": [
        {
          "box_2d": [190, 725, 280, 895],
          "english_text": "I will find the truth no matter what!",
          "spanish_text": "¡Encontraré la verdad sin importar qué!"
        },
        {
          "box_2d": [410, 150, 520, 310],
          "english_text": "Wait a minute...",
          "spanish_text": "Espera un minuto..."
        }
      ]
    }
    ```
  * **`400 Bad Request`:**
    * Si no se provee una API Key válida de Gemini:
      ```json
      { "error": "Gemini API Key is required. Please set it in settings or .env file." }
      ```
    * Si no se envía ni una imagen física ni una URL de origen:
      ```json
      { "error": "No image source provided (file or URL required)" }
      ```
  * **`403 Forbidden`:** Ocurre si la URL de imagen proporcionada fue bloqueada por Cloudflare al intentar el backend pre-procesarla y convertirla a Base64.
    ```json
    { "error": "El servidor de la imagen (Cloudflare/CDN) bloqueó la descarga automática (Error 403). Te recomendamos hacer clic derecho en la imagen original, guardarla en tu computadora y subirla arrastrándola aquí. ¡Funcionará de inmediato!" }
    ```
  * **`500 Internal Server Error`:** Ocurre si la API de Gemini devuelve un error de cuota, autenticación o si no retorna la estructura esperada:
    ```json
    { "error": "Gemini did not return valid JSON format.", "rawText": "[Respuesta cruda de Gemini]" }
    ```

---

## 🐍 Script de Consola Python (`translate_comic.py`)

Para desarrolladores y entusiastas del terminal, `translate_comic.py` ofrece una implementación autónoma en Python que automatiza todo el proceso gráfico sin dependencias pesadas de Google Cloud o Webpacks.

### Parámetros de Ejecución del Script
Puedes consultar la ayuda interactiva en tu terminal mediante:
```bash
python translate_comic.py --help
```

### Argumentos del Comando:
* **`input`** (Posicional, Obligatorio): Ruta del archivo de imagen local (`ej: manga3.jpg`) o una URL HTTP directa de la página en inglés.
* **`-k`, `--api-key`** (Opcional): Tu Gemini API Key. Si no se especifica, el script buscará la variable de entorno del sistema `GEMINI_API_KEY`.
* **`-o`, `--output`** (Opcional, Predeterminado: `translated_comic.pdf`): Nombre y ruta del archivo PDF de salida.
* **`-m`, `--model`** (Opcional, Predeterminado: `gemini-2.0-flash`): Versión del modelo de Gemini que se utilizará para la segmentación y traducción.

### Mecanismo de Procesamiento de Imagen y Dibujo con Pillow:
El script procesa la traducción de la siguiente manera:
1. **Descarga / Lectura:** Carga los bytes de la imagen y los codifica en base64 para enviarlos a Gemini.
2. **Coordenadas de Escala:** Gemini devuelve coordenadas relativas de `0` a `1000`. El script las escala a las dimensiones en píxeles reales de la imagen:
   $$\text{Y}_{px} = \text{Coord}_{Gemini} \times \frac{\text{Alto de Imagen}}{1000}$$
   $$\text{X}_{px} = \text{Coord}_{Gemini} \times \frac{\text{Ancho de Imagen}}{1000}$$
3. **Parcheo de Globos (Inpainting Vectorial):** Mediante la librería `Pillow` (PIL), el script dibuja una **elipse rellena de color blanco** con un fino borde negro de `2px` sobre la caja de diálogo para ocultar completamente el texto original en inglés.
4. **Cálculo de Ancho y Envoltura:** Analiza el ancho de la caja en píxeles y envuelve el texto en español por palabras (ajustando saltos de línea) utilizando una tipografía estilo comic si está instalada en el sistema (ej. `Comic Neue` en Windows o fuentes del sistema).
5. **Reducción de Tipografía Dinámica:** Si el texto resultante excede la altura de la caja delimitadora, el script reduce de forma iterativa el tamaño de la fuente (`font size`) de 2 en 2 puntos hasta que la traducción quepa de forma óptima en el globo.
6. **Centrado Absoluto:** Dibuja el texto en español perfectamente alineado tanto en el eje vertical como horizontal.
7. **Compilación PDF:** Guarda la imagen procesada convirtiéndola a modo de color `RGB` (si poseía canal Alfa) y exporta un documento PDF listo para imprimir.

---

## 🎨 Características Avanzadas del Estudio Web Frontend

La interfaz del Estudio Web interactivo (`public/app.js`) está construida con altos estándares de usabilidad, respuesta táctil y robustez gráfica:

* **Mesa de Trabajo Porcentual:** En lugar de posicionar los globos de texto traducidos con píxeles absolutos, la aplicación calcula su posición y tamaño en porcentajes (`top`, `left`, `width`, `height` en `%`). Esto permite que el usuario pueda usar la herramienta de **Zoom** (acercar/alejar la página) o redimensionar la ventana sin que los globos de texto se desplacen o pierdan su alineación con respecto a la imagen de fondo.
* **Interactividad Visual Completa:**
  * **Arrastre (Draggable):** Mueve los globos libremente sobre los bocadillos de la página.
  * **Redimensionamiento (Resizable):** Ajusta el ancho y el alto a través de un tirador circular inferior derecho.
  * **Edición Inline:** Haz doble clic en el texto para editar la traducción directamente dentro del globo.
  * **Sincronización Bidireccional de Estilos:** Al hacer clic en un globo de diálogo, el panel lateral de la interfaz lee inmediatamente sus características tipográficas y las carga en los controles visuales. Cualquier cambio en la tipografía, tamaño de letra, color de texto, color y opacidad de fondo, o grosor del borde se aplica de forma instantánea al globo seleccionado.
* **Exportación de Alta Densidad (Alta Resolución para Impresión):**
  Al exportar a PDF, `app.js` realiza los siguientes pasos técnicos:
  1. Oculta de forma temporal los bordes de edición activos y los tiradores de redimensionamiento de los globos.
  2. Resetea el zoom a `1.0` de forma invisible para que el navegador capture los elementos a su escala original de píxeles.
  3. Ejecuta `html2canvas` especificando una escala de renderizado de **`2`** (multiplicador de densidad de píxeles) para obtener una captura con el doble de resolución de la pantalla, eliminando el difuminado del texto.
  4. Crea un PDF usando `jsPDF` cuyas dimensiones en puntos coinciden milimétricamente con el tamaño original de la imagen del manga, incrustando la captura rasterizada sin pérdida de calidad.

---

## 🛠️ Preguntas Frecuentes y Solución de Problemas

### 1. ¿Cómo obtengo una API Key de Gemini?
Puedes generar una clave de forma totalmente gratuita y en menos de un minuto ingresando a [Google AI Studio](https://aistudio.google.com/) con tu cuenta de Google.

### 2. ¿El sistema soporta archivos PNG o WebP?
Sí, tanto el backend de Node como el script en Python identifican y procesan de forma transparente archivos en formatos `JPG`, `JPEG`, `PNG` y `WEBP`.

### 3. ¿Cómo soluciono el bloqueo 403 al traducir desde una URL?
Algunos portales y CDNs de manga aplican protecciones rígidas de Cloudflare. Si encuentras un error 403:
1. Haz clic en la URL provista en el error para abrir la imagen en tu navegador.
2. Haz clic derecho sobre la imagen y selecciona **Guardar imagen como...**.
3. Arrastra la imagen descargada a la caja de carga de la aplicación web o especifica la ruta de tu archivo en el script de consola (`python translate_comic.py path/to/image.jpg ...`). ¡Esto evitará el proxy y funcionará inmediatamente!

---

## 📥 Integración con JDownloader (Click'n'Load & API Local)

Hemos integrado soporte nativo bidireccional con **JDownloader** para facilitar descargas en lote y flujos de automatización de cómics.

### 1. Endpoint de API: `/send-to-jdownloader`
* **Ruta:** `POST /send-to-jdownloader`
* **Descripción:** Actúa como puente local para reenviar enlaces de descarga directamente al Capturador de Enlaces de JDownloader. Al realizar la llamada desde el servidor, se evitan por completo las restricciones de CORS del navegador.
* **Cuerpo de Petición (JSON):**
  ```json
  {
    "url": "https://ejemplo.com/manga-capitulo-1.zip",
    "port": 9666
  }
  ```
* **Comportamiento:** Se conecta al puerto Click'n'Load de la instancia local activa de JDownloader (`http://127.0.0.1:9666/jd/add`) y añade automáticamente el enlace a la cola.

### 2. Panel en el Estudio Web
La barra lateral del frontend incluye una tarjeta dedicada para **JDownloader**:
* Al tener una URL de imagen cargada en la mesa de trabajo, el botón **"Enviar a JDownloader"** se habilitará automáticamente.
* Al presionarlo, el cliente web enviará la URL al endpoint backend, inyectando la descarga directamente en tu cliente JDownloader local sin interrumpir tu flujo de traducción.

---

## ⚡ Descargador Automático de Fuentes (`setup_jdownloader.py`)

Para facilitar el desarrollo del entorno del compilador de JDownloader, el proyecto incluye el script automático `setup_jdownloader.py`. 

### Requisitos Previos (Ya instalados en el sistema)
1. **Slik Subversion (SVN):** Se ha instalado en tu sistema mediante Microsoft Package Manager (`winget`):
   ```bash
   winget install Slik.Subversion --silent
   ```
2. **Path absoluto de SVN:** `C:\Program Files\SlikSvn\bin\svn.exe`

### Cómo ejecutar la descarga automatizada:
Simplemente abre tu terminal en `c:\comicpro` y ejecuta:
```bash
python setup_jdownloader.py
```
Este script se encargará de:
1. Comprobar la presencia del cliente SVN nativo de forma automática.
2. Crear un directorio local de trabajo llamado `jdownloader-source/`.
3. Descargar mediante **Subversion (SVN Checkout)** los 4 repositorios oficiales necesarios para compilar la suite de JDownloader de manera secuencial y mostrando una bitácora limpia:
   - `AppWorkUtils` ➔ `svn://svn.appwork.org/utils`
   - `browser` ➔ `svn://svn.jdownloader.org/jdownloader/browser`
   - `JDownloader` (Trunk principal) ➔ `svn://svn.jdownloader.org/jdownloader/trunk`
   - `MyJDownloaderClient` ➔ `svn://svn.jdownloader.org/jdownloader/MyJDownloaderClient`

---

## 🛠️ Guía Completa de Configuración de IDE (Eclipse & IntelliJ)

A continuación, se detalla el procedimiento paso a paso para configurar tu entorno de desarrollo local en base al estándar oficial de JDownloader:

### A. Preparación del Entorno JDK
1. **JDK Requerido:** Asegúrate de tener instalado Java JDK 8 o superior (El sistema actual cuenta con **OpenJDK 25.0.2** configurado listo para usar).
2. **Variables de Entorno:** Verifica que la variable `JAVA_HOME` apunte a la carpeta de instalación de tu JDK y que la subcarpeta `bin` esté presente en tu variable `PATH`.

---

### B. Configuración del IDE Eclipse

#### 1. Configuración del Workspace y del JDK
* Inicia Eclipse y selecciona la carpeta raíz `jdownloader-source` como tu **Workspace** de trabajo.
* Añade la JDK instalada en Eclipse:
  1. Ve a **Window ➔ Preferences**.
  2. Navega en el menú lateral a **Java ➔ Installed JREs**.
  3. Si la lista está vacía, haz clic en **Add ➔ Standard VM ➔ Next**.
  4. En el campo **Directory**, selecciona la ruta de instalación de tu JDK (ej: `C:\Program Files\Eclipse Adoptium\jdk-...` o similar) y presiona **Finish**.
  5. Asegúrate de marcar la casilla de la JDK agregada y haz clic en **Apply and Close**.

#### 2. Instalación de Subclipse (SVN en Eclipse)
Dado que JDownloader utiliza SVN para su control de versiones, se recomienda instalar el plugin Subclipse dentro de Eclipse:
1. Dirígete a **Help ➔ Eclipse Marketplace...**
2. En la barra de búsqueda escribe `Subclipse` y presiona **Enter**.
3. Haz clic en **Install** junto al paquete de *Subclipse por Subclipse Project*.
4. Acepta los términos de licencia y presiona **Finish**. Si Eclipse te muestra una advertencia de contenido sin firmar, selecciona "Trust Selected".
5. Reinicia Eclipse cuando se te solicite.

#### 3. Importación y Enlace de Proyectos
Si ya ejecutaste `python setup_jdownloader.py`, puedes importar directamente las carpetas en tu Workspace:
1. Haz clic en **File ➔ Import... ➔ General ➔ Existing Projects into Workspace ➔ Next**.
2. En **Select root directory**, selecciona la carpeta `jdownloader-source` generada en `c:\comicpro`.
3. Eclipse identificará de forma automática los 4 proyectos: `AppWorkUtils`, `browser`, `JDownloader` y `MyJDownloaderClient`. Asegúrate de que todos estén seleccionados.
4. Haz clic en **Finish**. Eclipse compilará el espacio de trabajo y enlazará las dependencias de forma interna.

#### 4. Importación del Formateador de Código AppWork
Para mantener la consistencia del código, importa la plantilla de formateo:
1. Ve a **Window ➔ Preferences ➔ Java ➔ Code Style ➔ Formatter**.
2. Haz clic en **Import...**
3. Navega a `[Workspace]/AppWorkUtils/ide/eclipse/eclipse_format_file.xml` y haz clic en **Open**.
4. Haz clic en **Apply and Close**.

#### 5. Ejecución y Parámetros VM (Evitar warnings en Java 9+)
Para ejecutar el cliente de JDownloader:
1. En el panel lateral *Package Explorer*, expande el proyecto **JDownloader** y navega a la ruta: `src/org/jdownloader/startup`.
2. Busca el archivo `Main.java`, haz clic derecho sobre él ➔ **Run As ➔ Run Configurations...**
3. Ve a la pestaña **Arguments** y copia las siguientes directivas dentro de la sección **VM Arguments** (necesarias a partir de Java 9 para permitir la reflexión en librerías Swing/AWT):
   ```text
   --add-exports=java.desktop/sun.swing=ALL-UNNAMED
   --add-exports=java.desktop/sun.swing.table=ALL-UNNAMED
   --add-exports=java.desktop/sun.swing.plaf.synth=ALL-UNNAMED
   --add-opens=java.desktop/javax.swing.plaf.synth=ALL-UNNAMED
   --add-opens=java.desktop/javax.swing.plaf.basic=ALL-UNNAMED
   --add-opens=java.desktop/javax.swing=ALL-UNNAMED
   --add-opens=java.desktop/javax.swing.tree=ALL-UNNAMED
   --add-opens=java.desktop/java.awt.event=ALL-UNNAMED
   --add-exports=java.desktop/sun.awt.shell=ALL-UNNAMED
   --add-exports=java.base/sun.security.action=ALL-UNNAMED
   --add-exports=java.desktop/com.sun.awt=ALL-UNNAMED
   ```
4. Presiona **Apply** y luego **Run**. JDownloader compilará e iniciará por primera vez.

---

### C. Configuración del IDE IntelliJ IDEA

Si prefieres programar en IntelliJ IDEA:
1. Inicia IntelliJ y haz clic en **Open**.
2. Selecciona la carpeta `jdownloader-source/JDownloader`. IntelliJ detectará la presencia del proyecto.
3. Importa los otros tres proyectos como módulos:
   - Ve a **File ➔ Project Structure ➔ Modules**.
   - Haz clic en el botón **+ ➔ Import Module** y selecciona sucesivamente las carpetas `AppWorkUtils`, `browser` y `MyJDownloaderClient`.
   - Asegúrate de seleccionar *"Import module from external model (Eclipse)"* para mantener las referencias de dependencias originales intactas.
4. Para la ejecución, haz clic derecho en `Main.java` ➔ **Modify Run Configuration** y agrega las mismas directivas `VM Options` listadas en el apartado de Eclipse.

---

### D. Resolución del Synthetica License Warning
Al compilar JDownloader por primera vez dentro de un entorno de desarrollo IDE, Swing mostrará un aviso de advertencia indicando que la licencia del tema visual *Synthetica* está ausente. 

#### Solución Rápida y Recomendada (Cambiar a FlatLaf):
Puedes indicarle a JDownloader que utilice el tema open-source moderno **FlatLaf** para eliminar la advertencia de licencia:
1. Dentro de JDownloader, ve a la pestaña **Ajustes (Settings) ➔ Opciones Avanzadas (Advanced Settings)**.
2. En la barra de búsqueda escribe: `GraphicalUserInterfaceSettings.lookandfeeltheme`
3. Cambia el valor en la columna "Valor" a: **`FLATLAF_LIGHT`** (o `FLATLAF_DARK` según tu preferencia).
4. Reinicia JDownloader desde el menú o el IDE. El tema se aplicará limpiamente y la ventana de advertencia de licencia no volverá a aparecer.

