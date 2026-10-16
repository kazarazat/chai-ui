// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { abortError } from "./engine.js";
import { createFalTranscriber, extractFalTranscript } from "./engines/fal.js";
import { createVoiceInput, describeMicError, formatVoiceElapsed, type VoiceInputConfig } from "./voice-input.js";

/** A MediaRecorder stand-in: `stop()` delivers one chunk, then fires onstop. */
class FakeRecorder {
  static isTypeSupported = (t: string) => t === "audio/webm;codecs=opus";
  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(_stream: unknown, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? "";
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["sound"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

const stopTrack = vi.fn();
const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
const deps = { getUserMedia: async () => stream, MediaRecorder: FakeRecorder as unknown as typeof MediaRecorder };

function setup(config: VoiceInputConfig, overrides = {}) {
  const onTranscript = vi.fn();
  const voice = createVoiceInput(() => config, onTranscript, { ...deps, ...overrides });
  return { voice, onTranscript };
}

afterEach(() => {
  vi.useRealTimers();
  stopTrack.mockClear();
});

describe("createVoiceInput", () => {
  it("records, transcribes the clip, hands back the text and frees the mic", async () => {
    const transcribe = vi.fn().mockResolvedValue("  a red mug on oak  ");
    const { voice, onTranscript } = setup({ transcribe });

    await voice.start();
    expect(voice.getState().status).toBe("recording");
    voice.stop();
    await vi.waitFor(() => expect(voice.getState().status).toBe("idle"));

    expect(onTranscript).toHaveBeenCalledWith("a red mug on oak");
    const [clip] = transcribe.mock.calls[0]!;
    expect(clip).toMatchObject({ kind: "audio", mimeType: "audio/webm;codecs=opus" });
    expect(clip.src).toMatch(/^data:audio\/webm/);
    expect(stopTrack).toHaveBeenCalled();
  });

  it("explains a blocked or missing microphone", async () => {
    const blocked = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    const { voice } = setup({ transcribe: vi.fn() }, { getUserMedia: () => Promise.reject(blocked) });
    await voice.start();
    expect(voice.getState()).toMatchObject({ status: "error", error: expect.stringMatching(/blocked/) });
    voice.dismiss();
    expect(voice.getState().status).toBe("idle");

    expect(describeMicError({ name: "NotFoundError" })).toBe("No microphone found.");
    expect(describeMicError({ name: "NotAllowedError", message: "Permission denied by system" })).toMatch(/system's privacy settings/);
    const unsupported = setup({ transcribe: vi.fn() }, { MediaRecorder: undefined, getUserMedia: undefined });
    vi.stubGlobal("MediaRecorder", undefined);
    await unsupported.voice.start();
    vi.unstubAllGlobals();
    expect(unsupported.voice.getState().error).toMatch(/isn't supported/);
  });

  it("says so when nothing was heard or the model failed, and never hands back empty text", async () => {
    const quiet = setup({ transcribe: vi.fn().mockResolvedValue("   ") });
    await quiet.voice.start();
    quiet.voice.stop();
    await vi.waitFor(() => expect(quiet.voice.getState().error).toBe("Didn't catch that. Try again."));
    expect(quiet.onTranscript).not.toHaveBeenCalled();

    const failing = setup({ transcribe: vi.fn().mockRejectedValue(new Error("500")) });
    await failing.voice.start();
    failing.voice.stop();
    await vi.waitFor(() => expect(failing.voice.getState().error).toBe("Transcription failed. Try again."));
  });

  it("cancel drops a recording, and stops a transcription in flight", async () => {
    const transcribe = vi.fn();
    const recording = setup({ transcribe });
    await recording.voice.start();
    recording.voice.cancel();
    expect(recording.voice.getState().status).toBe("idle");
    expect(transcribe).not.toHaveBeenCalled();

    const slow = vi.fn(
      (_clip, { signal }: { signal: AbortSignal }) =>
        new Promise<string>((_, reject) => signal.addEventListener("abort", () => reject(abortError())))
    );
    const transcribing = setup({ transcribe: slow });
    await transcribing.voice.start();
    transcribing.voice.stop();
    await vi.waitFor(() => expect(transcribing.voice.getState().status).toBe("transcribing"));
    transcribing.voice.cancel();
    await vi.waitFor(() => expect(transcribing.voice.getState().status).toBe("idle"));
    expect(transcribing.onTranscript).not.toHaveBeenCalled();
  });

  it("keeps the latest mic levels while recording, for the waveform", async () => {
    vi.useFakeTimers();
    const analyser = { fftSize: 0, getByteTimeDomainData: (a: Uint8Array) => a.fill(160) };
    class FakeAudio {
      createAnalyser = () => analyser;
      createMediaStreamSource = () => ({ connect() {} });
      close = vi.fn(async () => {});
    }
    const { voice } = setup({ transcribe: vi.fn().mockResolvedValue("x") }, { AudioContext: FakeAudio });
    await voice.start();
    vi.advanceTimersByTime(80 * 60);
    const { levels } = voice.getState();
    expect(levels).toHaveLength(48);
    expect(levels[0]).toBeCloseTo(1);
    voice.cancel();
    expect(voice.getState().levels).toEqual([]);
  });

  it("stops and transcribes on its own at the longest recording", async () => {
    vi.useFakeTimers();
    const transcribe = vi.fn().mockResolvedValue("hello");
    const { voice } = setup({ transcribe, maxSeconds: 2 });
    await voice.start();
    vi.advanceTimersByTime(1040);
    expect(formatVoiceElapsed(voice.getState().elapsedMs)).toBe("0:01");
    vi.advanceTimersByTime(1040);
    vi.useRealTimers();
    await vi.waitFor(() => expect(transcribe).toHaveBeenCalled());
  });
});

describe("createFalTranscriber", () => {
  it("sends the clip as audio_url through the proxy and reads the transcript", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ request_id: "r1", status: "COMPLETED" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ text: " hi there " }) });
    const transcribe = createFalTranscriber({ model: "fal-ai/wizper", fetchImpl, pollIntervalMs: 0 });

    const text = await transcribe({ src: "data:audio/webm;base64,AAA", kind: "audio", mimeType: "audio/webm" });

    expect(text).toBe("hi there");
    expect(fetchImpl.mock.calls[0]![0]).toBe("/api/chai/fal/fal-ai/wizper");
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body)).toEqual({ audio_url: "data:audio/webm;base64,AAA" });
  });

  it("reads `output` too, the field some models use", () => {
    expect(extractFalTranscript({ output: "from output" })).toBe("from output");
    expect(extractFalTranscript({})).toBeUndefined();
  });
});
