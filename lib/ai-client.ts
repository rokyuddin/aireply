import type { ReplyTarget } from './messaging';
import type { Settings } from './storage';

const SYSTEM_PROMPT_BASE = `You write short social-media replies on behalf of the user.

1. Detect the MOOD of the target post or comment (happy, sad, congratulatory, funny, angry, grateful, sarcastic, question, etc.).
2. Detect the LANGUAGE it is written in and reply in the SAME language:
   - Bengali script → reply in Bengali
   - English → reply in English
   - Banglish (Bengali in Latin script or mixed Bengali-English) → reply in Banglish, matching how the person writes; no Bengali script unless they used it
3. If an image description is attached, let it inform the reply (scene, event, emotion shown).
4. Write ONE reply: 1-2 sentences, max ~25 words, natural and human, matching the mood. No emojis unless the target uses them. Never mention that you are an AI.
5. Output ONLY the reply text — no preamble, no quotes, no explanation.`;

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

export async function generateReply(
  settings: Settings,
  target: ReplyTarget,
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error('No API key configured. Open the extension options to add one.');
  }

  const res = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: buildMessages(target, settings.persona),
      temperature: 0.7,
      // max_tokens: the only cap every OpenAI-compatible provider
      // understands (max_completion_tokens is OpenAI-only).
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
