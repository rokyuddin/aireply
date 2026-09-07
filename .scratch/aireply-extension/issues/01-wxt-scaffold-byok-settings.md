# 01: WXT scaffold + BYOK settings page

**What to build:** The extension loads unpacked in Chrome. An options page lets the user paste their own API key, API base URL (default OpenRouter), model name, and reply tone/persona; settings persist locally and survive browser restarts. Scaffold is WXT + TypeScript with the background service worker, content-script entrypoint for Facebook, and adapter registry placeholder in place.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `wxt build` produces a loadable unpacked extension with background SW + content script declared for `*.facebook.com` only, `permissions: ["storage"]`
- [ ] Options page saves key/base URL/model/persona to local extension storage and reloads with saved values
- [ ] Settings are readable by both background and content scripts through a shared storage module
- [ ] TypeScript typecheck passes
