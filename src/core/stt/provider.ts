export type SttProviderKind = "web-speech" | "whisper-local" | "whisper-cloud";

export type SttErrorCode =
  | "not-allowed"
  | "service-not-allowed"
  | "audio-capture"
  | "network"
  | "no-speech"
  | "aborted"
  | "unsupported"
  | "unknown";

export interface SttError {
  code: SttErrorCode;
  message: string;
  fatal: boolean;
}

export interface SttResult {
  transcript: string;
  isFinal: boolean;
}

export interface SttProviderOptions {
  language?: string;
  onResult?: (result: SttResult) => void;
  onError?: (error: SttError) => void;
  onEnd?: () => void;
}

export interface SttProvider {
  readonly kind: SttProviderKind;
  isSupported(): boolean;
  start(options?: SttProviderOptions): void;
  stop(): void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

const ERROR_MESSAGES: Record<SttErrorCode, string> = {
  "not-allowed": "Microphone permission was denied.",
  "service-not-allowed": "Speech recognition is not allowed in this browser.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs a network connection.",
  "no-speech": "No speech detected.",
  aborted: "Speech recognition was stopped.",
  unsupported: "Speech recognition is not supported in this browser.",
  unknown: "Speech recognition failed.",
};

function normalizeError(error: string | undefined): SttError {
  const code: SttErrorCode =
    error === "not-allowed" || error === "service-not-allowed" || error === "audio-capture" ||
    error === "network" || error === "no-speech" || error === "aborted"
      ? error
      : "unknown";
  return {
    code,
    message: ERROR_MESSAGES[code],
    fatal: code !== "no-speech" && code !== "aborted",
  };
}

export class WebSpeechProvider implements SttProvider {
  readonly kind = "web-speech" as const;
  private static readonly MAX_NO_SPEECH_RETRIES = 5;
  private static readonly MAX_RESTART_DELAY_MS = 4000;
  private recognition: SpeechRecognitionLike | null = null;
  private shouldRestart = false;
  private restartTimer: number | null = null;
  private options: SttProviderOptions = {};
  private noSpeechRetries = 0;

  isSupported(): boolean {
    const speechWindow = typeof window === "undefined" ? null : window as SpeechRecognitionWindow;
    return Boolean(speechWindow?.SpeechRecognition || speechWindow?.webkitSpeechRecognition);
  }

  start(options: SttProviderOptions = {}): void {
    if (!this.isSupported()) {
      options.onError?.({ code: "unsupported", message: ERROR_MESSAGES.unsupported, fatal: true });
      return;
    }

    this.options = options;
    this.shouldRestart = true;
    this.noSpeechRetries = 0;
    this.clearRestartTimer();
    this.startRecognition();
  }

  stop(): void {
    this.shouldRestart = false;
    this.clearRestartTimer();
    const recognition = this.recognition;
    this.recognition = null;
    if (!recognition) {
      this.options.onEnd?.();
      return;
    }
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      recognition.abort();
    }
    this.options.onEnd?.();
  }

  private startRecognition(): void {
    const speechWindow = window as SpeechRecognitionWindow;
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) return;

    const recognition = new Constructor();
    this.recognition = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.options.language || navigator.language;
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        this.noSpeechRetries = 0;
        this.options.onResult?.({
          transcript: result[0]?.transcript || "",
          isFinal: result.isFinal,
        });
      }
    };
    recognition.onerror = (event) => {
      const error = normalizeError(event.error);
      if (error.code === "no-speech") {
        this.noSpeechRetries += 1;
        if (this.noSpeechRetries > WebSpeechProvider.MAX_NO_SPEECH_RETRIES) {
          this.shouldRestart = false;
          this.options.onError?.({ ...error, fatal: true });
        }
        return;
      }
      this.options.onError?.(error);
      if (error.fatal) this.shouldRestart = false;
    };
    recognition.onend = () => {
      if (this.recognition === recognition) this.recognition = null;
      if (this.shouldRestart) {
        const delay = this.noSpeechRetries > 0
          ? Math.min(250 * 2 ** (this.noSpeechRetries - 1), WebSpeechProvider.MAX_RESTART_DELAY_MS)
          : 250;
        this.restartTimer = window.setTimeout(() => {
          this.restartTimer = null;
          this.startRecognition();
        }, delay);
      } else {
        this.options.onEnd?.();
      }
    };

    try {
      recognition.start();
    } catch (error) {
      this.shouldRestart = false;
      this.options.onError?.({
        code: "unknown",
        message: error instanceof Error ? error.message : ERROR_MESSAGES.unknown,
        fatal: true,
      });
    }
  }

  private clearRestartTimer(): void {
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }
}

class NotImplementedProvider implements SttProvider {
  constructor(public readonly kind: "whisper-local" | "whisper-cloud") {}
  isSupported(): boolean { return false; }
  start(): void { throw new Error(`${this.kind} speech recognition is not implemented.`); }
  stop(): void {}
}

export function createSttProvider(kind: SttProviderKind = "web-speech"): SttProvider {
  if (kind === "whisper-local" || kind === "whisper-cloud") {
    return new NotImplementedProvider(kind);
  }
  return new WebSpeechProvider();
}

export const sttErrorMessage = (code: SttErrorCode): string => ERROR_MESSAGES[code];
