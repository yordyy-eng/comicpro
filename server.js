const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for local file uploads
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint to bypass CORS when fetching external images
app.get('/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*'
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).json({ error: 'El servidor de la imagen (Cloudflare/CDN) bloqueó la descarga automática (Error 403). Te recomendamos descargar la imagen a tu computadora y subirla manualmente.' });
      }
      return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
    }

    const contentType = response.headers.get('content-type');
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (error) {
    console.error('Error in proxy-image:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

// Translation endpoint connecting to Gemini
app.post('/translate', upload.single('image'), async (req, res) => {
  let { imageUrl, apiKey, model } = req.body;
  let base64Data = '';
  let mimeType = 'image/jpeg';

  // Fallback to environment variable key if not provided by client
  const geminiKey = apiKey || process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(400).json({ error: 'Gemini API Key is required. Please set it in settings or .env file.' });
  }

  try {
    // 1. Get the image data
    if (req.file) {
      // Local upload
      base64Data = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype;
    } else if (imageUrl) {
      // External URL
      console.log('Fetching external image to convert to Base64:', imageUrl);
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).json({ error: 'El servidor de la imagen (Cloudflare/CDN) bloqueó la descarga automática (Error 403). Te recomendamos hacer clic derecho en la imagen original, guardarla en tu computadora y subirla arrastrándola aquí. ¡Funcionará de inmediato!' });
      }
      return res.status(400).json({ error: `Failed to fetch image from URL: ${response.statusText}` });
    }
      
      mimeType = response.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await response.arrayBuffer());
      base64Data = buffer.toString('base64');
    } else {
      return res.status(400).json({ error: 'No image source provided (file or URL required)' });
    }

    // 2. Prepare Gemini Prompt
    const prompt = `Identify all English text bubbles/boxes on this comic or manga page. For each detected text box, perform the following:
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
}`;

    const geminiModel = model || 'gemini-2.0-flash';
    console.log(`Calling Gemini API using model: ${geminiModel}`);

    // 3. Request Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API returned error:', errText);
      return res.status(response.status).json({ error: `Gemini API Error: ${errText}` });
    }

    const data = await response.json();
    console.log('Gemini API response raw:', JSON.stringify(data).substring(0, 500));

    // 4. Parse the output JSON
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
      return res.status(500).json({ error: 'Empty response received from Gemini model' });
    }

    let parsedData;
    try {
      parsedData = JSON.parse(textResult);
    } catch (e) {
      console.error('Failed to parse JSON from Gemini:', textResult);
      return res.status(500).json({ 
        error: 'Gemini did not return valid JSON format.', 
        rawText: textResult 
      });
    }

    res.json(parsedData);
  } catch (error) {
    console.error('Server error during translation:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

// JDownloader Integration Endpoint
// Accepts: { url: string } OR { urls: string[] }, plus optional { port: number }
app.post('/send-to-jdownloader', async (req, res) => {
  const { url, urls, port } = req.body;

  // Build a flat list of URLs from either param
  const urlList = [];
  if (urls && Array.isArray(urls)) urlList.push(...urls.filter(Boolean));
  if (url) urlList.push(url);

  if (urlList.length === 0) {
    return res.status(400).json({ error: 'At least one URL is required' });
  }

  const jdPort = port || 9666;
  // Click'n'Load v1: newline-separated URLs
  const encoded = encodeURIComponent(urlList.join('\n'));
  const jdUrl = `http://127.0.0.1:${jdPort}/jd/add?urls=${encoded}`;

  console.log(`Forwarding ${urlList.length} URL(s) to JDownloader on port ${jdPort}`);

  try {
    const jdResponse = await fetch(jdUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    res.json({ success: true, count: urlList.length, status: jdResponse.status });
  } catch (error) {
    console.error('Error communicating with JDownloader:', error);
    res.status(502).json({ error: `Could not connect to JDownloader on port ${jdPort}. Is JDownloader open with Click'n'Load enabled?` });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`ComicPro Translator Studio listening at http://localhost:${PORT}`);
});
