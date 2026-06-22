# 03 — Forwarded message → task

Status: ready-for-agent

## Parent

PRD: `.scratch/whatsapp-integration/PRD.md`

## What to build

Extend Capture so a message the user forwards from another chat becomes a Task, using the forwarded
content's text. No command or special syntax required.

## Acceptance criteria

- [ ] A forwarded-message payload from the allowed number creates a Task titled from its text content.
- [ ] The same security and dedupe rules from the capture slice apply (signature, allowed number, message-id dedupe).
- [ ] A confirmation reply is sent.
- [ ] Handler test with a forwarded-message fixture against the fake D1 + fake client.

## Blocked by

- 02 — Inbound capture: text → task
