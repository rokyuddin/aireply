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
    // Primary: editors inside a post article (feed, permalink page).
    const inArticle = [
      ...document.querySelectorAll<HTMLElement>(
        'div[role="article"] div[role="textbox"][contenteditable="true"]',
      ),
    ];
    // Permalink/comment dialogs: role="dialog" roots, editors not
    // necessarily under an article.
    const inDialog = [
      ...document.querySelectorAll<HTMLElement>(
        'div[role="dialog"] div[role="textbox"][contenteditable="true"]',
      ),
    ];
    // Watchdog: any contenteditable textbox whose label looks like a
    // comment composer. Catches layouts where the editor sits outside
    // both article and dialog containers.
    const byLabel = [
      ...document.querySelectorAll<HTMLElement>(
        'div[role="textbox"][contenteditable="true"][aria-label]',
      ),
    ].filter((el) => /comment|commenting|write a/i.test(el.getAttribute('aria-label') ?? ''));

    const all = [...inArticle, ...inDialog, ...byLabel];
    return [...new Set(all.filter((el) => el.isConnected))];
  },

  /**
   * Some comment composers render collapsed (placeholder row, not
   * focused) and only become a real contenteditable editor after the
   * user clicks them. Focus is enough to expand them; if the element
   * isn't editable yet, click it first.
   */
  async activateComposer(composer: HTMLElement): Promise<void> {
    if (!composer.isContentEditable) {
      (composer.closest('[role="button"]') ?? composer).dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      await new Promise((r) => setTimeout(r, 250));
    }
    composer.focus();
  },

  async extractTarget(composer: HTMLElement): Promise<ReplyTarget | null> {
    // Feed/permalink pages: composer sits inside the post's article.
    // Dialogs: the article lives inside the same dialog (or is the
    // dialog's own article); walk up to whichever container has one.
    const article =
      composer.closest('div[role="article"]') ??
      composer.closest('div[role="dialog"]')?.querySelector('div[role="article"]') ??
      composer.closest('div[role="dialog"]');
    if (!article) return null;

    // A comment target is a text container nearer to the composer than
    // the post text; otherwise we're replying to the post itself.
    const comment = closestTextBefore(article, composer, '[data-comment-text]');
    const post = article.querySelector<HTMLElement>('[data-post-text]');

    // Real Facebook posts expose the caption through semantic ad-rendering
    // attributes rather than stable class names.
    const storyMessage = article.querySelector<HTMLElement>(
      '[data-ad-rendering-role="story_message"] [data-ad-preview="message"], ' +
        '[data-ad-rendering-role="story_message"], ' +
        '[data-ad-preview="message"]',
    );

    // Fall back to the article's own text only for test fixtures or layouts
    // without the semantic caption container.
    const text = comment
      ? comment.textContent?.trim() ?? ''
      : post?.textContent?.trim() ?? (storyMessage ? captionText(storyMessage) : articleText(article));
    return text || getPostImageUrl(article) ? { text } : null;
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
function captionText(container: Element): string {
  const clone = container.cloneNode(true) as Element;
  clone
    .querySelectorAll('[role="button"], [role="textbox"], nav, svg, img, input, [data-ad-rendering-role="meta"]')
    .forEach((n) => n.remove());
  clone.querySelectorAll('div, p, br').forEach((el) => {
    el.insertAdjacentText('beforebegin', '\n');
  });
  return (
    clone.textContent
      ?.replace(/[ \t]+/g, ' ')
      .replace(/\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() ?? ''
  );
}

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
