import { createSttProvider, SttError, SttProvider } from "../stt/provider";

export interface VoiceRecordingState {
  isRecording: boolean;
  transcript: string;
  interimTranscript: string;
  error?: string;
  status?: "idle" | "listening" | "transcribing" | "error" | "unsupported";
}

export class VoiceNoteIntegration {
  private provider: SttProvider = createSttProvider();
  private activeTranscript = "";
  private interimTranscript = "";
  private onUpdate: ((state: VoiceRecordingState) => void) | null = null;
  private onComplete: ((finalTranscript: string) => void) | null = null;
  private manuallyStopped = false;
  private terminalError: string | null = null;

  constructor(provider: SttProvider = createSttProvider()) {
    this.provider = provider;
  }

  isSupported(): boolean {
    return this.provider.isSupported();
  }

  startRecording(
    onUpdate: (state: VoiceRecordingState) => void,
    onComplete: (finalTranscript: string) => void
  ): boolean {
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.manuallyStopped = false;
    this.terminalError = null;
    this.activeTranscript = "";
    this.interimTranscript = "";

    if (!this.isSupported()) {
      onUpdate({
        isRecording: false,
        transcript: "",
        interimTranscript: "",
        error: "Speech recognition is not supported in this browser.",
        status: "unsupported",
      });
      return false;
    }

    try {
      this.provider.start({
        onResult: ({ transcript, isFinal }) => {
          if (isFinal) this.activeTranscript = `${this.activeTranscript} ${transcript}`.trim();
          else this.interimTranscript = transcript.trim();
          onUpdate({
            isRecording: true,
            transcript: this.activeTranscript,
            interimTranscript: this.interimTranscript,
            status: "listening",
          });
        },
        onError: (error) => this.handleError(error),
        onStatus: (status) => {
          if (status === "transcribing") {
            onUpdate({ isRecording: true, transcript: this.activeTranscript, interimTranscript: "Transcribing audio...", status });
          }
        },
        onEnd: () => {
          if (!this.manuallyStopped || this.terminalError) return;
          const final = this.activeTranscript.trim();
          onUpdate({
            isRecording: false,
            transcript: final,
            interimTranscript: "",
            error: final ? undefined : "No speech detected.",
            status: final ? "idle" : "error",
          });
          if (final) onComplete(final);
        },
      });
      onUpdate({
        isRecording: true,
        transcript: "",
        interimTranscript: "Listening...",
        status: "listening",
      });
      return true;
    } catch (error) {
      onUpdate({
        isRecording: false,
        transcript: "",
        interimTranscript: "",
        error: error instanceof Error ? error.message : "Failed to start microphone",
        status: "error",
      });
      return false;
    }
  }

  stopRecording(): void {
    this.manuallyStopped = true;
    this.provider.stop();
  }

  private handleError(error: SttError): void {
    if (error.code === "no-speech") return;
    if (!error.fatal) return;
    this.manuallyStopped = true;
    this.terminalError = error.message;
    this.onUpdate?.({
      isRecording: false,
      transcript: this.activeTranscript,
      interimTranscript: "",
      error: error.message,
      status: error.code === "unsupported" ? "unsupported" : "error",
    });
  }
}

export const voiceNoteIntegration = new VoiceNoteIntegration();

