const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

let fetchFn;

// Try to get fetch from global or fallback to node-fetch
async function initializeFetch() {
  try {
    if (global.fetch) {
      fetchFn = global.fetch;
    } else {
      // For older Node versions that don't have native fetch
      try {
        const nodeFetch = require("node-fetch");
        fetchFn = nodeFetch;
      } catch {
        console.error("node-fetch not available, trying dynamic import...");
        const { default: fetch } = await import("node-fetch");
        fetchFn = fetch;
      }
    }
    console.log("Fetch function initialized");
    startServer();
  } catch (error) {
    console.error("Failed to initialize fetch:", error);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

function startServer() {
  console.log("Starting server setup...");
  
  app.use(cors());
  console.log("CORS initialized");
  
  app.use(express.json({ limit: "1mb" }));
  console.log("JSON middleware initialized");
  
  app.use(express.static(path.join(__dirname)));
  console.log("Static middleware initialized");

  // Test endpoint
  app.get("/test", (req, res) => {
    console.log("Test endpoint called");
    res.json({ status: "ok" });
  });

  app.post("/tts", async (req, res) => {
    console.log("TTS request received");

    if (!ELEVENLABS_API_KEY) {
      res.status(500).json({
        error: "Missing ELEVENLABS_API_KEY. Add it to .env and restart the server."
      });
      return;
    }

    const text = req.body?.text?.trim();

    if (!text) {
      res.status(400).json({ error: "Please provide text to synthesize." });
      return;
    }

    try {
      console.log("Calling ElevenLabs API...");
      const response = await fetchFn(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text,
            model_id: ELEVENLABS_MODEL_ID
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        res.status(response.status).json({
          error: "ElevenLabs API request failed.",
          details: errorText.slice(0, 300)
        });
        return;
      }

      const audioBuffer = await response.arrayBuffer();
      res.set("Content-Type", "audio/mpeg");
      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ error: "Unexpected error generating speech." });
    }
  });

  const server = app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Set a different PORT in .env and restart.`);
      return;
    }

    if (error.code === "EPERM" || error.code === "EACCES") {
      console.error(`Unable to listen on http://${HOST}:${PORT}. Try a different HOST/PORT in .env.`);
      return;
    }

    console.error("Server failed to start:", error);
  });
}

// Initialize fetch and start server
initializeFetch();
