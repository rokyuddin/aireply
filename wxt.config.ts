import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'dist',
  modules: [],
  manifest: {
    name: 'AIReply — AI reply drafts for Facebook',
    description:
      'Generate AI reply drafts for Facebook posts and comments. You review and post the reply yourself.',
    icons: {
      '16': 'icons/16.png',
      '48': 'icons/48.png',
      '128': 'icons/128.png',
    },
    action: {
      default_title: 'Open AIReply',
      default_popup: 'popup/index.html',
    },
    permissions: ['storage'],
    host_permissions: [
      'https://*.facebook.com/*',
      'https://*.fbcdn.net/*',
      'https://app.manifest.build/*',
      'https://*.tokenharbor.ai/*',
      'https://tokenharbor.ai/*',
      'https://openrouter.ai/*',
      'https://api.openai.com/*',
      'https://api.groq.com/*',
      'https://generativelanguage.googleapis.com/*',
    ],
  },
});
