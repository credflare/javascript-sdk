# Development test coverage

Date: 2026-11-20. Host: macOS 26.3, Apple Silicon. Runtime: Node 26.0.0, TypeScript 7.0.2.

| Check | Result |
| --- | --- |
| TypeScript build | Passed |
| HTTP contract tests | 8 passed |
| Capture policy and step tests | 6 passed |
| Profile requirements and collection progress | 2 passed |
| Session authentication and error envelope | Passed |
| Multipart evidence upload and stable retry key | Passed |
| File-ID submission | Passed |
| Insecure remote API destination rejection | Passed |
| Host-controlled session replacement | Passed |

The HTTP tests use responses from isolated Laravel API requests with synthetic accounts and evidence. Backend authorization, expiry, revocation, CORS, file limits, document sides and retry behavior have separate API feature tests.

The browser camera test covers capture, preview, stopped camera tracks, biometric upload, retry without reupload, stable submission keys and cleanup using a software camera. Automated face matching, liveness processing and production deployment are outside the completed coverage.
