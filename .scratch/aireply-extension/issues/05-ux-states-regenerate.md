# 05: UX states + regenerate

**What to build:** The icon and any popover show loading state while generating, inline error states with retry (invalid key, API failure, expired image URL), a regenerate action, and a missing-key flow directing the user to the options page.

**Blocked by:** 03 — Text reply end-to-end; 04 — Image post understanding.

**Status:** ready-for-agent

- [ ] Loading indicator visible during generation; icon disabled meanwhile
- [ ] API/auth/image errors shown inline with a retry action
- [ ] Missing API key shows a clear call-to-action opening the options page
- [ ] Regenerate replaces the draft reply
