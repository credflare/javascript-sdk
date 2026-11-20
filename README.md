# CredFlare JavaScript/TypeScript SDK

Development SDK for scoped applicant sessions, with separate applicant and server entry points. Requires the scoped-session backend changes. This package is not published.

```sh
npm ci
npm test
```

## Server

Keep this code and its credentials on your backend.

```ts
import {CredflareServer} from '@credflare/sdk-javascript/server';

const server = new CredflareServer(process.env.CREDFLARE_API_URL!, {
  clientId: process.env.CREDFLARE_CLIENT_ID!,
  clientSecret: process.env.CREDFLARE_CLIENT_SECRET!,
});
const verification = await server.createVerification({
  email: 'applicant@example.test',
  profileId: 123,
});
const session = await server.createSession(verification.id, ['https://your-site.example']);
```

Authenticate your application's users and bind each session to the correct applicant before returning it. Store the verification ID on your backend for decisions and session renewal.

## Applicant

```ts
import {CredflareSession} from '@credflare/sdk-javascript';

const client = new CredflareSession(session);
const info = await client.get();
const body = new FormData();
body.append('file', selectedFile);
body.append('side', 'front');
body.append('capture_source', 'upload');
const uploadKey = crypto.randomUUID();
const uploaded = await client.upload('documents', body, uploadKey);
const submitKey = crypto.randomUUID();
await client.submit({
  type: 'document_verification',
  document_type_id: selectedRequirement.document_type.id,
  evidence: [{file_id: uploaded.id, source: 'upload', side: 'front'}],
}, submitKey);
```

Reuse each request key with the same payload after a network interruption. Use a new key when the applicant changes evidence. Use `captureSteps(requirement)` to collect every required side and source. `snapshot_and_upload` requires a separate camera photo and uploaded file for each side. Client-side file checks improve feedback; the API enforces workspace size, file types and evidence ownership.

The client also supports form, facial-photo and location submissions. A facial photo is not a liveness result. The server remains authoritative for verification decisions.

`CredflareError` exposes the HTTP status and validation errors. A 401 means the session is unavailable; ask your authenticated backend whether it may issue a replacement. A 409 means the verification no longer accepts submissions. Do not silently retry mutations with a new request key.

## Local examples

Set `CREDFLARE_API_URL`, `CREDFLARE_CLIENT_ID`, `CREDFLARE_CLIENT_SECRET` and `CREDFLARE_PROFILE_ID` in the server environment, then run:

```sh
npm run build
node examples/server.mjs
```

Open `http://localhost:3107`. The browser collects documents without displaying session credentials. Native examples request their own fresh session from this server. The server chooses the profile using `CREDFLARE_PROFILE_IDS` and `CREDFLARE_DEMO_FLOW` (default `snapshot_or_upload`), or `CREDFLARE_PROFILE_ID` when no map is configured. Configure a profile with `facial_verification` to exercise selfie collection. No profile choice is accepted from the browser. The sample server listens only on localhost and is not a production authentication implementation. Never commit its credentials or a session descriptor.

HTTPS is required except on loopback addresses. Browser origins must exactly match the allowlist supplied when the server creates a session. Applicant requests omit cookies.

See [the SDK flow requirements](docs/SDK-FLOW.md) for the guided flow and release boundary. Trusted-camera checks, liveness and deepfake detection are unavailable in this version.

## Developer-configured facial collection

Choose the compliance profile on your server when creating the case. The recipient does not choose a profile or verification mode. The SDK collects outstanding documents first, then opens the selfie step only when the case requests `facial_verification`. Selfie-only cases go directly to that step. Document alternatives and capture-source choices follow the server's requirement rules.

The selfie step uses the front camera, provides a preview and retake action, and sends only after confirmation. Uploads use the scoped biometric endpoint; facial submissions reference the uploaded file ID. Retrying a send reuses its upload and submission keys. A receipt confirms collection for review, not a face match or liveness result.

The backend currently reports liveness, trusted camera and deepfake detection as unavailable. Automated face matching and validated liveness processing are not implemented by this capture interface. Forms and location checks return control to the host app. Example apps obtain their requirements from the demo server without a recipient-facing profile selector.

For browser selfie collection, import `mountSelfieCapture` from `@credflare/sdk-javascript/browser`. Call it only when `requiresSelfie(info)` is true and the document step has finished. It returns a cleanup function that stops camera tracks, aborts pending requests, and revokes the preview URL. Call cleanup when replacing the screen or navigating away. Refresh the session after its submission callback.
