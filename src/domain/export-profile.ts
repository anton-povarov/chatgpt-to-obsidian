export interface ExportProfile {
  vault: string;
  folder: string;
}

export const DEFAULT_EXPORT_PROFILE: Readonly<ExportProfile> = Object.freeze({
  vault: '',
  folder: '',
});

export function normalizeExportProfile(value: unknown): ExportProfile {
  if (!isRecord(value)) {
    return copyDefaultExportProfile();
  }

  return {
    vault: normalizeText(value.vault),
    folder: normalizeText(value.folder),
  };
}

function copyDefaultExportProfile(): ExportProfile {
  return {
    vault: DEFAULT_EXPORT_PROFILE.vault,
    folder: DEFAULT_EXPORT_PROFILE.folder,
  };
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
