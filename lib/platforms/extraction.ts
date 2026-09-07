import type { Composer, PlatformAdapter } from './types';
import type { ReplyTarget } from '../messaging';
import { getPostImageUrl } from './facebook';

/**
 * "See more" expansion: the full text of a truncated post is not in
 * the DOM — click the button and wait for the article text to grow.
 */
export async function expandSeeMore(article: Element): Promise<void> {
  const before = article.textContent?.length ?? 0;
  const seeMore = [...article.querySelectorAll<HTMLElement>('[role="button"]')].find(
    (b) => seeMoreRe.test(b.textContent?.trim() ?? ''),
  );
  if (!seeMore) return;
  seeMore.click();
  await waitFor(() => (article.textContent?.length ?? 0) > before, 1500);
}

/**
 * "See more" in the UI languages FB ships for our audience. The click
 * is harmless if the guess is wrong (worst case: text doesn't grow and
 * we use what's there).
 */
const seeMoreRe =
  /^(see more|more|আরও দেখুন|আরও|ver más|voir plus|mehr anzeigen|查看更多|ещё|もっと見る)$/i;

function waitFor(cond: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (cond() || Date.now() - start > timeoutMs) resolve();
      else setTimeout(tick, 100);
    };
    tick();
  });
}

/**
 * Extract the reply target for the composer's click, expanding
 * truncation first. Adapter-injected so the flow is platform-agnostic;
 * image resolution rides along via the adapter's own helper.
 */
export async function extractTargetWithExpansion(
  adapter: PlatformAdapter,
  composer: Composer,
): Promise<ReplyTarget | null> {
  const article = composer.editor.closest('div[role="article"]');
  if (article) await expandSeeMore(article);
  const target = await adapter.extractTarget(composer.editor);
  if (target && article) {
    // Resolve at click time; the background fetches the bytes (fbcdn
    // URLs are signed and expire, so never cache).
    target.imageUrl = getPostImageUrl(article) ?? undefined;
  }
  return target;
}
