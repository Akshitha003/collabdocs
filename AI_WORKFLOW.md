# AI-native workflow note

## Tools used

ChatGPT (OpenAI) was used to generate and organize the initial React/TypeScript, FastAPI/SQLAlchemy, test, styling, and documentation source files. Local command-line tools were used to inspect files and attempt validation.

## Where AI accelerated work

AI helped translate the open-ended assignment into a small end-to-end product slice, scaffold cross-layer code, draft authorization tests, and document scope decisions and deployment steps.

## Review and changes

The generated design was constrained to seeded demo users, owner-checked sharing, persistent TipTap JSON, a bounded upload surface, and sequential debounced saves. Real-time editing, OAuth, DOCX parsing, and unnecessary infrastructure were excluded to keep the primary flow coherent. Generated code is not presumed correct merely because AI produced it.

## Verification

See the test results documented in `SUBMISSION.md`. The included pytest tests check access control, sharing, revocation, formatting persistence, and import validation. A live browser walkthrough and deployed smoke test must still be completed by the submitter; do not represent those as verified until performed.

## Responsible use

AI supported implementation, but responsibility for design tradeoffs, reviewing code, running tests, verifying deployed behavior, and accurately representing the final state belongs to the developer submitting the assignment. Edit this note to reflect any additional work and tools you actually use before submitting.
