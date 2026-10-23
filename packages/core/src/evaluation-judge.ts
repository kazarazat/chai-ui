/**
 * The opt-in evaluation judge: after a text or image result arrives, a
 * model the builder names checks it against the builder's own criteria,
 * and each check becomes a pass or fail tag on the result. Chai writes the
 * framing; what "good" means is the builder's, in `checks`.
 */
import type { Evaluation } from "./types.js";

/** One thing the judge checks. `label` is the tag on the result; `criterion` says what passing means, in the builder's words. */
export interface EvaluationCheck {
  id: string;
  label: string;
  criterion: string;
  /** Only judge results of this kind, e.g. a look-and-feel check for images. Absent, text and image results both get it. */
  kind?: "text" | "image";
}

/** What a judge prompt is built from. A text result's words are in `text`; an image result is attached to the judge's request. */
export interface JudgePromptInput {
  prompt: string;
  output: { kind: "text"; text: string } | { kind: "image" };
  checks: EvaluationCheck[];
}

/** The checks when the builder gives none: one accuracy check. Replace or add to it for your app. */
export const DEFAULT_EVALUATION_CHECKS: EvaluationCheck[] = [
  {
    id: "matches-prompt",
    label: "Matches prompt",
    criterion: "The result does what the prompt asked for, with nothing important missing or wrong.",
  },
];

/** The prompt the judge model receives: the person's prompt, the result, and each check's criterion, answered as JSON. */
export function buildJudgePrompt({ prompt, output, checks }: JudgePromptInput): string {
  return [
    "You judge a result an AI app generated, against the app's own criteria. Be strict: pass a check only if the result clearly meets it.",
    `The person's prompt:\n"""\n${prompt}\n"""`,
    output.kind === "image" ? "The result is the attached image." : `The result:\n"""\n${output.text}\n"""`,
    `Criteria, by id:\n${checks.map((c) => `- ${c.id}: ${c.criterion}`).join("\n")}`,
    'Reply with only a JSON object mapping each id to true (passes) or false (fails), e.g. {"first-id": true, "second-id": false}.',
  ].join("\n\n");
}

/** The judge's verdicts as evaluations, in the checks' order: `null` when the reply has none it can read. */
export function parseJudgeReply(reply: string, checks: EvaluationCheck[]): Evaluation[] | null {
  const json = reply.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  let verdicts: Record<string, unknown>;
  try {
    verdicts = JSON.parse(json);
  } catch {
    return null;
  }
  const found = checks.flatMap((c) => {
    const passed = verdicts[c.id];
    return typeof passed === "boolean" ? [{ id: c.id, label: c.label, passed }] : [];
  });
  return found.length > 0 ? found : null;
}
