// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { messageHtmlToMarkdown } from './html-to-markdown';

describe('messageHtmlToMarkdown', () => {
  it('preserves line breaks in pre-wrapped user queries', () => {
    const message = document.createElement('article');
    message.innerHTML = `
      <div class="whitespace-pre-wrap">explain this arm64 assembly
stp x29, x30, [sp, #-16]!
mov x29, sp
ret</div>
    `;

    expect(messageHtmlToMarkdown(message)).toBe(
      'explain this arm64 assembly\nstp x29, x30, [sp, #-16]!\nmov x29, sp\nret',
    );
  });

  it('preserves rich response structure and excludes controls', () => {
    const message = document.createElement('article');
    message.innerHTML = `
      <div class="markdown">
        <h1>Architecture</h1>
        <p>Use <strong>small</strong> modules and <a href="https://example.com/source">a citation</a>.</p>
        <blockquote><p>Keep boundaries explicit.</p></blockquote>
        <ul><li>Collector</li><li>Renderer</li></ul>
        <pre><code class="language-ts">const answer = 42;</code></pre>
        <table><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody><tr><td>A</td><td>B</td></tr></tbody></table>
        <p>Inline <span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">x^2</annotation></semantics></math></span></span>.</p>
        <div class="katex-display"><span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">a+b=c</annotation></semantics></math></span></span></div>
        <img src="https://example.com/chart.png" alt="Result chart" />
        <button>Copy</button>
      </div>
    `;

    const markdown = messageHtmlToMarkdown(message);

    expect(markdown).toContain('# Architecture');
    expect(markdown).toContain('**small**');
    expect(markdown).toContain('[a citation](https://example.com/source)');
    expect(markdown).toContain('> Keep boundaries explicit.');
    expect(markdown).toContain('-   Collector');
    expect(markdown).toContain('```ts\nconst answer = 42;\n```');
    expect(markdown).toContain('| Name | Role |');
    expect(markdown).toContain('$x^2$');
    expect(markdown).toContain('$$\na+b=c\n$$');
    expect(markdown).toContain('[Image: Result chart](https://example.com/chart.png)');
    expect(markdown).not.toContain('Copy');
  });
});
