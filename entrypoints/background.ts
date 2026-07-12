import { TOGGLE_EMBEDDED_POPUP } from '../src/messaging/conversation';

export default defineBackground(() => {
  void browser.action.setPopup({ popup: '' });

  browser.action.onClicked.addListener((tab) => {
    if (!tab.id || !tab.url?.startsWith('https://chatgpt.com/')) {
      return;
    }
    void browser.tabs.sendMessage(tab.id, { type: TOGGLE_EMBEDDED_POPUP }).catch(() => undefined);
  });
});
