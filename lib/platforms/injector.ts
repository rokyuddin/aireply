import type { IconHandle } from '../../components/icon';
import { isIconMounted, mountIcon } from '../../components/icon';
import type { Composer, PlatformAdapter } from './types';

interface Entry {
  editor: HTMLElement;
  icon: IconHandle;
}

/**
 * Watches the page for comment composers and mounts an AI icon beside
 * each one. Survives React re-renders: a MutationObserver re-scans on
 * added nodes, and icons whose editor disappears are unmounted.
 * Composer discovery is delegated to the platform adapter, so a new
 * platform needs no changes here.
 */
export class IconInjector {
  private readonly entries = new Map<HTMLElement, Entry>();
  private readonly decorated = new WeakSet<HTMLElement>();
  private observer: MutationObserver | undefined;
  private scanTimer: number | undefined;

  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly onClick: (composer: Composer, icon: IconHandle) => void,
  ) {}

  start(): void {
    this.scan();
    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stop(): void {
    this.observer?.disconnect();
    for (const { icon } of this.entries.values()) icon.destroy();
    this.entries.clear();
  }

  private scheduleScan(): void {
    if (this.scanTimer !== undefined) return;
    // Debounce: the feed fires many mutations per second while scrolling.
    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = undefined;
      this.scan();
    }, 300);
  }

  private scan(): void {
    const live = new Set<HTMLElement>();

    for (const editor of this.adapter.findComposers()) {
      live.add(editor);
      // Re-mount when React re-rendered the row and removed our icon
      // host while the editor element itself survived.
      if (this.decorated.has(editor) && isIconMounted(editor.parentElement)) continue;
      this.decorated.add(editor);
      const handle = mountIcon({ editor }, () => this.onClick({ editor }, handle));
      this.entries.set(editor, { editor, icon: handle });
    }

    // Unmount icons for composers removed by React re-renders.
    for (const [editor, entry] of this.entries) {
      if (!live.has(editor) && !editor.isConnected) {
        entry.icon.destroy();
        this.entries.delete(editor);
      }
    }
  }
}
