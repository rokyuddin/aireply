# 06: Scalability hardening

**What to build:** Prove the platform adapter seam with a dummy second adapter registered and dispatchable by URL, audit the manifest for CWS readiness (minimal permissions, no remote code, default CSP), and add the privacy disclosure (local key storage; post text/images sent to the user-configured endpoint).

**Blocked by:** 05 — UX states + regenerate.

**Status:** ready-for-agent

- [ ] Dummy adapter demonstrates registry dispatch by URL match without core changes
- [ ] Manifest audit passes: `permissions: ["storage"]`, FB+fbcdn+API hosts only, no remote code, default CSP untouched
- [ ] Privacy disclosure text present (options page and/or listing copy)
