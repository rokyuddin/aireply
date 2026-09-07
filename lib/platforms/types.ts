import type { ReplyTarget } from '../messaging';

/** Minimal composer metadata needed to anchor UI and insert replies. */
export interface Composer {
  /** The contenteditable composer element. */
  editor: HTMLElement;
}

/** Per-platform DOM knowledge, isolated behind this interface. */
export interface PlatformAdapter {
  id: string;
  /** URL patterns (for location.href matching) that this adapter handles. */
  matches: string[];
  /** Find comment composers on the page. */
  findComposers(): HTMLElement[];
  /**
   * Prepare a composer for insertReply (focus/click to expand a
   * collapsed "Comment as ..." placeholder into the real editor).
   * Optional — plain editors don't need it.
   */
  activateComposer?(composer: HTMLElement): Promise<void>;
  /** Extract the target (post or comment) the given composer belongs to. */
  extractTarget(composer: HTMLElement): Promise<ReplyTarget | null>;
  /** Insert a reply draft into the composer without submitting. */
  insertReply(composer: HTMLElement, text: string): boolean;
}

export const currentAdapter = (
  adapters: PlatformAdapter[],
): PlatformAdapter | undefined =>
  adapters.find((a) => a.matches.some((m) => new RegExp(m).test(location.href)));
