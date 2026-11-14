import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSttProvider, GroqCloudProvider, WebSpeechProvider } from "../../src/core/stt/provider";
import { VoiceNoteIntegration } from "../../src/core/integrations/voice";
import { insertTranscriptAtCursor } from "../../src/ui/sidepanel/composer";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    FakeRecognition.instances.push(this);
  }
}

describe("speech-to-text provider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeRecognition.instances = [];
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: FakeRecognition });
  });

  it("configures Web Speech with the browser language and emits interim/final results", () => {
    const provider = new WebSpeechProvider();
    const onResult = vi.fn();
    provider.start({ onResult });
    const recognition = (provider as unknown as { recognition: FakeRecognition }).recognition;

    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.lang).toBe(navigator.language);
    recognition.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: "hello" } }] });
    recognition.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "world" } }] });
    expect(onResult).toHaveBeenNthCalledWith(1, { transcript: "hello", isFinal: false });
    expect(onResult).toHaveBeenNthCalledWith(2, { transcript: "world", isFinal: true });
  });

  it("restarts after a recognition session ends while active", () => {
    const provider = new WebSpeechProvider();
    provider.start();
    const recognition = (provider as unknown as { recognition: FakeRecognition }).recognition;
    recognition.onend?.();
    vi.advanceTimersByTime(250);
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(FakeRecognition.instances[1].start).toHaveBeenCalled();
  });

  it("retries no-speech silently and preserves listening for a later transcript", () => {
    const provider = new WebSpeechProvider();
    const onError = vi.fn();
    const onResult = vi.fn();
    provider.start({ onError, onResult });
    const first = FakeRecognition.instances[0];

    first.onerror?.({ error: "no-speech" });
    first.onend?.();
    vi.advanceTimersByTime(250);

    const second = FakeRecognition.instances[1];
    expect(onError).not.toHaveBeenCalled();
    second.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "hello again" } }] });
    expect(onResult).toHaveBeenCalledWith({ transcript: "hello again", isFinal: true });
  });

  it("retries one transient network failure, then reports actionable service guidance", () => {
    const provider = new WebSpeechProvider();
    const onError = vi.fn();
    provider.start({ onError });

    const first = FakeRecognition.instances[0];
    first.onerror?.({ error: "network" });
    expect(onError).toHaveBeenNthCalledWith(1, expect.objectContaining({ code: "network", fatal: false }));
    first.onend?.();
    vi.advanceTimersByTime(250);

    const second = FakeRecognition.instances[1];
    second.onerror?.({ error: "network" });
    expect(onError).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        code: "network",
        fatal: true,
        message: expect.stringContaining("Brave"),
      }),
    );
    second.onend?.();
    vi.advanceTimersByTime(4000);
    expect(FakeRecognition.instances).toHaveLength(2);
  });

  it("notifies the integration on explicit stop without restarting", () => {
    const provider = new WebSpeechProvider();
    const onEnd = vi.fn();
    provider.start({ onEnd });
    provider.stop();

    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(4000);
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it("notifies the integration when stopping during a retry backoff", () => {
    const provider = new WebSpeechProvider();
    const onEnd = vi.fn();
    provider.start({ onEnd });
    const recognition = FakeRecognition.instances[0];
    recognition.onerror?.({ error: "no-speech" });
    recognition.onend?.();

    provider.stop();

    expect(onEnd).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(4000);
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it("creates the Groq cloud adapter for the cloud provider kind", () => {
    const provider = createSttProvider("whisper-cloud");
    expect(provider.isSupported()).toBe(false);
    expect(provider.kind).toBe("groq-cloud");
  });

  it("reports a missing Groq key without starting capture", () => {
    vi.stubGlobal("MediaRecorder", class {});
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    const onError = vi.fn();
    new GroqCloudProvider().start({ onError });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "configuration", fatal: true }));
  });

  it("uploads a multipart recording with the Groq model and emits final text", async () => {
    const stream = { getTracks: () => [{ stop: vi.fn() }] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    class FakeRecorder {
      static last: FakeRecorder;
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor() { FakeRecorder.last = this; }
      start = vi.fn(() => {
        this.state = "recording";
        this.ondataavailable?.({ data: new Blob(["audio"]) });
      });
      stop = vi.fn(() => {
        this.state = "inactive";
        this.onstop?.();
      });
    }
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "hello cloud" }) });
    vi.stubGlobal("fetch", fetchMock);
    const onResult = vi.fn();
    const onEnd = vi.fn();
    const provider = new GroqCloudProvider("gsk_test");
    provider.start({ onResult, onEnd });
    await Promise.resolve();
    provider.stop();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer gsk_test" }, body: expect.any(FormData) }),
    );
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("model")).toBe("whisper-large-v3-turbo");
    expect(body.get("file")).toBeInstanceOf(Blob);
    expect(onResult).toHaveBeenCalledWith({ transcript: "hello cloud", isFinal: true });
    expect(onEnd).toHaveBeenCalled();
  });

  it("explains when Web Speech is unsupported instead of blaming connectivity", () => {
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: undefined });
    const provider = new WebSpeechProvider();
    const onError = vi.fn();

    provider.start({ onError });

    expect(onError).toHaveBeenCalledWith({
      code: "unsupported",
      message: expect.stringContaining("Chrome"),
      fatal: true,
    });
  });

  describe("voice note integration", () => {
    it("keeps listening after no-speech and completes on explicit stop", () => {
      const provider = {
        kind: "web-speech" as const,
        isSupported: () => true,
        start: vi.fn((options) => {
          options?.onError?.({ code: "no-speech", message: "No speech detected.", fatal: false });
          options?.onResult?.({ transcript: "hello", isFinal: true });
        }),
        stop: vi.fn(),
      };
      const integration = new VoiceNoteIntegration(provider);
      const updates: Array<{ isRecording: boolean; error?: string }> = [];
      const onComplete = vi.fn();

      integration.startRecording((state) => updates.push(state), onComplete);
      expect(updates.some((state) => state.isRecording && !state.error)).toBe(true);

      integration.stopRecording();
      provider.start.mock.calls[0][0]?.onEnd?.();
      expect(onComplete).toHaveBeenCalledWith("hello");
      expect(updates.at(-1)).toMatchObject({ isRecording: false, error: undefined });
    });
  });
});

describe("transcript insertion", () => {
  it("inserts without replacing typed text and adds readable spacing", () => {
    expect(insertTranscriptAtCursor("typed text", "voice words", 5, 5)).toEqual({
      value: "typed voice words text",
      cursor: 17,
    });
    expect(insertTranscriptAtCursor("typed", "voice", 5, 5).value).toBe("typed voice");
  });
});
