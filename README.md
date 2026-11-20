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
const uploadKey = crypto.randomUUID();
const uploaded = await client.upload('documents', body, uploadKey);
const submitKey = crypto.randomUUID();
await client.submit({
  type: 'document_verification',
  document_type_id: selectedRequirement.document_type.id,
  file_id: uploaded.id,
}, submitKey);
```

Reuse each request key with the same payload after a network interruption. Use a new key when the applicant changes evidence. Submit `back_file_id` when the requirement requests both sides. Client-side file checks improve feedback; the API enforces workspace size, file types and evidence ownership.

The client also supports form, facial-photo and location submissions. A facial photo is not a liveness result. The server remains authoritative for verification decisions.

`CredflareError` exposes the HTTP status and validation errors. A 401 means the session is unavailable; ask your authenticated backend whether it may issue a replacement. A 409 means the verification no longer accepts submissions. Do not silently retry mutations with a new request key.

## Local examples

Set `CREDFLARE_API_URL`, `CREDFLARE_CLIENT_ID`, `CREDFLARE_CLIENT_SECRET` and `CREDFLARE_PROFILE_ID` in the server environment, then run:

```sh
npm run build
node examples/server.mjs
```

Open `http://localhost:3000`. The browser can submit a document and display a temporary session descriptor for the native examples. The sample server listens only on localhost and is not a production authentication implementation. Never commit its credentials or a session descriptor.

HTTPS is required except on loopback addresses. Browser origins must exactly match the allowlist supplied when the server creates a session. Applicant requests omit cookies.

See [the SDK flow requirements](docs/SDK-FLOW.md) for the guided flow and release boundary. Trusted-camera checks, liveness and deepfake detection are unavailable in this version.
