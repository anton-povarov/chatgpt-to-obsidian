import type { Exchange } from './conversation-snapshot';

export interface ConversationDraft {
  title: string;
  sourceUrl: string;
  exchanges: Exchange[];
}

export interface CollectionResult {
  draft: ConversationDraft;
  warnings: string[];
  diagnostics?: CollectionDiagnostics;
}

export interface CollectionDiagnostics {
  termination: 'stabilized' | 'timed-out' | 'cancelled' | 'failed';
  elapsedMs: number;
  passes: number;
  initialMessages: number;
  traversedMessages: number;
  finalMessages: number;
  originalScroll: { position: number; maximum: number };
  lastScroll: { position: number; maximum: number };
  restoredScroll: { position: number; maximum: number };
}
