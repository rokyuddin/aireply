import type { Settings } from './storage';

/** Payload describing what the user is replying to. */
export interface ReplyTarget {
  /** Post or comment text (already expanded past "See more"). */
  text: string;
  /** Author display name, when resolvable. */
  author?: string;
  /** Main image URL of an image post, if any. Resolved at click time. */
  imageUrl?: string;
  /** Post image as a base64 data URL, fetched+downscaled by the background. */
  imageDataUrl?: string;
}

export interface GenerateReplyRequest {
  type: 'GENERATE_REPLY';
  target: ReplyTarget;
  settings: Settings;
}

export interface GenerateReplyStreamRequest {
  type: 'GENERATE_REPLY_STREAM';
  requestId: string;
  target: ReplyTarget;
  settings: Settings;
}

export interface ReplyStreamEvent {
  requestId: string;
  type: 'REPLY_CHUNK' | 'REPLY_DONE' | 'REPLY_ERROR';
  text?: string;
  error?: string;
}

export interface GenerateReplyChunk {
  type: 'REPLY_CHUNK';
  text: string;
}

export interface GenerateReplyDone {
  type: 'REPLY_DONE';
  text: string;
}

export interface GenerateReplyError {
  type: 'REPLY_ERROR';
  error: string;
}

export interface GenerateReplySuccess {
  ok: true;
  text: string;
}

export interface GenerateReplyFailure {
  ok: false;
  error: string;
}

export type GenerateReplyResponse = GenerateReplySuccess | GenerateReplyFailure;

export interface OpenOptionsRequest {
  type: 'OPEN_OPTIONS';
}

export type MessageRequest = GenerateReplyRequest | GenerateReplyStreamRequest | OpenOptionsRequest;
export type MessageResponse = GenerateReplyResponse | { ok: true };
