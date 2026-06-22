# 02 — Inbound capture: text → task

Status: ready-for-agent

## Parent

PRD: `.scratch/whatsapp-integration/PRD.md`

## What to build

The first complete WhatsApp loop: a typed message from the user becomes a Task.

End-to-end behavior delivered:

- A new inbound webhook endpoint handles the provider's verification handshake (GET, verify token) and
  message delivery (POST).
- Every POST is authenticated by verifying the provider's request signature against the app secret;
  unsigned or mismatched requests are rejected. The endpoint is reachable by the provider (excluded from
  the app's access gate); the signature check is the only gate.
- Only messages from the single configured **allowed number** are processed; all others are ignored.
- Duplicate deliveries of the same message id are ignored (no double Capture).
- A typed text message becomes a Task using the shared parser, including any date/time/priority/labels,
  and the bot replies confirming the title and resolved due time.
- The new Task reaches an open app via the existing tickle/sync path.
- The component that sends WhatsApp messages is injectable, so tests substitute a fake that records
  outbound messages instead of making network calls. (This is the one new test seam.)

## Acceptance criteria

- [ ] GET verification handshake succeeds with the correct verify token and fails otherwise.
- [ ] A POST with a valid signature from the allowed number creates the correctly parsed Task and sends a confirmation reply.
- [ ] A POST with an invalid/missing signature is rejected; a message from a non-allowed number is ignored; a duplicate message id does not create a second Task.
- [ ] The Task write uses the same upsert + last-write-wins logic as the app's save path.
- [ ] Handler tests run against the fake D1 and the fake WhatsApp client (capture, dup-ignored, unsigned-rejected, wrong-sender-ignored).
- [ ] One end-to-end (Playwright) test confirms a captured Task appears in the app UI.

## Blocked by

- 01 — Shared compute module + remindAt foundation
