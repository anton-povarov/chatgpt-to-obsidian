import { describe, expect, it } from 'vitest';

import { structuredAssistantTextToMarkdown } from './structured-assistant-text';

describe('structuredAssistantTextToMarkdown', () => {
  it('ports inline and display TeX to Obsidian MathJax delimiters', () => {
    expect(
      structuredAssistantTextToMarkdown(
        'Inline \\(a+b\\).\n\n\\[\n\\mathbf{A} \\cdot \\mathbf{B} = |\\mathbf{A}|\\,|\\mathbf{B}| \\cos \\theta\n\\]',
      ),
    ).toBe(
      'Inline $a+b$.\n\n$$\n\\mathbf{A} \\cdot \\mathbf{B} = |\\mathbf{A}|\\,|\\mathbf{B}| \\cos \\theta\n$$',
    );
  });

  it('removes unsupported whitespace inside inline math delimiters', () => {
    expect(
      structuredAssistantTextToMarkdown(
        'TeX-style \\( x^2 \\), dollar-style $ y^2 $, and currency $5 and $10.',
      ),
    ).toBe('TeX-style $x^2$, dollar-style $y^2$, and currency $5 and $10.');
  });

  it('leaves TeX-looking content inside inline and fenced code unchanged', () => {
    const markdown = [
      'Use `\\(literal\\)` and ``\\(also literal\\)``.',
      '',
      '```tex',
      '\\[',
      'not converted',
      '\\]',
      '```',
      '',
      'Actual \\(x^2\\).',
    ].join('\n');

    expect(structuredAssistantTextToMarkdown(markdown)).toBe(
      markdown.replace('Actual \\(x^2\\).', 'Actual $x^2$.'),
    );
  });

  it('preserves unmatched and escaped delimiter-like prose', () => {
    const markdown = [
      String.raw`Unmatched \( text; escaped \\(literal\\).`,
      String.raw`\[`,
      'unmatched display opener',
    ].join('\n');

    expect(structuredAssistantTextToMarkdown(markdown)).toBe(markdown);
  });

  it('preserves Markdown container prefixes around display math', () => {
    expect(structuredAssistantTextToMarkdown('> \\[\n> x+y\n> \\]')).toBe(
      '> $$\n> x+y\n> $$',
    );
  });
});
