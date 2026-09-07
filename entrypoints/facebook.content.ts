import { IconInjector } from '../lib/platforms/injector';
import { currentAdapter } from '../lib/platforms/types';
import { facebookAdapter } from '../lib/platforms/facebook';
import { extractTargetWithExpansion } from '../lib/platforms/extraction';
import type { Composer } from '../lib/platforms/types';
import type { IconHandle } from '../components/icon';
import type {
  GenerateReplyRequest,
  GenerateReplyResponse,
  OpenOptionsRequest,
} from '../lib/messaging';
import { getSettings } from '../lib/storage';

export default defineContentScript({
  matches: ['https://*.facebook.com/*'],
  runAt: 'document_idle',
  main() {
    const adapter = currentAdapter([facebookAdapter]);
    if (!adapter) return;

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
        // Missing key isn't a retryable error here — send the user to
        // setup. The background owns openOptionsPage (content scripts
        // don't have that API).
        icon.setState('idle');
        const req: OpenOptionsRequest = { type: 'OPEN_OPTIONS' };
        await chrome.runtime.sendMessage(req);
        return;
      }

      const target = await extractTargetWithExpansion(adapter, composer);
      if (!target) {
        throw new Error('Could not read the post or comment to reply to.');
      }

      const req: GenerateReplyRequest = { type: 'GENERATE_REPLY', target, settings };
      const reply = (await chrome.runtime.sendMessage(req)) as
        | GenerateReplyResponse
        | undefined;

      if (!reply) throw new Error('No response from the extension background.');
      if (!reply.ok) throw new Error(reply.error);

      // Clear the composer's previous AI draft before inserting the new
      // one so regenerate replaces rather than appends.
      clearComposerDraft(composer.editor);
      if (!adapter.insertReply(composer.editor, reply.text)) {
        throw new Error('Could not type the draft into the comment box — try again.');
      }
      lastDraft.set(composer.editor, reply.text);
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
