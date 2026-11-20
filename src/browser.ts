import { CredflareSession } from './index.js';
import type { SessionDescriptor, SessionInfo } from './index.js';

export function mountSession(element: HTMLElement, descriptor: SessionDescriptor, onReady: (session: CredflareSession, info: SessionInfo) => void): () => void {
  const abort = new AbortController();
  const session = new CredflareSession(descriptor);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = 'Loading verification requirements…';
  element.replaceChildren(status);
  session.get(abort.signal).then(info => {
    if (abort.signal.aborted) return;
    status.textContent = info.custom_message || 'Your verification is ready.';
    onReady(session, info);
  }).catch((error: unknown) => {
    if (!abort.signal.aborted) status.textContent = error instanceof Error ? error.message : 'Unable to load verification.';
  });
  return () => { abort.abort(); element.replaceChildren(); };
}
