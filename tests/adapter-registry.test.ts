import { describe, expect, it } from 'vitest';
import type { PlatformAdapter } from '../lib/platforms/types';
import { currentAdapter } from '../lib/platforms/types';

/**
 * Ticket 06: prove the adapter seam scales — a second, structurally
 * different platform can be registered and dispatched purely by URL
 * match, with zero changes to shared core (injector, messaging, AI
 * client).
 */
describe('adapter registry scalability', () => {
  const fakeAdapter: PlatformAdapter = {
    id: 'fake-platform',
    matches: ['^https://([a-z]+\\.)?fake-platform\\.example/'],
    findComposers: () => [],
    extractTarget: async () => null,
    insertReply: () => true,
  };

  const facebookish: PlatformAdapter = {
    id: 'facebook',
    matches: ['^https://([a-z]+\\.)?facebook\\.com/'],
    findComposers: () => [],
    extractTarget: async () => null,
    insertReply: () => true,
  };

  it('dispatches to the second adapter by its own URL pattern', () => {
    const adapters = [facebookish, fakeAdapter];

    // jsdom's URL is a fixed about:blank; emulate by swapping location
    // through the registry contract instead: dispatch must depend only
    // on `matches`, so we test with the real function against a stubbed
    // location.
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://www.fake-platform.example/feed' },
    });
    try {
      expect(currentAdapter(adapters)?.id).toBe('fake-platform');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: original,
      });
    }
  });

  it('keeps dispatching to facebook unchanged', () => {
    const adapters = [facebookish, fakeAdapter];
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://www.facebook.com/somepost' },
    });
    try {
      expect(currentAdapter(adapters)?.id).toBe('facebook');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: original,
      });
    }
  });

  it('returns undefined for unknown URLs', () => {
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://unknown.example/' },
    });
    try {
      expect(currentAdapter([facebookish, fakeAdapter])).toBeUndefined();
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: original,
      });
    }
  });
});
