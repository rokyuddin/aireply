import type { MessageRequest, MessageResponse } from '../lib/messaging';
import { generateReply } from '../lib/ai-client';
import { fetchImageAsDataUrl } from '../lib/image-pipeline';

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener(
    (msg: MessageRequest, _sender, sendResponse) => {
      if (msg?.type === 'OPEN_OPTIONS') {
        void chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === 'GENERATE_REPLY') {
        (async () => {
          try {
            const target = { ...msg.target };
            if (target.imageUrl && !target.imageDataUrl) {
              // Fetch in the SW: host_permissions bypass CORS here.
              // On failure (expired signed URL, network), degrade to
              // text-only rather than failing the whole reply.
              try {
                target.imageDataUrl = await fetchImageAsDataUrl(target.imageUrl);
              } catch {
                delete target.imageDataUrl;
                target.imageUrl = undefined;
              }
            }
            const text = await generateReply(msg.settings, target);
            sendResponse({ ok: true, text } satisfies MessageResponse);
          } catch (e) {
            sendResponse({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            } satisfies MessageResponse);
          }
        })();
        return true; // keep the message channel open for the async reply
      }
      return false;
    },
  );
});
