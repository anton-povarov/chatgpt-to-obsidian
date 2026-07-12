import type { CollectionResult, ConversationDraft } from '../domain/conversation-draft';
import type { Exchange } from '../domain/conversation-snapshot';
import { messageHtmlToMarkdown } from '../markdown/html-to-markdown';
import {
  collectByScrolling,
  type ScrollCollectionAdapter,
  type ScrollCollectionProgress,
} from './scroll-collector';

const MESSAGE_SELECTOR = '[data-message-author-role]';
const CHATGPT_TITLE_SUFFIX = /\s*[|·-]\s*ChatGPT\s*$/i;

type MessageRole = 'user' | 'assistant';

interface VisibleMessage {
  key: string;
  order?: number;
  role: MessageRole;
  markdown: string;
}

export function collectChatGptConversation(document: Document): CollectionResult {
  const messages = collectMessages(document);
  return buildCollectionResult(document, messages, []);
}

export async function collectChatGptConversationByScrolling(
  document: Document,
  onProgress?: (progress: ScrollCollectionProgress) => void,
): Promise<CollectionResult> {
  const scrollElement = findConversationScrollElement(document);
  const adapter: ScrollCollectionAdapter<VisibleMessage> = {
    getPosition: () => scrollElement.scrollTop,
    getMaximumPosition: () => scrollElement.scrollHeight - scrollElement.clientHeight,
    getViewportSize: () => scrollElement.clientHeight || document.documentElement.clientHeight || 1,
    scrollTo: (position) => scrollElement.scrollTo({ top: position, behavior: 'instant' }),
    collectItems: () => collectMessages(document),
    getItemKey: (message) => message.key,
    compareItems: compareMessagesByConversationOrder,
    waitForRender: waitForConversationRender,
  };
  const outcome = await collectByScrolling(adapter, { onProgress });
  const collectionWarnings: string[] = [];

  if (!outcome.stabilized) {
    const reason = outcome.timedOut
      ? 'Automatic collection timed out.'
      : outcome.cancelled
        ? 'Automatic collection was cancelled.'
        : outcome.failure
          ? `Automatic scrolling failed: ${outcome.failure}`
          : 'Automatic collection did not stabilize.';
    collectionWarnings.push(
      `${reason} This snapshot may be incomplete; manually scroll through the conversation and try again.`,
    );
  }

  if (outcome.restorationFailure) {
    collectionWarnings.push(
      `The original scroll position could not be restored: ${outcome.restorationFailure}`,
    );
  }

  return {
    ...buildCollectionResult(document, outcome.items, collectionWarnings),
    method: 'dom-scroll',
    diagnostics: {
      termination: outcome.diagnostics.termination,
      elapsedMs: outcome.diagnostics.elapsedMs,
      passes: outcome.diagnostics.passes,
      initialMessages: outcome.diagnostics.initialItems,
      traversedMessages: outcome.diagnostics.traversedItems,
      finalMessages: outcome.diagnostics.finalItems,
      originalScroll: {
        position: outcome.diagnostics.originalPosition,
        maximum: outcome.diagnostics.originalMaximumPosition,
      },
      lastScroll: {
        position: outcome.diagnostics.lastPosition,
        maximum: outcome.diagnostics.lastMaximumPosition,
      },
      restoredScroll: {
        position: outcome.diagnostics.restoredPosition,
        maximum: outcome.diagnostics.restoredMaximumPosition,
      },
    },
  };
}

function buildCollectionResult(
  document: Document,
  messages: VisibleMessage[],
  collectionWarnings: string[],
): CollectionResult {
  const warnings: string[] = [];

  if (messages.length === 0) {
    warnings.push('No ChatGPT message containers were found on this page.');
  }

  const { exchanges, skippedMessages } = pairExchanges(messages);

  if (skippedMessages > 0) {
    warnings.push(`${skippedMessages} unpaired message${skippedMessages === 1 ? '' : 's'} skipped.`);
  }

  warnings.push(...collectionWarnings);

  const draft: ConversationDraft = {
    title: extractConversationTitle(document),
    sourceUrl: document.location.href,
    exchanges,
  };

  return { draft, warnings };
}

function collectMessages(document: Document): VisibleMessage[] {
  const fallbackOccurrences = new Map<string, number>();

  return Array.from(document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR)).flatMap((element) => {
    const role = toMessageRole(element.dataset.messageAuthorRole);
    if (!role || element.hidden || element.getAttribute('aria-hidden') === 'true') {
      return [];
    }

    const markdown = messageHtmlToMarkdown(element);
    if (!markdown) {
      return [];
    }

    const { identity, order } = getChatGptMessageCoordinates(element);
    const fallbackKey = `${role}:content:${markdown}`;
    const occurrence = fallbackOccurrences.get(fallbackKey) ?? 0;
    fallbackOccurrences.set(fallbackKey, occurrence + 1);

    return [
      {
        key: identity ? `${role}:id:${identity}` : `${fallbackKey}:occurrence:${occurrence}`,
        order,
        role,
        markdown,
      },
    ];
  });
}

export function getChatGptMessageCoordinates(element: HTMLElement): {
  identity?: string;
  order?: number;
} {
  const identityContainer = element.closest<HTMLElement>('[data-message-id], [data-turn-id]');
  const turnContainer = element.closest<HTMLElement>(
    '[data-testid^="conversation-turn-"]',
  );
  const testId = turnContainer?.dataset.testid;
  const orderMatch = /^conversation-turn-(\d+)$/.exec(testId ?? '');

  return {
    identity:
      identityContainer?.dataset.messageId ??
      identityContainer?.dataset.turnId ??
      (testId?.startsWith('conversation-turn-') ? testId : undefined),
    order: orderMatch ? Number(orderMatch[1]) : undefined,
  };
}

function compareMessagesByConversationOrder(left: VisibleMessage, right: VisibleMessage): number {
  if (left.order === undefined || right.order === undefined) {
    return 0;
  }

  return left.order - right.order;
}

function findConversationScrollElement(document: Document): Element {
  const messageElements = Array.from(document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR));
  let candidate: HTMLElement | null = messageElements[0]?.parentElement ?? null;

  while (candidate) {
    const style = getComputedStyle(candidate);
    const scrollsVertically = /(auto|scroll|overlay)/.test(style.overflowY);
    const containsAllMessages = messageElements.every((message) => candidate?.contains(message));

    if (
      scrollsVertically &&
      candidate.scrollHeight > candidate.clientHeight + 1 &&
      containsAllMessages
    ) {
      return candidate;
    }

    candidate = candidate.parentElement;
  }

  return document.scrollingElement ?? document.documentElement;
}

function waitForConversationRender(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 200);
  });
}

function toMessageRole(value: string | undefined): MessageRole | undefined {
  return value === 'user' || value === 'assistant' ? value : undefined;
}

function pairExchanges(messages: VisibleMessage[]): {
  exchanges: Exchange[];
  skippedMessages: number;
} {
  const exchanges: Exchange[] = [];
  let pendingQuery: string | undefined;
  let skippedMessages = 0;

  for (const message of messages) {
    if (message.role === 'user') {
      if (pendingQuery) {
        skippedMessages += 1;
      }
      pendingQuery = message.markdown;
      continue;
    }

    if (!pendingQuery) {
      skippedMessages += 1;
      continue;
    }

    exchanges.push({
      queryMarkdown: pendingQuery,
      responseMarkdown: message.markdown,
    });
    pendingQuery = undefined;
  }

  if (pendingQuery) {
    skippedMessages += 1;
  }

  return { exchanges, skippedMessages };
}

function extractConversationTitle(document: Document): string {
  const title = document.title.replace(CHATGPT_TITLE_SUFFIX, '').trim();
  return title && title.toLowerCase() !== 'chatgpt' ? title : 'Untitled ChatGPT conversation';
}
