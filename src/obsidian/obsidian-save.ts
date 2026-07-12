import {
  writeMarkdownToClipboard,
  type ClipboardWriter,
} from './clipboard';

export const MAX_FILENAME_BYTES = 200;
export const MAX_CONTENT_URI_LENGTH = 8_000;
export const DEFAULT_VAULT_FOLDER = 'ChatGPT';

export interface ObsidianSaveInput {
  vault: string;
  folder: string;
  title: string;
  markdown: string;
}

export interface ObsidianTarget {
  vault: string;
  file: string;
}

export type ObsidianSaveResult =
  | {
      ok: true;
      transfer: 'clipboard' | 'uri-content';
      file: string;
    }
  | {
      ok: false;
      stage: 'validation' | 'clipboard' | 'launch';
      message: string;
    };

interface SaveDependencies {
  clipboard?: ClipboardWriter;
  openUri(uri: string): Promise<{ ok: true } | { ok: false; message: string }>;
}

export function prepareObsidianTarget(input: ObsidianSaveInput):
  | { ok: true; target: ObsidianTarget }
  | { ok: false; message: string } {
  const vault = input.vault.trim();
  if (vault && hasControlCharacters(vault)) {
    return { ok: false, message: 'Obsidian vault contains unsupported control characters.' };
  }

  const title = sanitizeNoteTitle(input.title);
  if (!title) {
    return { ok: false, message: 'Enter a note title before saving.' };
  }
  if (!input.markdown) {
    return { ok: false, message: 'The Markdown preview is empty.' };
  }

  const folder = normalizeVaultFolder(input.folder.trim() || DEFAULT_VAULT_FOLDER);
  if (!folder.ok) {
    return folder;
  }

  const target = {
    vault,
    file: folder.value ? `${folder.value}/${title}` : title,
  };
  if (buildClipboardObsidianUri(target).length > MAX_CONTENT_URI_LENGTH) {
    return { ok: false, message: 'The configured vault and folder path is too long.' };
  }

  return { ok: true, target };
}

export function buildClipboardObsidianUri(target: ObsidianTarget): string {
  return buildObsidianUri(target, 'clipboard');
}

export function buildContentObsidianUri(
  target: ObsidianTarget,
  markdown: string,
): string | undefined {
  const uri = buildObsidianUri(target, 'content', markdown);
  return uri.length <= MAX_CONTENT_URI_LENGTH ? uri : undefined;
}

export async function saveToObsidian(
  input: ObsidianSaveInput,
  dependencies: SaveDependencies,
): Promise<ObsidianSaveResult> {
  const prepared = prepareObsidianTarget(input);
  if (!prepared.ok) {
    return { ok: false, stage: 'validation', message: prepared.message };
  }

  const clipboard = await writeMarkdownToClipboard(input.markdown, dependencies.clipboard);
  let uri: string;
  let transfer: 'clipboard' | 'uri-content';

  if (clipboard.ok) {
    uri = buildClipboardObsidianUri(prepared.target);
    transfer = 'clipboard';
  } else {
    const fallbackUri = buildContentObsidianUri(prepared.target, input.markdown);
    if (!fallbackUri) {
      return {
        ok: false,
        stage: 'clipboard',
        message: `${clipboard.message} This Conversation is too long for the safe URI fallback, so nothing was sent to Obsidian.`,
      };
    }
    uri = fallbackUri;
    transfer = 'uri-content';
  }

  const launched = await dependencies.openUri(uri);
  if (!launched.ok) {
    return { ok: false, stage: 'launch', message: launched.message };
  }

  return { ok: true, transfer, file: prepared.target.file };
}

export function isSafeObsidianNewUri(uri: string): boolean {
  if (uri.length > MAX_CONTENT_URI_LENGTH) {
    return false;
  }

  try {
    const parsed = new URL(uri);
    const hasClipboard = parsed.searchParams.has('clipboard');
    const hasContent = parsed.searchParams.has('content');
    return (
      parsed.protocol === 'obsidian:' &&
      parsed.hostname === 'new' &&
      Boolean(parsed.searchParams.get('file')) &&
      !parsed.searchParams.has('silent') &&
      hasClipboard !== hasContent &&
      !parsed.searchParams.has('append') &&
      !parsed.searchParams.has('prepend') &&
      !parsed.searchParams.has('overwrite')
    );
  } catch {
    return false;
  }
}

function buildObsidianUri(
  target: ObsidianTarget,
  transfer: 'clipboard' | 'content',
  markdown?: string,
): string {
  const parameters = [`file=${encodeURIComponent(target.file)}`];
  if (target.vault) {
    parameters.unshift(`vault=${encodeURIComponent(target.vault)}`);
  }
  parameters.push(
    transfer === 'clipboard' ? 'clipboard' : `content=${encodeURIComponent(markdown ?? '')}`,
  );
  return `obsidian://new?${parameters.join('&')}`;
}

function sanitizeNoteTitle(value: string): string {
  const compatibilityNormalized = value.normalize('NFKC');
  const meaningfulTitle = compatibilityNormalized
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\p{Cc}/gu, '')
    .trim()
    .replace(/[. ]+$/g, '');
  if (!meaningfulTitle) {
    return '';
  }

  const normalized = compatibilityNormalized
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\p{Cc}/gu, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim()
    .replace(/[. ]+$/g, '');

  return truncateUtf8(normalized, MAX_FILENAME_BYTES).trim().replace(/[. ]+$/g, '');
}

function normalizeVaultFolder(value: string):
  | { ok: true; value: string }
  | { ok: false; message: string } {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return { ok: true, value: '' };
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return {
      ok: false,
      message: 'Vault folder must not contain empty, “.”, or “..” path segments.',
    };
  }
  if (segments.some((segment) => hasControlCharacters(segment) || /[:*?"<>|]/.test(segment))) {
    return { ok: false, message: 'Vault folder contains unsupported filename characters.' };
  }
  if (segments.some((segment) => /[. ]$/.test(segment))) {
    return { ok: false, message: 'Vault folder segments must not end with a dot or space.' };
  }

  return { ok: true, value: segments.join('/') };
}

function truncateUtf8(value: string, maximumBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(value).length <= maximumBytes) {
    return value;
  }

  let result = '';
  for (const character of value) {
    if (encoder.encode(result + character).length > maximumBytes) {
      break;
    }
    result += character;
  }
  return result;
}

function hasControlCharacters(value: string): boolean {
  return /\p{Cc}/u.test(value);
}
