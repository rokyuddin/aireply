# Research 002 — OpenAI-compatible API selection & vision calling (browser-direct, BYOK)

Ticket: `wayfinder/tickets/002-api-provider-vision.md` · Researched: 2026-09-07
Context: Chrome MV3 extension, background service worker calls the API directly with the user's own key; goal is short mood-matched social replies (Bengali/English/Banglish) with image understanding.

---

## 1. Vision-capable models & cost/quality trade-offs

All four providers below expose an OpenAI-compatible `/v1/chat/completions` (or `/chat/completions` under a base URL) that accepts image inputs. Model IDs change often — always verify against the provider's live model list before shipping.

| Provider | Base URL | Candidate vision models | Rough cost (input/output per 1M tokens) | Notes for short social replies |
|---|---|---|---|---|
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4.1-mini`, `gpt-5-mini` class ("mini/nano" tier); check [models page](https://developers.openai.com/api/docs/models) | Mini tier ≈ $0.40–0.70 in / $1.60–2.80 out; image tokens: low detail = flat 85 tokens, high detail = 85 + 170/512px tile ([vision guide](https://developers.openai.com/api/docs/guides/images-vision), [pricing](https://openai.com/api/pricing/)) | Best instruction-following + Bengali quality; `detail: "low"` makes an image cost ~85 tokens (~$0.00003 on mini) — negligible |
| **Google (Gemini OpenAI-compat)** | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-2.5-flash` (deprecated, shutdown 2026-10-16), `gemini-3-flash-preview`, `gemini-3.1-flash-lite` ([compat docs](https://ai.google.dev/gemini-api/docs/openai), [pricing](https://ai.google.dev/gemini-api/docs/pricing)) | 2.5-flash: $0.30 / $2.50; 3-flash-preview: $0.50 / $3.00; 3.1-flash-lite: $0.25 / $1.50. Image ≈ 258 tokens flat at standard size | Cheapest text+vision tier; strong multilingual (excellent Bengali). Free tier exists on AI Studio keys |
| **Groq** | `https://api.groq.com/openai/v1` | `meta-llama/llama-4-scout-17b-16e-instruct`, `meta-llama/llama-4-maverick-17b-128e-instruct`, `qwen/qwen3.6-27b` ([vision docs](https://console.groq.com/docs/vision)) | Scout ≈ $0.11 / $0.34; Maverick ≈ $0.50 / $0.77 (launch pricing; rotate with catalog) | Fastest latency; vision models rotate quarterly — verify IDs. Bengali quality weaker than Gemini/OpenAI |
| **OpenRouter** | `https://openrouter.ai/api/v1` | Any catalog model via `provider/model` IDs, e.g. `google/gemini-2.5-flash`, `openai/gpt-4.1-mini`, `meta-llama/llama-4-scout` ([models](https://openrouter.ai/docs)) | Pass-through + small fee; some `:free` variants (rate-limited, often no vision or degraded) | One key → many providers; great BYOK UX for users who don't want 4 accounts. Provider BYOK also supported ([BYOK docs](https://openrouter.ai/docs/guides/overview/auth/byok)) |

**Quality ranking for this use case** (short, casual, code-mixed Bengali/English replies + image caption understanding): Gemini Flash ≥ OpenAI mini tier > Llama 4 Maverick > Llama 4 Scout. Gemini Flash also wins on cost. Groq wins on latency. OpenRouter wins on user flexibility (single key).

## 2. Image input: request shape, base64 vs URL, size limits

OpenAI chat-completions shape (identical across all four providers; this is the OpenAI-compatible standard):

```json
{
  "model": "gemini-2.5-flash",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "..." },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,<B64>", "detail": "low" } }
    ]
  }],
  "max_completion_tokens": 200
}
```

- **base64 data URL** (`data:image/jpeg;base64,...`): the image bytes travel inside your request. This is the right choice here — Facebook CDN image URLs are signed and short-lived, and the provider's server fetching the URL may fail (expiry, geo, anti-bot). Fetch the image bytes in the background service worker (host_permissions for `facebook.com` grant this) and inline them as base64.
- **http(s) URL**: simpler payload, but relies on the provider's servers fetching a live, public URL. Not reliable for Facebook.
- **Limits** (provider maxima for image inputs):
  - OpenAI: 20 MB/image, 50 MB total/request, 500 images; formats PNG/JPEG/WEBP/non-animated GIF ([source](https://developers.openai.com/api/docs/guides/images-vision))
  - Groq: 20 MB for URL-based requests, **4 MB for base64-embedded requests**, max 5 images, 33 MP resolution ([source](https://console.groq.com/docs/vision))
  - Gemini: ~20 MB total request (native API limit; compat endpoint similar); images ≈ 258 tokens each at standard size
  - OpenAI charges via `detail`: `"low"` = flat 85 tokens (512×512 downsample), `"high"` = tile-based. Use `"low"` — a reply generator needs scene understanding, not OCR-grade resolution. Groq images count as ~2048 tokens each.
- Practical rule: **downscale/compress client-side before base64** (canvas → JPEG, longest edge ~768px, quality ~0.8) → stays well under every provider's base64 limit and keeps image tokens cheap.

## 3. CORS / host_permissions: MV3 manifest requirements

- **Content scripts are subject to page CORS** — since Chrome 85+ they can only fetch what the page itself could. A fetch from the content script (running inside facebook.com) to `api.openai.com` will be blocked unless the provider sends CORS headers ([Chromium announcement](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches/)).
- **Extension contexts (background service worker, popup, options page) bypass CORS for origins listed in `host_permissions`.** From the service worker, `fetch()` to a permitted origin succeeds without any server-side CORS headers ([Chrome docs pattern](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)). This is why the API call must live in the background script (matches ticket 003's architecture).
- Manifest requirement:

```json
{
  "manifest_version": 3,
  "host_permissions": [
    "https://api.openai.com/*",
    "https://openrouter.ai/*",
    "https://api.groq.com/*",
    "https://generativelanguage.googleapis.com/*",
    "https://www.facebook.com/*", "https://web.facebook.com/*",
    "https://*.fbcdn.net/*"
  ],
  "permissions": ["storage"],
  "background": { "service_worker": "background.js", "type": "module" }
}
```

  Keeping host_permissions narrow (specific API hosts + Facebook) matters for Chrome Web Store review; if the user picks a custom base URL, use `optional_host_permissions` and request at runtime.
- **Provider browser-call policies (plain fetch, BYOK):**
  - **OpenRouter**: explicitly browser-safe — CORS is enabled on `https://openrouter.ai/api/v1`; optional `HTTP-Referer`/`X-Title` headers are for attribution only ([docs](https://openrouter.ai/docs)). Works even without host_permissions.
  - **OpenAI**: `api.openai.com` does serve CORS headers (widely used from browser apps; the SDK's `dangerouslyAllowBrowser` flag is a client-side warning guard only — it has nothing to do with server CORS). With host_permissions + service worker, CORS is irrelevant anyway. OpenAI's [safety guidance](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety) discourages client-side keys in general web apps; a local BYOK extension where the user holds their own key is the accepted exception pattern used by BYOK tools.
  - **Gemini OpenAI-compat**: `generativelanguage.googleapis.com` supports CORS for API-key requests (AI Studio browser apps rely on it).
  - **Groq**: commonly called from browser apps; if CORS were ever an issue, host_permissions covers it.
  - **Key handling**: store keys in `chrome.storage.local` (not accessible to page JavaScript), never inject keys into the page world. Plain `fetch` avoids the SDK entirely — no `dangerouslyAllowBrowser` needed.

## 4. Streaming vs non-streaming

- **Non-streaming is the right default.** Replies are 1–3 sentences; total generation time with a flash-class model is ~0.5–2s. A single JSON response is simpler: one error path, no SSE parsing, no partial-failure states, and the reply goes into the comment box for human review anyway (per the map's locked decision) — so typewriter UX adds nothing.
- Streaming (SSE, `"stream": true`) is only worth it if you later add a visible "typing" preview in the UI. OpenAI-compatible SSE is uniform across all four providers, so switching later is a small change.
- Service-worker note: the fetch runs while the SW is alive because it's triggered by a message from the content script; short non-streaming calls finish well within the 30s message-reply window and the SW's idle lifetime.

## 5. System prompt pattern: one call for mood + language + reply

Single call, structured output. Do not do a separate "detect mood" call — it doubles latency and cost for no quality gain at this task size.

```
SYSTEM:
You write short social-media replies on behalf of the user.

1. Detect the MOOD of the target post/comment (e.g. happy, sad, congratulatory,
   funny, angry, grateful, sarcastic, question).
2. Detect the LANGUAGE it is written in and reply in the SAME language:
   - Bengali script   → reply in Bengali
   - English          → reply in English
   - Banglish (Bengali in Latin script / mixed Bengali-English) → reply in Banglish,
     matching how the person writes (no Bengali script unless they used it)
3. If an image is attached, let it inform the reply (scene, event, emotion shown).
4. Write ONE reply: 1–2 sentences, max ~25 words, natural and human, matching the
   mood. No emojis unless the target uses them. Never mention that you are an AI.
5. Output ONLY the reply text — no preamble, no quotes, no explanation.

USER:
[{ target text }
{ optional: parent post text / thread context }]
```

- **temperature ≈ 0.7–0.8** (natural variance for social tone; drop to 0.2–0.4 only if you later want more deterministic regenerations).
- **max_completion_tokens ≈ 120–200** (hard cap on length; Bengali uses more tokens per word than English, so don't cap below ~120).
- Consider `response_format: { type: "json_object" }` with a `{"reply": "...", "mood": "...", "language": "..."}` schema if the UI wants to show detected mood — supported by OpenAI, OpenRouter (model-dependent) and Groq; Gemini compat supports structured output too. For MVP, plain text output is simpler.

## Example: plain-fetch provider client (background service worker)

```js
// client.js — runs in the MV3 service worker. Plain fetch, no SDK.
const PROVIDERS = {
  openai:   { base: "https://api.openai.com/v1",                          model: "gpt-4.1-mini" },
  openrouter: { base: "https://openrouter.ai/api/v1",                     model: "google/gemini-2.5-flash" },
  gemini:   { base: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
  groq:     { base: "https://api.groq.com/openai/v1",                     model: "meta-llama/llama-4-scout-17b-16e-instruct" },
};

const SYSTEM_PROMPT = `...`; // see section 5

export async function fetchImageAsBase64(url) {
  // host_permissions for *.fbcdn.net makes this CORS-free in the SW
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const blob = await res.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);       // "data:image/jpeg;base64,..."
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  return dataUrl;
}

export async function generateReply({ provider, apiKey, baseUrl, model, text, imageDataUrl }) {
  const p = PROVIDERS[provider];
  const content = [{ type: "text", text }];
  if (imageDataUrl) {
    content.push({
      type: "image_url",
      image_url: { url: imageDataUrl, detail: "low" }, // low = cheapest, enough for scene/mood
    });
  }
  const res = await fetch(`${baseUrl ?? p.base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      // OpenRouter only (optional, attribution): 
      ...(provider === "openrouter" && { "X-Title": "AI Reply Assistant" }),
    },
    body: JSON.stringify({
      model: model ?? p.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      temperature: 0.7,
      max_completion_tokens: 200,
      stream: false,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// message routing
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === "GENERATE_REPLY") {
    (async () => {
      try {
        let imageDataUrl = null;
        if (msg.imageUrl) imageDataUrl = await fetchImageAsBase64(msg.imageUrl);
        reply({ ok: true, text: await generateReply({ ...msg.settings, text: msg.text, imageDataUrl }) });
      } catch (e) {
        reply({ ok: false, error: String(e.message ?? e) });
      }
    })();
    return true; // keep the message channel open for the async reply
  }
});
```

## Sources

- OpenAI vision guide & limits — https://developers.openai.com/api/docs/guides/images-vision · pricing — https://openai.com/api/pricing/
- Gemini OpenAI-compatibility — https://ai.google.dev/gemini-api/docs/openai · pricing — https://ai.google.dev/gemini-api/docs/pricing
- Groq vision (models, 4 MB base64 / 20 MB URL limits) — https://console.groq.com/docs/vision
- OpenRouter auth/BYOK — https://openrouter.ai/docs/guides/overview/auth/byok · base URL/headers — https://openrouter.ai/docs
- Chromium: content-script cross-origin restriction (why the call must be in the SW) — https://www.chromium.org/Home/chromium-security/extension-content-script-fetches/
- Chrome extensions networking (host_permissions grant) — https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- Image-token math by provider (secondary, for cost intuition) — https://howmanytokens.io/how-many-tokens-in-an-image/

## Practical recommendation

1. **Provider seam with a default of OpenRouter** (`https://openrouter.ai/api/v1`): one user key unlocks all models (including Gemini Flash and GPT mini), CORS is browser-friendly, and users who already hold provider keys can switch to a direct OpenAI/Gemini/Groq base URL via the same settings UI. Default model: `google/gemini-2.5-flash` — cheapest strong multilingual (Bengali/Banglish) vision option; note 2.5 sunsets 2026-10-16, so ship with a setting that lets users pick `gemini-3-flash-preview` or `openai/gpt-4.1-mini` when that happens.
2. **Always base64 data URLs, never provider-side URL fetch**: fetch Facebook CDN images in the service worker (host_permissions on `*.fbcdn.net`), downscale to ~768px JPEG on canvas, and send `detail: "low"`. This sidesteps signed-URL expiry and every provider's base64 cap (mind Groq's 4 MB).
3. **Manifest**: `host_permissions` for the four API hosts + Facebook + fbcdn; `permissions: ["storage"]`; all API traffic in the background service worker — content scripts only relay text/image URLs via messages. Store the key in `chrome.storage.local`; plain `fetch`, no SDK (no `dangerouslyAllowBrowser` concern).
4. **Non-streaming**, `temperature: 0.7`, `max_completion_tokens: 200`, single-call system prompt that detects mood + language (Bengali → Bengali, English → English, Banglish → Banglish) and outputs only the reply text.
