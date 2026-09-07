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

export async function generateReply(
  settings: Settings,
  target: ReplyTarget,
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error('No API key configured. Open the extension options to add one.');
  }

  const cleanBaseUrl = settings.baseUrl.replace(/\/$/, '');
  const isResponsesApi =
    cleanBaseUrl.includes('manifest.build') || cleanBaseUrl.endsWith('/responses');

  if (isResponsesApi) {
    const endpoint = cleanBaseUrl.endsWith('/responses')
      ? cleanBaseUrl
      : `${cleanBaseUrl}/responses`;

    const persona = settings.persona?.trim();
    const instructions = persona
      ? `${SYSTEM_PROMPT_BASE}\n\nPersona — write the way this person writes: ${persona}`
      : SYSTEM_PROMPT_BASE;

    const inputContent: Array<{ type: string; text?: string; image_url?: string }> = [
      { type: 'input_text', text: target.text || '(empty post — reply based on context)' },
    ];
    if (target.imageDataUrl) {
      inputContent.push({
        type: 'input_image',
        image_url: target.imageDataUrl,
      });
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model || 'auto',
        instructions,
        input: [
          {
            role: 'user',
            content: inputContent,
          },
        ],
        max_output_tokens: 500,
        store: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as any;
    let text = data.choices?.[0]?.message?.content?.trim();
    if (!text && Array.isArray(data.output)) {
      const msg = data.output.find((o: any) => o.type === 'message') ?? data.output[0];
      const textPart =
        msg?.content?.find((c: any) => c.type === 'output_text') ?? msg?.content?.[0];
      text = textPart?.text?.trim();
    }
    if (!text) throw new Error('Provider returned an empty reply');
    return text;
  }

  const res = await fetch(`${cleanBaseUrl}/chat/completions`, {
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
