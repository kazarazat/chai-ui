/**
 * Voice input for the Composer: record from the microphone, send the clip
 * to a speech-to-text model, and hand back the transcript. Framework-free,
 * so React and Vue each add only the button.
 */
import { abortError, isAbortError } from "./engine.js";
import { createFalTranscriber } from "./engines/fal.js";

/** A recorded clip, as a data URL. */
export interface VoiceClip {
  src: string;
  kind: "audio";
  /** What the browser recorded, e.g. `"audio/webm;codecs=opus"` (Chrome, Firefox) or `"audio/mp4"` (Safari). */
  mimeType: string;
}

/** Turns a recorded clip into text. Reject with an `AbortError` when `signal` aborts. */
export type Transcribe = (audio: VoiceClip, options?: { signal?: AbortSignal }) => Promise<string>;

/**
 * Turns on the Composer's mic. Name a Fal speech-to-text model and Chai
 * sends the clip through your existing `/api/chai/fal` route, or pass your
 * own `transcribe` for any other provider. There's no default model: the
 * mic shows only once you choose one.
 */
export type VoiceInputConfig = (
  | { model: string; transcribe?: never; endpoint?: string }
  | { transcribe: Transcribe; model?: never; endpoint?: never }
) & {
  /** Longest recording, in seconds. Recording stops and transcribes at this length. Defaults to 60. */
  maxSeconds?: number;
};

export type VoiceInputStatus = "idle" | "recording" | "transcribing" | "error";

export interface VoiceInputState {
  status: VoiceInputStatus;
  /** How long the current recording has run. */
  elapsedMs: number;
  /** A short message for the person while `status` is "error". */
  error: string | null;
  /**
   * The microphone's recent loudness while recording, oldest first, each
   * 0–1: what a waveform draws, so the person sees they're being heard.
   * Empty when not recording, or when the browser has no Web Audio.
   */
  levels: number[];
}

/** How many level readings a waveform shows. */
export const VOICE_LEVEL_COUNT = 48;

export const DEFAULT_VOICE_MAX_SECONDS = 60;

/** Recording formats, best first. Chrome and Firefox record WebM, Safari MP4. */
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** The `Transcribe` a config describes: its own, or a Fal transcriber for its model. */
export function voiceTranscriber(config: VoiceInputConfig): Transcribe {
  return config.transcribe ?? createFalTranscriber({ model: config.model!, endpoint: config.endpoint });
}

/** "0:05", "1:00": how long a recording has run. */
export function formatVoiceElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Why the microphone couldn't start, in words for the person. */
export function describeMicError(err: unknown): string {
  const { name, message } = (err as { name?: string; message?: string } | null) ?? {};
  // Chrome's wording when the computer, not the site, blocks the browser
  // (macOS Privacy & Security, Windows microphone privacy).
  if (name === "NotAllowedError" && /system/i.test(message ?? "")) {
    return "Your computer is blocking this browser from the microphone. Allow it in your system's privacy settings, then reload.";
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow it in your browser's site settings to use voice input.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone found.";
  if (name === "NotReadableError") return "The microphone is in use by another app.";
  return "The microphone couldn't start.";
}

interface VoiceInputDeps {
  /** Defaults to the browser's `navigator.mediaDevices.getUserMedia`. */
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  /** Defaults to the browser's `MediaRecorder`. */
  MediaRecorder?: typeof MediaRecorder;
  /** Defaults to the browser's `AudioContext`, for the waveform. Without one, recording still works. */
  AudioContext?: typeof AudioContext;
}

/**
 * The recorder behind the mic button. `start` asks for the microphone and
 * records; `stop` ends the recording and transcribes it; `cancel` stops
 * either without a transcript. `onTranscript` gets the text: it never
 * submits, so the person can fix it first.
 */
export function createVoiceInput(
  getConfig: () => VoiceInputConfig,
  onTranscript: (text: string) => void,
  deps: VoiceInputDeps = {}
) {
  let state: VoiceInputState = { status: "idle", elapsedMs: 0, error: null, levels: [] };
  const listeners = new Set<() => void>();
  const set = (next: Partial<VoiceInputState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };

  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let controller: AbortController | null = null;
  let discard = false;
  let audio: AudioContext | null = null;
  let readLevel: (() => number) | null = null;

  function release() {
    if (timer) clearInterval(timer);
    timer = null;
    void audio?.close().catch(() => {});
    audio = null;
    readLevel = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    recorder = null;
  }

  async function start() {
    if (state.status === "recording" || state.status === "transcribing") return;
    const Recorder = deps.MediaRecorder ?? (typeof MediaRecorder === "undefined" ? undefined : MediaRecorder);
    const getUserMedia =
      deps.getUserMedia ?? (typeof navigator !== "undefined" ? navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) : undefined);
    if (!Recorder || !getUserMedia) return set({ status: "error", error: "Voice input isn't supported in this browser." });
    try {
      stream = await getUserMedia({ audio: true });
    } catch (err) {
      return set({ status: "error", error: describeMicError(err) });
    }
    const mimeType = MIME_TYPES.find((t) => Recorder.isTypeSupported?.(t));
    const chunks: Blob[] = [];
    discard = false;
    recorder = new Recorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder?.mimeType || mimeType || "audio/webm";
      release();
      if (discard) return set({ status: "idle", elapsedMs: 0, levels: [] });
      void transcribe(new Blob(chunks, { type }), type);
    };
    recorder.start();
    readLevel = listen(stream);
    const startedAt = Date.now();
    const maxMs = (getConfig().maxSeconds ?? DEFAULT_VOICE_MAX_SECONDS) * 1000;
    set({ status: "recording", elapsedMs: 0, error: null, levels: [] });
    timer = setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const levels = readLevel ? [...state.levels, readLevel()].slice(-VOICE_LEVEL_COUNT) : state.levels;
      set({ elapsedMs, levels });
      if (elapsedMs >= maxMs) stop();
    }, 80);
  }

  /** Reads the stream's loudness, 0–1, through Web Audio. Null without it. */
  function listen(source: MediaStream): (() => number) | null {
    const Context = deps.AudioContext ?? (typeof AudioContext === "undefined" ? undefined : AudioContext);
    if (!Context) return null;
    try {
      audio = new Context();
      const analyser = audio.createAnalyser();
      analyser.fftSize = 256;
      audio.createMediaStreamSource(source).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      return () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) sum += ((v - 128) / 128) ** 2;
        // Speech sits low on this scale: lift it so a normal voice fills the bars.
        return Math.min(1, Math.sqrt(sum / samples.length) * 4);
      };
    } catch {
      return null;
    }
  }

  async function transcribe(blob: Blob, mimeType: string) {
    if (blob.size === 0) return set({ status: "error", error: "Nothing was recorded. Try again." });
    set({ status: "transcribing", levels: [] });
    controller = new AbortController();
    try {
      const src = await readAsDataUrl(blob);
      if (controller.signal.aborted) throw abortError();
      const text = (await voiceTranscriber(getConfig())({ src, kind: "audio", mimeType }, { signal: controller.signal })).trim();
      if (!text) return set({ status: "error", error: "Didn't catch that. Try again." });
      onTranscript(text);
      set({ status: "idle", elapsedMs: 0, levels: [] });
    } catch (err) {
      if (isAbortError(err)) return set({ status: "idle", elapsedMs: 0, levels: [] });
      set({ status: "error", error: "Transcription failed. Try again." });
    } finally {
      controller = null;
    }
  }

  /** Ends the recording and transcribes it. */
  function stop() {
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  /** Stops recording or transcribing, with no transcript. */
  function cancel() {
    if (state.status === "recording") {
      discard = true;
      stop();
    } else if (state.status === "transcribing") controller?.abort();
  }

  /** Clears an error, back to the idle mic. */
  function dismiss() {
    if (state.status === "error") set({ status: "idle", error: null, elapsedMs: 0, levels: [] });
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start,
    stop,
    cancel,
    dismiss,
    /** Stops everything, for when the Composer goes away. */
    dispose() {
      discard = true;
      controller?.abort();
      if (recorder && recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}

export type VoiceInput = ReturnType<typeof createVoiceInput>;

/** A clip's data URL, for the model's `audio_url`. */
function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
