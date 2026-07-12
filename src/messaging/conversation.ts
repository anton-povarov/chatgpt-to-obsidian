import type { CollectionResult } from '../domain/conversation-draft';
import type { StructuredConversationDebugLog } from '../extraction/chatgpt-structured-conversation';

export const COLLECT_CONVERSATION = 'collect-conversation' as const;
export const COLLECTION_PROGRESS = 'collection-progress' as const;
export const GET_STRUCTURED_DEBUG_LOG = 'get-structured-debug-log' as const;

export interface CollectConversationMessage {
  type: typeof COLLECT_CONVERSATION;
  requestId: string;
}

export interface CollectionProgressMessage {
  type: typeof COLLECTION_PROGRESS;
  requestId: string;
  messagesCollected: number;
  pass: number;
  position: number;
  maximumPosition: number;
  elapsedMs: number;
  stablePasses: number;
}

export interface CollectConversationResponse {
  ok: boolean;
  result?: CollectionResult;
  error?: string;
}

export interface GetStructuredDebugLogMessage {
  type: typeof GET_STRUCTURED_DEBUG_LOG;
}

export interface GetStructuredDebugLogResponse {
  ok: boolean;
  log?: StructuredConversationDebugLog;
  error?: string;
}

export function isCollectConversationMessage(value: unknown): value is CollectConversationMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === COLLECT_CONVERSATION &&
    'requestId' in value &&
    typeof value.requestId === 'string'
  );
}

export function isCollectionProgressMessage(value: unknown): value is CollectionProgressMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === COLLECTION_PROGRESS &&
    'requestId' in value &&
    typeof value.requestId === 'string' &&
    'messagesCollected' in value &&
    typeof value.messagesCollected === 'number' &&
    'pass' in value &&
    typeof value.pass === 'number' &&
    'position' in value &&
    typeof value.position === 'number' &&
    'maximumPosition' in value &&
    typeof value.maximumPosition === 'number' &&
    'elapsedMs' in value &&
    typeof value.elapsedMs === 'number' &&
    'stablePasses' in value &&
    typeof value.stablePasses === 'number'
  );
}

export function isGetStructuredDebugLogMessage(
  value: unknown,
): value is GetStructuredDebugLogMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === GET_STRUCTURED_DEBUG_LOG
  );
}
