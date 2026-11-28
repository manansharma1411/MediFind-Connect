import { AiExplanation } from './aiTypes.js';

export interface IExplanationEnhancer {
  enhanceSummary(params: {
    deterministicSummary: string;
    metrics: Record<string, number | string | boolean | null>;
  }): Promise<string>;
}

/**
 * Wraps an optional LLM explanation enhancer with strict numerical-integrity
 * validation and automatic deterministic fallback if the enhancer fails or
 * fabricates/alters numerical values.
 * Never receives patient PII or raw search events.
 */
export async function applySafeExplanationEnhancer(
  explanation: AiExplanation,
  enhancer?: IExplanationEnhancer
): Promise<AiExplanation> {
  if (!enhancer) {
    return explanation;
  }

  try {
    const candidate = await enhancer.enhanceSummary({
      deterministicSummary: explanation.summary,
      metrics: explanation.influencingMetrics,
    });

    if (!candidate || candidate.trim().length < 10) {
      return explanation;
    }

    // Guard: any numbers mentioned in the enhanced text must appear in the deterministic metrics/summary
    const allowedNumbers = new Set<string>();
    for (const val of Object.values(explanation.influencingMetrics)) {
      if (typeof val === 'number') allowedNumbers.add(String(val));
    }
    const baseNums = explanation.summary.match(/\d+(\.\d+)?/g) ?? [];
    for (const n of baseNums) allowedNumbers.add(n);

    const candidateNums = candidate.match(/\d+(\.\d+)?/g) ?? [];
    for (const n of candidateNums) {
      if (!allowedNumbers.has(n)) {
        return explanation; // Reject fabricated/altered numbers and fall back
      }
    }

    return {
      ...explanation,
      summary: candidate.trim(),
      explanationSource: 'LLM_VERIFIED_WITH_DETERMINISTIC_GUARD',
    };
  } catch {
    return explanation;
  }
}
