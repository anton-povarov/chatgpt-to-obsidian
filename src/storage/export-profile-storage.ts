import {
  normalizeExportProfile,
  type ExportProfile,
} from '../domain/export-profile';

export const EXPORT_PROFILE_STORAGE_KEY = 'exportProfile';

export interface ProfileStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export async function loadExportProfile(
  storage: ProfileStorageArea = browser.storage.local,
): Promise<ExportProfile> {
  const stored = await storage.get(EXPORT_PROFILE_STORAGE_KEY);
  return normalizeExportProfile(stored[EXPORT_PROFILE_STORAGE_KEY]);
}

export async function saveExportProfile(
  profile: ExportProfile,
  storage: ProfileStorageArea = browser.storage.local,
): Promise<void> {
  await storage.set({
    [EXPORT_PROFILE_STORAGE_KEY]: normalizeExportProfile(profile),
  });
}
