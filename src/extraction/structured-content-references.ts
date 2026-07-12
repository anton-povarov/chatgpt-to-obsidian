/**
 * Replaces ChatGPT's structured content-reference markers with their visible
 * names. The marker text is a more reliable key than message offsets after
 * multiple structured text parts have been joined for Markdown export.
 */
export function replaceStructuredContentReferences(
  text: string,
  references: unknown,
): string {
  if (!Array.isArray(references)) {
    return text;
  }

  const replacements = new Map<string, string>();
  for (const reference of references) {
    if (!isRecord(reference)) {
      continue;
    }

    const matchedText = reference.matched_text;
    const name = reference.name;
    if (
      typeof matchedText === "string" &&
      matchedText.length > 0 &&
      typeof name === "string" &&
      name.trim().length > 0
    ) {
      replacements.set(matchedText, name.trim());
    }
  }

  let result = text;
  for (const [matchedText, name] of replacements) {
    result = result.split(matchedText).join(name);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
