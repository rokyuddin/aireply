# 02: Facebook icon injection

**What to build:** On facebook.com, an AI-reply icon appears next to every comment composer (and post), mounted in a shadow DOM, surviving React re-renders and SPA navigation via debounced MutationObserver with role/aria selectors only. Clicking the icon currently performs a logged no-op — the deliverable is reliable, non-duplicating injection.

**Blocked by:** 01 — WXT scaffold + BYOK settings page.

**Status:** ready-for-agent

- [ ] Icon appears beside each comment composer on facebook.com (feed, post permalink, comments dialog)
- [ ] No duplicate icons after re-renders, scrolling, or SPA navigation
- [ ] No Facebook styles leak in and icon styles leak out (shadow DOM)
- [ ] Icon click logs a message (no-op) — wiring point for the reply flow
