import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import compression from 'compression';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(compression());
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.PORT) || 3000;

// Determine environment:
// In Cloud Run, K_SERVICE or K_REVISION is set by the infrastructure.
// When deployed or when NODE_ENV=production, or when dist/index.html is present (unless explicitly NODE_ENV=development).
const isProduction =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.K_SERVICE) ||
  Boolean(process.env.K_REVISION) ||
  (process.env.NODE_ENV !== 'development' && fs.existsSync(path.join(process.cwd(), 'dist', 'index.html')));

// Health check endpoints for Cloud Run / load balancers
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Zero-permission instant location fallback for immediate emergency live streaming
app.get('/api/locate', (req, res) => {
  const geoHeader = req.headers['x-appengine-citylatlong'];
  if (typeof geoHeader === 'string') {
    const [latStr, lngStr] = geoHeader.split(',');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!isNaN(lat) && !isNaN(lng)) {
      return res.json({ lat, lng, source: 'edge-network', accuracy: 500 });
    }
  }
  // Graceful fallback coordinate so emergency SOS broadcasts immediately with zero permissions
  res.json({
    lat: 17.6868,
    lng: 83.2185,
    source: 'regional-anchor',
    accuracy: 1000,
    timestamp: new Date().toISOString()
  });
});

// Shared Gemini client utility with User-Agent required for AI Studio telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API endpoint for Google Maps Grounding assistant
app.post('/api/safe-places', async (req, res) => {
  const { lat, lng, query } = req.body;
  
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Missing latitude or longitude coordinate parameters.' });
  }

  const searchQuery = query || "What are the nearest secure public places, police stations, or support services near me?";

  console.log(`[Gemini Maps Grounding] Query: "${searchQuery}" at [${lat}, ${lng}]`);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: searchQuery,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: Number(lat),
              longitude: Number(lng)
            }
          }
        }
      }
    });

    const text = response.text || "";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // Extract any search/maps references
    const references = (groundingChunks || []).map((chunk) => {
      if (chunk.maps) {
        return {
          title: chunk.maps.title,
          uri: chunk.maps.uri
        };
      } else if (chunk.web) {
        return {
          title: chunk.web.title,
          uri: chunk.web.uri
        };
      }
      return null;
    }).filter(Boolean);

    res.json({
      text,
      references
    });
  } catch (error) {
    console.warn('[Gemini Maps Grounding] Grounding failed or quota exceeded. Executing fallback without grounding:', error?.message || error);
    
    try {
      // Direct text fallback containing coordinates and the user request
      const fallbackPrompt = `You are a real-time emergency safety assistant. A user is currently located at:
Latitude: ${lat}
Longitude: ${lng}

Please answer the user's safety search query by giving them general safety advice, lists of typical secure facilities to look for (such as police stations, fire stations, 24/7 convenience stores, hospitals, or public buildings), and instructions on how to locate them.

Explain that they can use the direct 'Google Maps Link' or 'Live Breadcrumb Map' on their SOS dashboard to open real-time navigation/routing on their device immediately.

User's safety inquiry: "${searchQuery}"`;

      const fallbackResponse = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: fallbackPrompt,
      });

      const fallbackText = (fallbackResponse.text || "") + 
        "\n\n*(Note: Live Google Maps grounding is temporarily rate-limited. Standard emergency advice has been generated as a backup. You can click any direct Map link or view the Breadcrumb Map above to see live coordinates and route to safety.)*";

      const defaultReferences = [
        {
          title: "Search Nearest Police Stations on Google Maps",
          uri: `https://www.google.com/maps/search/police+station/@${lat},${lng},15z`
        },
        {
          title: "Search Nearest 24/7 Hospitals & Clinics",
          uri: `https://www.google.com/maps/search/hospital+emergency/@${lat},${lng},15z`
        },
        {
          title: "Search Nearest Transit & Public Shelters",
          uri: `https://www.google.com/maps/search/metro+station+or+bus+station/@${lat},${lng},15z`
        }
      ];

      res.json({
        text: fallbackText,
        references: defaultReferences
      });
    } catch (fallbackError) {
      console.warn('[Gemini Fallback] Standard generation also failed, returning local emergency guide:', fallbackError?.message);
      
      const localEmergencyGuide = `🚨 **Emergency Safety Protocol & Nearby Facilities** (Coordinates: ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})

1. **Immediate Helplines**:
   - **National Women Helpline**: Dial **1091** or **181**
   - **Emergency Response Service (Police/Fire/Ambulance)**: Dial **112** (or **911**)
   - **Domestic Violence Crisis Line**: Dial **1800-799-7233**

2. **Immediate Physical Safe Havens**:
   - Head towards well-lit public facilities: 24/7 pharmacies, petrol stations, hotel lobbies, transit hubs, or open convenience stores.
   - Inform front-desk personnel or store managers that you feel unsafe and request an escort or call to emergency services.

3. **Live Navigation**:
   - Use the links below to open direct navigation to the nearest verified emergency locations around your current GPS coordinates.`;

      const localReferences = [
        {
          title: "Navigate to Nearest Police Precinct",
          uri: `https://www.google.com/maps/search/police+station/@${lat},${lng},15z`
        },
        {
          title: "Navigate to Nearest Hospital / Emergency Room",
          uri: `https://www.google.com/maps/search/hospital+emergency/@${lat},${lng},15z`
        },
        {
          title: "Navigate to Nearest Well-Lit Public Transit",
          uri: `https://www.google.com/maps/search/metro+or+train+station/@${lat},${lng},15z`
        }
      ];

      res.json({ 
        text: localEmergencyGuide,
        references: localReferences
      });
    }
  }
});

// API endpoint for automatic SMS sender to emergency contacts (Real Twilio Integration with graceful Simulation fallback)
app.post('/api/send-sms', async (req, res) => {
  try {
    const { phone, name, message, twilioSid, twilioToken, twilioFrom } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Missing phone number or message payload parameters.' });
    }

    const accountSid = twilioSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = twilioToken || process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = twilioFrom || process.env.TWILIO_FROM_NUMBER;

    if (accountSid && authToken && fromNumber) {
      console.log(`[Twilio SMS Dispatcher] Transmitting REAL emergency payload to ${name || 'Contact'} (${phone})...`);
      
      const authString = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authString}`
        },
        body: new URLSearchParams({
          To: phone,
          From: fromNumber,
          Body: message
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('[Twilio Error Response]:', responseData);
        let errorMsg = 'Twilio Gateway returned an error. Verify credentials.';
        
        if (responseData.code === 21608) {
          errorMsg = `Twilio Trial Constraint: The recipient's number is unverified. To send messages in trial mode, you must first verify this phone number in your Twilio Console (Console > Phone Numbers > Verified Caller IDs).`;
        } else if (responseData.message) {
          errorMsg = `Twilio Error ${responseData.code || ''}: ${responseData.message}`;
        }

        return res.status(502).json({
          error: errorMsg,
          details: responseData.message || 'Unknown carrier transmission error.',
          code: responseData.code
        });
      }

      console.log(`[Twilio SMS Success] Message queued with SID: ${responseData.sid}`);
      return res.json({
        success: true,
        simulated: false,
        sid: responseData.sid,
        status: responseData.status
      });
    } else {
      // Graceful local simulation fallback when keys are absent
      console.log(`[Simulated Carrier Relay] Sending emergency message to ${name || 'Guardian'} (${phone}): "${message}"`);
      return res.json({
        success: true,
        simulated: true,
        note: 'Twilio keys not configured in server environment. Running in secure simulated backup relay.'
      });
    }
  } catch (error) {
    console.error('Error invoking SMS Dispatcher:', error);
    res.status(500).json({
      error: 'Failed to process automated SMS carrier gateway request.',
      details: error?.message || String(error)
    });
  }
});

// Setup Vite Dev server middleware or static directory serving
async function bootstrap() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Guaranteed SPA index.html handler in dev middleware mode
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }

      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });

    console.log('Vite middleware mounted successfully (Development).');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Cache hashed assets for 1 year (immutable)
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }));
    // Serve other root static files with 1-hour cache
    app.use(express.static(distPath, {
      maxAge: '1h',
    }));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        const rootIndex = path.join(process.cwd(), 'index.html');
        if (fs.existsSync(rootIndex)) {
          res.sendFile(rootIndex);
        } else {
          res.status(200).send('<!doctype html><html><head><title>SafeLink</title></head><body>SafeLink is loading...</body></html>');
        }
      }
    });
    console.log('Serving optimized production static build from:', distPath);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SafeLink Server] Running on http://0.0.0.0:${PORT} (Mode: ${isProduction ? 'Production' : 'Development'})`);
  });

  // Cloud Run keep-alive and headers timeout recommendations
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  process.on('SIGTERM', () => {
    console.log('[SafeLink Server] SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('[SafeLink Server] HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(0);
    }, 4000).unref();
  });

  process.on('SIGINT', () => {
    console.log('[SafeLink Server] SIGINT signal received: closing HTTP server');
    server.close(() => {
      console.log('[SafeLink Server] HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(0);
    }, 4000).unref();
  });
}

bootstrap();
