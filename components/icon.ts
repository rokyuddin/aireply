import type { Composer } from '../lib/platforms/types';

const ICON_ID = 'aireply-icon-host';

const ICON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 2l1.9 5.6L19.5 9l-4.4 3.9L16.2 18 12 15l-4.2 3 1.1-5.1L4.5 9l5.6-1.4L12 2z" fill="url(#aireply-g)"/>
<defs><linearGradient id="aireply-g" x1="2" y1="2" x2="22" y2="22"><stop stop-color="#7c3aed"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs>
</svg>`;

const ICON_CSS = `
:host { all: initial; }
.wrap { position: relative; display: inline-flex; }
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.65;
  padding: 0;
}
.btn:hover { opacity: 1; background: rgba(0, 0, 0, 0.05); }
.btn:disabled { cursor: wait; opacity: 0.9; }
.btn[data-state="error"] { opacity: 1; }
.btn[data-state="loading"] svg { opacity: 0.25; }
.btn[data-state="loading"]::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
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
 * Mount an AI-reply icon inside the composer's parent row so it sits
 * beside the comment box. Idempotent: re-mounting over the same editor
 * replaces the previous icon. Shows a loading spinner while generating
 * and an inline error bubble (click icon to retry) on failure.
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
  btn.title = 'AI reply draft';
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

  // Place the icon right before the composer among its siblings; fall
  // back to appending into the parent when a previous icon occupies
  // the spot.
  const parent = composer.editor.parentElement ?? composer.editor;
  const existing = parent.querySelector(`:scope > #${ICON_ID}`);
  if (existing) existing.remove();
  parent.insertBefore(host, composer.editor);

  return {
    isBusy: false,
    setState(next, message) {
      btn.disabled = next === 'loading';
      btn.dataset.state = next;
      btn.title =
        next === 'loading'
          ? 'Generating reply...'
          : next === 'error'
            ? 'Generation failed — click to retry'
            : message ?? 'AI reply draft';
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
  return parent !== null && parent.querySelector(`:scope > #${ICON_ID}`) !== null;
}
