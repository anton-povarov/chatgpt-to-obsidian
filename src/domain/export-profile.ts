export interface ExportProfile {
  vault: string;
  folder: string;
  defaultTags: string[];
}

export const DEFAULT_EXPORT_PROFILE: Readonly<ExportProfile> = Object.freeze({
  vault: '',
  folder: '',
  defaultTags: ['chatgpt'],
});

export function normalizeExportProfile(value: unknown): ExportProfile {
  if (!isRecord(value)) {
    return copyDefaultExportProfile();
  }

  return {
    vault: normalizeText(value.vault),
    folder: normalizeText(value.folder),
    defaultTags: Array.isArray(value.defaultTags)
      ? normalizeTags(value.defaultTags.filter((tag): tag is string => typeof tag === 'string'))
      : [...DEFAULT_EXPORT_PROFILE.defaultTags],
  };
}

export function parseTagsInput(value: string): string[] {
  return normalizeTags(value.split(','));
}

export function formatTagsInput(tags: string[]): string {
  return tags.join(', ');
}

function copyDefaultExportProfile(): ExportProfile {
  return {
    vault: DEFAULT_EXPORT_PROFILE.vault,
    folder: DEFAULT_EXPORT_PROFILE.folder,
    defaultTags: [...DEFAULT_EXPORT_PROFILE.defaultTags],
  };
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTags(tags: string[]): string[] {
  const uniqueTags = new Set<string>();
  for (const tag of tags) {
    const normalized = tag.trim();
    if (normalized) {
      uniqueTags.add(normalized);
    }
  }
  return [...uniqueTags];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
