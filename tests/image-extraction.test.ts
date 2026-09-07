// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getPostImageUrl } from '@/lib/platforms/facebook';

function withImages(...imgs: Array<{ src: string; w: number; h: number }>): void {
  document.body.innerHTML = `
    <div role="article">
      <div data-post-text>check this out</div>
      ${imgs
        .map(
          ({ src, w, h }) =>
            `<img src="${src}" width="${w}" height="${h}" />`,
        )
        .join('')}
    </div>`;
}

describe('getPostImageUrl', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when the article has no image', () => {
    withImages();
    const article = document.querySelector('[role="article"]')!;
    expect(getPostImageUrl(article)).toBeNull();
  });

  it('picks the largest fbcdn image', () => {
    withImages(
      { src: 'https://scontent.xx.fbcdn.net/v/t39/small.jpg', w: 100, h: 100 },
      { src: 'https://scontent.xx.fbcdn.net/v/t31/large.jpg', w: 960, h: 720 },
    );
    const article = document.querySelector('[role="article"]')!;
    expect(getPostImageUrl(article)).toContain('large.jpg');
  });

  it('ignores non-fbcdn images (stickers, external)', () => {
    withImages({ src: 'https://example.com/pic.jpg', w: 960, h: 720 });
    const article = document.querySelector('[role="article"]')!;
    expect(getPostImageUrl(article)).toBeNull();
  });
});
