# 003 — Chrome MV3 extension skeleton and scalable architecture

Status: CLOSED
Labels: wayfinder:research
Blocked by: none
Claimed: resolved by charting session (2026-09-07)

## Question

What is the recommended MV3 structure for this extension so it is scalable to other platforms and future public release?

Sub-questions:
- MV3 building blocks needed: content script (icon injection + composer insert), background service worker (API calls, image fetching), options page (BYOK settings: API key, base URL, model, persona/tone), storage (chrome.storage.local vs sync for the key), messaging between content and background.
- Vite/TypeScript + CRXJS or WXT as the build tool — which is the 2026 best choice for scalable MV3 development?
- Adapter/harness pattern: how to structure `platform adapters` (DOM selectors, extraction, composer insertion per site) so Instagram/LinkedIn can be added later without rewriting the core.
- CWS-readiness implications now (permissions minimization, no remote code, CSP) vs later.
- Icon UI: single floating icon near composer — how have similar extensions done it (positioning, theming to match Facebook UI, loading/success/error states)?

## Resolution

RESOLVED. Full findings: [research/003-mv3-architecture.md](../research/003-mv3-architecture.md)

Decisions:
1. **Toolchain: WXT** (Vite-based, active in 2026; CRXJS stalled, Plasmo maintenance mode). HMR, file-based entrypoints, `createShadowRootUi`, `wxt zip` for CWS artifact.
2. **Structure**: content script (`*.facebook.com`, document_idle, delegates to adapter) + background service worker (all LLM/image fetch, stateless — persist via `chrome.storage`, SW dies after ~30s idle) + options page (BYOK settings). Typed `chrome.runtime.sendMessage` union in shared `lib/messaging.ts`; no ports.
3. **Storage**: API key + settings in `chrome.storage.local` (never sync — syncs via Google's servers + quotas; disclose local-only storage in privacy policy).
4. **Adapter pattern**: `PlatformAdapter` interface (`matches`, `findComposers`, `extractContext`, `insertReply`, `theme`) + registry dispatched by URL. New platform = one adapter file + one content entrypoint + one host pattern. Zero core changes.
5. **Icon UI**: WXT `createShadowRootUi` (shadow DOM isolation, `all: initial` reset) anchored per composer; re-anchor on MutationObserver (known WXT pitfall #2041 — anchor nodes get replaced by React re-renders). States: idle → loading → success/error inline. Theme via adapter tokens, restyle inside shadow root.
6. **CWS day one**: `permissions: ["storage"]` only; narrow host patterns per shipped platform (no `<all_urls>`, no future-proofed hosts — #1 rejection reason); default MV3 CSP untouched; zero remote code (bundled JS, plain fetch); privacy disclosure written early.
7. **Skeleton**: WXT layout with `entrypoints/{background.ts, facebook.content.ts, options/}`, `lib/{messaging,storage,ai-client}.ts`, `lib/platforms/{types,index,facebook}.ts`, `components/` for shadow-UI.
