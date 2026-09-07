import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildMessages, generateReply } from '@/lib/ai-client';
import { DEFAULT_SETTINGS } from '@/lib/storage';

const settings = { ...DEFAULT_SETTINGS, apiKey: 'sk-test' };
const DATA_URL = 'data:image/jpeg;base64,abc123';

function okResponse(text: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: 'assistant', content: text } }] }),
    { status: 200 },
  );
}

describe('vision payload', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('appends an image_url part with detail low when imageDataUrl is present', () => {
    const messages = buildMessages({ text: 'look at this', imageDataUrl: DATA_URL });
    const user = messages[1]?.content as Array<{ type: string; image_url?: unknown }>;
    expect(user).toHaveLength(2);
    expect(user[1]?.type).toBe('image_url');
    expect(JSON.stringify(user[1])).toContain(DATA_URL);
    expect(JSON.stringify(user[1])).toContain('"detail":"low"');
  });

  it('omits the image part when there is no image', () => {
    const messages = buildMessages({ text: 'plain text' });
    const user = messages[1]?.content as Array<{ type: string }>;
    expect(user).toHaveLength(1);
  });

  it('sends the image through to the provider in responses API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'nice pic' }],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const reply = await generateReply(settings, { text: 'look', imageDataUrl: DATA_URL });
    expect(reply).toBe('nice pic');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const userContent = body.input[0].content;
    expect(userContent).toHaveLength(2);
    expect(userContent[1].type).toBe('input_image');
    expect(userContent[1].image_url).toBe(DATA_URL);
  });

  it('sends the image through to custom chat/completions provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('nice pic'));
    vi.stubGlobal('fetch', fetchMock);

    await generateReply(
      { ...settings, baseUrl: 'https://openrouter.ai/api/v1' },
      { text: 'look', imageDataUrl: DATA_URL },
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const userContent = body.messages[1].content;
    expect(userContent).toHaveLength(2);
    expect(userContent[1].image_url.url).toBe(DATA_URL);
    expect(userContent[1].image_url.detail).toBe('low');
  });
});
