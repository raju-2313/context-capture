const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel = LOG_LEVELS["info"];

export class Logger {
  private enabled = true;
  private maxEntries = 500;
  private entries: Array<{ level: string; message: string; time: string }> = [];

  setLevel(level: string): void {
    currentLevel = LOG_LEVELS[level] ?? LOG_LEVELS["info"];
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private add(level: keyof typeof LOG_LEVELS, message: string): void {
    if (!this.enabled) return;
    if (LOG_LEVELS[level] < currentLevel) return;
    const entry = { level, message, time: new Date().toISOString() };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    if (level === "error") {
      console.error(`[${level}] ${message}`);
    } else if (level === "warn") {
      console.warn(`[${level}] ${message}`);
    } else {
      console.log(`[${level}] ${message}`);
    }
  }

  debug(message: string): void {
    this.add("debug", message);
  }

  info(message: string, context?: string): void {
    this.add("info", context ? `[${context}] ${message}` : message);
  }

  warn(message: string, context?: string): void {
    this.add("warn", context ? `[${context}] ${message}` : message);
  }

  error(message: string, context?: string): void {
    this.add("error", context ? `[${context}] ${message}` : message);
  }

  getEntries(): Array<{ level: string; message: string; time: string }> {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }

  exportText(): string {
    return this.entries
      .map((e) => `${e.time} [${e.level}] ${e.message}`)
      .join("\n");
  }
}

export const logger = new Logger();
