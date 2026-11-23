# Development test coverage

Date: 2026-11-21. Host: macOS 26.3, Apple Silicon. Runtime: Node 26.0.0, TypeScript 7.0.2, Chrome headless.

```sh
npm test                 # build and unit and contract tests
npm run check:spec       # generated spec and fixtures match ../sdk-spec
node tool/browser-camera.mjs
node tool/browser-flows.mjs
```

| Check | Coverage |
| --- | --- |
| Contract tests | Session, documents, liveness challenge, gesture, video and selfie uploads (multipart fields and retry keys), facial submission, location submission, location rejection as a 422 validation error |
| Gesture engine | Every trace in `test/fixtures/liveness-traces`, plus challenge sequencing, timeout and expiry |
| Settings | Facial and location settings, defaults and reference place labels |
| Location | Accuracy, age and mock checks, retry attempts, reference place copy |
| Questions | Every server computed `show_if` case in `fixtures/show-if-cases.json` (62), conditional questions of the questionnaire session, validation copy for each question type, hidden answers left out of the payload |
| Contact codes | Code request and confirmation against the real 202 and 201 bodies, every email and phone rejection mapped to its spec screen, extra rejection fields kept |
| Refresh rule | The session before and after a form submission that added a phone requirement, receipt when nothing is outstanding |
| MediaPipe signals | A real Face Landmarker result for a face turned to its own right and looking down (and its mirror) gives the contract signs for yaw and pitch |

`tool/browser-camera.mjs` starts headless Chrome with a synthetic camera, emulates geolocation and runs the remaining steps flow: liveness intro and consent, mirrored preview, challenge, gesture frames, video recording, selfie, uploads, facial submission, location consent, a low accuracy retry, a server rejection with retry, location submission and the receipt. The synthetic camera shows no face, so the page replays spec traces through the provider interface; the camera stream, recording and uploads are real. Set `SCREENSHOT_DIR` to save each screen.

- Without API variables it uses the contract fixtures as the API.
- With `CREDFLARE_API_URL`, `CREDFLARE_CLIENT_ID`, `CREDFLARE_CLIENT_SECRET` and `CREDFLARE_PROFILE_ID` it creates a case on that backend and runs the same flow against it.
- With `CREDFLARE_FACE_MODEL` pointing to a local `face_landmarker.task` it also loads the MediaPipe provider on the synthetic camera and checks that it reports no face.

`tool/browser-flows.mjs` drives the browser screens in headless Chrome against fixture responses: the code entry after a `resend_too_soon` with no code on screen, the leave action without a host handler, resend and change locked during a confirmation, a closed case seen by the handoff poll, a camera switch while the face detector starts, a question keyed `constructor` and the founders input.

Pending: a run with a real face in front of a camera on physical devices.
