// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  collectChatGptConversation,
  getChatGptMessageCoordinates,
} from './chatgpt-conversation';

const fixturePath = resolve(
  process.cwd(),
  'src/extraction/__fixtures__/ordinary-conversation.html',
);

describe('collectChatGptConversation', () => {
  it('collects role-marked messages and excludes surrounding page controls', () => {
    document.write(readFileSync(fixturePath, 'utf8'));

    const result = collectChatGptConversation(document);

    expect(result.draft.title).toBe('Design a parser');
    expect(result.draft.exchanges).toEqual([
      {
        queryMarkdown: 'Design a parser',
        responseMarkdown: 'Start with a small grammar.',
      },
      {
        queryMarkdown: 'Can it support tables?',
        responseMarkdown: 'Yes, add a table node.',
      },
    ]);
    expect(JSON.stringify(result.draft)).not.toContain('Sidebar');
    expect(JSON.stringify(result.draft)).not.toContain('Share');
    expect(JSON.stringify(result.draft)).not.toContain('Copy');
    expect(result.warnings).toEqual([]);
  });

  it('warns when a query has no visible response', () => {
    document.body.innerHTML = '<div data-message-author-role="user">Still generating</div>';
    document.title = 'Pending | ChatGPT';

    const result = collectChatGptConversation(document);

    expect(result.draft.exchanges).toEqual([]);
    expect(result.warnings).toContain('1 unpaired message skipped.');
  });

  it('reads identity and conversation order from independently nested ancestors', () => {
    document.body.innerHTML = `
      <article data-testid="conversation-turn-42">
        <section data-message-id="message-abc">
          <div data-message-author-role="assistant">Answer</div>
        </section>
      </article>
    `;
    const message = document.querySelector<HTMLElement>('[data-message-author-role]');

    expect(message).not.toBeNull();
    expect(getChatGptMessageCoordinates(message!)).toEqual({
      identity: 'message-abc',
      order: 42,
    });
  });
});
