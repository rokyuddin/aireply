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

function okManifestResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text }],
        },
      ],
    }),
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

  it('POSTs to OpenRouter with bearer auth, headers, and returns the reply text', async () => {
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
    expect((init.headers as Record<string, string>)['HTTP-Referer']).toBe(
      'https://github.com/rokyuddin/aireply-extension',
    );
    expect((init.headers as Record<string, string>)['X-Title']).toBe(
      'AIReply',
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('openrouter/free');
    expect(body.max_tokens).toBe(200);
  });

  it('respects a custom base URL and model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await generateReply(
      { ...settings, baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/free' },
      { text: 'hi' },
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(JSON.parse(init.body as string).model).toBe('openrouter/free');
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
