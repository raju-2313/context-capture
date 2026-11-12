import { capturePipeline } from "../capture/pipeline";

export interface VoiceRecordingState {
  isRecording: boolean;
  transcript: string;
  interimTranscript: string;
  error?: string;
}

export class VoiceNoteIntegration {
  private recognition: any = null;
  private activeTranscript = "";

  isSupported(): boolean {
    return typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  }

  startRecording(
    onUpdate: (state: VoiceRecordingState) => void,
    onComplete: (finalTranscript: string) => void
  ): boolean {
    if (!this.isSupported()) {
      onUpdate({
        isRecording: false,
        transcript: "",
        interimTranscript: "",
        error: "Speech recognition is not supported in this browser.",
      });
      return false;
    }

    try {
      const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";

      this.activeTranscript = "";

      this.recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            this.activeTranscript += event.results[i][0].transcript + " ";
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        onUpdate({
          isRecording: true,
          transcript: this.activeTranscript.trim(),
          interimTranscript: interim.trim(),
        });
      };

      this.recognition.onerror = (event: any) => {
        onUpdate({
          isRecording: false,
          transcript: this.activeTranscript.trim(),
          interimTranscript: "",
          error: event.error || "Speech recognition error",
        });
      };

      this.recognition.onend = () => {
        const final = this.activeTranscript.trim();
        onUpdate({
          isRecording: false,
          transcript: final,
          interimTranscript: "",
        });
        if (final) onComplete(final);
      };

      this.recognition.start();
      onUpdate({
        isRecording: true,
        transcript: "",
        interimTranscript: "Listening...",
      });
      return true;
    } catch (e: any) {
      onUpdate({
        isRecording: false,
        transcript: "",
        interimTranscript: "",
        error: e?.message || "Failed to start microphone",
      });
      return false;
    }
  }

  stopRecording(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
  }

  /**
   * Saves a voice transcript directly as a capture
   */
  async saveVoiceCapture(
    transcript: string,
    tabId: number | null,
    windowId: number | null
  ): Promise<string> {
    return await capturePipeline.captureNote({
      text: transcript,
      tabId,
      windowId,
      note: "Captured via voice note",
      tags: ["voice-note"],
    });
  }
}

export const voiceNoteIntegration = new VoiceNoteIntegration();
