import { collectChatGptConversationByScrolling } from '../src/extraction/chatgpt-conversation';
import { collectChatGptStructuredConversation } from '../src/extraction/chatgpt-structured-conversation';
import type { StructuredConversationDebugLog } from '../src/extraction/chatgpt-structured-conversation';
import { singleFlightCollector } from '../src/extraction/single-flight-collector';
import type { CollectionResult } from '../src/domain/conversation-draft';
import {
  COLLECTION_PROGRESS,
  isGetStructuredDebugLogMessage,
  isCollectConversationMessage,
  type GetStructuredDebugLogResponse,
  type CollectConversationResponse,
} from '../src/messaging/conversation';

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  runAt: 'document_idle',
  main() {
    let activeRequestId: string | undefined;
    let structuredDebugLog: StructuredConversationDebugLog | undefined;
    const collectOnce = singleFlightCollector(async () => {
      const requestId = activeRequestId;
      if (!requestId) {
        throw new Error('Conversation collection started without a request identifier.');
      }
      return collectConversation(requestId);
    });

    browser.runtime.onMessage.addListener((message, _sender, sendResponse): boolean | void => {
      if (isGetStructuredDebugLogMessage(message)) {
        const response: GetStructuredDebugLogResponse = structuredDebugLog
          ? { ok: true, log: structuredDebugLog }
          : { ok: false, error: 'No structured Conversation response has been captured yet.' };
        sendResponse(response);
        return;
      }

      if (!isCollectConversationMessage(message)) {
        return;
      }

      activeRequestId ??= message.requestId;
      void collectOnce()
        .then((result) => {
          const response: CollectConversationResponse = { ok: true, result };
          sendResponse(response);
        })
        .catch((error: unknown) => {
          const response: CollectConversationResponse = {
            ok: false,
            error: error instanceof Error ? error.message : 'Conversation extraction failed.',
          };
          sendResponse(response);
        })
        .finally(() => {
          if (activeRequestId === message.requestId) {
            activeRequestId = undefined;
          }
        });

      return true;
    });

    async function collectConversation(requestId: string): Promise<CollectionResult> {
      structuredDebugLog = undefined;
      try {
        return await collectChatGptStructuredConversation(
          document,
          window.fetch.bind(window),
          (log) => {
            structuredDebugLog = log;
          },
        );
      } catch (error) {
        const structuredFailure =
          error instanceof Error ? error.message : 'Structured conversation collection failed.';
        const fallback = await collectChatGptConversationByScrolling(document, (progress) => {
          void browser.runtime
            .sendMessage({
              type: COLLECTION_PROGRESS,
              requestId,
              messagesCollected: progress.itemsCollected,
              pass: progress.pass,
              position: progress.position,
              maximumPosition: progress.maximumPosition,
              elapsedMs: progress.elapsedMs,
              stablePasses: progress.stablePasses,
            })
            .catch(() => undefined);
        });

        return {
          ...fallback,
          warnings: [
            `Structured collection was unavailable (${structuredFailure}) The DOM scroll collector was used instead.`,
            ...fallback.warnings,
          ],
        };
      }
    }
  },
});
