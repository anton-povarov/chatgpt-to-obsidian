export interface ConversationSnapshot {
  title: string;
  sourceUrl: string;
  exportedAt: string;
  tags: string[];
  exchanges: Exchange[];
}

export interface Exchange {
  queryMarkdown: string;
  responseMarkdown: string;
  responseTimestamp?: string;
  responseDelaySeconds?: number;
  model?: string;
}
