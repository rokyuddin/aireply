# 002 — OpenAI-compatible API selection and vision calling

Status: CLOSED
Labels: wayfinder:research
Blocked by: none
Claimed: resolved by charting session (2026-09-07)

## Question

What OpenAI-compatible setup best fits: BYOK, browser-direct calls, vision (image) understanding, and mood-matched multilingual replies?

Sub-questions:
- Which vision-capable models are available via OpenAI-compatible APIs (OpenAI, OpenRouter, Groq, etc.) and their rough cost/quality trade-offs for short social-media replies?
- Correct request shape for sending an image (base64 data URL vs public URL — note Facebook image URLs may be CDN-signed/short-lived or CORS-blocked, so fetch-in-background-script + base64 is likely required).
- CORS: which providers allow direct browser calls from a Chrome extension (MV3 host_permissions), and what does the manifest need?
- Streaming vs non-streaming for a short reply insert (non-streaming likely fine).
- System prompt patterns for mood detection + language matching (Bengali/English/Banglish) in a single call.

## Resolution

RESOLVED. Full findings: [research/002-api-provider-vision.md](../research/002-api-provider-vision.md)

Decisions:
1. **Provider seam, default OpenRouter** (`https://openrouter.ai/api/v1`): one BYOK key unlocks all models, CORS browser-friendly; settings let user switch to direct OpenAI / Gemini compat / Groq base URLs. Default model `google/gemini-2.5-flash` — cheapest strong Bengali/Banglish vision model. **Note: 2.5-flash sunsets 2026-10-16** — settings must expose model choice (e.g. `gemini-3-flash-preview`, `openai/gpt-4.1-mini`).
2. **Images always as base64 data URLs fetched in the service worker** (host_permissions `*.fbcdn.net`); downscale client-side to ~768px JPEG q0.8; `detail: "low"` (~85 tokens OpenAI). Mind Groq's 4 MB base64 cap. Never provider-side URL fetch (signed FB URLs expire).
3. **All API calls in the background service worker** — content scripts inherit page CORS (Chrome 85+); the SW with host_permissions bypasses it. Plain `fetch` + Bearer, no SDK. Key in `chrome.storage.local` (never sync). Manifest: `permissions: ["storage"]`; host_permissions for FB + fbcdn + the 4 API hosts (custom base URLs → `optional_host_permissions` at runtime).
4. **Non-streaming**: replies are 1–2 sentences; single JSON response is simpler and the human reviews anyway. SSE shape is uniform if streaming is added later.
5. **Single-call prompt** (one request detects mood + language + writes the reply; separate detection calls double latency for no gain): match Bengali script → Bengali, English → English, Banglish → Banglish; image informs scene/emotion; 1–2 sentences, ≤~25 words; output only reply text. `temperature: 0.7`, `max_completion_tokens: 200` (Bengali is token-heavy).
