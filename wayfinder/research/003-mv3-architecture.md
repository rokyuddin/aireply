# 003 — Chrome MV3 extension skeleton and scalable architecture (research)

Resolves: `wayfinder/tickets/003-mv3-architecture.md`
Researched: 2026-09-07 · Sources checked against primary docs (developer.chrome.com, wxt.dev) + 2026 framework comparisons.

## 1. Recommended toolchain: **WXT** (Vite-based, framework-agnostic)

| Criterion | WXT | CRXJS (Vite plugin) | Raw manifest (esbuild/TS) |
|---|---|---|---|
| Maintained in 2026 | ✅ active (v0.21.4, ~300k weekly npm downloads) | 🟡 stalled — maintainers signal limited progress ([discussion #974](https://github.com/crxjs/chrome-extension-tools/discussions/974)); v2 never left beta | ✅ but you own everything |
| HMR / auto-reload | ✅ UI + content scripts + background | ✅ but weaker | ❌ manual rebuild + chrome://extensions refresh |
| Entry points | ✅ file-based (`entrypoints/`) | ❌ hand-written manifest | ❌ hand-written |
| Cross-browser (Firefox later) | ✅ one codebase | 🟡 Chromium only, MV2 XOR MV3 | manual |
| Bundled storage wrapper, `createShadowRootUi`, auto-icons, zip/publish | ✅ | ❌ | ❌ |
| Framework-agnostic UI | ✅ React/Vue/Svelte/vanilla | ✅ | ✅ |

Plasmo is feature-rich but in maintenance mode (little maintainer activity, [wxt-dev/wxt#1404 comment](https://github.com/wxt-dev/wxt/pull/1404#issuecomment-2643089518)) and Parcel-based. CRXJS's own README points users at WXT for new projects.

**Decision: WXT.** It generates the manifest from `entrypoints/` + `wxt.config.ts`, gives TS + Vite HMR out of the box, has a first-class content-script UI helper (shadow DOM), and `wxt zip` produces the CWS artifact. Avoid raw manifest only if you want zero dependencies — not worth it at this scale.

Notes (2026): WXT ≥0.21 requires Node ≥22 and Vite as an explicit peer dep (`pnpm add -D vite typescript`). `wxt submit` supports CWS API v2; v1 stops working Oct 15, 2026.

## 2. MV3 building blocks (mapped to this extension)

- **Content script** (`entrypoints/facebook.content.ts`): injected on `*://*.facebook.com/*`, `run_at: "document_idle"` (default). Finds composer via adapter selectors, mounts the floating icon. Runs in ISOLATED world — DOM access, no page-JS access. SPA navigation means it must re-scan on URL/route changes (MutationObserver; see §4).
- **Background service worker** (`entrypoints/background.ts`): event-driven, killed after ~30 s idle — **never keep state in module variables**; persist to `chrome.storage` ([MV3 architecture](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)). Owns: OpenAI-compatible chat completions (BYOK key + base URL + model), image attachment fetch + base64 conversion (fetch here avoids host-page CORS), and reply generation. Promises are native in MV3.
- **Options page** (`entrypoints/options/index.html`): BYOK settings — API key, base URL, model, persona/tone. Plain React or vanilla; persisted via `storage.local`, live-applied via `storage.onChanged` (no restart needed).
- **Storage: `chrome.storage.local` for the API key.** Rationale:
  - `storage.sync` syncs data through Google's servers, has ~100 KB total / 8 KB-per-item quota and per-key write rate limits — and is explicitly discouraged for secrets ("Don't store secrets like API keys in chrome.storage.sync — they sync via Google's servers", [plugthis.ai API reference](https://plugthis.ai/guides/chrome-extension-api-reference)).
  - `chrome.storage` is **not encrypted** in any area ("Confidential user information should not be stored! The storage area isn't encrypted", [chrome.storage docs](https://developer.chrome.com/docs/extensions/reference/api/storage)); that is accepted for BYOK — the key must stay on-device and you disclose in the privacy policy that it is stored locally and sent only to the user-configured base URL.
  - Use `storage.local` for key/baseUrl/model/persona; `storage.session` only if you later add short-lived tokens.
- **Messaging**: `chrome.runtime.sendMessage` (request/response, promise-based) is sufficient. Pattern used by comparable open-source AI-reply extensions (e.g. [LinkedIn-AI-Reply-Chrome-Extension](https://github.com/Ganesh-Ghadage/LinkedIn-AI-Reply-Chrome-Extension), which is WXT-based): content script sends `{type: "generate-reply", payload}` → background calls the LLM → returns reply → content script inserts it. **No long-lived ports needed**; if you later add streaming, either use a port or chunked `sendMessage` responses. Define a typed message union in `lib/messaging.ts` shared by both sides.

## 3. Adapter pattern for multi-platform (Facebook now; Instagram/LinkedIn later)

One content script entry point that dispatches to a registered adapter by URL match, rather than one content script per site. Keep the core platform-agnostic and push all site knowledge into adapters.

```ts
// lib/platforms/types.ts
export interface PlatformAdapter {
  id: 'facebook' | 'instagram' | 'linkedin';
  matches: string[];                      // URL patterns for runtime check
  findComposers(): HTMLElement[];         // message/comment composer boxes
  extractContext(): PostContext | null;   // post text, author, comment being replied to
  insertReply(el: HTMLElement, text: string): Promise<void>; // set value + fire input events so React state updates
  theme: { accent: string; radius: string }; // optional: blend with host UI
}
```

```ts
// lib/platforms/index.ts — registry
export const adapters: PlatformAdapter[] = [facebookAdapter /*, instagramAdapter, linkedinAdapter later */];
export const currentAdapter = () => adapters.find(a => a.matches.some(m => location.href.match(m)));
```

How comparable projects organize it: open-source AI-reply extensions (LinkedIn AI Reply above; Social Comments GPT for LinkedIn/Instagram/X) keep per-platform selector sets + composer insertion in isolated modules and a thin shared core; the Recurate extension (4 chat platforms) uses "platform integration — one module per platform with platform-specific selectors" over a shared injection/messaging core ([recurate.ai/extension-architecture](https://recurate.ai/extension-architecture)). Known maintenance pain: selectors break when platforms redesign — isolate them in one file per platform and add version-tolerant fallback selectors (`aria-label`, `contenteditable[role=textbox]`) rather than brittle class names.

Composer insertion specifics (Facebook): the composer is a `contenteditable` div backed by React — set text via `document.execCommand('insertText')` or by dispatching `InputEvent` after mutating `textContent`; never just `.value =`. Verify against `wayfinder/tickets/001-facebook-dom-injection.md` findings.

## 4. Floating icon UI near composers

- **Mount via WXT `createShadowRootUi`** (`cssInjectionMode: "ui"`): UI lives in a shadow root — host CSS (Tailwind, Facebook's styles) can't leak in and your styles can't leak out; WXT applies an `all: initial` reset. Works with React (`onMount` → `ReactDOM.createRoot(container)`) or vanilla DOM ([wxt.dev content-script UI guide](https://wxt.dev/guide/essentials/content-scripts.html#shadow-root), [api: createShadowRootUi](https://wxt.dev/api/reference/wxt/utils/content-script-ui/shadow-root/functions/createshadowrootui)).
- **Positioning**: render an `inline`/`overlay` root anchored near each detected composer; compute placement from the composer's `getBoundingClientRect()` and re-position on `MutationObserver` + `ResizeObserver` events. Facebook re-renders composers constantly — known WXT pitfall where an anchored UI is dropped when the anchor node is replaced ([wxt-dev/wxt#2041](https://github.com/wxt-dev/wxt/issues/2041)); the fix is to observe DOM changes and re-mount/re-anchor (or re-run `ui.mount()` when the anchor reappears).
- **States**: idle (icon) → loading (spinner, disabled) → success/error (inline in the shadow UI, auto-revert). Keep a single small button per composer; open a popover/panel only on click. Match host aesthetics via adapter `theme` tokens (accent color, radius) — don't try to inherit host styles, restyle inside the shadow root.
- Only one shadow-root UI per composer; guard against duplicate mounting on SPA re-navigation.

## 5. CWS readiness from day one

- **Permissions minimization** ([Declare permissions and warn users](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), [CWS excessive-permissions policy](https://developer.chrome.com/docs/webstore/troubleshooting#excessive-permissions)):
  - `permissions: ["storage"]` only. No `tabs`, no `scripting` needed while content scripts are declared statically in the manifest.
  - `host_permissions` / content-script `matches`: narrow to `https://*.facebook.com/*` now. When Instagram/LinkedIn ship, **add their host patterns then** — do not pre-declare unused hosts (explicit CWS rejection reason: requesting permissions not required for current functionality). Do not use `<all_urls>`.
  - `activeTab` is a fallback if you ever switch to on-demand programmatic injection (`chrome.scripting.executeScript`) instead of static content scripts — it grants temporary current-tab access with **no install warning**.
  - `host_permissions` for the LLM base URL is **not required**: `fetch` from the service worker is governed by `connect-src`/CORS, not host permissions, unless the endpoint blocks CORS. If users supply arbitrary base URLs, prefer per-origin `optional_host_permissions` granted at runtime over a wildcard host permission.
- **No remote code** (MV3 hard rule, [what-is-mv3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)): all JS must ship in the package; no CDN scripts, no `eval`/`new Function`, no downloading logic at runtime. Fetching *data* (LLM responses, images) is fine; fetching *code* is not. Ensure the bundler doesn't emit eval-bearing dev code in prod builds.
- **CSP**: MV3 default extension CSP is `script-src 'self'; upgrade-insecure-requests` — no `unsafe-inline`/`unsafe-eval`, no remote `script-src` ([CSP docs](https://developer.chrome.com/docs/extensions/develop/concepts/content-security-policy)). Content scripts follow the **host page's** CSP for injected `<script>`; with shadow-DOM UI + `sendMessage` you never need to inject page-context scripts, so this stays a non-issue. Keep the default policy; don't loosen it.
- **Privacy**: disclose in the listing that the BYOK key is stored locally and post content is sent to the user-configured API endpoint — this is what comparable CWS-published BYOK reply extensions (e.g. FB AI Reply) state to pass review. Single-purpose description: "generate AI reply suggestions for social posts".

## 6. Recommended project skeleton (WXT)

```
aireply-extension/
├─ wxt.config.ts                 # manifest: name, permissions: ["storage"],
│                                # host_permissions: ["https://*.facebook.com/*"]
├─ package.json                  # wxt, vite, typescript, @wxt-dev/module-react (optional)
├─ tsconfig.json                 # extends .wxt/tsconfig.json
├─ entrypoints/
│  ├─ background.ts              # service worker: LLM calls, image fetch, message router
│  ├─ facebook.content.ts        # matches *.facebook.com — delegates to adapter
│  │                             #   cssInjectionMode: "ui", run_at: "document_idle"
│  └─ options/                   # BYOK settings page (key, baseUrl, model, persona)
│     ├─ index.html
│     └─ main.tsx
├─ components/                   # floating icon, reply popover, spinner states (shadow-DOM UI)
├─ lib/
│  ├─ messaging.ts               # typed sendMessage contract (content ⇄ background)
│  ├─ storage.ts                 # settings get/set via chrome.storage.local + onChanged
│  ├─ ai-client.ts               # OpenAI-compatible fetch (no SDK — avoids remote-code/CSP risk)
│  └─ platforms/
│     ├─ index.ts                # adapter registry + URL matching
│     ├─ types.ts                # PlatformAdapter interface
│     └─ facebook.ts             # selectors, context extraction, composer insertion, theme
├─ assets/                       # icons (16/32/48/128 → public/ or @wxt-dev/auto-icons)
└─ public/
```

Scaling recipe: add `instagram.ts` / `linkedin.ts` adapters + a new `*.content.ts` entrypoint + one host pattern each — zero core changes.

## 7. Practical recommendation

1. **Scaffold with `npx wxt@latest init` (TypeScript; React only for options + shadow-UI components, vanilla TS for DOM logic).**
2. Day one: static content script for `*.facebook.com` only, `permissions: ["storage"]`, no other host permissions; adapter registry wired so future platforms are additive.
3. BYOK key + settings in `chrome.storage.local` (never `sync`); typed `sendMessage` contract; all LLM traffic in the service worker with keys read from storage per request (survives SW restarts).
4. Floating icon = WXT `createShadowRootUi` anchored per composer, re-anchored via MutationObserver; loading/success/error states inside the shadow root; theme tokens from the adapter.
5. Keep the default MV3 CSP, ship zero remote code, and write the privacy disclosure (local key storage, data sent to user-configured endpoint) while the codebase is small — it unblocks CWS review later.
6. Explicitly out of scope for now: long-lived ports/streaming (add when streaming replies matter), Firefox build (WXT makes it a flag flip later).

## Sources

- WXT: [npm: wxt](https://www.npmjs.com/package/wxt) · [manifest config](https://wxt.dev/guide/essentials/config/manifest.html) · [compare vs Plasmo/CRXJS](https://wxt.dev/guide/resources/compare) · [createShadowRootUi](https://wxt.dev/api/reference/wxt/utils/content-script-ui/shadow-root/functions/createshadowrootui) · [content-script UI guide](https://wxt.dev/guide/essentials/content-scripts.html) · [upgrade notes v0.21](https://wxt.dev/guide/resources/upgrading) · [CWS submit API v2](https://wxt.dev/guide/resources/upgrading)
- CRXJS status: [chrome-extension-tools discussion #974](https://github.com/crxjs/chrome-extension-tools/discussions/974) · [2026 framework comparison](https://trybuildpilot.com/649-wxt-vs-plasmo-vs-crxjs-2026) · [StarterPick boilerplate guide 2026](https://starterpick.com/guides/best-chrome-extension-boilerplates-2026)
- MV3 platform: [What is Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) (service worker lifecycle, remote-code ban) · [chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage) · [Declare permissions & warnings](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) · [chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting) · [CSP](https://developer.chrome.com/docs/extensions/develop/concepts/content-security-policy)
- CWS policy: [Troubleshooting violations — excessive permissions, MV3 code requirements](https://developer.chrome.com/docs/webstore/troubleshooting)
- Patterns & prior art: [Recurate extension architecture (per-platform adapters, WXT)](https://recurate.ai/extension-architecture/) · [LinkedIn AI Reply (WXT, BYOK Gemini)](https://github.com/Ganesh-Ghadage/LinkedIn-AI-Reply-Chrome-Extension) · [AI Auto Reply (FB Messenger + WhatsApp, BYOK Gemini)](https://github.com/arifnextdev/ai-auto-reply-extension) · [Social Comments GPT (multi-platform BYOK OpenAI)](https://github.com/marcolink/CSSocialComments) · [WXT shadow-UI re-mount issue #2041](https://github.com/wxt-dev/wxt/issues/2041) · [Content-script UI injection walkthrough (rxliuli)](https://rxliuli.com/blog/browser-extension-dev-03-inject-ui/) · [storage.sync secret-handling guidance](https://plugthis.ai/guides/chrome-extension-apis-reference)
