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

function syncProviderFields(systemAi: boolean): void {
  $('customFields').classList.toggle('hidden', systemAi);
  $('homeMode').textContent = systemAi ? 'System AI is on' : 'Custom provider is on';
  $('homeProvider').textContent = systemAi ? 'No API key needed' : 'Using your saved API key';
  $('providerName').textContent = systemAi ? 'System AI' : 'Custom provider';
  $('providerDetail').textContent = systemAi ? 'Managed by AIReply' : ($('model') as HTMLInputElement).value || 'Configured locally';
}

async function load(): Promise<void> {
  const settings = await getSettings();
  ($('systemAi') as HTMLInputElement).checked = settings.systemAi;
  ($('apiKey') as HTMLInputElement).value = settings.apiKey;
  ($('baseUrl') as HTMLInputElement).value = settings.baseUrl;
  ($('model') as HTMLInputElement).value = settings.model;
  ($('persona') as HTMLTextAreaElement).value = settings.persona;
  syncProviderFields(settings.systemAi);
}

async function saveProvider(): Promise<void> {
  const systemAi = ($('systemAi') as HTMLInputElement).checked;
  const baseUrl = ($('baseUrl') as HTMLInputElement).value.trim();
  const apiKey = ($('apiKey') as HTMLInputElement).value.trim();
  if (!systemAi && !apiKey) {
    message('providerMessage', 'Add an API key or turn on System AI.', true);
    return;
  }
  if (!systemAi && baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    message('providerMessage', 'Base URL must start with http:// or https://.', true);
    return;
  }
  await saveSettings({ systemAi, apiKey, baseUrl, model: ($('model') as HTMLInputElement).value.trim() });
  syncProviderFields(systemAi);
  message('providerMessage', 'Provider saved.');
}

async function savePreferences(): Promise<void> {
  await saveSettings({ persona: ($('persona') as HTMLTextAreaElement).value.trim() });
  message('settingsMessage', 'Preferences saved.');
}

navItems.forEach((item) => item.addEventListener('click', () => showView(item.dataset.nav ?? 'home')));
$('systemAi').addEventListener('change', () => syncProviderFields(($('systemAi') as HTMLInputElement).checked));
$('saveProvider').addEventListener('click', () => void saveProvider());
$('saveSettings').addEventListener('click', () => void savePreferences());
$('useAi').addEventListener('click', () => {
  void chrome.tabs.create({ url: 'https://www.facebook.com/' });
});
void load();