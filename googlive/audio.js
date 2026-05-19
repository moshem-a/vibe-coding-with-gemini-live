// audio.js — helpers for 16k input capture and 24k output playback
// Exposes window.GLAudio.*

(function () {
  const TARGET_IN = 16000;
  const TARGET_OUT = 24000;

  // ─────────── Float32 → PCM16 little-endian ───────────
  function floatToPCM16(f32) {
    const buf = new ArrayBuffer(f32.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < f32.length; i++) {
      let s = Math.max(-1, Math.min(1, f32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buf;
  }

  function pcm16ToFloat(pcm) {
    const view = new DataView(pcm);
    const out = new Float32Array(pcm.byteLength / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = view.getInt16(i * 2, true) / 0x8000;
    }
    return out;
  }

  function downsample(f32, from, to) {
    if (from === to) return f32;
    const ratio = from / to;
    const len = Math.floor(f32.length / ratio);
    const out = new Float32Array(len);
    let pos = 0;
    for (let i = 0; i < len; i++) {
      const start = Math.floor(pos);
      const end = Math.floor(pos + ratio);
      let sum = 0, n = 0;
      for (let j = start; j < end && j < f32.length; j++) { sum += f32[j]; n++; }
      out[i] = n > 0 ? sum / n : 0;
      pos += ratio;
    }
    return out;
  }

  function b64encode(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function b64decode(s) {
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  // ─────────── Mic capture ───────────
  class MicCapture extends EventTarget {
    constructor() { super(); this.ctx = null; this.node = null; this.stream = null; this.muted = false; this.level = 0; }
    async start() {
      if (this.ctx) return;
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
      });
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      await this.ctx.audioWorklet.addModule("audio-worklet.js");
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.node = new AudioWorkletNode(this.ctx, "capture-processor");
      this.node.port.onmessage = (e) => {
        if (this.muted) return;
        const { pcm, sampleRate } = e.data;
        // RMS for level meter
        let sum = 0;
        for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
        this.level = Math.sqrt(sum / pcm.length);
        const ds = downsample(pcm, sampleRate, TARGET_IN);
        const pcm16 = floatToPCM16(ds);
        this.dispatchEvent(new CustomEvent("chunk", { detail: { buffer: pcm16, b64: b64encode(pcm16) } }));
      };
      src.connect(this.node);
      // Note: do NOT connect node to destination — we don't want echo.
    }
    mute(v) { this.muted = !!v; if (v) this.level = 0; }
    stop() {
      try { this.node?.disconnect(); } catch {}
      try { this.stream?.getTracks().forEach(t => t.stop()); } catch {}
      try { this.ctx?.close(); } catch {}
      this.ctx = null; this.node = null; this.stream = null;
    }
  }

  // ─────────── Playback queue (24k PCM16 LE) ───────────
  class AudioPlayer extends EventTarget {
    constructor() {
      super();
      this.ctx = null;
      this.nextTime = 0;
      this.playing = false;
      this.gain = null;
      this.analyser = null;
      this.activeSources = new Set();
    }
    _ensure() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: TARGET_OUT });
        this.gain = this.ctx.createGain();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.gain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    }
    enqueue(pcmArrayBuffer) {
      this._ensure();
      const f32 = pcm16ToFloat(pcmArrayBuffer);
      const buf = this.ctx.createBuffer(1, f32.length, TARGET_OUT);
      buf.getChannelData(0).set(f32);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.gain);
      const now = this.ctx.currentTime;
      const startAt = Math.max(now, this.nextTime);
      src.start(startAt);
      this.nextTime = startAt + buf.duration;
      this.activeSources.add(src);
      src.onended = () => {
        this.activeSources.delete(src);
        if (this.activeSources.size === 0) this.dispatchEvent(new Event("idle"));
      };
      this.playing = true;
    }
    stop() {
      // interrupt: stop all sources
      for (const s of this.activeSources) { try { s.stop(); } catch {} }
      this.activeSources.clear();
      this.nextTime = this.ctx ? this.ctx.currentTime : 0;
      this.dispatchEvent(new Event("interrupted"));
    }
    getLevel() {
      if (!this.analyser) return 0;
      const arr = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteTimeDomainData(arr);
      let sum = 0;
      for (let i = 0; i < arr.length; i++) {
        const v = (arr[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / arr.length);
    }
  }

  window.GLAudio = { MicCapture, AudioPlayer, floatToPCM16, pcm16ToFloat, b64encode, b64decode };
})();
