import { defineConfig } from 'wxt';

export default defineConfig({
  modules: [],
  manifest: {
    name: 'AIReply — AI reply drafts for Facebook',
    description:
      'Generate AI reply drafts for Facebook posts and comments. You review and post the reply yourself.',
    permissions: ['storage'],
    host_permissions: [
      'https://*.facebook.com/*',
      'https://*.fbcdn.net/*',
      'https://openrouter.ai/*',
      'https://api.openai.com/*',
      'https://api.groq.com/*',
      'https://generativelanguage.googleapis.com/*',
    ],
  },
});
