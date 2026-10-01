/**
 * The instruction text `MediaAnalyzer` sends to an analysis model — one
 * complete, final string per (media kind × prompt length), not a template
 * with placeholders, so tuning the wording is just editing English.
 *
 * Phrase optimization (rewriting for the target model's known prompt
 * style) is folded directly into every prompt's wording below rather than
 * modeled as a separate option.
 */

export type MediaAnalysisKind = "image" | "video" | "audio";
export type MediaAnalysisPromptLength = "terse" | "concise" | "detailed";

const OPTIMIZE_CLAUSE =
  "Rewrite the description for the selected model's known prompt style before finishing.";
const RESPOND_ONLY = "Respond only with the description, no preamble.";

export const MEDIA_ANALYSIS_PROMPTS: Record<
  MediaAnalysisKind,
  Record<MediaAnalysisPromptLength, string>
> = {
  image: {
    terse: `Analyze the attached image and produce a terse, single-sentence description suitable as a generation seed prompt — subject and composition only. ${OPTIMIZE_CLAUSE} ${RESPOND_ONLY}`,
    concise: `Analyze the attached image and produce a concise description suitable as a generation seed prompt — subject, composition, and lighting in a few sentences. ${OPTIMIZE_CLAUSE} ${RESPOND_ONLY}`,
    detailed: `Analyze the attached image and produce a detailed description suitable as a generation seed prompt — subject, composition, lighting, color palette, and style, thorough enough to reproduce it closely. ${OPTIMIZE_CLAUSE} ${RESPOND_ONLY}`,
  },
  video: {
    terse: `Analyze the attached video's key frames and motion and produce a terse, single-sentence description suitable as a generation seed prompt — subject and camera movement only. ${OPTIMIZE_CLAUSE} ${RESPOND_ONLY}`,
    concise: `Analyze the attached video's key frames and motion — subject, action, camera movement, pacing — and produce a concise description suitable as a generation seed prompt. ${OPTIMIZE_CLAUSE} ${RESPOND_ONLY}`,
    detailed: `Analyze the attached video's key frames and motion — subject, action, camera movement, pacing, lighting, and style — and produce a detailed description suitable as a generation seed prompt, thorough enough to reproduce the shot closely. ${OPTIMIZE_CLAUSE} ${RESPOND_ONLY}`,
  },
  audio: {
    terse: `Analyze the attached audio and produce a terse, single-sentence description suitable as a generation seed prompt — content and voice/instrumentation only. ${OPTIMIZE_CLAUSE} ${RESPOND_ONLY}`,
    concise: `Analyze the attached audio — content, voice/instrumentation, tone, pacing — and produce a concise description suitable as a generation seed prompt. ${OPTIMIZE_CLAUSE} ${RESPOND_ONLY}`,
    detailed: `Analyze the attached audio — content, voice/instrumentation, tone, pacing, and production style — and produce a detailed description suitable as a generation seed prompt, thorough enough to reproduce it closely. ${OPTIMIZE_CLAUSE} ${RESPOND_ONLY}`,
  },
};

export const DEFAULT_MEDIA_ANALYSIS_PROMPT_LENGTH: MediaAnalysisPromptLength = "concise";

export const MEDIA_ANALYSIS_PROMPT_LENGTHS: { value: MediaAnalysisPromptLength; label: string }[] = [
  { value: "terse", label: "Terse" },
  { value: "concise", label: "Concise" },
  { value: "detailed", label: "Detailed" },
];
