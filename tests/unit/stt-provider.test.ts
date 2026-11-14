import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSttProvider, WebSpeechProvider } from "../../src/core/stt/provider";
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

  it("provides explicit not-implemented provider stubs", () => {
    const provider = createSttProvider("whisper-cloud");
    expect(provider.isSupported()).toBe(false);
    expect(() => provider.start()).toThrow("not implemented");
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
