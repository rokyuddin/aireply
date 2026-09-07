import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMessages, generateReply } from '@/lib/ai-client';
import { DEFAULT_SETTINGS } from '@/lib/storage';
import type { ReplyTarget } from '@/lib/messaging';

const settings = {
  ...DEFAULT_SETTINGS,
  apiKey: 'sk-test',
};

function okResponse(text: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: 'assistant', content: text } }] }),
    { status: 200 },
  );
}

describe('buildMessages', () => {
  it('includes mood and language instructions in the system prompt', () => {
    const messages = buildMessages({ text: 'hello' });
    const system = messages[0]?.content;
    expect(system).toMatch(/mood/i);
    expect(system).toMatch(/language/i);
    expect(system).toMatch(/Banglish/i);
  });

  it('appends the user persona when set', () => {
    const messages = buildMessages(
      { text: 'hello' },
      'casual and warm',
    );
    expect(messages[0]?.content).toContain('casual and warm');
  });

  it('omits persona section when empty', () => {
    const messages = buildMessages({ text: 'hello' });
    expect(messages[0]?.content).not.toContain('Persona');
  });

  it('sends target text as a user message', () => {
    const messages = buildMessages({ text: 'sad day' });
    const user = messages[1]?.content;
    expect(JSON.stringify(user)).toContain('sad day');
  });
});

describe('generateReply', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the configured base URL with bearer auth and returns the reply text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('Great news! 🎉'));
    vi.stubGlobal('fetch', fetchMock);

    const target: ReplyTarget = { text: 'I got the job!' };
    const reply = await generateReply(settings, target);

    expect(reply).toBe('Great news! 🎉');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer sk-test',
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(DEFAULT_SETTINGS.model);
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(200);
    expect(body.stream).toBe(false);
  });

  it('respects a custom base URL and model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await generateReply(
      { ...settings, baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-4' },
      { text: 'hi' },
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(JSON.parse(init.body as string).model).toBe('llama-4');
  });

  it('throws a readable error on auth failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"error":"bad key"}', { status: 401 })),
    );
    await expect(generateReply(settings, { text: 'hi' })).rejects.toThrow(
      /API 401/,
    );
  });

  it('throws on malformed provider response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [] }), { status: 200 }),
      ),
    );
    await expect(generateReply(settings, { text: 'hi' })).rejects.toThrow(
      /empty/i,
    );
  });
});
