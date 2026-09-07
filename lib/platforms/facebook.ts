import type { Composer, PlatformAdapter } from './types';
import type { ReplyTarget } from '../messaging';

/**
 * Facebook adapter. Selectors use only stable semantic attributes
 * (role / contenteditable) — never obfuscated class names or
 * localized aria-label text.
 */
export const facebookAdapter: PlatformAdapter = {
  id: 'facebook',
  matches: ['^https://([a-z]+\\.)?facebook\\.com/'],
  findComposers(): HTMLElement[] {
    return [
      ...document.querySelectorAll<HTMLElement>(
        'div[role="article"] div[role="textbox"][contenteditable="true"]',
      ),
    ];
  },

  async extractTarget(composer: HTMLElement): Promise<ReplyTarget | null> {
    const article = composer.closest('div[role="article"]');
    if (!article) return null;

    // A comment target is a text container nearer to the composer than
    // the post text; otherwise we're replying to the post itself.
    const comment = closestTextBefore(article, composer, '[data-comment-text]');
    const post = article.querySelector<HTMLElement>('[data-post-text]');

    // Real Facebook DOM has neither marker: fall back to the article's
    // own text minus UI noise.
    const text = (comment ?? post)?.textContent?.trim() ?? articleText(article);
    return text ? { text } : null;
  },

  insertReply(composer: Composer['editor'], text: string): boolean {
    const editor = composer;
    editor.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount === 0) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    // execCommand fires beforeinput/input so React state updates.
    return document.execCommand('insertText', false, text);
  },
};

/**
 * Resolve the post's main image URL at click time. fbcdn URLs are
 * signed and expire — never cache the result; re-resolve every use.
 * Returns null for text-only posts.
 */
export function getPostImageUrl(article: Element): string | null {
  const candidates = [...article.querySelectorAll<HTMLImageElement>('img')]
    .filter((img) => /scontent.*\.fbcdn\.net/.test(img.src))
    // Avatars are real photos on fbcdn too — exclude by rendered size
    // (profile pics render ~32-40px) rather than URL shape.
    .filter((img) => (img.naturalWidth || img.width) >= 100)
    .map((img) => ({
      src: img.src,
      area: (img.naturalWidth || img.width) * (img.naturalHeight || img.height),
    }))
    .sort((a, b) => b.area - a.area);
  return candidates[0]?.src ?? null;
}

/** Heuristic for real-DOM fallback: article text minus button labels. */
function articleText(article: Element): string {
  const clone = article.cloneNode(true) as Element;
  clone
    .querySelectorAll('[role="button"], [role="textbox"], nav, svg, img, input')
    .forEach((n) => n.remove());
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/**
 * Finds the closest matching text container that appears before `el`
 * in document order (scoped to `root`). Used to attribute a composer
 * to the comment it sits under rather than the post.
 */
function closestTextBefore(
  root: Element,
  el: Element,
  selector: string,
): HTMLElement | null {
  let current: Element | null = el;
  while (current && current !== root) {
    const prev = previousElement(current);
    let cursor: Element | null = prev;
    while (cursor) {
      const match = cursor.matches(selector)
        ? (cursor as HTMLElement)
        : cursor.querySelector<HTMLElement>(selector);
      if (match) return match;
      cursor = previousElement(cursor);
    }
    current = current.parentElement;
  }
  // Search the direct ancestors chain of composer within root.
  current = el.parentElement;
  while (current && current !== root) {
    if (current.matches(selector)) return current as HTMLElement;
    current = current.parentElement;
  }
  return null;
}

function previousElement(el: Element): Element | null {
  const parent = el.parentElement;
  if (!parent) return null;
  let sibling: Element | null = el.previousElementSibling;
  while (sibling) {
    const last = lastDescendant(sibling);
    if (last) return last;
    sibling = sibling.previousElementSibling;
  }
  return null;
}

function lastDescendant(el: Element): Element | null {
  const children = el.querySelectorAll<HTMLElement>('[data-comment-text], [data-post-text]');
  return children.length ? children[children.length - 1]! : (el.matches('[data-comment-text], [data-post-text]') ? el : null);
}
