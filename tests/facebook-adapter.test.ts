// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { facebookAdapter } from '@/lib/platforms/facebook';

function composerHtml(postText: string, commentText?: string): string {
  return `
    <div id="root">
      <div role="article">
        <div data-post-text>${postText}</div>
        ${commentText ? `<div data-comment-text>${commentText}</div>` : ''}
        <div role="button" tabindex="0" data-testid="see-more">See more</div>
        <div>
          <div role="textbox" contenteditable="true" aria-label="Comment on post"></div>
        </div>
      </div>
    </div>`;
}

function composer(): HTMLElement {
  const el = document.querySelector<HTMLElement>(
    'div[role="textbox"][contenteditable="true"]',
  );
  if (!el) throw new Error('fixture composer missing');
  return el;
}

describe('facebook adapter', () => {
  beforeEach(() => {
    document.body.innerHTML = composerHtml('Eid Mubarak everyone!');
  });

  it('finds composers inside role=article', () => {
    const found = facebookAdapter.findComposers();
    expect(found).toHaveLength(1);
  });

  it('inserts reply into the composer via execCommand', () => {
    const editor = composer();
    const focusSpy = vi.spyOn(editor, 'focus');
    const execMock = vi.fn<(a: string, b: boolean, c: string) => boolean>(() => true);
    document.execCommand = execMock as unknown as typeof document.execCommand;

    const ok = facebookAdapter.insertReply(composer(), 'Eid Mubarak to you too!');

    expect(ok).toBe(true);
    expect(focusSpy).toHaveBeenCalled();
    expect(execMock).toHaveBeenCalledWith('insertText', false, 'Eid Mubarak to you too!');
  });

  it('returns false when execCommand is unavailable', () => {
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand;
    expect(facebookAdapter.insertReply(composer(), 'x')).toBe(false);
  });

  it('extracts post text for a post composer', async () => {
    const target = await facebookAdapter.extractTarget(composer());
    expect(target?.text).toContain('Eid Mubarak everyone!');
  });

  it('extracts comment text when the composer sits under a comment', async () => {
    document.body.innerHTML = composerHtml('Post text', 'Is this today?');
    const target = await facebookAdapter.extractTarget(composer());
    expect(target?.text).toBe('Is this today?');
  });

  it('extracts Facebook story captions without preview metadata or controls', async () => {
    document.body.innerHTML = `
      <div role="article">
        <div data-ad-rendering-role="story_message">
          <div data-ad-preview="message">
            <div dir="auto">এই ছেলেটার গুণের কোনো শেষ নেই।</div>
            <div dir="auto">আখতার হোসেনের চলার পথ বিপদমুক্ত হোক।</div>
            <div role="button">See less</div>
          </div>
        </div>
        <div data-ad-rendering-role="meta">Mobile uploads</div>
        <div role="textbox" contenteditable="true" aria-label="Comment on post"></div>
      </div>`;
      const target = await facebookAdapter.extractTarget(composer());
      expect(target?.text).toContain('এই ছেলেটার গুণের কোনো শেষ নেই।');
      expect(target?.text).toContain('আখতার হোসেনের চলার পথ বিপদমুক্ত হোক।');
      expect(target?.text).not.toContain('See less');
      expect(target?.text).not.toContain('Mobile uploads');
    });

  it('accepts an image-only post', async () => {
    document.body.innerHTML = `
      <div role="article">
        <img src="https://scontent.xx.fbcdn.net/v/t31/image.jpg" width="960" height="720">
        <div role="textbox" contenteditable="true" aria-label="Comment on post"></div>
      </div>`;
    const target = await facebookAdapter.extractTarget(composer());
    expect(target).toEqual({ text: '' });
  });
});
