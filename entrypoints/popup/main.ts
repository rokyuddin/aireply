import { getSettings, saveSettings } from '../../lib/storage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const views = [...document.querySelectorAll<HTMLElement>('[data-view]')];
const navItems = [...document.querySelectorAll<HTMLButtonElement>('[data-nav]')];

function showView(name: string): void {
  views.forEach((view) => view.classList.toggle('hidden', view.dataset.view !== name));
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.nav === name));
}

function message(id: string, text: string, error = false): void {
  const element = $(id);
  element.textContent = text;
  element.className = `message${error ? ' error' : ''}`;
  window.setTimeout(() => {
    element.textContent = '';
    element.className = 'message';
  }, 3500);
}

function syncProviderFields(apiKey: string, model: string): void {
  const hasKey = Boolean(apiKey?.trim());
  $('homeMode').textContent = hasKey ? 'OpenRouter is ready' : 'API key required';
  $('homeProvider').textContent = hasKey ? `Model: ${model || 'openrouter/free'}` : 'Add your free OpenRouter API key';
  $('providerName').textContent = 'OpenRouter AI';
  $('providerDetail').textContent = model || 'openrouter/free';
  const badge = document.querySelector('.status .badge') as HTMLElement;
  if (badge) {
    badge.textContent = hasKey ? 'ACTIVE' : 'SETUP REQUIRED';
    badge.style.background = hasKey ? '#e3f7ef' : '#fff4e5';
    badge.style.color = hasKey ? '#137653' : '#b25e00';
  }
}

async function load(): Promise<void> {
  const settings = await getSettings();
  ($('apiKey') as HTMLInputElement).value = settings.apiKey;
  ($('baseUrl') as HTMLInputElement).value = settings.baseUrl;
  ($('model') as HTMLInputElement).value = settings.model;
  ($('persona') as HTMLTextAreaElement).value = settings.persona;
  syncProviderFields(settings.apiKey, settings.model);
}

async function saveProvider(): Promise<void> {
  const apiKey = ($('apiKey') as HTMLInputElement).value.trim();
  const baseUrl = ($('baseUrl') as HTMLInputElement).value.trim();
  const model = ($('model') as HTMLInputElement).value.trim() || 'openrouter/free';
  if (!apiKey) {
    message('providerMessage', 'Please add your OpenRouter API key.', true);
    return;
  }
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    message('providerMessage', 'Base URL must start with http:// or https://.', true);
    return;
  }
  await saveSettings({ apiKey, baseUrl, model });
  syncProviderFields(apiKey, model);
  message('providerMessage', 'OpenRouter settings saved ✓');
}

async function savePreferences(): Promise<void> {
  await saveSettings({ persona: ($('persona') as HTMLTextAreaElement).value.trim() });
  message('settingsMessage', 'Preferences saved.');
}

navItems.forEach((item) => item.addEventListener('click', () => showView(item.dataset.nav ?? 'home')));
$('saveProvider').addEventListener('click', () => void saveProvider());
$('saveSettings').addEventListener('click', () => void savePreferences());
$('useAi').addEventListener('click', () => {
  void chrome.tabs.create({ url: 'https://www.facebook.com/' });
});
void load();