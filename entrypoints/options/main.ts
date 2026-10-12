import { getSettings, saveSettings } from '../../lib/storage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function load(): Promise<void> {
  const s = await getSettings();
  ($('apiKey') as HTMLInputElement).value = s.apiKey ?? '';
  ($('baseUrl') as HTMLInputElement).value = s.baseUrl;
  ($('model') as HTMLInputElement).value = s.model;
  ($('persona') as HTMLTextAreaElement).value = s.persona;
}

async function save(): Promise<void> {
  const baseUrl = ($('baseUrl') as HTMLInputElement).value.trim();
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    status('Base URL must start with http:// or https://', true);
    return;
  }
  await saveSettings({
    apiKey: ($('apiKey') as HTMLInputElement).value.trim(),
    baseUrl: baseUrl || 'https://openrouter.ai/api/v1',
    model: ($('model') as HTMLInputElement).value.trim() || 'openrouter/free',
    persona: ($('persona') as HTMLTextAreaElement).value.trim(),
  });
  status('Settings saved ✓ Open Facebook to use AIReply', false);
}

function status(text: string, isError = false): void {
  const el = $('status');
  el.textContent = text;
  el.className = isError ? 'error' : 'success';
  setTimeout(() => {
    el.textContent = '';
    el.className = '';
  }, 4000);
}

$('save').addEventListener('click', () => void save());
void load();
