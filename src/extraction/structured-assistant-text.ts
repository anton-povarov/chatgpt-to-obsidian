const FENCE = /^( {0,3})(`{3,}|~{3,})/;
const DISPLAY_DELIMITER = /^(\s*(?:(?:>\s*)+)?)(\\(?:\[|\]))\s*$/;

/**
 * Converts TeX delimiters in a raw structured assistant text part to the
 * MathJax delimiters used by Obsidian. This is the structured-data equivalent
 * of the DOM converter's `renderKatex` rule.
 */
export function structuredAssistantTextToMarkdown(text: string): string {
  const lines = text.split('\n');
  const displayDelimiterLines = findPairedDisplayDelimiterLines(lines);
  let fence: { character: string; length: number } | undefined;

  return lines
    .map((line, lineIndex) => {
      const fenceMatch = FENCE.exec(line);
      if (fenceMatch) {
        const marker = fenceMatch[2]!;
        if (!fence) {
          fence = { character: marker[0]!, length: marker.length };
        } else if (
          marker[0] === fence.character &&
          marker.length >= fence.length &&
          line.slice(fenceMatch[0].length).trim() === ''
        ) {
          fence = undefined;
        }
        return line;
      }

      if (fence) {
        return line;
      }

      const displayDelimiter = DISPLAY_DELIMITER.exec(line);
      if (displayDelimiter && displayDelimiterLines.has(lineIndex)) {
        return `${displayDelimiter[1]}$$`;
      }

      return convertInlineMathOutsideCode(line);
    })
    .join('\n');
}

function findPairedDisplayDelimiterLines(lines: string[]): Set<number> {
  const pairedLines = new Set<number>();
  let openingLineIndex: number | undefined;
  let fence: { character: string; length: number } | undefined;

  for (const [lineIndex, line] of lines.entries()) {
    const fenceMatch = FENCE.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[2]!;
      if (!fence) {
        fence = { character: marker[0]!, length: marker.length };
      } else if (
        marker[0] === fence.character &&
        marker.length >= fence.length &&
        line.slice(fenceMatch[0].length).trim() === ''
      ) {
        fence = undefined;
      }
      continue;
    }
    if (fence) {
      continue;
    }

    const delimiter = DISPLAY_DELIMITER.exec(line);
    if (delimiter?.[2] === '\\[') {
      openingLineIndex = lineIndex;
    } else if (delimiter?.[2] === '\\]' && openingLineIndex !== undefined) {
      pairedLines.add(openingLineIndex);
      pairedLines.add(lineIndex);
      openingLineIndex = undefined;
    }
  }

  return pairedLines;
}

function convertInlineMathOutsideCode(line: string): string {
  let result = '';
  let cursor = 0;

  for (const codeSpan of findCodeSpans(line)) {
    result += convertInlineMath(line.slice(cursor, codeSpan.start));
    result += line.slice(codeSpan.start, codeSpan.end);
    cursor = codeSpan.end;
  }

  return result + convertInlineMath(line.slice(cursor));
}

function findCodeSpans(line: string): Array<{ start: number; end: number }> {
  const runs = Array.from(line.matchAll(/`+/g));
  const spans: Array<{ start: number; end: number }> = [];

  for (let openingIndex = 0; openingIndex < runs.length; openingIndex += 1) {
    const opening = runs[openingIndex]!;
    const markerLength = opening[0].length;
    const closingOffset = runs
      .slice(openingIndex + 1)
      .findIndex((candidate) => candidate[0].length === markerLength);
    if (closingOffset === -1) {
      continue;
    }

    const closingIndex = openingIndex + closingOffset + 1;
    const closing = runs[closingIndex]!;
    spans.push({
      start: opening.index!,
      end: closing.index! + closing[0].length,
    });
    openingIndex = closingIndex;
  }

  return spans;
}

function convertInlineMath(value: string): string {
  const convertedTeXDelimiters = value.replace(
    /(?<!\\)\\\((.+?)(?<!\\)\\\)/g,
    (_match, tex: string) => `$${tex.trim()}$`,
  );

  // Obsidian does not recognize inline math when whitespace follows the
  // opening dollar. Requiring that whitespace also avoids treating ordinary
  // currency pairs such as "$5 and $10" as math.
  return convertedTeXDelimiters.replace(
    /(?<![\\$])\$(?!\$)\s+([^\n$]*?)(?<!\\)\$(?!\$)/g,
    (_match, tex: string) => `$${tex.trim()}$`,
  );
}
