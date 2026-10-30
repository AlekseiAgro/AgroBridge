import type { ConversationListPhase } from './list';
import type { ConversationMessage } from './model';

/** Matches `SendMessageDto` `@MaxLength(4000)`. */
export const MESSAGE_TEXT_MAX = 4000;

export type ComposerIssue = 'empty' | 'tooLong';

export type ComposerGate = {
  pending: boolean;
};

export type ComposerSubmitResult =
  | { status: 'ignored' }
  | { status: 'invalid'; issue: ComposerIssue }
  | { status: 'sent'; message: ConversationMessage; sentText: string }
  | { status: 'failed' };

/** The composer is only for a loaded thread. Signed-out and unverified states stay as they are. */
export function composerAvailable(phase: ConversationListPhase): boolean {
  return phase === 'list' || phase === 'empty';
}

/** Whitespace is checked only to reject an empty draft. The typed text is otherwise unchanged. */
export function composerIssue(text: string): ComposerIssue | null {
  if (text.length > MESSAGE_TEXT_MAX) {
    return 'tooLong';
  }
  if (!text.trim()) {
    return 'empty';
  }
  return null;
}

export function canSubmitComposer(text: string, pending: boolean): boolean {
  return !pending && composerIssue(text) === null;
}

export function messageRequestBody(
  text: string,
  sourceLocale: string,
): { text: string; sourceLocale: string } | null {
  if (composerIssue(text)) {
    return null;
  }
  return { text, sourceLocale };
}

/** Keeps a draft the user changed while sending. Clears it only when that exact text was sent. */
export function draftAfterSubmit(current: string, sentText: string, succeeded: boolean): string {
  if (!succeeded || current !== sentText) {
    return current;
  }
  return '';
}

/** Inserts the API message once. An id already on screen is replaced, not duplicated. */
export function appendSentMessage(
  messages: readonly ConversationMessage[],
  created: ConversationMessage,
): ConversationMessage[] {
  const index = messages.findIndex((item) => item.id === created.id);
  if (index === -1) {
    return [...messages, created];
  }
  const next = messages.slice();
  next[index] = created;
  return next;
}

export async function submitComposer(options: {
  text: string;
  sourceLocale: string;
  gate: ComposerGate;
  send: (body: { text: string; sourceLocale: string }) => Promise<ConversationMessage>;
  onPending: (pending: boolean) => void;
}): Promise<ComposerSubmitResult> {
  if (options.gate.pending) {
    return { status: 'ignored' };
  }

  const issue = composerIssue(options.text);
  if (issue) {
    return { status: 'invalid', issue };
  }

  const body = { text: options.text, sourceLocale: options.sourceLocale };
  options.gate.pending = true;
  options.onPending(true);
  try {
    const message = await options.send(body);
    return { status: 'sent', message, sentText: options.text };
  } catch {
    return { status: 'failed' };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}
