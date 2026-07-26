import type { BuyerRequirement } from "./domain";

export type SamvaadRole = "buyer" | "supplier";
export type SamvaadStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "ended";

export type SamvaadInit = {
  role: SamvaadRole;
  language: string;
  requirement?: BuyerRequirement | null;
  supplierName?: string;
};

type Callbacks = {
  onStatus(status: SamvaadStatus): void;
  onTranscript(message: { role: string; content: string }): void;
  onAgentText(text: string): void;
  onEvent(event: string): void;
  onError(message: string): void;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function downsamplePcm16(
  input: Float32Array,
  inputRate: number,
  outputRate = 16_000,
): Uint8Array {
  const ratio = inputRate / outputRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const bytes = new Uint8Array(outputLength * 2);
  const view = new DataView(bytes.buffer);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(input.length, Math.floor((outputIndex + 1) * ratio));
    let total = 0;
    for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
      total += input[inputIndex];
    }
    const sample = Math.max(-1, Math.min(1, total / Math.max(1, end - start)));
    view.setInt16(
      outputIndex * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }
  return bytes;
}

export class SamvaadBrowserSession {
  private socket: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private playbackSources = new Set<AudioBufferSourceNode>();
  private nextPlaybackTime = 0;
  private stopped = false;

  constructor(
    private readonly init: SamvaadInit,
    private readonly callbacks: Callbacks,
  ) {}

  async start(): Promise<void> {
    this.callbacks.onStatus("connecting");
    const sessionResponse = await fetch("/api/agent/session", { method: "POST" });
    if (!sessionResponse.ok) {
      const body = (await sessionResponse.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error || "Could not create a Samvaad session.");
    }
    const session = (await sessionResponse.json()) as {
      gatewayUrl: string;
      token: string;
    };
    const url = new URL(session.gatewayUrl);
    url.searchParams.set("token", session.token);

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;
      const timeout = window.setTimeout(
        () => reject(new Error("Samvaad gateway connection timed out.")),
        12_000,
      );

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "init", ...this.init }));
      };
      socket.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Could not connect to the Samvaad gateway."));
      };
      socket.onclose = () => {
        this.cleanupAudio();
        this.callbacks.onStatus("ended");
      };
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data as string) as Record<string, unknown>;
        if (message.type === "ready") {
          window.clearTimeout(timeout);
          resolve();
          return;
        }
        this.handleMessage(message);
      };
    });

    if (this.stopped) return;
    await this.startMicrophone();
    this.callbacks.onStatus("listening");
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.cleanupAudio();
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "stop" }));
      this.socket.close(1000, "Session ended by user.");
    }
    this.socket = null;
    this.callbacks.onStatus("ended");
  }

  sendText(text: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "text", data: text }));
    }
  }

  private async startMicrophone(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.audioContext = new AudioContext();
    await this.audioContext.resume();
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.silentGain = this.audioContext.createGain();
    this.silentGain.gain.value = 0;

    this.processor.onaudioprocess = (event) => {
      if (this.socket?.readyState !== WebSocket.OPEN) return;
      const pcm = downsamplePcm16(
        event.inputBuffer.getChannelData(0),
        event.inputBuffer.sampleRate,
      );
      this.socket.send(
        JSON.stringify({ type: "audio", data: bytesToBase64(pcm) }),
      );
    };
    this.source.connect(this.processor);
    this.processor.connect(this.silentGain);
    this.silentGain.connect(this.audioContext.destination);
  }

  private handleMessage(message: Record<string, unknown>): void {
    if (message.type === "transcript") {
      this.callbacks.onTranscript({
        role: String(message.role || ""),
        content: String(message.content || ""),
      });
      return;
    }
    if (message.type === "agent_text") {
      this.callbacks.onAgentText(String(message.text || ""));
      return;
    }
    if (message.type === "agent_audio") {
      this.callbacks.onStatus("speaking");
      this.playAudio(
        String(message.audio || ""),
        Number(message.sampleRate || 16_000),
      );
      return;
    }
    if (message.type === "agent_event") {
      const event = String(message.event || "");
      if (event.includes("user_interrupt")) this.stopPlayback();
      if (event.includes("user_speech_start")) {
        this.callbacks.onStatus("listening");
      }
      this.callbacks.onEvent(event);
      return;
    }
    if (message.type === "error") {
      this.callbacks.onError(String(message.message || "Samvaad session failed."));
    }
  }

  private playAudio(encoded: string, sampleRate: number): void {
    if (!encoded || !this.audioContext) return;
    const bytes = base64ToBytes(encoded);
    const samples = new Float32Array(Math.floor(bytes.length / 2));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = view.getInt16(index * 2, true) / 0x8000;
    }
    const buffer = this.audioContext.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    const startAt = Math.max(
      this.audioContext.currentTime,
      this.nextPlaybackTime,
    );
    source.start(startAt);
    this.nextPlaybackTime = startAt + buffer.duration;
    this.playbackSources.add(source);
    source.onended = () => {
      this.playbackSources.delete(source);
      if (this.playbackSources.size === 0) this.callbacks.onStatus("listening");
    };
  }

  private stopPlayback(): void {
    for (const source of this.playbackSources) {
      try {
        source.stop();
      } catch {
        // A source may already have completed between the event and cleanup.
      }
    }
    this.playbackSources.clear();
    this.nextPlaybackTime = this.audioContext?.currentTime || 0;
  }

  private cleanupAudio(): void {
    this.stopPlayback();
    this.processor?.disconnect();
    this.source?.disconnect();
    this.silentGain?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.audioContext?.close();
    this.processor = null;
    this.source = null;
    this.silentGain = null;
    this.stream = null;
    this.audioContext = null;
  }
}
