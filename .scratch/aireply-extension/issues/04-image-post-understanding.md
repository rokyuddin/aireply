# 04: Image post understanding

**What to build:** For image posts, the extension resolves the post's main image at click time, fetches it in the background service worker (host permissions for fbcdn), downscales to ~768px JPEG, and sends it as a base64 data URL with `detail: "low"` so replies reflect the image's scene and mood.

**Blocked by:** 03 — Text reply end-to-end.

**Status:** ready-for-agent

- [ ] Reply to an image post references the image content (scene/event/emotion)
- [ ] Image fetched in background SW as base64; no content-script fetch (CORS)
- [ ] Large images downscaled before sending; respects provider base64 limits
- [ ] Image extraction covered by adapter fixture tests (largest fbcdn img, avatars excluded)
