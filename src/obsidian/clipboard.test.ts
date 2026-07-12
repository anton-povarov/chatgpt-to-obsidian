import { describe, expect, it, vi } from 'vitest';

import { writeMarkdownToClipboard } from './clipboard';

describe('writeMarkdownToClipboard', () => {
  it('reports a successful clipboard write', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(writeMarkdownToClipboard('exact Markdown', { writeText })).resolves.toEqual({
      ok: true,
    });
    expect(writeText).toHaveBeenCalledWith('exact Markdown');
  });

  it('reports unavailable and rejected clipboard writes', async () => {
    await expect(writeMarkdownToClipboard('text', undefined)).resolves.toEqual({
      ok: false,
      message: 'Clipboard access is unavailable in this browser context.',
    });

    await expect(
      writeMarkdownToClipboard('text', {
        writeText: vi.fn().mockRejectedValue(new Error('permission denied')),
      }),
    ).resolves.toEqual({
      ok: false,
      message: 'Could not copy the Markdown to the clipboard: permission denied',
    });
  });
});
