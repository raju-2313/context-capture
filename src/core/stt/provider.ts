import { settingsStore } from "../../data/settings";
import { transcribeThroughGateway } from "./managedGateway";

export type SttProviderKind = "web-speech" | "whisper-local" | "whisper-cloud" | "groq-cloud" | "configured";

export type SttErrorCode =
  | "not-allowed"
  | "service-not-allowed"
  | "audio-capture"
  | "network"
  | "no-speech"
  | "aborted"
  | "unsupported"
  | "configuration"
  | "api"
  | "quota-exceeded"
  | "unauthorized"
  | "unknown";

export interface SttError {
  code: SttErrorCode;
  message: string;
  fatal: boolean;
  quota?: {
    plan: string;
    usedToday: number;
    dailyLimit: number;
    remaining: number;
    resetAt?: string;
    upgradeUrl?: string;
  };
  upgradeUrl?: string;
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
  onStatus?: (status: "listening" | "transcribing") => void;
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
  network: "The browser speech service could not be reached. Check microphone permissions and, in Brave, try allowing this site and turning off Shields for it. Chrome/Chromium may also need access to its speech service.",
  "no-speech": "No speech detected.",
  aborted: "Speech recognition was stopped.",
  unsupported: "Voice input is not supported in this browser. Try Chrome or another Chromium browser with Web Speech enabled.",
  configuration: "Managed transcription is not configured. Add the gateway settings in Settings.",
  api: "The managed transcription service could not transcribe this recording.",
  "quota-exceeded": "Your daily transcription limit is exhausted. Upgrade to continue.",
  unauthorized: "Managed transcription authentication expired. Try again.",
  unknown: "Speech recognition failed.",
};

function normalizeError(error: string | undefined): SttError {
  const code: SttErrorCode =
    error === "not-allowed" || error === "service-not-allowed" || error === "audio-capture" ||
    error === "network" || error === "no-speech" || error === "aborted" ||
    error === "configuration" || error === "api" || error === "quota-exceeded" || error === "unauthorized"
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
  private static readonly MAX_NETWORK_RETRIES = 2;
  private static readonly MAX_RESTART_DELAY_MS = 4000;
  private recognition: SpeechRecognitionLike | null = null;
  private shouldRestart = false;
  private restartTimer: number | null = null;
  private options: SttProviderOptions = {};
  private noSpeechRetries = 0;
  private networkRetries = 0;

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
    this.networkRetries = 0;
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
        this.networkRetries = 0;
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
      if (error.code === "network") {
        this.networkRetries += 1;
        const isTerminal = this.networkRetries >= WebSpeechProvider.MAX_NETWORK_RETRIES;
        this.shouldRestart = !isTerminal;
        this.options.onError?.({ ...error, fatal: isTerminal });
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

export class GroqCloudProvider implements SttProvider {
  readonly kind = "groq-cloud" as const;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private options: SttProviderOptions = {};
  private stopping = false;

  isSupported(): boolean {
    return typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined";
  }

  start(options: SttProviderOptions = {}): void {
    this.options = options;
    this.stopping = false;
    this.chunks = [];
    if (!this.isSupported()) {
      options.onError?.({ code: "unsupported", message: "Cloud voice input requires microphone access and MediaRecorder.", fatal: true });
      return;
    }
    void this.beginRecording();
  }

  stop(): void {
    this.stopping = true;
    this.options.onStatus?.("transcribing");
    if (!this.recorder) {
      return;
    }
    if (this.recorder.state === "inactive") {
      void this.transcribe();
      return;
    }
    try {
      this.recorder.stop();
    } catch (error) {
      this.options.onError?.({ code: "unknown", message: error instanceof Error ? error.message : ERROR_MESSAGES.unknown, fatal: true });
      this.cleanup();
      this.options.onEnd?.();
    }
  }

  private async beginRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(this.stream);
      this.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) this.chunks.push(event.data);
      };
      recorder.onstop = () => { if (this.stopping) void this.transcribe(); };
      recorder.onerror = () => this.options.onError?.({ code: "audio-capture", message: ERROR_MESSAGES["audio-capture"], fatal: true });
      recorder.start();
      if (this.stopping) recorder.stop();
    } catch (error) {
      const code = error instanceof DOMException && error.name === "NotAllowedError" ? "not-allowed" : "audio-capture";
      this.options.onError?.({ code, message: ERROR_MESSAGES[code], fatal: true });
    }
  }

  private async transcribe(): Promise<void> {
    const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || "audio/webm" });
    this.cleanup();
    if (!blob.size) {
      this.options.onError?.({ code: "no-speech", message: ERROR_MESSAGES["no-speech"], fatal: false });
      this.options.onEnd?.();
      return;
    }
    try {
      const result = await transcribeThroughGateway(blob, this.options.language);
      const transcript = result.text;
      if (!transcript) this.options.onError?.({ code: "no-speech", message: ERROR_MESSAGES["no-speech"], fatal: false });
      else this.options.onResult?.({ transcript, isFinal: true });
    } catch (error) {
      const typed = error as Error & { code?: SttErrorCode; quota?: SttError["quota"]; upgradeUrl?: string };
      const code = typed.code || (error instanceof TypeError ? "network" : "api");
      this.options.onError?.({
        code,
        message: typed.message || ERROR_MESSAGES[code],
        fatal: true,
        quota: typed.quota,
        upgradeUrl: typed.upgradeUrl,
      });
    } finally {
      this.options.onEnd?.();
    }
  }

  private cleanup(): void {
    this.recorder = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}

class NotImplementedProvider implements SttProvider {
  constructor(public readonly kind: "whisper-local") {}
  isSupported(): boolean { return false; }
  start(): void { throw new Error(`${this.kind} speech recognition is not implemented.`); }
  stop(): void {}
}

export function createSttProvider(kind: SttProviderKind = "web-speech"): SttProvider {
  if (kind === "whisper-cloud" || kind === "groq-cloud") {
    return new GroqCloudProvider();
  }
  if (kind === "whisper-local") {
    return new NotImplementedProvider(kind);
  }
  return new ConfiguredSttProvider();
}

export const sttErrorMessage = (code: SttErrorCode): string => ERROR_MESSAGES[code];

class ConfiguredSttProvider implements SttProvider {
  readonly kind = "configured" as const;
  private active: SttProvider | null = null;
  private pendingStop = false;

  isSupported(): boolean {
    return new WebSpeechProvider().isSupported() || new GroqCloudProvider().isSupported();
  }

  start(options: SttProviderOptions = {}): void {
    this.pendingStop = false;
    void settingsStore.get("stt_provider").then(async (provider) => {
      const gateway = await settingsStore.get("transcription_gateway_url");
      this.active = provider === "groq" || (provider === "auto" && Boolean(gateway))
        ? new GroqCloudProvider()
        : new WebSpeechProvider();
      this.active.start(options);
      if (this.pendingStop) this.active.stop();
    }).catch(() => options.onError?.({ code: "unknown", message: ERROR_MESSAGES.unknown, fatal: true }));
  }

  stop(): void {
    this.pendingStop = true;
    this.active?.stop();
  }
}
