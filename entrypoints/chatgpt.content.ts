import { collectChatGptConversationByScrolling } from '../src/extraction/chatgpt-conversation';
import { collectChatGptStructuredConversation } from '../src/extraction/chatgpt-structured-conversation';
import type { CollectionResult } from '../src/domain/conversation-draft';
import {
  COLLECTION_PROGRESS,
  isCollectConversationMessage,
  type CollectConversationResponse,
} from '../src/messaging/conversation';

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  runAt: 'document_idle',
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse): boolean | void => {
      if (!isCollectConversationMessage(message)) {
        return;
      }

      void collectConversation(message.requestId)
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
        });

      return true;
    });

    async function collectConversation(requestId: string): Promise<CollectionResult> {
      try {
        return await collectChatGptStructuredConversation(document, window.fetch.bind(window));
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
