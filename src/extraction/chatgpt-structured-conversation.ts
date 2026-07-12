import type { CollectionResult, ConversationDraft } from '../domain/conversation-draft';
import type { Exchange } from '../domain/conversation-snapshot';

interface StructuredMessage {
  role: 'user' | 'assistant';
  markdown: string;
  createdAt?: number;
  model?: string;
  incomplete: boolean;
}

interface ParsedConversation {
  draft: ConversationDraft;
  warnings: string[];
  messageDiagnostics: StructuredMessageDiagnostic[];
}

interface NormalizedNodeMessage {
  message?: StructuredMessage;
  unsupportedContent: boolean;
  outcome: 'parsed' | 'partial' | 'skipped' | 'ignored';
  reasons: string[];
}

interface TracedNode {
  id: string;
  node: Record<string, unknown>;
}

export interface StructuredMessageDiagnostic {
  nodeId: string;
  role?: string;
  contentType?: string;
  outcome: 'parsed' | 'partial' | 'skipped' | 'ignored' | 'outside-visible-branch';
  reasons: string[];
}

export interface StructuredConversationDebugLog {
  formatVersion: 1;
  capturedAt: string;
  sourceUrl: string;
  currentNode?: string;
  parseError?: string;
  messageDiagnostics: StructuredMessageDiagnostic[];
  conversationResponse: unknown;
}

type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const IGNORED_INTERNAL_CONTENT_TYPES = new Set(['model_editable_context']);

export async function collectChatGptStructuredConversation(
  document: Document,
  fetchFunction: FetchFunction = fetch,
  onDebugLog?: (log: StructuredConversationDebugLog) => void,
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
    if (response.status === 429) {
      const retryAdvice = formatRetryAdvice(response.headers.get('retry-after'));
      throw new Error(`ChatGPT structured conversation request was rate limited.${retryAdvice}`);
    }
    throw new Error(`ChatGPT structured conversation request failed with status ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('ChatGPT returned a non-JSON structured conversation response.');
  }

  let parsed: ParsedConversation;
  try {
    parsed = parseChatGptConversationGraph(payload, document.location.href);
  } catch (error) {
    onDebugLog?.(
      createDebugLog(payload, document.location.href, [], error instanceof Error ? error.message : 'Structured parsing failed.'),
    );
    throw error;
  }
  onDebugLog?.(createDebugLog(payload, document.location.href, parsed.messageDiagnostics));
  if (parsed.draft.exchanges.length === 0 && parsed.warnings.length === 0) {
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
    if (response.status === 429) {
      const retryAdvice = formatRetryAdvice(response.headers.get('retry-after'));
      throw new Error(`ChatGPT session request was rate limited.${retryAdvice}`);
    }
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
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const warnings: string[] = [];
  const messageDiagnostics: StructuredMessageDiagnostic[] = [];
  let unsupportedContentMessages = 0;
  let skippedUnsupportedMessages = 0;
  const messages = nodes.flatMap(({ id, node }): StructuredMessage[] => {
    const normalized = normalizeNodeMessage(node, payload.default_model_slug);
    messageDiagnostics.push(toMessageDiagnostic(id, node, normalized));
    if (normalized.unsupportedContent) {
      unsupportedContentMessages += 1;
      if (!normalized.message) {
        skippedUnsupportedMessages += 1;
      }
    }
    return normalized.message ? [normalized.message] : [];
  });

  for (const [nodeId, node] of Object.entries(payload.mapping)) {
    if (!visibleNodeIds.has(nodeId) && isRecord(node)) {
      messageDiagnostics.push({
        nodeId,
        ...readMessageIdentity(node),
        outcome: 'outside-visible-branch',
        reasons: ['Node is not on the ancestor path from current_node.'],
      });
    }
  }

  if (unsupportedContentMessages > 0) {
    const retainedMessages = unsupportedContentMessages - skippedUnsupportedMessages;
    warnings.push(
      formatUnsupportedContentWarning(
        unsupportedContentMessages,
        retainedMessages,
        skippedUnsupportedMessages,
      ),
    );
  }

  const { exchanges, unpairedMessages, incompleteMessages } = pairStructuredMessages(messages);
  if (unpairedMessages > 0) {
    const unpairedWarning = `${unpairedMessages} structured message${unpairedMessages === 1 ? '' : 's'} could not be paired and ${unpairedMessages === 1 ? 'was' : 'were'} omitted.`;
    warnings.push(unpairedWarning);
  }

  if (incompleteMessages > 0) {
    const incompleteWarning = `${incompleteMessages} structured message${incompleteMessages === 1 ? '' : 's'} appeared to be still generating or interrupted. The captured text may be incomplete.`;
    warnings.push(incompleteWarning);
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
    messageDiagnostics,
  };
}

function formatUnsupportedContentWarning(
  total: number,
  retained: number,
  skipped: number,
): string {
  const messageLabel = `${total} non-standard structured message${total === 1 ? '' : 's'}`;
  const detail =
    retained > 0 && skipped > 0
      ? `Readable text was retained from ${retained}; ${skipped} with no readable text ${skipped === 1 ? 'was' : 'were'} skipped.`
      : retained > 0
        ? `Readable text was retained from ${retained}; only unsupported portions were omitted.`
        : `${skipped} contained no readable text and ${skipped === 1 ? 'was' : 'were'} skipped.`;
  return `${messageLabel} could not be fully interpreted. ${detail} The rest of the Conversation was processed normally. Use “Download structured JSON (sensitive)” for node-level details.`;
}

export function extractConversationId(url: string): string | undefined {
  try {
    const match = /^\/c\/([^/?#]+)\/?$/.exec(new URL(url).pathname);
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function traceCurrentBranch(mapping: Record<string, unknown>, currentNodeId: string): TracedNode[] {
  const reversePath: TracedNode[] = [];
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

    reversePath.push({ id: nodeId, node });
    if (node.parent !== undefined && node.parent !== null && typeof node.parent !== 'string') {
      throw new Error(`ChatGPT structured conversation node ${nodeId} has an invalid parent.`);
    }
    nodeId = typeof node.parent === 'string' ? node.parent : undefined;
  }

  return reversePath.reverse();
}

function normalizeNodeMessage(
  node: unknown,
  defaultModel: unknown,
): NormalizedNodeMessage {
  if (!isRecord(node) || !isRecord(node.message)) {
    return {
      unsupportedContent: false,
      outcome: 'ignored',
      reasons: ['Node does not contain a message object.'],
    };
  }

  const message = node.message;
  const author = isRecord(message.author) ? message.author : undefined;
  const role = author?.role ?? message.role;
  const metadata = isRecord(message.metadata) ? message.metadata : {};
  if (metadata.is_visually_hidden_from_conversation === true) {
    return {
      unsupportedContent: false,
      outcome: 'ignored',
      reasons: ['Message is marked as visually hidden.'],
    };
  }
  if (role !== 'user' && role !== 'assistant') {
    return role === 'system' || role === undefined
      ? {
          unsupportedContent: false,
          outcome: 'ignored',
          reasons: ['Message is not a visible user or assistant message.'],
        }
      : {
          unsupportedContent: true,
          outcome: 'skipped',
          reasons: [`Unsupported visible message role: ${String(role)}.`],
        };
  }
  const incomplete = isMessageIncomplete(message, metadata);

  const content = isRecord(message.content) ? message.content : undefined;
  const contentType =
    content && typeof content.content_type === 'string' ? content.content_type : undefined;
  if (contentType && IGNORED_INTERNAL_CONTENT_TYPES.has(contentType)) {
    return {
      unsupportedContent: false,
      outcome: 'ignored',
      reasons: [`Internal content type ${contentType} is not user-visible.`],
    };
  }
  if (!content || !Array.isArray(content.parts)) {
    return {
      unsupportedContent: true,
      outcome: 'skipped',
      reasons: ['Message content does not contain a supported parts array.'],
    };
  }

  const reasons: string[] = [];
  let unsupportedContent =
    contentType !== undefined && contentType !== 'text' && contentType !== 'multimodal_text';
  if (unsupportedContent) {
    reasons.push(`Unsupported content type: ${contentType}.`);
  }
  const textParts = content.parts.flatMap((part): string[] => {
    if (typeof part === 'string') {
      return part.trim() ? [part] : [];
    }
    if (isRecord(part) && typeof part.text === 'string') {
      if (part.type !== undefined && part.type !== 'text') {
        unsupportedContent = true;
        reasons.push(`Part with type ${String(part.type)} was only partially parsed.`);
      }
      return part.text.trim() ? [part.text] : [];
    }
    if (
      isRecord(part) &&
      part.type === 'text' &&
      typeof part.content === 'string'
    ) {
      return part.content.trim() ? [part.content] : [];
    }
    if (part !== null) {
      unsupportedContent = true;
      reasons.push('A message part used an unsupported shape.');
    }
    return [];
  });

  if (textParts.length === 0) {
    if (incomplete && !unsupportedContent) {
      return {
        unsupportedContent: false,
        outcome: 'parsed',
        reasons: ['Message is explicitly incomplete and does not contain text yet.'],
        message: {
          role,
          markdown: '',
          createdAt: toEpochSeconds(message.create_time),
          model:
            role === 'assistant'
              ? firstNonEmptyString(metadata.model_slug, metadata.model, defaultModel)
              : undefined,
          incomplete: true,
        },
      };
    }
    return unsupportedContent
      ? { unsupportedContent: true, outcome: 'skipped', reasons }
      : {
          unsupportedContent: false,
          outcome: 'ignored',
          reasons: ['Message contains no non-empty text.'],
        };
  }

  return {
    unsupportedContent,
    outcome: unsupportedContent ? 'partial' : 'parsed',
    reasons,
    message: {
      role,
      markdown: textParts.join('\n\n').trim(),
      createdAt: toEpochSeconds(message.create_time),
      model:
        role === 'assistant'
          ? firstNonEmptyString(metadata.model_slug, metadata.model, defaultModel)
          : undefined,
      incomplete,
    },
  };
}

function toMessageDiagnostic(
  nodeId: string,
  node: Record<string, unknown>,
  normalized: NormalizedNodeMessage,
): StructuredMessageDiagnostic {
  return {
    nodeId,
    ...readMessageIdentity(node),
    outcome: normalized.outcome,
    reasons: normalized.reasons,
  };
}

function readMessageIdentity(
  node: Record<string, unknown>,
): Pick<StructuredMessageDiagnostic, 'role' | 'contentType'> {
  const message = isRecord(node.message) ? node.message : undefined;
  const author = message && isRecord(message.author) ? message.author : undefined;
  const content = message && isRecord(message.content) ? message.content : undefined;
  const role = author?.role ?? message?.role;
  return {
    role: typeof role === 'string' ? role : undefined,
    contentType:
      typeof content?.content_type === 'string' ? content.content_type : undefined,
  };
}

function createDebugLog(
  payload: unknown,
  sourceUrl: string,
  messageDiagnostics: StructuredMessageDiagnostic[],
  parseError?: string,
): StructuredConversationDebugLog {
  return {
    formatVersion: 1,
    capturedAt: new Date().toISOString(),
    sourceUrl,
    currentNode:
      isRecord(payload) && typeof payload.current_node === 'string'
        ? payload.current_node
        : undefined,
    parseError,
    messageDiagnostics,
    conversationResponse: payload,
  };
}

function pairStructuredMessages(messages: StructuredMessage[]): {
  exchanges: Exchange[];
  unpairedMessages: number;
  incompleteMessages: number;
} {
  const exchanges: Exchange[] = [];
  let pendingQuery: StructuredMessage | undefined;
  let responseMessages: StructuredMessage[] = [];
  let unpairedMessages = 0;
  let incompleteMessages = 0;

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
    if (message.incomplete) {
      incompleteMessages += 1;
    }
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

  return { exchanges, unpairedMessages, incompleteMessages };
}

function isMessageIncomplete(
  message: Record<string, unknown>,
  metadata: Record<string, unknown>,
): boolean {
  return (
    message.status === 'in_progress' ||
    message.status === 'streaming' ||
    metadata.is_complete === false
  );
}

function formatRetryAdvice(retryAfter: string | null): string {
  if (!retryAfter) {
    return ' Try again later.';
  }

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return ` Try again in about ${Math.ceil(seconds)} seconds.`;
  }

  const retryAt = Date.parse(retryAfter);
  return Number.isNaN(retryAt)
    ? ' Try again later.'
    : ` Try again after ${new Date(retryAt).toISOString()}.`;
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
