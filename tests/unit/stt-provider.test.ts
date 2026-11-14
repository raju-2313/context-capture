import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSttProvider, WebSpeechProvider } from "../../src/core/stt/provider";
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

  it("provides explicit not-implemented provider stubs", () => {
    const provider = createSttProvider("whisper-cloud");
    expect(provider.isSupported()).toBe(false);
    expect(() => provider.start()).toThrow("not implemented");
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
