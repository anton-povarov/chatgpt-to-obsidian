import { describe, expect, it, vi } from 'vitest';

import {
  MAX_CONTENT_URI_LENGTH,
  MAX_FILENAME_BYTES,
  DEFAULT_VAULT_FOLDER,
  buildClipboardObsidianUri,
  buildContentObsidianUri,
  isSafeObsidianNewUri,
  prepareObsidianTarget,
  saveToObsidian,
} from './obsidian-save';

const validInput = {
  vault: 'Personal Notes',
  folder: 'Imports/ChatGPT',
  title: 'A useful Conversation',
  markdown: '---\ntitle: "Original"\n---\n\nEdited exactly.',
};

describe('prepareObsidianTarget', () => {
  it('builds a vault-relative file path and sanitizes separators and controls in the title', () => {
    expect(
      prepareObsidianTarget({
        ...validInput,
        title: '  A/B\\C:*?"<>|\u0000 title...  ',
      }),
    ).toEqual({
      ok: true,
      target: {
        vault: 'Personal Notes',
        file: 'Imports/ChatGPT/A-B-C- title',
      },
    });
  });

  it('uses the ChatGPT folder by default and normalizes backslash separators', () => {
    expect(prepareObsidianTarget({ ...validInput, folder: '' })).toMatchObject({
      ok: true,
      target: { file: `${DEFAULT_VAULT_FOLDER}/A useful Conversation` },
    });
    expect(prepareObsidianTarget({ ...validInput, folder: 'Imports\\ChatGPT' })).toMatchObject({
      ok: true,
      target: { file: 'Imports/ChatGPT/A useful Conversation' },
    });
  });

  it('uses the last active vault when the vault field is empty', () => {
    expect(prepareObsidianTarget({ ...validInput, vault: ' ' })).toMatchObject({
      ok: true,
      target: { vault: '', file: 'Imports/ChatGPT/A useful Conversation' },
    });
  });

  it('identifies invalid fields without changing Markdown', () => {
    expect(prepareObsidianTarget({ ...validInput, vault: 'Personal\u0000' })).toEqual({
      ok: false,
      message: 'Obsidian vault contains unsupported control characters.',
    });
    expect(prepareObsidianTarget({ ...validInput, title: '///' })).toEqual({
      ok: false,
      message: 'Enter a note title before saving.',
    });
    expect(prepareObsidianTarget({ ...validInput, folder: '../Private' })).toEqual({
      ok: false,
      message: 'Vault folder must not contain empty, “.”, or “..” path segments.',
    });
    expect(prepareObsidianTarget({ ...validInput, markdown: '' })).toEqual({
      ok: false,
      message: 'The Markdown preview is empty.',
    });
    expect(
      prepareObsidianTarget({ ...validInput, folder: 'x'.repeat(MAX_CONTENT_URI_LENGTH) }),
    ).toEqual({
      ok: false,
      message: 'The configured vault and folder path is too long.',
    });
    expect(validInput.markdown).toContain('title: "Original"');
  });

  it('caps exceptionally long filenames by UTF-8 bytes without splitting characters', () => {
    const result = prepareObsidianTarget({ ...validInput, folder: '', title: '🙂'.repeat(100) });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const filename = result.target.file.split('/').at(-1) ?? '';
      expect(new TextEncoder().encode(filename)).toHaveLength(MAX_FILENAME_BYTES);
      expect(filename).toBe('🙂'.repeat(50));
    }
  });
});

describe('Obsidian URI construction', () => {
  const target = { vault: 'Personal Notes', file: 'Imports/ChatGPT/A & B' };

  it('requests clipboard transfer and opens the new note without mutation flags', () => {
    const first = buildClipboardObsidianUri(target);
    const duplicate = buildClipboardObsidianUri(target);

    expect(first).toBe(
      'obsidian://new?vault=Personal%20Notes&file=Imports%2FChatGPT%2FA%20%26%20B&clipboard',
    );
    expect(duplicate).toBe(first);
    expect(first).not.toMatch(/append|overwrite|merge/);
    expect(isSafeObsidianNewUri(first)).toBe(true);
  });

  it('uses complete Markdown only when the fallback URI is bounded', () => {
    const markdown = '# exact\n\ncontent & more';
    const uri = buildContentObsidianUri(target, markdown);
    expect(uri).toContain(`content=${encodeURIComponent(markdown)}`);
    expect(uri).not.toContain('clipboard');
    expect(isSafeObsidianNewUri(uri ?? '')).toBe(true);
    expect(buildContentObsidianUri(target, 'x'.repeat(MAX_CONTENT_URI_LENGTH))).toBeUndefined();
  });

  it('omits the vault parameter so Obsidian can use its last active vault', () => {
    const uri = buildClipboardObsidianUri({ vault: '', file: 'ChatGPT/A note' });
    expect(uri).toBe('obsidian://new?file=ChatGPT%2FA%20note&clipboard');
    expect(isSafeObsidianNewUri(uri)).toBe(true);
  });

  it('rejects unsafe or mutating URIs at the background boundary', () => {
    expect(isSafeObsidianNewUri('https://example.com')).toBe(false);
    expect(
      isSafeObsidianNewUri(
        'obsidian://new?vault=V&file=F&clipboard&overwrite=true',
      ),
    ).toBe(false);
    expect(
      isSafeObsidianNewUri(
        'obsidian://new?vault=V&file=F&clipboard&content=unexpected',
      ),
    ).toBe(false);
    expect(isSafeObsidianNewUri('obsidian://new?vault=V&file=F&silent=true&clipboard')).toBe(
      false,
    );
  });
});

describe('saveToObsidian', () => {
  it('copies the exact current Markdown before launching the clipboard URI', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const openUri = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      saveToObsidian(validInput, { clipboard: { writeText }, openUri }),
    ).resolves.toEqual({
      ok: true,
      transfer: 'clipboard',
      file: 'Imports/ChatGPT/A useful Conversation',
    });
    expect(writeText).toHaveBeenCalledWith(validInput.markdown);
    expect(openUri).toHaveBeenCalledWith(expect.stringContaining('&clipboard'));
  });

  it('falls back to bounded URI content after clipboard failure', async () => {
    const openUri = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      saveToObsidian(validInput, {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
        openUri,
      }),
    ).resolves.toMatchObject({ ok: true, transfer: 'uri-content' });
    expect(openUri).toHaveBeenCalledWith(
      expect.stringContaining(`content=${encodeURIComponent(validInput.markdown)}`),
    );
  });

  it('never launches a truncated long export when clipboard writing fails', async () => {
    const openUri = vi.fn();
    const result = await saveToObsidian(
      { ...validInput, markdown: 'x'.repeat(MAX_CONTENT_URI_LENGTH) },
      {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
        openUri,
      },
    );

    expect(result).toMatchObject({ ok: false, stage: 'clipboard' });
    expect(openUri).not.toHaveBeenCalled();
  });

  it('reports an immediate URI launch failure without claiming the note was created', async () => {
    await expect(
      saveToObsidian(validInput, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        openUri: vi.fn().mockResolvedValue({
          ok: false,
          message: 'The browser could not send the request to Obsidian.',
        }),
      }),
    ).resolves.toEqual({
      ok: false,
      stage: 'launch',
      message: 'The browser could not send the request to Obsidian.',
    });
  });
});
