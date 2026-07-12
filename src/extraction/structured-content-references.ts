const MARKER_START = "\uE200";
const MARKER_SEPARATOR = "\uE202";
const MARKER_END = "\uE201";
const CONTENT_REFERENCE_MARKER = /\uE200([^\uE201]*)\uE201/gu;

/**
 * Converts ChatGPT's structured content-reference markers to Markdown. The
 * marker text is a more reliable key than message offsets after multiple
 * structured text parts have been joined for export.
 */
export function replaceStructuredContentReferences(
  text: string,
  references: unknown,
): string {
  const replacements = new Map<string, string>();
  if (Array.isArray(references)) {
    for (const reference of references) {
      if (!isRecord(reference) || !isReferenceMarker(reference.matched_text)) {
        continue;
      }

      replacements.set(
        reference.matched_text,
        renderContentReference(reference, reference.matched_text),
      );
    }
  }

  let result = text;
  for (const [matchedText, replacement] of replacements) {
    result = result.split(matchedText).join(replacement);
  }

  // Private-use marker glyphs should never leak into the exported note, even
  // when ChatGPT adds a reference type that this version does not recognize.
  return result.replace(CONTENT_REFERENCE_MARKER, (_marker, content: string) =>
    humanizeMarkerContent(content),
  );
}

function renderContentReference(
  reference: Record<string, unknown>,
  matchedText: string,
): string {
  const name = nonEmptyString(reference.name);
  if (name) {
    return name;
  }

  const markerContent = matchedText.slice(1, -1);
  const markerType = markerContent.split(MARKER_SEPARATOR, 1)[0];
  if (reference.type === "grouped_webpages" || markerType === "cite") {
    const citation = renderWebCitation(reference.safe_urls);
    if (citation) {
      return citation;
    }
  }

  return (
    nonEmptyString(reference.alt) ?? humanizeMarkerContent(markerContent)
  );
}

function renderWebCitation(value: unknown): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const urls = new Map<string, URL>();
  for (const candidate of value) {
    if (typeof candidate !== "string") {
      continue;
    }

    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        continue;
      }
      if (url.searchParams.get("utm_source") === "chatgpt.com") {
        url.searchParams.delete("utm_source");
      }
      urls.set(url.href, url);
    } catch {
      // Ignore malformed values in an otherwise usable reference.
    }
  }

  if (urls.size === 0) {
    return undefined;
  }

  const links = Array.from(urls.values(), (url) => {
    const label = url.hostname.replace(/^www\./, "");
    const destination = url.href
      .replaceAll("(", "%28")
      .replaceAll(")", "%29");
    return `[${label}](${destination})`;
  });
  return `(${links.join(", ")})`;
}

function isReferenceMarker(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(MARKER_START) &&
    value.endsWith(MARKER_END)
  );
}

function humanizeMarkerContent(content: string): string {
  return content.split(MARKER_SEPARATOR).filter(Boolean).join("|") || "reference";
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
