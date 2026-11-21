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

The client also covers liveness and location: `createLivenessChallenge`, `uploadBiometric` (types `gesture`, `liveness_video` and `selfie`, always with the challenge ID and `capture_source=camera`), `submitFacial` and `submitLocation`. `facialSettings` and `locationSettings` read `verification_requirements[].settings` and fill the spec defaults. The server remains authoritative for verification decisions.

`CredflareError` exposes the HTTP status and validation errors. A 401 means the session is unavailable; ask your authenticated backend whether it may issue a replacement. A 409 means the verification no longer accepts submissions. Do not silently retry mutations with a new request key.

## Local examples

Set `CREDFLARE_API_URL`, `CREDFLARE_CLIENT_ID`, `CREDFLARE_CLIENT_SECRET` and `CREDFLARE_PROFILE_ID` in the server environment, then run:

```sh
npm run build
node examples/server.mjs
```

Open `http://localhost:3107` (set `PORT` to change it). The browser collects documents, then runs liveness and location without displaying session credentials. Set `CREDFLARE_FACE_MODEL` to a local `face_landmarker.task` to serve the model from the example server. Native examples request their own fresh session from this server. The server chooses the profile using `CREDFLARE_PROFILE_IDS` and `CREDFLARE_DEMO_FLOW` (default `snapshot_or_upload`), or `CREDFLARE_PROFILE_ID` when no map is configured. Configure a profile with `facial_verification` and `location_verification` to exercise liveness and location. No profile choice is accepted from the browser. The sample server listens only on localhost and is not a production authentication implementation. Never commit its credentials or a session descriptor.

HTTPS is required except on loopback addresses. Browser origins must exactly match the allowlist supplied when the server creates a session. Applicant requests omit cookies.

See [the SDK flow requirements](docs/SDK-FLOW.md) for the guided flow and release boundary and [TESTING.md](TESTING.md) for the checks. Trusted camera checks and deepfake detection are not available.

## Liveness and location

After documents, the SDK runs the remaining facial and location requirements in profile order and ends with a receipt. In the browser, `mountRemainingSteps(element, session, options)` drives this flow; `mountLiveness`, `mountLocation` and `mountReceipt` are available for custom flows.

Liveness asks the server for a challenge, shows a mirrored front camera preview with positioning hints, runs the server's gestures in order with the shared gesture engine, captures a JPEG frame as each gesture completes, records a video without audio while the challenge runs (when `record_video` is on, up to `max_video_seconds`), then takes the selfie. Retrying always requests a new challenge. The checks show that the camera saw a server chosen sequence in time; they do not prove a live person or detect deepfakes.

Face signals come from a swappable provider (`FaceSignalProvider`). The browser default is MediaPipe Face Landmarker from `@credflare/sdk-javascript/mediapipe`, loaded only when liveness starts. Install `@mediapipe/tasks-vision` 0.10.32 (an optional peer dependency) in apps that collect liveness. Set `wasmBaseUrl` and `modelAssetPath` to serve the runtime and model yourself; the defaults load them from public CDNs. Eye openness is `1 - mean(eyeBlinkLeft, eyeBlinkRight)`, smile is `mean(mouthSmileLeft, mouthSmileRight)`, yaw is `atan2(m8, m10)` and pitch is `asin(m9)` from the facial transformation matrix, in degrees.

Location shows a consent screen (naming a reference place by its label when the profile has one), requests a high accuracy fix with `navigator.geolocation`, retries up to the spec attempts until the fix meets `max_accuracy_m` and `max_age_s`, then sends it with `provider: "browser"` and `is_mock: null`. Server rejections are recognised by their `code` (exposed on `CredflareError.code`) and shown with the matching copy and a retry; a place requirement rejection names the place. No geocoding or IP lookup is called.

Browser permissions: camera (no microphone) and location. Serve the page over HTTPS.

## Shared spec

`src/spec.generated.ts` is generated from the sibling `sdk-spec` repository and exported from the package (copy, tokens, icons, liveness and location rules). `npm run check:spec` fails when it or the copied fixtures in `test/fixtures` drift from `../sdk-spec`. CI runs the same check against a checkout of the spec repository.
