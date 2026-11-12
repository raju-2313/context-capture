import { captures as capRepo, projects as projRepo, contexts as ctxRepo } from "../../data/repositories";
import { settingsStore } from "../../data/settings";
import { Capture } from "../../shared/types";
import { stripDiacritics } from "../../shared/types";

export interface Citation {
  capture_id: string;
  title: string;
  domain?: string | null;
  snippet: string;
  source_url?: string | null;
}

export interface GroundedAnswer {
  query: string;
  answer: string;
  citations: Citation[];
  confidence: number; // 0.0 to 1.0
  scope: "all" | "context" | "project";
  abstentionReason?: string;
}

/**
 * Sanitizes input text to neutralize prompt injection patterns
 * in captured webpage content.
 */
export function sanitizeContentForAI(text: string): string {
  if (!text) return "";
  return text
    // Strip common system-prompt override attempts
    .replace(/(?:system\s*prompt|ignore\s+previous\s+instructions|disregard\s+all\s+prior)/gi, "[redacted_directive]")
    .replace(/[<>{}[\]]/g, (char) => ({ "<": "‹", ">": "›", "{": "(", "}": ")", "[": "(", "]": ")" }[char] || char))
    .slice(0, 15000); // sensible token/context guard
}

export class AIAssistant {
  /**
   * Check if AI features are enabled by user in settings.
   */
  async isEnabled(): Promise<boolean> {
    const val = await settingsStore.get("ai_assistant_enabled");
    return val !== "false"; // Default enabled locally
  }

  /**
   * Set user consent for AI assistant.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    await settingsStore.set("ai_assistant_enabled", enabled ? "true" : "false");
  }

  /**
   * Answer a user's question grounded strictly in their saved captures.
   * If captures don't contain enough information, it abstains with a clear explanation.
   */
  async ask(
    query: string,
    options: {
      scope?: "all" | "context" | "project";
      scopeId?: string;
    } = {}
  ): Promise<GroundedAnswer> {
    const scope = options.scope || "all";
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      return {
        query,
        answer: "Please ask a question about your saved captures.",
        citations: [],
        confidence: 0,
        scope,
        abstentionReason: "empty_query",
      };
    }

    // 1. Gather candidate captures according to scope
    let candidates: Capture[] = [];
    if (scope === "context" && options.scopeId) {
      candidates = await capRepo.listByContext(options.scopeId);
    } else if (scope === "project" && options.scopeId) {
      candidates = await projRepo.listCaptures(options.scopeId);
    } else {
      candidates = await capRepo.listAll({ limit: 1000 });
    }

    candidates = candidates.filter((c) => !c.deleted_at);

    if (candidates.length === 0) {
      return {
        query,
        answer: `No captures found in this ${scope}. Try capturing some notes or articles first!`,
        citations: [],
        confidence: 0,
        scope,
        abstentionReason: "no_captures_in_scope",
      };
    }

    // 2. Rank candidates based on keyword and semantic query relevance
    const STOP_WORDS = new Set([
      "the", "and", "that", "this", "from", "with", "for", "have", "what", "which",
      "how", "when", "where", "why", "who", "make", "does", "are", "was", "were",
      "been", "into", "onto", "about", "can", "could", "would", "should", "your"
    ]);

    const queryTokens = stripDiacritics(cleanQuery)
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    if (queryTokens.length === 0) {
      return {
        query,
        answer: `I searched your captures, but found no specific keywords answering "${query}".`,
        citations: [],
        confidence: 0,
        scope,
        abstentionReason: "insufficient_grounding",
      };
    }

    const scored = candidates
      .map((cap) => {
        const text = `${cap.source_title || ""} ${cap.content_text || ""} ${cap.user_note || ""} ${(cap.tags || []).join(" ")}`.toLowerCase();
        let matchCount = 0;
        const matchedTerms: string[] = [];
        for (const token of queryTokens) {
          if (text.includes(token)) {
            matchCount++;
            matchedTerms.push(token);
          }
        }
        const score = matchCount / queryTokens.length;
        return { cap, score, matchedTerms };
      })
      .filter((item) => item.score >= 0.2) // require at least 20% content keyword match
      .sort((a, b) => b.score - a.score);

    // 3. Abstention test: if no candidate scored above threshold, abstain
    if (scored.length === 0) {
      return {
        query,
        answer: `I searched your ${candidates.length} captures in this ${scope}, but found no information answering "${query}". I only answer based on what you have captured.`,
        citations: [],
        confidence: 0,
        scope,
        abstentionReason: "insufficient_grounding",
      };
    }

    // 4. Construct citations from top matching captures
    const topMatches = scored.slice(0, 4);
    const citations: Citation[] = topMatches.map(({ cap }) => {
      const fullText = cap.content_text || cap.user_note || cap.source_title || "";
      return {
        capture_id: cap.capture_id,
        title: cap.source_title || cap.content_text?.slice(0, 50) || "Untitled Capture",
        domain: cap.source_domain,
        source_url: cap.source_url,
        snippet: fullText.slice(0, 160).trim() + (fullText.length > 160 ? "…" : ""),
      };
    });

    // 5. Synthesis: synthesize grounded answer from the cited captures
    const answerSections: string[] = [];
    answerSections.push(`Based on **${topMatches.length}** of your saved captures:\n`);

    for (let i = 0; i < topMatches.length; i++) {
      const { cap } = topMatches[i];
      const title = cap.source_title || "Capture";
      const excerpt = cap.content_text
        ? `"${cap.content_text.slice(0, 180).trim()}…"`
        : cap.user_note
        ? `Note: ${cap.user_note}`
        : "Link reference";

      answerSections.push(`- **[${i + 1}] ${title}**: ${excerpt}`);
    }

    const confidence = Math.min(1.0, topMatches[0].score);

    return {
      query,
      answer: answerSections.join("\n\n"),
      citations,
      confidence,
      scope,
    };
  }

  /**
   * Generates a synthesized research summary of a Context or Project.
   */
  async generateSummary(
    targetType: "context" | "project",
    targetId: string
  ): Promise<{ title: string; summary: string; keyThemes: string[]; citations: Citation[] }> {
    let title = "Summary";
    let captures: Capture[] = [];

    if (targetType === "context") {
      const ctx = await ctxRepo.get(targetId);
      title = ctx?.title || "Context Summary";
      captures = await capRepo.listByContext(targetId);
    } else {
      const prj = await projRepo.get(targetId);
      title = prj?.title || "Project Summary";
      captures = await projRepo.listCaptures(targetId);
    }

    captures = captures.filter((c) => !c.deleted_at);

    if (captures.length === 0) {
      return {
        title,
        summary: "No captures found to summarize.",
        keyThemes: [],
        citations: [],
      };
    }

    // Extract tags & domains as key themes
    const tagFreq: Record<string, number> = {};
    const domains = new Set<string>();
    for (const c of captures) {
      if (c.source_domain) domains.add(c.source_domain);
      for (const t of c.tags || []) {
        tagFreq[t] = (tagFreq[t] || 0) + 1;
      }
    }

    const keyThemes = Object.entries(tagFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    if (keyThemes.length === 0 && domains.size > 0) {
      keyThemes.push(...Array.from(domains).slice(0, 4));
    }

    const citations: Citation[] = captures.slice(0, 6).map((c) => ({
      capture_id: c.capture_id,
      title: c.source_title || c.content_text?.slice(0, 40) || "Capture",
      domain: c.source_domain,
      source_url: c.source_url,
      snippet: (c.content_text || c.user_note || "").slice(0, 140),
    }));

    const summaryParts: string[] = [
      `### Research Summary: ${title}`,
      `This collection contains **${captures.length} captures** across **${domains.size} sources**.`,
      `**Key Focus Areas:** ${keyThemes.length > 0 ? keyThemes.map((t) => `#${t}`).join(", ") : "General research"}.`,
      `\n**Key Insights & Excerpts:**`,
    ];

    for (let i = 0; i < Math.min(captures.length, 5); i++) {
      const c = captures[i];
      const desc = c.content_text ? c.content_text.slice(0, 140) : c.user_note || c.source_title || "Reference";
      summaryParts.push(`- **[${i + 1}] ${c.source_title || "Source"}**: ${desc}`);
    }

    return {
      title,
      summary: summaryParts.join("\n\n"),
      keyThemes,
      citations,
    };
  }
}

export const aiAssistant = new AIAssistant();
