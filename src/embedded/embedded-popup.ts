export const EMBEDDED_POPUP_CONTAINER_ID = 'chatgpt-to-obsidian-embedded';

export function toggleEmbeddedPopup(document: Document, popupUrl: string): 'opened' | 'closed' {
  const existing = document.getElementById(EMBEDDED_POPUP_CONTAINER_ID);
  if (existing) {
    existing.remove();
    return 'closed';
  }

  const container = document.createElement('div');
  container.id = EMBEDDED_POPUP_CONTAINER_ID;
  Object.assign(container.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    width: '560px',
    maxWidth: 'calc(100vw - 24px)',
    height: 'calc(100vh - 24px)',
    maxHeight: 'calc(100vh - 24px)',
    zIndex: '2147483647',
    overflow: 'hidden',
    border: '1px solid rgba(47, 43, 58, 0.18)',
    borderRadius: '12px',
    background: '#f7f5fb',
    boxShadow: '0 16px 40px rgba(20, 16, 30, 0.24)',
  });

  const iframe = document.createElement('iframe');
  iframe.title = 'ChatGPT to Obsidian';
  iframe.allow = 'clipboard-write';
  iframe.src = popupUrl;
  Object.assign(iframe.style, {
    display: 'block',
    width: '100%',
    height: '100%',
    border: '0',
    background: '#f7f5fb',
  });
  container.append(iframe);
  document.body.append(container);
  return 'opened';
}
