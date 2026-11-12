import { captures as capRepo } from "../../data/repositories";
import { Capture } from "../../shared/types";
import { stripDiacritics } from "../../shared/types";

export interface RelatedCaptureResult {
  capture: Capture;
  score: number; // 0.0 to 1.0
  commonTerms: string[];
}

export interface DuplicateCandidate {
  capture: Capture;
  reason: "exact_url" | "exact_content" | "high_text_similarity";
  score: number;
}

/**
 * Tokenize text into normalized unique word stems
 */
function tokenize(text: string): Set<string> {
  const words = stripDiacritics((text || "").toLowerCase())
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2); // ignore tiny stop-like words
  return new Set(words);
}

/**
 * Calculate Jaccard similarity coefficient between two sets of tokens
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): { score: number; common: string[] } {
  if (a.size === 0 || b.size === 0) return { score: 0, common: [] };

  const common: string[] = [];
  for (const item of a) {
    if (b.has(item)) common.push(item);
  }

  const unionSize = a.size + b.size - common.length;
  const score = unionSize === 0 ? 0 : common.length / unionSize;
  return { score, common };
}

export class SimilarityEngine {
  /**
   * Find captures related to a given capture based on keyword overlap,
   * domain affinity, and tag intersections.
   */
  async findRelated(captureId: string, limit = 5): Promise<RelatedCaptureResult[]> {
    const target = await capRepo.get(captureId);
    if (!target) return [];

    const all = await capRepo.listAll({ limit: 5000 });
    const targetTokens = tokenize(
      `${target.content_text || ""} ${target.user_note || ""} ${target.source_title || ""}`
    );
    const targetTags = new Set(target.tags || []);

    const results: RelatedCaptureResult[] = [];

    for (const other of all) {
      if (other.capture_id === captureId) continue;

      const otherTokens = tokenize(
        `${other.content_text || ""} ${other.user_note || ""} ${other.source_title || ""}`
      );
      const { score: textScore, common } = jaccardSimilarity(targetTokens, otherTokens);

      // Tag bonus (+0.2 per shared tag, max 0.4)
      let tagBonus = 0;
      for (const t of other.tags || []) {
        if (targetTags.has(t)) tagBonus += 0.2;
      }
      tagBonus = Math.min(0.4, tagBonus);

      // Domain bonus (+0.1 if from same source domain)
      const domainBonus =
        target.source_domain && other.source_domain && target.source_domain === other.source_domain
          ? 0.1
          : 0;

      const finalScore = Math.min(1.0, textScore * 0.7 + tagBonus + domainBonus);

      if (finalScore >= 0.15) {
        results.push({
          capture: other,
          score: Math.round(finalScore * 100) / 100,
          commonTerms: common.slice(0, 5),
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Find potential duplicate captures in the library
   */
  async findDuplicates(capture: Partial<Capture>): Promise<DuplicateCandidate[]> {
    const all = await capRepo.listAll({ limit: 5000 });
    const duplicates: DuplicateCandidate[] = [];

    const normText = (capture.content_text || "").trim().toLowerCase();
    const targetTokens = tokenize(normText);

    for (const other of all) {
      if (other.capture_id === capture.capture_id) continue;

      // 1. Exact URL match
      if (
        capture.source_url &&
        other.source_url &&
        capture.source_url.toLowerCase() === other.source_url.toLowerCase()
      ) {
        duplicates.push({
          capture: other,
          reason: "exact_url",
          score: 1.0,
        });
        continue;
      }

      // 2. Exact content text match (for non-trivial text)
      const otherNormText = (other.content_text || "").trim().toLowerCase();
      if (normText.length > 30 && normText === otherNormText) {
        duplicates.push({
          capture: other,
          reason: "exact_content",
          score: 0.98,
        });
        continue;
      }

      // 3. Very high text overlap (> 80% Jaccard)
      if (normText.length > 50) {
        const otherTokens = tokenize(otherNormText);
        const { score } = jaccardSimilarity(targetTokens, otherTokens);
        if (score >= 0.8) {
          duplicates.push({
            capture: other,
            reason: "high_text_similarity",
            score: Math.round(score * 100) / 100,
          });
        }
      }
    }

    duplicates.sort((a, b) => b.score - a.score);
    return duplicates;
  }
}

export const similarityEngine = new SimilarityEngine();

