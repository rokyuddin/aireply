import type { Composer } from '../lib/platforms/types';

const ICON_ID = 'aireply-icon-host';

// Matches Facebook's composer icons: outline style (fill:none,
// stroke:currentColor), sized between their 16px icons for a slight
// emphasis, colored via --secondary-icon like the rest of the row.
const ICON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg">
<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z"/>
</svg>`;

const ICON_CSS = `
:host { all: initial; }
.wrap { position: relative; display: inline-flex; vertical-align: middle; }
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--secondary-icon, #65676b);
  opacity: 1;
}
.btn:hover { color: var(--primary-icon, #050505); }
.btn:disabled { cursor: wait; opacity: 0.9; }
.btn[data-state="error"] { opacity: 1; }
.btn[data-state="loading"] svg { opacity: 0.25; }
.btn[data-state="loading"]::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(124, 58, 237, 0.9);
  border-top-color: transparent;
  animation: aireply-spin 0.8s linear infinite;
}
@keyframes aireply-spin { to { transform: rotate(360deg); } }
.bubble {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  z-index: 2147483646;
  max-width: 260px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #1c1e21;
  color: #fff;
  font: 400 12px/1.4 system-ui, sans-serif;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  white-space: pre-wrap;
  word-break: break-word;
}
.bubble[hidden] { display: none; }
`;

export type IconState = 'idle' | 'loading' | 'error';

export interface IconHandle {
  /** True while a generation is in flight; guards double-clicks. */
  isBusy: boolean;
  setState(state: IconState, message?: string): void;
  destroy(): void;
}

/**
 * Icon placement anchor. Preferred: Facebook's comment-composer
 * toolbar (stable internal ids, not obfuscated classes), so the icon
 * sits left of the emoji/photo/GIF/sticker buttons. Fallback: the
 * editor's own parent row.
 */
export function getIconAnchor(editor: HTMLElement): HTMLElement {
  let el: HTMLElement | null = editor;
  let depth = 0;
  while (el && depth < 12 && el !== document.body) {
    const row = el.querySelector<HTMLElement>(
      '#focused-state-actions-list ul, [data-id="unfocused-state-actions-list"]',
    );
    if (row) return row;
    // Stay inside this composer's post — don't grab another post's row.
    if (el.getAttribute('role') === 'article') break;
    el = el.parentElement;
    depth++;
  }
  return editor.parentElement ?? editor;
}

/**
 * Mount an AI-reply icon next to the comment composer. Idempotent:
 * re-mounting over the same editor replaces the previous icon. Shows
 * a loading spinner while generating and an inline error bubble
 * (click icon to retry) on failure.
 */
export function mountIcon(composer: Composer, onClick: () => void): IconHandle {
  const host = document.createElement('div');
  host.id = ICON_ID;

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = ICON_CSS;
  shadow.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  shadow.appendChild(wrap);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.type = 'button';
  // Use aria-label for accessibility; avoid a native title tooltip,
  // which Facebook can render as a black floating label over the row.
  btn.setAttribute('aria-label', 'Generate AI reply draft');
  btn.innerHTML = ICON_SVG;
  wrap.appendChild(btn);

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.setAttribute('role', 'status');
  bubble.hidden = true;
  wrap.appendChild(bubble);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  // Preferred spot: inside the LAST icon slot of the composer's
  // action toolbar (right of the sticker icon). The li's contents are
  // forced onto one flex line so our icon sits beside the sticker on
  // the same row instead of dropping below it. Fallback: right before
  // the editor among its siblings.
  const anchor = getIconAnchor(composer.editor);
  if (anchor.tagName === 'UL') {
    const existing = anchor.querySelector(`:scope #${ICON_ID}`);
    if (existing) existing.remove();
    const items = anchor.querySelectorAll<HTMLElement>(':scope > li');
    const lastLi = items[items.length - 1] ?? anchor;
    // The li holds the sticker button in nested spans; make it a
    // no-wrap flex row so both icons share one line, centered.
    lastLi.style.display = 'inline-flex';
    lastLi.style.flexWrap = 'nowrap';
    lastLi.style.alignItems = 'center';
    lastLi.style.gap = '6px';
    lastLi.appendChild(host);
  } else {
    const existing = anchor.querySelector(`:scope > #${ICON_ID}`);
    if (existing) existing.remove();
    anchor.insertBefore(host, composer.editor);
  }

  return {
    isBusy: false,
    setState(next, message) {
      btn.disabled = next === 'loading';
      btn.dataset.state = next;
      btn.setAttribute(
        'aria-label',
        next === 'loading'
          ? 'Generating reply'
          : next === 'error'
            ? 'Generation failed — click to retry'
            : 'Generate AI reply draft',
      );
      if (next === 'error' && message) {
        bubble.textContent = message;
        bubble.hidden = false;
      } else {
        bubble.hidden = true;
      }
    },
    destroy() {
      host.remove();
    },
  };
}

export function isIconMounted(parent: Element | null): boolean {
  if (parent === null) return false;
  // Toolbar placement wraps the host in an <li> we created.
  const li = parent.querySelector(`:scope > li > #${ICON_ID}`);
  return li !== null || parent.querySelector(`:scope > #${ICON_ID}`) !== null;
}
