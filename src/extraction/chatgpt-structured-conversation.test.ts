import { describe, expect, it, vi } from 'vitest';

import {
  collectChatGptStructuredConversation,
  extractConversationId,
  parseChatGptConversationGraph,
} from './chatgpt-structured-conversation';
import partialUnsupportedPayload from './__fixtures__/structured-partial-unsupported.json';

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
    expect(result.warnings).toEqual([
      '1 structured message could not be paired and was omitted.',
    ]);
  });

  it('retains common text, warns about unsupported content, and continues the branch', () => {
    const result = parseChatGptConversationGraph(
      partialUnsupportedPayload,
      'https://chatgpt.com/c/partial-unsupported',
    );

    expect(result.draft.exchanges).toEqual([
      {
        queryMarkdown: 'Research this topic',
        responseMarkdown: 'Recognized research summary',
        responseTimestamp: '2023-11-14 22:13:24',
        responseDelaySeconds: 4,
        model: 'research-model',
      },
      {
        queryMarkdown: 'Continue normally',
        responseMarkdown: 'Normal response after unsupported content',
        responseTimestamp: '2023-11-14 22:13:36',
        responseDelaySeconds: 6,
        model: 'text-model',
      },
    ]);
    expect(result.warnings).toEqual([
      '1 non-standard structured message could not be fully interpreted. Readable text was retained from 1; only unsupported portions were omitted. The rest of the Conversation was processed normally. Use “Download structured JSON (sensitive)” for node-level details.',
    ]);
    expect(result.messageDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeId: 'assistant-1', outcome: 'partial' }),
        expect.objectContaining({ nodeId: 'assistant-2', outcome: 'parsed' }),
      ]),
    );
    expect(
      result.messageDiagnostics.find((diagnostic) => diagnostic.nodeId === 'assistant-1')?.reasons,
    ).toEqual(
      expect.arrayContaining([
        'Unsupported content type: deep_research.',
        'A message part used an unsupported shape.',
      ]),
    );
  });

  it('skips an unsupported message without recognized text and continues processing', () => {
    const payload = structuredConversation([
      messageNode('user-1', null, 'user', ['First query']),
      messageNode('assistant-unsupported', 'user-1', 'assistant', [
        { type: 'computer_output', data: { omitted: true } },
      ], 'computer_output'),
      messageNode('user-2', 'assistant-unsupported', 'user', ['Second query']),
      messageNode('assistant-2', 'user-2', 'assistant', ['Second response']),
    ]);

    const result = parseChatGptConversationGraph(payload, 'https://chatgpt.com/c/id');

    expect(result.draft.exchanges).toEqual([
      expect.objectContaining({
        queryMarkdown: 'Second query',
        responseMarkdown: 'Second response',
      }),
    ]);
    expect(result.warnings).toEqual([
      '1 non-standard structured message could not be fully interpreted. 1 contained no readable text and was skipped. The rest of the Conversation was processed normally. Use “Download structured JSON (sensitive)” for node-level details.',
      '1 structured message could not be paired and was omitted.',
    ]);
  });

  it('warns when a message reports incomplete generation', () => {
    const payload = structuredSingleExchange({ content_type: 'text', parts: ['Partial response'] });
    Object.assign(payload.mapping.assistant.message, { status: 'in_progress' });

    const result = parseChatGptConversationGraph(payload, 'https://chatgpt.com/c/id');

    expect(result.draft.exchanges[0]?.responseMarkdown).toBe('Partial response');
    expect(result.warnings).toContain(
      '1 structured message appeared to be still generating or interrupted. The captured text may be incomplete.',
    );
  });

  it('retains an explicitly in-progress assistant node before any text arrives', () => {
    const payload = structuredSingleExchange({ content_type: 'text', parts: [] });
    Object.assign(payload.mapping.assistant.message, { status: 'streaming' });

    const result = parseChatGptConversationGraph(payload, 'https://chatgpt.com/c/id');

    expect(result.draft.exchanges).toHaveLength(1);
    expect(result.draft.exchanges[0]?.responseMarkdown).toBe('');
    expect(result.warnings).toContain(
      '1 structured message appeared to be still generating or interrupted. The captured text may be incomplete.',
    );
  });

  it('reports a visible tool-role message as unsupported and continues', () => {
    const user1 = messageNode('user-1', null, 'user', ['First query']);
    const tool = {
      id: 'tool',
      parent: 'user-1',
      message: {
        author: { role: 'tool' },
        content: { content_type: 'tool_result', parts: [{ redacted: true }] },
      },
    };
    const user2 = messageNode('user-2', 'tool', 'user', ['Second query']);
    const assistant2 = messageNode('assistant-2', 'user-2', 'assistant', ['Second response']);

    const result = parseChatGptConversationGraph(
      structuredConversation([user1, tool, user2, assistant2]),
      'https://chatgpt.com/c/id',
    );

    expect(result.draft.exchanges).toEqual([
      expect.objectContaining({
        queryMarkdown: 'Second query',
        responseMarkdown: 'Second response',
      }),
    ]);
    expect(result.warnings[0]).toBe(
      '1 non-standard structured message could not be fully interpreted. 1 contained no readable text and was skipped. The rest of the Conversation was processed normally. Use “Download structured JSON (sensitive)” for node-level details.',
    );
    expect(result.warnings[1]).toBe('1 structured message could not be paired and was omitted.');
  });

  it('ignores model-editable context without producing a fidelity warning', () => {
    const user = messageNode('user', null, 'user', ['Question']);
    const modelContext = {
      id: 'model-context',
      parent: 'user',
      message: {
        author: { role: 'assistant' },
        status: 'finished_successfully',
        content: {
          content_type: 'model_editable_context',
          model_set_context: 'internal context omitted from the visible Conversation',
          structured_context: null,
        },
        metadata: { can_save: false },
      },
    };
    const assistant = messageNode('assistant', 'model-context', 'assistant', ['Visible response']);

    const result = parseChatGptConversationGraph(
      structuredConversation([user, modelContext, assistant]),
      'https://chatgpt.com/c/id',
    );

    expect(result.draft.exchanges).toEqual([
      expect.objectContaining({
        queryMarkdown: 'Question',
        responseMarkdown: 'Visible response',
      }),
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.messageDiagnostics).toContainEqual({
      nodeId: 'model-context',
      role: 'assistant',
      contentType: 'model_editable_context',
      outcome: 'ignored',
      reasons: ['Internal content type model_editable_context is not user-visible.'],
    });
  });

  it('groups consecutive assistant nodes and uses final-response metadata', () => {
    const user = messageNode('user', null, 'user', ['Question']);
    const firstAssistant = messageNode('assistant-1', 'user', 'assistant', ['Thinking step']);
    const finalAssistant = messageNode(
      'assistant-2',
      'assistant-1',
      'assistant',
      ['Final answer'],
    );
    Object.assign(user.message, { create_time: 1_700_000_000 });
    Object.assign(firstAssistant.message, {
      create_time: 1_700_000_002,
      metadata: { model_slug: 'intermediate-model' },
    });
    Object.assign(finalAssistant.message, {
      create_time: 1_700_000_005,
      metadata: { model_slug: 'final-model' },
    });

    const result = parseChatGptConversationGraph(
      structuredConversation([user, firstAssistant, finalAssistant]),
      'https://chatgpt.com/c/id',
    );

    expect(result.draft.exchanges).toEqual([
      {
        queryMarkdown: 'Question',
        responseMarkdown: 'Thinking step\n\nFinal answer',
        responseTimestamp: '2023-11-14 22:13:25',
        responseDelaySeconds: 5,
        model: 'final-model',
      },
    ]);
  });

  it('omits missing metadata and ignores model metadata attached to a user message', () => {
    const payload = structuredSingleExchange({
      content_type: 'text',
      parts: ['Response without metadata'],
    });
    Object.assign(payload.mapping.user.message, {
      metadata: { model_slug: 'wrong-user-model' },
    });

    const result = parseChatGptConversationGraph(payload, 'https://chatgpt.com/c/id');
    const exchange = result.draft.exchanges[0];

    expect(exchange).toMatchObject({
      queryMarkdown: 'Query',
      responseMarkdown: 'Response without metadata',
    });
    expect(exchange?.responseTimestamp).toBeUndefined();
    expect(exchange?.responseDelaySeconds).toBeUndefined();
    expect(exchange?.model).toBeUndefined();
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
    const captureDebugLog = vi.fn();

    const result = await collectChatGptStructuredConversation(
      fakeDocument,
      fetchFunction,
      captureDebugLog,
    );

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
    expect(captureDebugLog).toHaveBeenCalledOnce();
    const debugLog = captureDebugLog.mock.calls[0]?.[0];
    expect(debugLog).toMatchObject({
      formatVersion: 1,
      sourceUrl: 'https://chatgpt.com/c/conversation-id',
      currentNode: 'assistant-2',
      conversationResponse: conversationPayload,
    });
    expect(debugLog.messageDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeId: 'assistant-2', outcome: 'parsed' }),
        expect.objectContaining({ nodeId: 'alternate-user', outcome: 'outside-visible-branch' }),
      ]),
    );
    expect(JSON.stringify(debugLog)).not.toContain('temporary-test-token');
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

  it('reports bounded Retry-After advice without retrying a rate-limited request', async () => {
    const fetchFunction = vi.fn(async (input: RequestInfo | URL) =>
      input.toString().endsWith('/api/auth/session')
        ? new Response(JSON.stringify({ accessToken: 'temporary-token' }))
        : new Response(null, { status: 429, headers: { 'retry-after': '12.2' } }),
    );
    const fakeDocument = {
      location: new URL('https://chatgpt.com/c/conversation-id'),
    } as unknown as Document;

    await expect(
      collectChatGptStructuredConversation(fakeDocument, fetchFunction),
    ).rejects.toThrow('rate limited. Try again in about 13 seconds.');
    expect(fetchFunction).toHaveBeenCalledTimes(2);
  });

  it('keeps an unsupported-only Conversation as a warned structured result', async () => {
    const unsupportedPayload = structuredConversation([
      messageNode('user', null, 'user', [
        { type: 'attachment', asset_pointer: 'redacted' },
      ], 'multimodal_text'),
    ]);
    const fetchFunction = vi.fn(async (input: RequestInfo | URL) =>
      new Response(
        JSON.stringify(
          input.toString().endsWith('/api/auth/session')
            ? { accessToken: 'temporary-token' }
            : unsupportedPayload,
        ),
      ),
    );
    const fakeDocument = {
      location: new URL('https://chatgpt.com/c/conversation-id'),
    } as unknown as Document;

    const result = await collectChatGptStructuredConversation(fakeDocument, fetchFunction);

    expect(result.method).toBe('structured-data');
    expect(result.draft.exchanges).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it('rejects a graph with no visible or partially recoverable messages', async () => {
    const emptyPayload = {
      title: 'Empty',
      current_node: 'root',
      mapping: { root: { id: 'root', parent: null, message: null } },
    };
    const fetchFunction = vi.fn(async (input: RequestInfo | URL) =>
      new Response(
        JSON.stringify(
          input.toString().endsWith('/api/auth/session')
            ? { accessToken: 'temporary-token' }
            : emptyPayload,
        ),
      ),
    );
    const fakeDocument = {
      location: new URL('https://chatgpt.com/c/conversation-id'),
    } as unknown as Document;

    await expect(
      collectChatGptStructuredConversation(fakeDocument, fetchFunction),
    ).rejects.toThrow('contained no complete Exchanges');
  });

  it('captures the raw Conversation response and parse error when graph parsing fails', async () => {
    const invalidPayload = { title: 'Invalid', mapping: {}, current_node: 'missing' };
    const fetchFunction = vi.fn(async (input: RequestInfo | URL) =>
      new Response(
        JSON.stringify(
          input.toString().endsWith('/api/auth/session')
            ? { accessToken: 'temporary-token' }
            : invalidPayload,
        ),
      ),
    );
    const captureDebugLog = vi.fn();
    const fakeDocument = {
      location: new URL('https://chatgpt.com/c/conversation-id'),
    } as unknown as Document;

    await expect(
      collectChatGptStructuredConversation(fakeDocument, fetchFunction, captureDebugLog),
    ).rejects.toThrow('missing node missing');
    expect(captureDebugLog).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationResponse: invalidPayload,
        parseError: 'ChatGPT structured conversation data is missing node missing.',
      }),
    );
    expect(JSON.stringify(captureDebugLog.mock.calls)).not.toContain('temporary-token');
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

function structuredConversation(nodes: Array<Record<string, unknown>>) {
  return {
    title: 'Synthetic structured conversation',
    current_node: nodes.at(-1)?.id,
    mapping: Object.fromEntries(nodes.map((node) => [node.id, node])),
  };
}

function messageNode(
  id: string,
  parent: string | null,
  role: 'user' | 'assistant',
  parts: unknown[],
  contentType = 'text',
) {
  return {
    id,
    parent,
    message: {
      author: { role },
      content: { content_type: contentType, parts },
    },
  };
}
