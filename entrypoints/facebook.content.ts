import { IconInjector } from '../lib/platforms/injector';
import { currentAdapter } from '../lib/platforms/types';
import { facebookAdapter } from '../lib/platforms/facebook';
import { extractTargetWithExpansion } from '../lib/platforms/extraction';
import type { Composer } from '../lib/platforms/types';
import type { IconHandle } from '../components/icon';
import type { OpenOptionsRequest, ReplyStreamEvent } from '../lib/messaging';
import { getSettings } from '../lib/storage';

export default defineContentScript({
  matches: ['https://*.facebook.com/*'],
  runAt: 'document_idle',
  main() {
    const adapter = currentAdapter([facebookAdapter]);
    if (!adapter) return;

    console.debug('[AIReply] content script active on', location.href);

    const injector = new IconInjector(adapter, (composer, icon) => {
      void handleIconClick(composer, icon);
    });
    injector.start();

    const handleIconClick = async (composer: Composer, icon: IconHandle): Promise<void> => {
      if (icon.isBusy) return;

      icon.isBusy = true;
      icon.setState('loading');

      try {
        await generateAndInsert(composer, icon);
      } catch (err) {
        icon.setState('error', errorMessage(err));
      } finally {
        icon.isBusy = false;
      }
    };

    const generateAndInsert = async (composer: Composer, icon: IconHandle): Promise<void> => {
      const settings = await getSettings();
      if (!settings.apiKey) {
        // Needs OpenRouter API key before generation can start.
        // The background owns openOptionsPage (content scripts don't have that API).
        icon.setState('idle');
        const req: OpenOptionsRequest = { type: 'OPEN_OPTIONS' };
        await chrome.runtime.sendMessage(req);
        return;
      }

      await adapter.activateComposer?.(composer.editor);

      const target = await extractTargetWithExpansion(adapter, composer);
      if (!target) {
        throw new Error('Could not read the post or comment to reply to.');
      }

      const requestId = crypto.randomUUID();
      const req = { type: 'GENERATE_REPLY_STREAM' as const, requestId, target, settings };
      let streamedText = '';
      await new Promise<void>((resolve, reject) => {
        const onEvent = (message: ReplyStreamEvent) => {
          if (message.requestId !== requestId) return;
          if (message.type === 'REPLY_CHUNK' && message.text) {
            clearComposerDraft(composer.editor);
            streamedText = message.text;
            if (!adapter.insertReply(composer.editor, streamedText)) {
              cleanup();
              reject(new Error('Could not type the draft into the comment box — try again.'));
              return;
            }
            lastDraft.set(composer.editor, streamedText);
          } else if (message.type === 'REPLY_ERROR') {
            cleanup();
            reject(new Error(message.error ?? 'AI reply generation failed.'));
          } else if (message.type === 'REPLY_DONE') {
            cleanup();
            resolve();
          }
        };
        const cleanup = () => chrome.runtime.onMessage.removeListener(onEvent);
        chrome.runtime.onMessage.addListener(onEvent);
        void chrome.runtime.sendMessage(req).catch((err) => {
          cleanup();
          reject(err);
        });
      });
      icon.setState('idle');
    };
  },
});

/**
 * Remove only text previously inserted by the AI draft (tracked via a
 * WeakMap) so a user's own typed text is never touched. Spans text
 * nodes: execCommand-based insert can split the draft across them.
 */
function clearComposerDraft(editor: HTMLElement): void {
  const prev = lastDraft.get(editor);
  if (!prev) return;

  // Locate the draft across text-node boundaries (execCommand-based
  // insert can split it), then select exactly that span.
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) nodes.push(node);

  const full = nodes.map((n) => n.data).join('');
  const start = full.indexOf(prev);
  if (start === -1) return;

  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const startPos = offsetToPosition(nodes, start);
  const endPos = offsetToPosition(nodes, start + prev.length);
  if (!startPos || !endPos) return;
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand('delete', false);
}

/** Maps a plain-text offset into (text node, offset within that node). */
function offsetToPosition(
  nodes: Text[],
  plainOffset: number,
): { node: Text; offset: number } | null {
  let remaining = plainOffset;
  for (const n of nodes) {
    if (remaining <= n.data.length) return { node: n, offset: remaining };
    remaining -= n.data.length;
  }
  return null;
}

const lastDraft = new WeakMap<HTMLElement, string>();

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err ?? 'Something went wrong.');
}
