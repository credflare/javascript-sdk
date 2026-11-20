import { apiBase, request } from './index.js';
import type { Fetch, SessionDescriptor } from './index.js';

export class CredflareServer {
  private readonly base: string;
  constructor(base: string, private readonly credentials: { clientId: string; clientSecret: string }, private readonly fetcher: Fetch = globalThis.fetch) {
    if (typeof window !== 'undefined') throw new Error('Server credentials must stay on your server.');
    this.base = apiBase(base);
  }
  private call<T>(method: string, path: string, body?: unknown): Promise<T> {
    return request<T>(this.fetcher, this.base + path, { method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Client-ID': this.credentials.clientId, 'X-Client-Secret': this.credentials.clientSecret },
      body: body === undefined ? undefined : JSON.stringify(body) });
  }
  createVerification(input: { email: string; profileId: number; callbackUrl?: string }): Promise<{ id: string; status: string; verification_url: string }> {
    return this.call('POST', '/client/verifications', { target: { type: 'email', value: input.email }, profile_id: input.profileId, callback_url: input.callbackUrl });
  }
  createSession(verificationId: string, allowedOrigins: string[] = []): Promise<SessionDescriptor> {
    return this.call('POST', `/client/verifications/${encodeURIComponent(verificationId)}/sessions`, { allowed_origins: allowedOrigins });
  }
  revokeSession(sessionId: string): Promise<null> {
    return this.call('DELETE', `/client/verification-sessions/${encodeURIComponent(sessionId)}`);
  }
  getVerification(verificationId: string): Promise<Record<string, unknown>> {
    return this.call('GET', `/client/verifications/${encodeURIComponent(verificationId)}`);
  }
}
