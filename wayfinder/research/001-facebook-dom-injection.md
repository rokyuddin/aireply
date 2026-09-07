# 001 — Facebook DOM injection: research findings

Resolves `wayfinder/tickets/001-facebook-dom-injection.md`. Researched 2026-09-07.

## 1. Injection strategy: MutationObserver + aria/role selectors

Facebook's class names (`x1lliihq x6ikm8r ...`) are build-generated and change between deployments; they are **not usable as selectors** [4]. The stable surface is the **ARIA / semantic layer**, which Facebook must keep correct for accessibility and screen readers:

- Posts: `div[role="article"]`
- Comment composer: `div[role="textbox"][contenteditable="true"]` (also `aria-label` like "Comment on …" / "Write a comment…")
- Buttons: `[role="button"]` + localized `aria-label` ("Like", "Comment", "More")
- Menus/dialogs: `div[role="menu"]`, `div[role="dialog"]`
- `data-testid` exists (`post_chevron_button`, etc.) but is a test hook Facebook can rename or drop at any time — treat it as a secondary fallback only [1][4].

**Recommended architecture** (works in practice across FB scraper/exporter extensions [1][8]):

1. **Static content script** at `document_idle` for `*://*.facebook.com/*`.
2. **MutationObserver** on `document.body` with `{ childList: true, subtree: true }` — Facebook is a React SPA; feed posts, comment threads and composers mount/unmount constantly. Observe added nodes and re-scan, with a `WeakSet` guard so each post/composer is decorated once.
3. **Event delegation** for clicks (icons, buttons) — one listener on `document` survives re-renders; do not attach per-node listeners that get destroyed.
4. **SPA navigation**: Facebook does client-side routing without full page loads. A `MutationObserver` alone usually suffices (new content triggers it), but re-scan on `popstate`/history changes or long-interval fallback scan is a cheap safety net [1].

```js
// content.js — detection skeleton
const decorated = new WeakSet();

function scan(root = document) {
  // Feed posts
  root.querySelectorAll('div[role="article"]').forEach(attachIcon);

  // Comment composers (open composer under a post or in the comments dialog)
  root.querySelectorAll(
    'div[role="textbox"][contenteditable="true"][aria-label]'
  ).forEach(attachComposerIcon);
}

scan();
new MutationObserver(muts => {
  for (const m of muts)
    for (const n of m.addedNodes)
      if (n.nodeType === 1) scan(n.parentElement ?? n);
}).observe(document.body, { childList: true, subtree: true });

// Also: window.addEventListener('popstate', () => setTimeout(scan, 500));
```

Notes:
- Throttle/debounce the scan; the feed fires many mutations per second while scrolling.
- `aria-label` text is **localized** — never match on English strings like "Write a comment" for logic; match on structural attributes (`role`, `contenteditable`) and treat label text as display-only data. If you need the composer vs. search box distinction, disambiguate by DOM position (inside a `role="article"` ancestor) rather than label wording.
- Do **not** use `setInterval` polling as the primary mechanism (some tutorials do [1]); it wastes CPU and still loses races with React. Observer + delegated events is the reliable pattern.

## 2. Extracting post/comment text

- **Post text**: from the `div[role="article"]` root, take the main message container (first large `div` of `dir="auto"` spans under the article). Robust approach: select all text nodes inside the article that are *not* inside the comments section (comments live in a sibling subtree after the "View all comments" divider) and are not UI labels (action buttons, timestamps).
- **Nested comments**: each comment is typically a `div[role="article"]` or `ul > li` inside the post's comment section; replies are nested deeper. Walk the article subtree and collect `dir="auto"` text containers, paired with the author link (`a[href*="/user/"]` or the first `h2`/`span` hyperlink) that precedes them. Existing FB comment-exporter extensions do exactly this (scroll to load, expand threads, then parse text + author + timestamp) [8].
- **"See more" truncation**: the full text is usually **not in the DOM** when collapsed — only the truncated portion is. Two options:
  1. **Click the "See more"** `[role="button"]` (identified by localized text, e.g. /see more/i, or `aria-expanded="false"` + `aria-controls`), wait for the article's text length to grow (short `MutationObserver` or `requestAnimationFrame` poll), read, then optionally re-collapse. This is what existing "auto expand" extensions do [7]. This is a UI-visible action on the user's own feed; it is the pragmatic route.
  2. If the post is already visible with `aria-expanded`/`aria-controls` present, some layouts keep full text in the DOM hidden via CSS (class-dependent, unreliable) — don't depend on it; implement the click-and-recheck path.

```js
async function getFullPostText(article) {
  let text = articleText(article);
  const seeMore = [...article.querySelectorAll('[role="button"]')]
    .find(b => /^(see more|more)$/i.test(b.textContent.trim())
           || b.getAttribute('aria-expanded') === 'false'
              && b.textContent.trim().length < 12);
  if (seeMore) {
    seeMore.click();
    await waitFor(() => articleText(article).length > text.length, 1500);
    text = articleText(article);
  }
  return text;
}
```

## 3. Extracting image-post images

- Image `src` values are `scontent.*.fbcdn.net` URLs. They are **signed and short-lived** — an expiry timestamp is embedded in the query string (`ext=` decimal Unix time on Facebook; `oe=` hex on Instagram/Threads, same Meta CDN) after which they 403 [5]. Never persist these URLs; use them immediately.
- **CORS**: a content script fetching `fbcdn` runs with the *page's* origin restrictions, and fbcdn does not send permissive `Access-Control-Allow-Origin` headers. **Extension pages / the background service worker with `host_permissions` bypass CORS entirely** — cross-origin `fetch()` from the service worker succeeds without any server-side CORS headers [3].
- MV3 quirk: since mid-2024, host permissions for `fetch` in the *content script* context are no longer honored for cross-origin — the fetch must happen in the **background service worker** (or an extension page / offscreen document), with the content script passing the URL via `chrome.runtime.sendMessage` [3].

```js
// manifest.json
"host_permissions": ["*://*.facebook.com/*", "*://*.fbcdn.net/*", "*://*.fbsbx.com/*"]

// background.js — fetch image → base64 data URL
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'FETCH_IMAGE') return;
  fetch(msg.url, { credentials: 'include' })   // cookies: signed URL + auth context
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.blob();
    })
    .then(blobToDataUrl)
    .then(dataUrl => sendResponse({ ok: true, dataUrl }))
    .catch(e => sendResponse({ ok: false, error: String(e) }));
  return true; // keep the message channel open (async)
});

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);        // "data:image/jpeg;base64,…"
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}
```

```js
// content.js — find the post's image and ask the background to fetch it
function getPostImageUrl(article) {
  const img = [...article.querySelectorAll('img')]
    .filter(i => /scontent.*\.fbcdn\.net/.test(i.src))
    .map(i => ({ el: i, w: i.naturalWidth * i.height }))
    .sort((a, b) => b.w - a.w)[0]?.el;        // largest = main photo, not avatars
  return img?.src;
}
```

Best practice: resolve the URL from the DOM at click time → fetch in the background immediately → send base64 to the vision API in the same request. Never cache fbcdn URLs; re-resolve on every use [5].

## 4. Inserting text into the React-controlled composer

Facebook's composer is a `contenteditable` div (`role="textbox"`) driven by a React/Draft.js-style editor. Setting `innerText`/`textContent` directly does **not** update React state — the value resets on the next render. What works, in order of preference:

1. **`document.execCommand('insertText', false, text)`** after `element.focus()`. Despite being formally deprecated (MDN), it is still the most reliable path in 2026: it goes through the browser's editing pipeline, fires real `beforeinput`/`input` events, preserves the undo buffer, and React state updates correctly. Editing-framework discussions confirm execCommand remains the pragmatic option with no full replacement shipped [6][9]. Verify the return value; if false, fall back.
2. **Dispatching `InputEvent`** (`new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' })`) after manually mutating the DOM — works for some React apps but is editor-specific (Draft.js reads selection/state internally) and fragile; use only as fallback.
3. **Clipboard paste** (`navigator.clipboard.writeText` + `document.execCommand('paste')` or simulating a `paste` event) — works but requires clipboard permission flow; clunky UX.

```js
function insertIntoComposer(editor, text) {
  editor.focus();
  // Place caret at end if nothing selected
  const sel = window.getSelection();
  if (sel.rangeCount === 0) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  const ok = document.execCommand('insertText', false, text);
  if (!ok) {
    // Fallback: manual DOM insert + InputEvent
    const sel2 = window.getSelection();
    const r = sel2.getRangeAt(0);
    r.deleteContents();
    r.insertNode(document.createTextNode(text));
    r.collapse(false);
    editor.dispatchEvent(new InputEvent('input', {
      bubbles: true, composed: true,
      data: text, inputType: 'insertText',
    }));
  }
}
```

Keep the insertion **user-initiated** (fired from the user's click on your icon / "Insert draft" button). Chrome requires user activation for focus changes, and it also matches the policy posture in §5.

## 5. ToS / CWS policy constraints

**Facebook ToS**: Terms of Service §3.2.3 forbids accessing or collecting data from Facebook "using automated means" without prior permission, and Meta's Automated Data Collection policy states that outside the Platform APIs, "you may not automate actions on Facebook or use scripts/HTTP libraries/JavaScript to make data access requests" [10][11]. Practical reading for this product:
- **Reading DOM content the user can already see, at the user's request, to power a draft they review and post themselves** — this is the same category as mainstream grammar/assist extensions; the automation line is crossed when the extension *acts without the user* (auto-posting, auto-liking, bulk scraping, background data collection).
- Design guardrails: no automatic posting (user must click Facebook's own "Post" button), no background harvesting of the feed, no reading of data the user didn't interact with, no bulk comment scraping/export.
- Account-integrity risk is real for automation-style tools: Meta restricts accounts using scripted/inauthentic means [12].

**Chrome Web Store**: relevant policies are [13]:
- **Spam & Abuse §4**: "We don't allow extensions that send messages on behalf of the user without giving the user the ability to confirm the content and intended recipients." → A draft-insert-only design (user confirms + hits Post themselves) is compliant; auto-send is not.
- **Single purpose**: declare one purpose ("AI reply drafts for Facebook") in the listing and manifest description.
- **Minimal permissions**: `host_permissions` limited to `*.facebook.com`, `*.fbcdn.net` (+ your API host); prefer `activeTab` where feasible — broad/unnecessary host permissions are the #1 review rejection reason [14].
- **Privacy**: disclose that post/comment text and images are sent to your AI backend; publish a privacy policy; comply with Limited Use (don't sell/train on user data).

## Practical recommendation

1. **Detection**: static content script + one `MutationObserver` on `body` (childList+subtree, debounced), selectors based on `role`/`contenteditable`/`aria-*` only — never obfuscated classes; `data-testid` as optional fallback. Event delegation for clicks.
2. **Text extraction**: scope to `div[role="article"]`; separate post text from comments by DOM position; handle "See more" by clicking the button and waiting for text growth (cap attempts; never auto-click repeatedly in background).
3. **Images**: never trust fbcdn URLs long-term (signed, expiring via `ext=` param). Resolve `src` at click time → `chrome.runtime.sendMessage` → fetch in the **background service worker** (host_permissions: fbcdn + facebook) → `FileReader` → base64 data URL → straight into the vision API call. Content-script-side fetch will be CORS-blocked in MV3.
4. **Composer insertion**: `editor.focus()` + `document.execCommand('insertText', false, text)` (still works in 2026; fires the input events React needs), with manual DOM insert + `InputEvent('input')` as fallback. Only trigger from a user click; never auto-submit.
5. **Policy posture**: draft-and-confirm only. User reviews the reply and presses Facebook's own Post button. No auto-posting, no background scraping, minimal host permissions, clear privacy disclosure. This keeps you inside CWS Spam & Abuse §4 and as close as practical to Facebook ToS §3.2.3.

## Sources

1. Edwin von Labja — Auto-block FB posts with a Chrome extension (MutationObserver + `role="article"` + SPA re-injection pattern): https://edwinvonlabja.com/2025/05/05/auto-block-fb-follow-posts/
2. Chrome for Developers — Content scripts (isolated worlds, injection, run_at): https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts/
3. Chrome for Developers — Cross-origin network requests (host_permissions, background fetch, content-script CORS restriction): https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
4. Mantis API — How to Scrape Facebook Data (obfuscated class names change between deployments; use `[role="article"]`, `[aria-label]`): https://mantisapi.com/blog/how-to-scrape-facebook-data-2026.html
5. Post-Pulse — Pre-signed URL expiry across platforms (Facebook `ext=` decimal timestamp; Meta CDN signature expiry → 403): https://post-pulse.com/blog/presigned-url-expiry-across-platforms
6. MDN — `Document.execCommand()` (deprecated but still functional; fires beforeinput/input; preserves undo): https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand
7. Chrome Web Store — "Facebook Auto See More" (auto-clicks See more buttons, incl. localized labels): https://chromewebstore.google.com/detail/facebook-auto-see-more/depbcegepklhngliblfdekegnfonakdb
8. GitHub — fb-comments-scan-ext (MV3 comment scraper: scroll, expand threads, parse text/author): https://github.com/tdfork/fb-comments-scan-ext/blob/master/README.md
9. W3Tweaks — contenteditable rich-text guide (beforeinput as the modern execCommand alternative; execCommand still pragmatic): https://www.w3tweaks.com/html/html-contenteditable-rich-text-editor/
10. Facebook Terms of Service §3.2.3 (no automated access/collection without permission): https://www.facebook.com/terms.php
11. Meta — Automated Data Collection policy (Platform APIs are the only allowable programmatic access): https://developers.facebook.com/docs/development/terms-and-policies/automated-data-collection
12. Meta Transparency — Account Integrity and Authentic Identity: https://transparency.fb.com/policies/community-standards/account-integrity-and-authentic-identity/
13. Chrome Web Store — Program Policies (Spam & Abuse §4; single purpose; minimal permissions): https://developer.chrome.com/docs/webstore/program-policies/
14. ExtensionRadar — Why Chrome extensions get rejected (unnecessary host permissions = #1 rejection reason): https://www.extensionradar.com/blog/chrome-extension-rejected
