import { isSafeObsidianNewUri } from '../obsidian/obsidian-save';

export const OPEN_OBSIDIAN_URI = 'open-obsidian-uri' as const;

export interface OpenObsidianUriMessage {
  type: typeof OPEN_OBSIDIAN_URI;
  tabId: number;
  uri: string;
}

export type OpenObsidianUriResponse =
  | { ok: true }
  | { ok: false; message: string };

export function isOpenObsidianUriMessage(value: unknown): value is OpenObsidianUriMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === OPEN_OBSIDIAN_URI &&
    'tabId' in value &&
    typeof value.tabId === 'number' &&
    Number.isInteger(value.tabId) &&
    value.tabId > 0 &&
    'uri' in value &&
    typeof value.uri === 'string' &&
    isSafeObsidianNewUri(value.uri)
  );
}
