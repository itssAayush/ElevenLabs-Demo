const textEl = document.getElementById("text");
const player = document.getElementById("audioPlayer");
const generateButton = document.getElementById("generateBtn");
const playButton = document.getElementById("playBtn");
const statusEl = document.getElementById("status");
let preparedSpeech = null;

function resetAudioPlayer() {
  player.pause();
  player.removeAttribute("src");
  player.load();
}

function clearPreparedSpeech() {
  stopBrowserSpeech();
  resetAudioPlayer();

  if (preparedSpeech?.audioUrl) {
    URL.revokeObjectURL(preparedSpeech.audioUrl);
  }

  preparedSpeech = null;
  playButton.disabled = true;
}

function stopBrowserSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speakWithBrowser(text) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    throw new Error("Browser speech fallback is not available in this browser.");
  }

  stopBrowserSpeech();

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("Browser speech fallback failed."));

    window.speechSynthesis.speak(utterance);
  });
}

async function generateSpeech() {
  const text = textEl.value.trim();

  if (!text) {
    statusEl.textContent = "Please enter text first.";
    return;
  }

  clearPreparedSpeech();
  generateButton.disabled = true;
  statusEl.textContent = "Generating...";

  try {
    const response = await fetch("/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      let message = "Failed to generate speech.";
      try {
        const payload = await response.json();
        if (payload?.error) {
          message = payload.error;
        }
        if (payload?.details) {
          try {
            const parsedDetails = JSON.parse(payload.details);
            const apiMessage =
              parsedDetails?.detail?.message ||
              parsedDetails?.detail?.status;
            if (apiMessage) {
              message = `${message} ${apiMessage}`;
            }
          } catch {
            message = `${message} ${payload.details}`;
          }
        }
      } catch {
        // Keep fallback message if non-JSON response.
      }
      throw new Error(message);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    preparedSpeech = {
      type: "audio",
      text,
      audioUrl
    };
    player.src = audioUrl;
    playButton.disabled = false;
    statusEl.textContent = "Speech is ready. Click Play Speech or use the audio controls.";
  } catch (error) {
    preparedSpeech = {
      type: "browser",
      text
    };
    playButton.disabled = false;
    statusEl.textContent = `${error.message} Click Play Speech to use browser voice fallback.`;
  } finally {
    generateButton.disabled = false;
  }
}

async function playGeneratedSpeech() {
  if (!preparedSpeech) {
    statusEl.textContent = "Generate speech first.";
    return;
  }

  playButton.disabled = true;

  try {
    if (preparedSpeech.type === "audio") {
      stopBrowserSpeech();
      player.currentTime = 0;
      await player.play();
      statusEl.textContent = "Playing ElevenLabs audio.";
    } else {
      resetAudioPlayer();
      statusEl.textContent = "Playing browser voice fallback.";
      await speakWithBrowser(preparedSpeech.text);
      statusEl.textContent = "Browser voice playback finished.";
    }
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    playButton.disabled = false;
  }
}

window.generateSpeech = generateSpeech;
window.playGeneratedSpeech = playGeneratedSpeech;
