export interface ExportProfile {
  vault: string;
  folder: string;
  defaultTags: string[];
  downloadImages: boolean;
}

export const DEFAULT_EXPORT_PROFILE: Readonly<ExportProfile> = Object.freeze({
  vault: '',
  folder: '',
  defaultTags: ['chatgpt'],
  downloadImages: false,
});
