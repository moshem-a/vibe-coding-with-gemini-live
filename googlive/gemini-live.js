// gemini-live.js — minimal Gemini Live WebSocket client
// Exposes window.GeminiLive
(function () {
  const WS_URL_BASE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

  function b64decode(s) {
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  class GeminiLiveSession extends EventTarget {
    constructor(opts) {
      super();
      this.opts = opts; // { apiKey, model, systemInstruction, voice, tools, responseModalities, inputTranscription, outputTranscription }
      this.ws = null;
      this.connected = false;
    }

    connect() {
      return new Promise((resolve, reject) => {
        const url = WS_URL_BASE + "?key=" + encodeURIComponent(this.opts.apiKey);
        const ws = new WebSocket(url);
        ws.binaryType = "arraybuffer";
        this.ws = ws;

        const setupMsg = {
          setup: {
            model: this.opts.model || "models/gemini-3.1-flash-live-preview",
            generationConfig: {
              responseModalities: this.opts.responseModalities || ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: this.opts.voice || "Aoede" } },
                ...(this.opts.languageCode ? { languageCode: this.opts.languageCode } : {})
              }
            },
            ...(this.opts.systemInstruction
              ? { systemInstruction: { parts: [{ text: this.opts.systemInstruction }] } }
              : {}),
            ...(this.opts.tools ? { tools: this.opts.tools } : {}),
            inputAudioTranscription: this.opts.inputTranscription === false ? undefined : {},
            outputAudioTranscription: this.opts.outputTranscription === false ? undefined : {}
          }
        };

        ws.onopen = () => { ws.send(JSON.stringify(setupMsg)); };
        ws.onerror = (e) => {
          this.dispatchEvent(new CustomEvent("error", { detail: e }));
          if (!this.connected) reject(new Error("WebSocket error"));
        };
        ws.onclose = (e) => {
          this.connected = false;
          this.dispatchEvent(new CustomEvent("close", { detail: { code: e.code, reason: e.reason } }));
        };
        ws.onmessage = async (e) => {
          let txt;
          if (typeof e.data === "string") txt = e.data;
          else if (e.data instanceof ArrayBuffer) txt = new TextDecoder().decode(new Uint8Array(e.data));
          else if (e.data instanceof Blob) txt = await e.data.text();
          else return;
          let msg;
          try { msg = JSON.parse(txt); } catch { return; }

          if (msg.setupComplete) {
            this.connected = true;
            this.dispatchEvent(new Event("ready"));
            resolve();
            return;
          }
          this._handleServer(msg);
        };
      });
    }

    _handleServer(msg) {
      const sc = msg.serverContent;
      if (sc) {
        // Input transcription (user mic)
        if (sc.inputTranscription?.text) {
          this.dispatchEvent(new CustomEvent("inputTranscript", {
            detail: { text: sc.inputTranscription.text, finished: !!sc.inputTranscription.finished }
          }));
        }
        // Output transcription (Gemini speech transcribed)
        if (sc.outputTranscription?.text) {
          this.dispatchEvent(new CustomEvent("outputTranscript", {
            detail: { text: sc.outputTranscription.text, finished: !!sc.outputTranscription.finished }
          }));
        }
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.text) {
              this.dispatchEvent(new CustomEvent("text", { detail: { text: part.text } }));
            }
            if (part.inlineData?.data) {
              const buf = b64decode(part.inlineData.data);
              this.dispatchEvent(new CustomEvent("audio", { detail: { buffer: buf, mimeType: part.inlineData.mimeType } }));
            }
            if (part.functionCall) {
              this.dispatchEvent(new CustomEvent("functionCall", { detail: part.functionCall }));
            }
          }
        }
        if (sc.interrupted) this.dispatchEvent(new Event("interrupted"));
        if (sc.turnComplete) this.dispatchEvent(new Event("turnComplete"));
        if (sc.generationComplete) this.dispatchEvent(new Event("generationComplete"));
      }
      if (msg.toolCall) {
        this.dispatchEvent(new CustomEvent("toolCall", { detail: msg.toolCall }));
      }
      if (msg.goAway) {
        this.dispatchEvent(new CustomEvent("goAway", { detail: msg.goAway }));
      }
    }

    sendAudio(b64Pcm16k) {
      if (!this.connected) return;
      this.ws.send(JSON.stringify({
        realtimeInput: { audio: { data: b64Pcm16k, mimeType: "audio/pcm;rate=16000" } }
      }));
    }

    sendImage(b64Jpeg, mimeType = "image/jpeg") {
      if (!this.connected) return;
      this.ws.send(JSON.stringify({
        realtimeInput: { video: { data: b64Jpeg, mimeType } }
      }));
    }

    sendText(text, turnComplete = true) {
      if (!this.connected) return;
      this.ws.send(JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [{ text }] }],
          turnComplete
        }
      }));
    }

    sendToolResponse(functionResponses) {
      if (!this.connected) return;
      this.ws.send(JSON.stringify({
        toolResponse: { functionResponses }
      }));
    }

    close() {
      try { this.ws?.close(); } catch {}
      this.ws = null; this.connected = false;
    }
  }

  window.GeminiLive = { Session: GeminiLiveSession };
})();
