import axe from "axe-core";

/** The WCAG levels Chai targets: 2.0, 2.1 and 2.2, A and AA. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

/**
 * Runs axe on `root` and returns its WCAG violations, one line each:
 * "rule-id (impact): selector". Empty means axe found nothing; it can't
 * catch everything, so keyboard and screen-reader checks still matter.
 */
export async function wcagViolations(root: Element = document.body): Promise<string[]> {
  const { violations } = await axe.run(root, { runOnly: { type: "tag", values: WCAG_TAGS } });
  return violations.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(" ")}`));
}

