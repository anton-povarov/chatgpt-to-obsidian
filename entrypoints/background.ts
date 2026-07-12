import { TOGGLE_EMBEDDED_POPUP } from '../src/messaging/conversation';
import {
  isOpenObsidianUriMessage,
  type OpenObsidianUriResponse,
} from '../src/messaging/obsidian';

export default defineBackground(() => {
  void browser.action.setPopup({ popup: '' });

  browser.action.onClicked.addListener((tab) => {
    if (!tab.id || !tab.url?.startsWith('https://chatgpt.com/')) {
      return;
    }
    void browser.tabs.sendMessage(tab.id, { type: TOGGLE_EMBEDDED_POPUP }).catch(() => undefined);
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse): true | void => {
    if (!isOpenObsidianUriMessage(message)) {
      return;
    }

    void browser.tabs
      .update(message.tabId, { url: message.uri })
      .then(() => {
        const response: OpenObsidianUriResponse = { ok: true };
        sendResponse(response);
      })
      .catch((error: unknown) => {
        const details = error instanceof Error ? ` ${error.message}` : '';
        const response: OpenObsidianUriResponse = {
          ok: false,
          message: `The browser could not send the request to Obsidian.${details}`,
        };
        sendResponse(response);
      });

    return true;
  });
});
