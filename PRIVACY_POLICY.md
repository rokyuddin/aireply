# Privacy Policy for AIReply

**Last Updated**: September 7, 2026

AIReply ("we", "our", or "the extension") is a Chrome browser extension designed to help users generate draft replies for Facebook posts and comments using AI.

We take user privacy seriously. This policy outlines how information is handled by AIReply.

---

### 1. Information Collection and Handling

- **API Keys & Configuration**: AIReply operates on a Bring Your Own Key (BYOK) model. Your API keys, model selections, and custom persona prompts are stored locally in your browser using `chrome.storage.local`. They are never sent to our servers or any third-party telemetry/analytics services.
- **Post & Comment Content**: When you explicitly click the AIReply draft icon next to a comment box, the extension reads the text (and image URL if present) of that specific post to provide relevant context for drafting a reply.
- **AI Requests**: Post context is sent directly from your browser to your configured AI API provider (e.g., OpenRouter, OpenAI, Groq, or Google Gemini) over encrypted HTTPS.

---

### 2. What We Do NOT Collect

- We do not run background telemetry, trackers, or advertising scripts.
- We do not operate a centralized backend server that stores your Facebook activity, account details, or browsing history.
- We do not sell, rent, or monetize your data.
- We do not post or submit any comments automatically. All reply generation results in a draft that you must manually review, edit, and post.

---

### 3. Third-Party Services

When you use AIReply, the post context you request drafts for is processed according to the privacy policy of the AI provider you configure:
- OpenRouter: https://openrouter.ai/privacy
- OpenAI: https://openai.com/policies/privacy-policy
- Google Gemini: https://policies.google.com/privacy
- Groq: https://groq.com/privacy-policy/

---

### 4. Permissions Used

- `storage`: Persists your API key and user preferences locally in your browser.
- `host_permissions` (`*.facebook.com`, `*.fbcdn.net`): Enables injecting the draft button and retrieving images for visual understanding.
- `host_permissions` for AI providers: Allows your browser to communicate with your chosen AI API endpoints.

---

### 5. Contact Us

If you have questions about this privacy policy, please contact:
- Email: support@rokyuddin.com
- GitHub: https://github.com/rokyuddin/aireply-extension
