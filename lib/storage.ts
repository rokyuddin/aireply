/** BYOK settings persisted in chrome.storage.local. */
export interface Settings {
  apiKey: string;
  /** OpenAI-compatible base URL, e.g. https://openrouter.ai/api/v1 */
  baseUrl: string;
  /** Vision-capable model id, e.g. google/gemini-2.5-flash */
  model: string;
  /** Free-text persona / tone instruction appended to the system prompt. */
  persona: string;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'google/gemini-2.5-flash',
  persona: '',
};

export async function getSettings(): Promise<Settings> {
  const stored = (await chrome.storage.local.get(null)) as Partial<
    Record<keyof Settings, unknown>
  >;
  const str = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v.trim() ? v : fallback;
  return {
    apiKey: str(stored.apiKey, DEFAULT_SETTINGS.apiKey),
    baseUrl: str(stored.baseUrl, DEFAULT_SETTINGS.baseUrl),
    model: str(stored.model, DEFAULT_SETTINGS.model),
    persona: typeof stored.persona === 'string' ? stored.persona : '',
  };
}

export async function saveSettings(partial: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(partial);
}
