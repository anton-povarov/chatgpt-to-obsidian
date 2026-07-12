import { collectChatGptConversationByScrolling } from '../src/extraction/chatgpt-conversation';
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

      void collectChatGptConversationByScrolling(document, (progress) => {
        void browser.runtime
          .sendMessage({
            type: COLLECTION_PROGRESS,
            requestId: message.requestId,
            messagesCollected: progress.itemsCollected,
            pass: progress.pass,
            position: progress.position,
            maximumPosition: progress.maximumPosition,
            elapsedMs: progress.elapsedMs,
            stablePasses: progress.stablePasses,
          })
          .catch(() => undefined);
      })
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
  },
});
