import { describe, expect, it, vi } from 'vitest';

import {
  collectChatGptStructuredConversation,
  extractConversationId,
  parseChatGptConversationGraph,
} from './chatgpt-structured-conversation';

const conversationPayload = {
  title: 'Structured conversation',
  current_node: 'assistant-2',
  default_model_slug: 'fallback-model',
  mapping: {
    root: {
      id: 'root',
      parent: null,
      children: ['user-1'],
      message: {
        author: { role: 'system' },
        content: { content_type: 'text', parts: [''] },
      },
    },
    'user-1': {
      id: 'user-1',
      parent: 'root',
      children: ['assistant-1'],
      message: {
        author: { role: 'user' },
        create_time: 1_700_000_000,
        content: { content_type: 'text', parts: ['First query'] },
      },
    },
    'assistant-1': {
      id: 'assistant-1',
      parent: 'user-1',
      children: ['user-2', 'alternate-user'],
      message: {
        author: { role: 'assistant' },
        create_time: 1_700_000_004,
        content: { content_type: 'text', parts: ['First response'] },
        metadata: { model_slug: 'gpt-test' },
      },
    },
    'user-2': {
      id: 'user-2',
      parent: 'assistant-1',
      children: ['hidden-assistant'],
      message: {
        author: { role: 'user' },
        create_time: 1_700_000_010,
        content: { content_type: 'text', parts: ['', 'Second query'] },
      },
    },
    'hidden-assistant': {
      id: 'hidden-assistant',
      parent: 'user-2',
      children: ['assistant-2'],
      message: {
        author: { role: 'assistant' },
        create_time: 1_700_000_011,
        content: { content_type: 'text', parts: ['Internal content'] },
        metadata: { is_visually_hidden_from_conversation: true },
      },
    },
    'assistant-2': {
      id: 'assistant-2',
      parent: 'hidden-assistant',
      children: [],
      message: {
        author: { role: 'assistant' },
        create_time: 1_700_000_016,
        content: { content_type: 'text', parts: ['Second response'] },
        metadata: { model_slug: 'gpt-test-2' },
      },
    },
    'alternate-user': {
      id: 'alternate-user',
      parent: 'assistant-1',
      children: [],
      message: {
        author: { role: 'user' },
        content: { content_type: 'text', parts: ['Hidden branch query'] },
      },
    },
  },
};

describe('parseChatGptConversationGraph', () => {
  it('walks only the current branch and includes response metadata', () => {
    const result = parseChatGptConversationGraph(
      conversationPayload,
      'https://chatgpt.com/c/conversation-id',
    );

    expect(result.draft).toEqual({
      title: 'Structured conversation',
      sourceUrl: 'https://chatgpt.com/c/conversation-id',
      exchanges: [
        {
          queryMarkdown: 'First query',
          responseMarkdown: 'First response',
          responseTimestamp: '2023-11-14 22:13:24',
          responseDelaySeconds: 4,
          model: 'gpt-test',
        },
        {
          queryMarkdown: 'Second query',
          responseMarkdown: 'Second response',
          responseTimestamp: '2023-11-14 22:13:36',
          responseDelaySeconds: 6,
          model: 'gpt-test-2',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('Hidden branch query');
    expect(JSON.stringify(result)).not.toContain('Internal content');
    expect(result.warnings).toEqual([]);
  });

  it('rejects an incomplete or cyclic graph', () => {
    expect(() =>
      parseChatGptConversationGraph(
        { mapping: {}, current_node: 'missing' },
        'https://chatgpt.com/c/id',
      ),
    ).toThrow('missing node missing');

    expect(() =>
      parseChatGptConversationGraph(
        { mapping: { loop: { parent: 'loop' } }, current_node: 'loop' },
        'https://chatgpt.com/c/id',
      ),
    ).toThrow('parent cycle');
  });

  it('keeps ordered text components while ignoring interspersed empty components', () => {
    const payload = structuredSingleExchange({
      content_type: 'multimodal_text',
      parts: [
        { type: 'text', content: '' },
        { type: 'text', content: 'Message 1' },
        { type: 'text', content: '' },
        { type: 'text', content: 'Message 2' },
      ],
    });

    const result = parseChatGptConversationGraph(payload, 'https://chatgpt.com/c/id');

    expect(result.draft.exchanges[0]?.responseMarkdown).toBe('Message 1\n\nMessage 2');
    expect(result.warnings).toEqual([]);
  });

  it('silently ignores a node containing only empty text components', () => {
    const payload = structuredSingleExchange({
      content_type: 'multimodal_text',
      parts: [{ type: 'text', content: '' }],
    });

    const result = parseChatGptConversationGraph(payload, 'https://chatgpt.com/c/id');

    expect(result.draft.exchanges).toEqual([]);
    expect(result.warnings).toEqual(['1 structured message could not be paired.']);
  });
});

describe('collectChatGptStructuredConversation', () => {
  it('requests only the current Conversation with ambient credentials', async () => {
    const fetchFunction = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      const body = url.endsWith('/api/auth/session')
        ? { accessToken: 'temporary-test-token' }
        : conversationPayload;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const location = new URL('https://chatgpt.com/c/conversation-id');
    const fakeDocument = { location } as unknown as Document;

    const result = await collectChatGptStructuredConversation(fakeDocument, fetchFunction);

    expect(fetchFunction).toHaveBeenNthCalledWith(
      1,
      new URL('https://chatgpt.com/api/auth/session'),
      {
        method: 'GET',
        credentials: 'include',
        headers: { accept: 'application/json' },
      },
    );
    expect(fetchFunction).toHaveBeenNthCalledWith(
      2,
      new URL('https://chatgpt.com/backend-api/conversation/conversation-id'),
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          accept: 'application/json',
          authorization: 'Bearer temporary-test-token',
        },
      },
    );
    expect(result.method).toBe('structured-data');
    expect(result.draft.exchanges).toHaveLength(2);
  });

  it('fails safely when the session does not provide an access token', async () => {
    const fetchFunction = vi.fn(async () =>
      new Response(JSON.stringify({ user: { name: 'User' } }), { status: 200 }),
    );
    const location = new URL('https://chatgpt.com/c/conversation-id');
    const fakeDocument = { location } as unknown as Document;

    await expect(
      collectChatGptStructuredConversation(fakeDocument, fetchFunction),
    ).rejects.toThrow('did not provide an access token');
    expect(fetchFunction).toHaveBeenCalledTimes(1);
  });
});

describe('extractConversationId', () => {
  it('accepts only ChatGPT Conversation routes', () => {
    expect(extractConversationId('https://chatgpt.com/c/abc-123')).toBe('abc-123');
    expect(extractConversationId('https://chatgpt.com/')).toBeUndefined();
    expect(extractConversationId('not a URL')).toBeUndefined();
  });
});

function structuredSingleExchange(assistantContent: Record<string, unknown>) {
  return {
    title: 'Content parts',
    current_node: 'assistant',
    mapping: {
      user: {
        parent: null,
        message: {
          author: { role: 'user' },
          content: { content_type: 'text', parts: ['Query'] },
        },
      },
      assistant: {
        parent: 'user',
        message: {
          author: { role: 'assistant' },
          content: assistantContent,
        },
      },
    },
  };
}
