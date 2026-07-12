import type { CollectionResult, ConversationDraft } from '../domain/conversation-draft';
import type { Exchange } from '../domain/conversation-snapshot';

interface StructuredMessage {
  role: 'user' | 'assistant';
  markdown: string;
  createdAt?: number;
  model?: string;
}

interface ParsedConversation {
  draft: ConversationDraft;
  warnings: string[];
}

type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function collectChatGptStructuredConversation(
  document: Document,
  fetchFunction: FetchFunction = fetch,
): Promise<CollectionResult> {
  const conversationId = extractConversationId(document.location.href);
  if (!conversationId) {
    throw new Error('The current page URL does not contain a ChatGPT Conversation ID.');
  }

  const accessToken = await fetchSessionAccessToken(document.location.origin, fetchFunction);
  const endpoint = new URL(
    `/backend-api/conversation/${encodeURIComponent(conversationId)}`,
    document.location.origin,
  );
  const response = await fetchFunction(endpoint, {
    method: 'GET',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`ChatGPT structured conversation request failed with status ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('ChatGPT returned a non-JSON structured conversation response.');
  }

  const parsed = parseChatGptConversationGraph(payload, document.location.href);
  if (parsed.draft.exchanges.length === 0) {
    throw new Error('ChatGPT structured conversation data contained no complete Exchanges.');
  }

  return { ...parsed, method: 'structured-data' };
}

async function fetchSessionAccessToken(
  origin: string,
  fetchFunction: FetchFunction,
): Promise<string> {
  const response = await fetchFunction(new URL('/api/auth/session', origin), {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`ChatGPT session request failed with status ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('ChatGPT returned a non-JSON session response.');
  }

  if (!isRecord(payload) || typeof payload.accessToken !== 'string' || !payload.accessToken) {
    throw new Error('The active ChatGPT session did not provide an access token.');
  }

  return payload.accessToken;
}

export function parseChatGptConversationGraph(
  payload: unknown,
  sourceUrl: string,
): ParsedConversation {
  if (!isRecord(payload) || !isRecord(payload.mapping) || typeof payload.current_node !== 'string') {
    throw new Error('ChatGPT structured conversation data has an unsupported shape.');
  }

  const nodes = traceCurrentBranch(payload.mapping, payload.current_node);
  const warnings: string[] = [];
  let unsupportedContentMessages = 0;
  const messages = nodes.flatMap((node): StructuredMessage[] => {
    const normalized = normalizeNodeMessage(node, payload.default_model_slug);
    if (normalized === 'unsupported') {
      unsupportedContentMessages += 1;
      return [];
    }
    return normalized ? [normalized] : [];
  });

  if (unsupportedContentMessages > 0) {
    warnings.push(
      `${unsupportedContentMessages} structured message${unsupportedContentMessages === 1 ? '' : 's'} used unsupported content and were omitted.`,
    );
  }

  const { exchanges, unpairedMessages } = pairStructuredMessages(messages);
  if (unpairedMessages > 0) {
    warnings.push(
      `${unpairedMessages} structured message${unpairedMessages === 1 ? '' : 's'} could not be paired.`,
    );
  }

  return {
    draft: {
      title:
        typeof payload.title === 'string' && payload.title.trim()
          ? payload.title.trim()
          : 'Untitled ChatGPT conversation',
      sourceUrl,
      exchanges,
    },
    warnings,
  };
}

export function extractConversationId(url: string): string | undefined {
  try {
    const match = /^\/c\/([^/?#]+)\/?$/.exec(new URL(url).pathname);
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function traceCurrentBranch(mapping: Record<string, unknown>, currentNodeId: string): unknown[] {
  const reversePath: unknown[] = [];
  const visited = new Set<string>();
  let nodeId: string | undefined = currentNodeId;

  while (nodeId) {
    if (visited.has(nodeId)) {
      throw new Error('ChatGPT structured conversation data contains a parent cycle.');
    }
    visited.add(nodeId);

    const node: unknown = mapping[nodeId];
    if (!isRecord(node)) {
      throw new Error(`ChatGPT structured conversation data is missing node ${nodeId}.`);
    }

    reversePath.push(node);
    nodeId = typeof node.parent === 'string' ? node.parent : undefined;
  }

  return reversePath.reverse();
}

function normalizeNodeMessage(
  node: unknown,
  defaultModel: unknown,
): StructuredMessage | 'unsupported' | undefined {
  if (!isRecord(node) || !isRecord(node.message)) {
    return undefined;
  }

  const message = node.message;
  const author = isRecord(message.author) ? message.author : undefined;
  const role = author?.role ?? message.role;
  if (role !== 'user' && role !== 'assistant') {
    return undefined;
  }

  const metadata = isRecord(message.metadata) ? message.metadata : {};
  if (metadata.is_visually_hidden_from_conversation === true) {
    return undefined;
  }

  const content = isRecord(message.content) ? message.content : undefined;
  if (!content || !Array.isArray(content.parts)) {
    return undefined;
  }

  const textParts = content.parts.flatMap((part): string[] => {
    if (typeof part === 'string') {
      return part.trim() ? [part] : [];
    }
    if (isRecord(part) && typeof part.text === 'string' && part.text.trim()) {
      return [part.text];
    }
    if (
      isRecord(part) &&
      part.type === 'text' &&
      typeof part.content === 'string' &&
      part.content.trim()
    ) {
      return [part.content];
    }
    return [];
  });

  if (textParts.length === 0) {
    const hasNonEmptyUnsupportedPart = content.parts.some(
      (part) => {
        if (typeof part === 'string' || part === null) {
          return false;
        }
        if (!isRecord(part)) {
          return true;
        }
        if (typeof part.text === 'string') {
          return false;
        }
        return !(part.type === 'text' && typeof part.content === 'string');
      },
    );
    return hasNonEmptyUnsupportedPart ? 'unsupported' : undefined;
  }

  return {
    role,
    markdown: textParts.join('\n\n').trim(),
    createdAt: toEpochSeconds(message.create_time),
    model:
      role === 'assistant'
        ? firstNonEmptyString(metadata.model_slug, metadata.model, defaultModel)
        : undefined,
  };
}

function pairStructuredMessages(messages: StructuredMessage[]): {
  exchanges: Exchange[];
  unpairedMessages: number;
} {
  const exchanges: Exchange[] = [];
  let pendingQuery: StructuredMessage | undefined;
  let responseMessages: StructuredMessage[] = [];
  let unpairedMessages = 0;

  const flush = () => {
    if (!pendingQuery) {
      unpairedMessages += responseMessages.length;
    } else if (responseMessages.length === 0) {
      unpairedMessages += 1;
    } else {
      const finalResponse = responseMessages.at(-1)!;
      const responseTimestamp = finalResponse.createdAt
        ? formatEpochSeconds(finalResponse.createdAt)
        : undefined;
      const responseDelaySeconds =
        pendingQuery.createdAt !== undefined && finalResponse.createdAt !== undefined
          ? Math.max(0, Math.round(finalResponse.createdAt - pendingQuery.createdAt))
          : undefined;

      exchanges.push({
        queryMarkdown: pendingQuery.markdown,
        responseMarkdown: responseMessages.map((message) => message.markdown).join('\n\n'),
        responseTimestamp,
        responseDelaySeconds,
        model: finalResponse.model,
      });
    }

    pendingQuery = undefined;
    responseMessages = [];
  };

  for (const message of messages) {
    if (message.role === 'user') {
      flush();
      pendingQuery = message;
    } else if (pendingQuery) {
      responseMessages.push(message);
    } else {
      unpairedMessages += 1;
    }
  }
  flush();

  return { exchanges, unpairedMessages };
}

function formatEpochSeconds(value: number): string {
  return new Date(value * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

function toEpochSeconds(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const milliseconds = Date.parse(value);
    return Number.isNaN(milliseconds) ? undefined : milliseconds / 1000;
  }
  return undefined;
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  return values.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
