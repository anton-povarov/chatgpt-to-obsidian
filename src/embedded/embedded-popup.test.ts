// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import {
  EMBEDDED_POPUP_CONTAINER_ID,
  toggleEmbeddedPopup,
} from './embedded-popup';

describe('toggleEmbeddedPopup', () => {
  it('opens a viewport-height extension iframe and closes it on the next toggle', () => {
    document.body.innerHTML = '<main>ChatGPT page</main>';

    const popupUrl = 'about:blank?context=embedded';
    expect(toggleEmbeddedPopup(document, popupUrl)).toBe('opened');

    const container = document.getElementById(EMBEDDED_POPUP_CONTAINER_ID);
    const iframe = container?.querySelector('iframe');
    expect(container?.style.position).toBe('fixed');
    expect(container?.style.top).toBe('12px');
    expect(container?.style.height).toBe('calc(100vh - 24px)');
    expect(container?.style.maxHeight).toBe('calc(100vh - 24px)');
    expect(iframe?.src).toBe(popupUrl);
    expect(iframe?.style.height).toBe('100%');

    expect(toggleEmbeddedPopup(document, popupUrl)).toBe('closed');
    expect(document.getElementById(EMBEDDED_POPUP_CONTAINER_ID)).toBeNull();
  });
});
