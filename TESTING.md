# Development test coverage

Date: 2026-11-20. Host: macOS 26.3, Apple Silicon. Runtime: Node 26.0.0, TypeScript 7.0.2.

| Check | Result |
| --- | --- |
| TypeScript build | Passed |
| HTTP contract tests | 7 passed |
| Capture policy and step tests | 6 passed |
| Session authentication and error envelope | Passed |
| Multipart evidence upload and stable retry key | Passed |
| File-ID submission | Passed |
| Insecure remote API destination rejection | Passed |
| Host-controlled session replacement | Passed |

The HTTP tests use responses from isolated Laravel API requests with synthetic accounts and evidence. Backend authorization, expiry, revocation, CORS, file limits, document sides and retry behavior have separate HTTP feature tests in the webservice repository.

The browser example has not yet had an interactive capture test. Full guided verification, biometric processing and production deployment are outside the completed coverage.
