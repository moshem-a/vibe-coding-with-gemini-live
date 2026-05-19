// audio-worklet.js — captures mic audio at the AudioContext rate and emits Float32 frames
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = [];
    this._target = 2048;
  }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch || ch.length === 0) return true;
    this._buf.push(new Float32Array(ch));
    let total = this._buf.reduce((s, b) => s + b.length, 0);
    if (total >= this._target) {
      const out = new Float32Array(total);
      let off = 0;
      for (const b of this._buf) { out.set(b, off); off += b.length; }
      this._buf.length = 0;
      this.port.postMessage({ pcm: out, sampleRate: sampleRate }, [out.buffer]);
    }
    return true;
  }
}
registerProcessor("capture-processor", CaptureProcessor);
