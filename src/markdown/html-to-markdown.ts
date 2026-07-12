import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const NON_CONTENT_SELECTOR = [
  'button',
  'script',
  'style',
  'textarea',
  '[aria-hidden="true"]',
  '[data-testid*="copy" i]',
].join(', ');

export function messageHtmlToMarkdown(element: HTMLElement): string {
  const content = findContentRoot(element).cloneNode(true) as HTMLElement;
  content.querySelectorAll(NON_CONTENT_SELECTOR).forEach((node) => node.remove());

  if (content.matches('[class*="whitespace-pre-wrap"]')) {
    return extractPreWrappedText(content);
  }

  const service = createTurndownService();
  return service.turndown(content).trim();
}

function findContentRoot(element: HTMLElement): HTMLElement {
  return (
    element.querySelector<HTMLElement>('.markdown') ??
    element.querySelector<HTMLElement>('[class*="whitespace-pre-wrap"]') ??
    element
  );
}

function extractPreWrappedText(element: HTMLElement): string {
  element.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith('\n'));
  return (element.textContent ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function createTurndownService(): TurndownService {
  const service = new TurndownService({
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    fence: '```',
    headingStyle: 'atx',
    linkStyle: 'inlined',
    strongDelimiter: '**',
  });

  service.use(gfm);

  service.addRule('chatgpt-fenced-code', {
    filter: 'pre',
    replacement: (_content, node) => renderCodeBlock(node as HTMLElement),
  });

  service.addRule('chatgpt-katex', {
    filter: (node) =>
      node instanceof HTMLElement &&
      node.classList.contains('katex') &&
      node.querySelector('annotation[encoding="application/x-tex"]') !== null,
    replacement: (_content, node) => renderKatex(node as HTMLElement),
  });

  service.addRule('linked-images', {
    filter: 'img',
    replacement: (_content, node) => renderImageLink(node as HTMLImageElement),
  });

  return service;
}

function renderCodeBlock(node: HTMLElement): string {
  const codeElement = node.querySelector('code');
  const code = (codeElement?.textContent ?? node.textContent ?? '').replace(/\n$/, '');
  const language = extractCodeLanguage(codeElement ?? node);
  const longestBacktickRun = Math.max(0, ...Array.from(code.matchAll(/`+/g), (match) => match[0].length));
  const fence = '`'.repeat(Math.max(3, longestBacktickRun + 1));

  return `\n\n${fence}${language}\n${code}\n${fence}\n\n`;
}

function extractCodeLanguage(element: Element): string {
  const classLanguage = Array.from(element.classList)
    .map((className) => /^(?:language|lang)-(.+)$/.exec(className)?.[1])
    .find(Boolean);

  return classLanguage ?? element.getAttribute('data-language') ?? '';
}

function renderKatex(node: HTMLElement): string {
  const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
  const tex = annotation?.textContent?.trim() ?? '';
  const isDisplay = node.closest('.katex-display') !== null;

  return isDisplay ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`;
}

function renderImageLink(node: HTMLImageElement): string {
  const source = node.getAttribute('src')?.trim();
  const description = node.getAttribute('alt')?.trim() || 'Image';

  if (!source || source.startsWith('data:') || source.startsWith('blob:')) {
    return description ? `[${description}]` : '';
  }

  return `[Image: ${escapeLinkLabel(description)}](${source})`;
}

function escapeLinkLabel(value: string): string {
  return value.replaceAll('[', '\\[').replaceAll(']', '\\]');
}
