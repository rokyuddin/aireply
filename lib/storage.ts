/** Settings persisted in chrome.storage.local. */
export interface Settings {
  apiKey: string;
  /** OpenAI-compatible base URL, default https://openrouter.ai/api/v1 */
  baseUrl: string;
  /** Model id, default openrouter/free */
  model: string;
  /** Free-text persona / tone instruction appended to the system prompt. */
  persona: string;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'openrouter/free',
  persona: '',
};

export async function getSettings(): Promise<Settings> {
  const stored = (await chrome.storage.local.get(null)) as Partial<
    Record<keyof Settings, unknown>
  >;
  const str = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v.trim() ? v : fallback;

  let baseUrl = str(stored.baseUrl, DEFAULT_SETTINGS.baseUrl);
  if (baseUrl.includes('manifest.build')) {
    baseUrl = DEFAULT_SETTINGS.baseUrl;
  }

  let model = str(stored.model, DEFAULT_SETTINGS.model);
  if (model === 'auto') {
    model = DEFAULT_SETTINGS.model;
  }

  return {
    apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : DEFAULT_SETTINGS.apiKey,
    baseUrl,
    model,
    persona: typeof stored.persona === 'string' ? stored.persona : '',
  };
}

export async function saveSettings(partial: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(partial);
}
