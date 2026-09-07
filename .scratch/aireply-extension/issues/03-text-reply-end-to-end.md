# 03: Text reply end-to-end

**What to build:** Clicking the icon on a text post or comment extracts the target's text (clicking "See more" to expand truncated posts), sends it to the background service worker, which calls the user's configured OpenAI-compatible API with the mood+language-matching prompt (Bengali→Bengali, English→English, Banglish→Banglish), and inserts the generated reply into the comment box for review. Never auto-posts.

**Blocked by:** 01 — WXT scaffold + BYOK settings page; 02 — Facebook icon injection.

**Status:** ready-for-agent

- [ ] Click on icon under a text post generates a mood/language-matched reply inserted into the comment composer (React state updates; user still presses Post)
- [ ] Click on a comment generates a reply to that comment (target scoping correct, not the whole post)
- [ ] Truncated "See more" posts expand before extraction
- [ ] Message contract and AI client unit tests pass with stubbed fetch (success, auth error, malformed response)
- [ ] Facebook adapter context extraction tested against fixture DOM
