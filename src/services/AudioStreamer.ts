/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class AudioStreamer {
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  
  // Analysers for visual effects
  public inputAnalyser: AnalyserNode | null = null;
  public outputAnalyser: AnalyserNode | null = null;
  
  // Audio playing sync
  private nextPlaybackTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private leftoverByte: number | null = null;

  constructor() {}

  /**
   * Initializes the input audio context, analyser, and user's microphone.
   * Chunks are sent via onAudioChunk callback as base64-encoded raw 16kHz PCM data.
   */
  public async startRecording(onAudioChunk: (base64PCM: string) => void): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API (getUserMedia) not supported in this environment.");
      }
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Initialize input AudioContext using hardware properties directly at 16kHz to avoid manual resampling
      this.inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 256;

      this.micSource = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      this.micSource.connect(this.inputAnalyser);

      // Create a ScriptProcessorNode to batch mic float arrays in buffer chunks of 2048 samples
      this.scriptNode = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);
      
      this.scriptNode.onaudioprocess = (event) => {
        try {
          const floatSamples = event.inputBuffer.getChannelData(0);
          
          // Clear the output stream completely to prevent voice loop echoing/howling
          const outputBuffer = event.outputBuffer.getChannelData(0);
          outputBuffer.fill(0);

          const pcmBuffer = this.floatTo16BitPCM(floatSamples);
          const base64PCM = this.arrayBufferToBase64(pcmBuffer);
          onAudioChunk(base64PCM);
        } catch (e) {
          console.error("Error in onaudioprocess callback:", e);
        }
      };

      this.micSource.connect(this.scriptNode);
      this.scriptNode.connect(this.inputAudioCtx.destination);

      if (this.inputAudioCtx.state === "suspended") {
        await this.inputAudioCtx.resume();
      }
    } catch (err) {
      console.error("AudioStreamer failed to initialize recording session:", err);
      throw err;
    }
  }

  /**
   * Stops microphone input capture, closes stream trackers.
   */
  public stopRecording(): void {
    if (this.scriptNode) {
      try {
        this.scriptNode.disconnect();
      } catch (e) {}
      this.scriptNode.onaudioprocess = null;
      this.scriptNode = null;
    }

    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (e) {}
      this.micSource = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch (e) {}
      this.inputAudioCtx = null;
    }

    this.inputAnalyser = null;
  }

  /**
   * Prepares the output audio context for receiving 24kHz streams from the live server.
   */
  public startPlayback(): void {
    if (!this.outputAudioCtx) {
      try {
        this.outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn("Failed to initialize output AudioContext:", e);
      }
      if (this.outputAudioCtx) {
        this.outputAnalyser = this.outputAudioCtx.createAnalyser();
        this.outputAnalyser.fftSize = 256;
        this.nextPlaybackTime = this.outputAudioCtx.currentTime;
      }
    }

    if (this.outputAudioCtx && this.outputAudioCtx.state === "suspended") {
      this.outputAudioCtx.resume();
    }
  }

  /**
   * Decodes, schedules, and queues 24kHz PCM chunk for gapless, zero-latency playback.
   */
  public playAudioChunk(base64PCM: string): void {
    if (!this.outputAudioCtx || !this.outputAnalyser) {
      this.startPlayback();
    }

    if (!this.outputAudioCtx || !this.outputAnalyser) {
      console.warn("AudioContext playback is unavailable in this environment.");
      return;
    }

    const ctx = this.outputAudioCtx;
    const analyser = this.outputAnalyser;

    try {
      const binary = window.atob(base64PCM);
      let len = binary.length;
      
      const hasLeftover = this.leftoverByte !== null;
      const totalBytes = len + (hasLeftover ? 1 : 0);
      const numSamples = Math.floor(totalBytes / 2);
      
      const float32 = new Float32Array(numSamples);
      const dataView = new DataView(new ArrayBuffer(totalBytes));
      
      let writeOffset = 0;
      if (hasLeftover) {
        dataView.setUint8(0, this.leftoverByte!);
        writeOffset = 1;
        this.leftoverByte = null;
      }
      
      for (let i = 0; i < len; i++) {
        dataView.setUint8(writeOffset + i, binary.charCodeAt(i));
      }
      
      if (totalBytes % 2 !== 0) {
        this.leftoverByte = dataView.getUint8(totalBytes - 1);
      }
      
      for (let i = 0; i < numSamples; i++) {
        const val = dataView.getInt16(i * 2, true); // Little endian
        float32[i] = val / 32768.0;
      }

      // Web Audio API natively handles resampling, so we use 24000Hz directly
      const audioBuffer = ctx.createBuffer(1, numSamples, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Connect source to analyser and output to client speaker
      source.connect(analyser);
      analyser.connect(ctx.destination);

      const now = ctx.currentTime;
      // If we fall behind (buffer underflow), push start time slightly forward to create a jitter buffer
      // This prevents constant stuttering and crackling when chunks arrive just-in-time
      if (this.nextPlaybackTime < now) {
        this.nextPlaybackTime = now + 0.2; // 200ms jitter buffer
      }

      source.start(this.nextPlaybackTime);
      this.nextPlaybackTime += audioBuffer.duration;
      
      this.activeSources.push(source);
      
      // Clean up finished sources from tracker array
      source.onended = () => {
        try {
          this.activeSources = this.activeSources.filter((s) => s !== source);
        } catch (e) {
          console.error("Error in onended handler:", e);
        }
      };
    } catch (err) {
      console.error("AudioStreamer failed to play incoming sound segment:", err);
    }
  }

  public getTimeUntilPlaybackEnds(): number {
    if (!this.outputAudioCtx) return 0;
    return Math.max(0, this.nextPlaybackTime - this.outputAudioCtx.currentTime);
  }

  /**
   * Stops current voice playback and flushes scheduled audio segments instantly.
   */
  public stopPlayback(): void {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
      } catch (e) {}
    });
    this.activeSources = [];
    this.leftoverByte = null;
    if (this.outputAudioCtx) {
      this.nextPlaybackTime = this.outputAudioCtx.currentTime;
    }
  }

  /**
   * Complete teardown of audio context pipelines.
   */
  public destroy(): void {
    this.stopRecording();
    this.stopPlayback();
    
    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch (e) {}
      this.outputAudioCtx = null;
    }
    
    this.outputAnalyser = null;
  }

  /**
   * Helper to fetch real-time input voice amplitude.
   */
  public getInputVolume(): number {
    if (!this.inputAnalyser) return 0;
    const dataArray = new Uint8Array(this.inputAnalyser.frequencyBinCount);
    this.inputAnalyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return Math.round(sum / dataArray.length);
  }

  /**
   * Helper to fetch real-time output (Divi's speaking) voice amplitude.
   */
  public getOutputVolume(): number {
    if (!this.outputAnalyser) return 0;
    const dataArray = new Uint8Array(this.outputAnalyser.frequencyBinCount);
    this.outputAnalyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return Math.round(sum / dataArray.length);
  }

  /**
   * Direct conversion from browser Float32 audio format to 16-bit linear PCM format.
   */
  private floatTo16BitPCM(floatSamples: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(floatSamples.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < floatSamples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, floatSamples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  /**
   * Base64 array buffer conversion.
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Resamples raw buffer with linear interpolation between source and target sample rates.
   */
  private resample(sourceBuffer: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
    if (fromSampleRate === toSampleRate) {
      return sourceBuffer;
    }
    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.round(sourceBuffer.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const pos = i * ratio;
      const index = Math.floor(pos);
      const frac = pos - index;
      const nextIndex = index + 1 < sourceBuffer.length ? index + 1 : index;
      result[i] = sourceBuffer[index] * (1 - frac) + sourceBuffer[nextIndex] * frac;
    }
    return result;
  }
}
