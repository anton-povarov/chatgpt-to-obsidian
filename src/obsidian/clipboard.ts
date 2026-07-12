export type ClipboardWriteResult =
  | { ok: true }
  | { ok: false; message: string };

export interface ClipboardWriter {
  writeText(text: string): Promise<void>;
}

export async function writeMarkdownToClipboard(
  markdown: string,
  clipboard: ClipboardWriter | undefined = navigator.clipboard,
): Promise<ClipboardWriteResult> {
  if (!clipboard || typeof clipboard.writeText !== 'function') {
    return {
      ok: false,
      message: 'Clipboard access is unavailable in this browser context.',
    };
  }

  try {
    await clipboard.writeText(markdown);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Could not copy the Markdown to the clipboard: ${error.message}`
          : 'Could not copy the Markdown to the clipboard.',
    };
  }
}
