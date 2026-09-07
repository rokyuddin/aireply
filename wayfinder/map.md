# Wayfinder Map: AI Reply Assistant for Facebook (Chrome Extension)

Label: `wayfinder:map`

## Destination

A validated spec plus a working MVP Chrome extension (loadable unpacked) that injects an AI-reply icon into Facebook post and comment sections; clicking it generates a mood- and language-matched reply (understanding both text and image posts) via an OpenAI-compatible vision API, with an architecture ready to scale to other platforms and a future public release.

## Notes

- Domain: an AI reply assistant for social media. Core concepts: Post, Comment, Reply, Target (post or comment being replied to), Reply Anchor (the injected icon), Mood, Persona, Provider (OpenAI-compatible endpoint).
- Skills every session should consult: `grilling`, `domain-modeling`, `research`, `prototype`.
- Standing preferences (locked in charting):
  - BYOK: user pastes their own API key + base URL in extension settings; browser calls the API directly. Client abstracted so a backend proxy can be added later.
  - Replies are inserted into the comment box for human review before posting (no auto-post in MVP).
  - Replies must match the language and mood of the target (Bengali / English / Banglish etc.).
  - Personal-first, but CWS-ready: keep architecture compatible with a future Chrome Web Store release.
  - Facebook-only MVP; extensibility via adapter pattern is a design requirement, not an MVP feature.
- Tracker convention (local markdown): tickets are files in `wayfinder/tickets/`; blocking is expressed in ticket bodies as `Blocked by: <ticket file names>`. Claim a ticket by adding `Claimed: <session>` before working it. Resolution = fill the `## Resolution` section and set Status: CLOSED.
- Research findings live in `wayfinder/research/`.

## Decisions so far

- [Destination and scope](tickets/000-destination.md): MVP = personal BYOK extension, review-before-post, Facebook-only, platform-extensible architecture.
- [Facebook DOM injection feasibility and architecture](tickets/001-facebook-dom-injection.md): role/aria selectors + debounced MutationObserver; "See more" click-to-expand; fbcdn images fetched in the service worker as base64 (signed URLs expire); `execCommand('insertText')` into the React composer; draft-and-confirm policy posture.
- [OpenAI-compatible API selection and vision calling](tickets/002-api-provider-vision.md): OpenRouter as default provider seam (any direct provider base URL switchable), base64 images with `detail: "low"`, all API calls in the background SW, key in `chrome.storage.local`, non-streaming, single-call mood+language+reply prompt (temp 0.7, max 200 tokens).
- [Chrome MV3 extension skeleton and scalable architecture](tickets/003-mv3-architecture.md): WXT toolchain; content script + SW + options page; typed sendMessage; `PlatformAdapter` registry for multi-platform scaling; shadow-DOM icon UI re-anchored on mutation; CWS-minimal permissions from day one.

## Not yet specified

- Regenerate / edit-before-insert / reply-history UX (depends on the icon UI prototype).
- Token/cost controls and rate limiting per user key.
- Prompt versioning and a tuning workflow for mood/persona.
- Packaging/versioning/release flow (unpacked vs CWS) once a public release is actually attempted.
- Error states and fallbacks detail (API failure, unsupported content, missing key) — to be pinned in the MVP build tickets.

## Out of scope

- Auto-posting without human review (deliberately excluded for safety and platform-policy risk).
- Non-Facebook platforms in the MVP (Instagram, LinkedIn, X, Messenger) — architecture only.
- Backend proxy, accounts, and multi-user billing — BYOK direct-call only for MVP.
