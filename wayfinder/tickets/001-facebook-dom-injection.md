# 001 — Facebook DOM injection feasibility and architecture

Status: CLOSED
Labels: wayfinder:research
Blocked by: none
Claimed: resolved by charting session (2026-09-07)

## Question

How does the extension reliably detect Facebook post and comment sections in the DOM and inject a reply icon next to the comment box — given Facebook's obfuscated, fast-changing class names and frequent re-renders (React)?

Sub-questions:
- What injection strategy works in 2026: MutationObserver, event delegation, or Facebook's internal data-testid / aria attributes?
- How to extract the post/comment text content reliably (including nested comments and "see more" truncation)?
- How to extract the image of an image post (URL in `<img>` src, blob, base64)?
- How to programmatically set text into the contenteditable comment composer (React-controlled input — does `document.execCommand('insertText')` still work)?
- Known ToS / anti-automation constraints we must respect (read-only DOM reading + user-initiated draft insert vs automated posting).

## Resolution

RESOLVED. Full findings: [research/001-facebook-dom-injection.md](../research/001-facebook-dom-injection.md)

Decisions:
1. **Detection**: static content script + one debounced MutationObserver on `document.body`; selectors use only stable semantic attributes — `div[role="article"]` (posts), `div[role="textbox"][contenteditable]` inside an article (composers). Never obfuscated classes; never localized aria-label text for logic; `data-testid` only as optional fallback. Event delegation for clicks; WeakSet guard so each node is decorated once.
2. **Text extraction**: scope to the `role="article"` subtree; separate post text from comments by DOM position. "See more" truncation: full text is NOT in DOM when collapsed — click the `[role="button"]` and wait for text growth (cap ~1.5s).
3. **Images**: fbcdn URLs are signed and expire (`ext=` param → 403). Resolve `img` src at click time (largest scontent.*.fbcdn.net image, filters avatars) → message the background → fetch in the **service worker** with `host_permissions` for `*.fbcdn.net` (content-script fetch is CORS-blocked in MV3) → FileReader → base64 data URL. Never cache URLs.
4. **Composer insertion**: `editor.focus()` + `document.execCommand('insertText', false, text)` — still the reliable path in 2026, fires beforeinput/input so React state updates. Fallback: manual DOM insert + dispatched `InputEvent('input')`. Only from user click; never auto-submit.
5. **Policy posture (decision)**: draft-and-confirm only. CWS Spam & Abuse §4 requires user confirmation before sending messages on the user's behalf; FB ToS §3.2.3 bans automated access — reading what the user sees, on click, to draft a reply the user posts themselves is compliant. No auto-post (already locked in map), no background scraping, minimal host permissions, privacy disclosure required before CWS.
