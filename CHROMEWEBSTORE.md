# Chrome Web Store Listing — AIReply

> Last Updated: 2026-09-07

## Store Listing

**Extension Name** [REQUIRED]
AIReply — AI reply drafts for Facebook

**Short Description** [REQUIRED]
Generate contextual AI reply drafts for Facebook posts and comments. Draft-only workflow: you review, edit, and post manually.

**Detailed Description** [REQUIRED]
AIReply helps you write faster, more thoughtful replies on Facebook with the power of modern AI — while keeping you completely in control.

Unlike automatic bots that post on your behalf, AIReply is strictly a draft assistant. It places a discreet AI icon beside Facebook comment and reply boxes. With one click, it reads the post context (and attached images if supported by your chosen model) and drafts a natural reply directly in your composer box. You review, edit, and press Enter yourself.

KEY FEATURES
- In-context reply generation: Mounts cleanly beside Facebook comment and reply inputs
- Multi-modal context: Analyzes post text and attached images for context-aware responses
- Custom persona & tone: Define your preferred tone (casual, professional, witty, Banglish, etc.)
- Bring Your Own Key (BYOK): Works with OpenAI, OpenRouter, Groq, or Google Gemini APIs
- 100% manual review: AIReply never submits or auto-posts comments for you
- Privacy focused: Your API key and preferences remain stored locally on your machine

HOW TO USE
1. Install AIReply and open Extension Options (click the extension icon in your browser toolbar).
2. Enter your API key and choose your preferred provider/model (default is OpenRouter).
3. (Optional) Set your custom persona or reply guidelines.
4. Browse Facebook (facebook.com). Beside any comment box, click the AIReply gradient star icon.
5. Watch the reply draft appear, make any adjustments you like, and submit it yourself!

PRIVACY & SECURITY
AIReply operates on a Bring-Your-Own-Key model. Your API key and settings are stored locally in your browser (chrome.storage.local). Data is only sent to your chosen AI provider endpoint when you actively click the draft button. We do not track you, run analytics, or sell your data.

SUPPORT & FEEDBACK
Open an issue or get help at: https://github.com/rokyuddin/aireply-extension or email support@rokyuddin.com.

**Category** [REQUIRED]
Productivity (or Tools)

**Single Purpose** [REQUIRED]
Generates contextual AI reply drafts for Facebook posts and comments for the user to review and post manually.

**Primary Language** [REQUIRED]
English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `public/icons/128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ To capture | Facebook comment box with AIReply icon and drafted text |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ To capture | Extension Options / BYOK settings page |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Optional | Promo graphic |

### Screenshot Guidance
1. **Screenshot 1**: Go to Facebook, find a post or comment thread, click the AIReply icon, and take a 1280×800 screenshot showing the drafted reply in the comment composer.
2. **Screenshot 2**: Screenshot of `options.html` showing the clean settings UI with provider choice, model selection, and persona customization.

---

## Permissions Justification

| Permission / Host | Type | Justification (Paste into Developer Dashboard) |
|---|---|---|
| `storage` | permissions | Saves user API keys, selected AI model, custom persona, and provider base URL locally on the device using chrome.storage.local. |
| `https://*.facebook.com/*` | host_permissions | Required to inject the content script that renders the draft reply button and inserts drafted text into comment input fields on Facebook. |
| `https://*.fbcdn.net/*` | host_permissions | Required to fetch image previews attached to Facebook posts so vision-capable AI models can understand image context. |
| `https://openrouter.ai/*` | host_permissions | Required to send user-initiated prompt requests to the OpenRouter API endpoint configured by the user. |
| `https://api.openai.com/*` | host_permissions | Required to send user-initiated prompt requests to the OpenAI API endpoint when configured by the user. |
| `https://api.groq.com/*` | host_permissions | Required to send user-initiated prompt requests to the Groq API endpoint when configured by the user. |
| `https://generativelanguage.googleapis.com/*` | host_permissions | Required to send user-initiated prompt requests to the Google Gemini API endpoint when configured by the user. |

---

## Privacy & Data Use Disclosures

### Single Purpose
"Generates AI reply drafts for Facebook posts and comments upon user request."

### Data Types Collected
- **Website Content**: Checked.
  - *Does this data leave the user's device?*: **Yes** (sent strictly to the user-configured AI API endpoint, e.g. OpenRouter or OpenAI, to generate the reply).
  - *Data use certification*:
    - [x] Data is NOT sold to third parties.
    - [x] Data is NOT used or transferred for purposes unrelated to the core functionality.
    - [x] Data is NOT used or transferred to determine creditworthiness or for lending purposes.
- **Remote Code Declaration**: Select **"No, I am not using remote code."** (All JavaScript is bundled locally in the extension build).

---

## Privacy Policy URL

**Live URL**: `https://rokyuddin.com/aireply/privacy` (or GitHub Gist / repository markdown page)

---

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 0.1.1 | 2026-09-20 | Streaming AI replies, System AI default, and refreshed popup UI. | Ready to upload |
| 0.1.0 | 2026-09-07 | Initial release: Facebook comment draft injection, BYOK OpenAI-compatible client, vision image support, custom personas. | Published |
