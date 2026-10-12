import type { ReplyTarget } from './messaging';
import type { Settings } from './storage';

const SYSTEM_PROMPT_BASE = `You write short social-media replies on behalf of the user.

Before writing, silently analyze the target post or comment:
1. PURPOSE — what kind of content is it? (life event, achievement, grief/loss, joke/meme, religious reflection, question, photo share, announcement, opinion, etc.) What is the author trying to express or get?
2. MOOD — the emotional tone (happy, sad, congratulatory, funny, angry, grateful, sarcastic, proud, hopeful, seeking support, etc.).
3. LANGUAGE — reply in the SAME language the target is written in:
   - Bengali script → reply in Bengali
   - English → reply in English
   - Banglish (Bengali in Latin script or mixed Bengali-English) → reply in Banglish, matching how the person writes; no Bengali script unless they used it

Then write ONE reply that:
- Directly responds to THAT post's specific content — reference what it actually says or shows (a reply that could fit any post is a failure).
  - If an image is attached, silently read visible text in the image (OCR), people, scene, event, and emotion.
  - The caption is the primary source of meaning and intent; use image details and OCR only as supporting context. If they conflict, follow the caption and avoid asserting the conflicting image detail.
  - Matches the mood and purpose: congratulate an achievement, comfort a loss, laugh at a joke, answer a question, share the joy of a photo (if an image is attached, use its scene, event, visible text, and emotion as supporting context).
- Is 1-2 sentences, max ~25 words, natural and human. No emojis unless the target uses them. Never mention that you are an AI.
- Output ONLY the reply text — no preamble, no quotes, no explanation.`;

type TextPart = { type: 'text'; text: string };
type ImagePart = {
  type: 'image_url';
  image_url: { url: string; detail: 'low' };
};
export type ContentPart = TextPart | ImagePart;

export function buildMessages(
  target: ReplyTarget,
  persona?: string,
): Array<{ role: 'system' | 'user'; content: string | ContentPart[] }> {
  const system = persona
    ? `${SYSTEM_PROMPT_BASE}\n\nPersona — write the way this person writes: ${persona}`
    : SYSTEM_PROMPT_BASE;

  const userContent: ContentPart[] = [
    { type: 'text', text: target.text || '(empty post — reply based on context)' },
  ];
  if (target.imageDataUrl) {
    userContent.push({
      type: 'image_url',
      // detail low: scene/mood understanding is enough; cheapest tier
      image_url: { url: target.imageDataUrl, detail: 'low' },
    });
  }

  return [
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ];
}

export async function streamReply(
  settings: Settings,
  target: ReplyTarget,
  onText: (text: string) => void,
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error('No OpenRouter API key configured. Open Settings to add one.');
  }

  const cleanBaseUrl = settings.baseUrl.replace(/\/$/, '');
  const endpoint = `${cleanBaseUrl}/chat/completions`;

  const body = {
    model: settings.model || 'openrouter/free',
    messages: buildMessages(target, settings.persona),
    temperature: 0.7,
    max_tokens: 200,
    stream: true,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
      'HTTP-Referer': 'https://github.com/rokyuddin/aireply-extension',
      'X-Title': 'AIReply',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${errorBody.slice(0, 300)}`);
  }
  if (!res.body) throw new Error('Provider did not return a stream.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  const emit = (value: unknown) => {
    if (typeof value !== 'string' || !value) return;
    text += value;
    onText(text);
  };
  const process = (line: string) => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      const event = JSON.parse(data) as any;
      emit(event.choices?.[0]?.delta?.content);
    } catch {
      // Providers occasionally send non-JSON SSE comments or keep-alives.
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    lines.forEach(process);
    if (done) break;
  }
  process(buffer);
  if (!text.trim()) throw new Error('Provider returned an empty reply');
  return text.trim();
}

export async function generateReply(
  settings: Settings,
  target: ReplyTarget,
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error('No OpenRouter API key configured. Open Settings to add one.');
  }

  const cleanBaseUrl = settings.baseUrl.replace(/\/$/, '');
  const res = await fetch(`${cleanBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
      'HTTP-Referer': 'https://github.com/rokyuddin/aireply-extension',
      'X-Title': 'AIReply',
    },
    body: JSON.stringify({
      model: settings.model || 'openrouter/free',
      messages: buildMessages(target, settings.persona),
      temperature: 0.7,
      max_tokens: 200,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Provider returned an empty reply');
  return text;
}
