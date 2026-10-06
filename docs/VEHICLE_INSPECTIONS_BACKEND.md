# Vehicle inspections integration

## Frontend status

Routes: `/inspections`, `/inspections/new`, `/inspections/:id`, including tenant-prefixed variants. The sidebar uses the existing `JOB_CARDS` permission. All visual controls reuse the current theme and shared UI.

Implemented: list/search/status/date filters and pagination; send history; customer/vehicle selection; optional job linking; diagnostic sections/checkpoints; ratings/readings/remarks; template snapshots; camera/uploads; draft saves; finalization; revisions; local branded PDFs; WhatsApp/email send requests.

**Backend Changes Required:** the endpoints below are new contracts, not existing backend functionality. This repository does not contain the backend. No local-storage or mock persistence is substituted when an endpoint is unavailable. The frontend keeps edits visible and shows an error on failed saves/uploads/sends.

## Response and authorization

Use the existing `{ data, error }` envelope and bearer-token authorization. Enforce organization and branch access on the server, including photo uploads and send-history records. Never trust the branch supplied by the browser. Follow existing Job Cards VIEW/CREATE/EDIT permissions; template writes additionally require Settings EDIT. PDF export remains subject to the existing subscription export lock.

`src/types/inspection.ts` defines the payloads. Server-generated fields: `id`, unique `reportNumber`, `revision`, timestamps, authenticated inspector/audit attribution. Every update must compare the supplied revision and return 409 for stale data. Validate customer ownership of the vehicle, branch consistency of a linked job card, all rating enums, non-negative odometer, and length/count limits. Uploads and document URLs must not expose another tenant's assets.

## Endpoints

| Method | Path | Request / data |
| --- | --- | --- |
| GET | `/api/inspections` | `page`, `limit`, `q`, optional `branchId`, `status`, `from`, `to`; returns `{ items: InspectionReport[], total, totalPages }`. Include `inspectorName`, `inspectorRole`, and `whatsAppStatus` (`NOT_SENT` or the latest WhatsApp send status) on each item; compute latest status from send logs for that report revision. |
| GET | `/api/inspections/send-history` | Same query shape; status is QUEUED/SENT/DELIVERED/FAILED; returns `{ items: InspectionSendLog[], total, totalPages }`. Each item includes `inspectionId` and an authorized `pdfUrl` for the exact sent revision. Exclude send logs for soft-deleted inspections from normal send-history results and counts. |
| GET | `/api/inspections/:id` | `{ item: InspectionReport }`; include an authorized `pdfUrl` for the latest finalized revision and a `pdfUrl` for each retained finalized revision. |
| DELETE | `/api/inspections/:id` | Requires Job Cards DELETE permission and matching branch/org access; soft-delete report from active lists and return `{ deleted: true }` |
| POST | `/api/inspections` | Draft report body; ignore blank client ID/number; return `{ item: InspectionReport }` |
| PUT | `/api/inspections/:id` | Draft report body with expected revision; return `{ item: InspectionReport }` |
| POST | `/api/inspections/:id/finalize` | `{ revision }`; validate completeness, atomically persist status `FINAL`, freeze snapshot and PDF, and return `{ item: InspectionReport }` with `item.status === "FINAL"`. A 2xx response with a draft item is not a successful finalization. |
| POST | `/api/inspections/:id/revisions` | `{ revision }`; create a draft revision while preserving previous finalized versions; return `{ item: InspectionReport }` |
| POST | `/api/inspections/uploads` | Multipart `photo`, `branchId`; return `{ id, url }` |
| GET | `/api/inspection-templates` | `{ items: InspectionTemplate[] }` for current organization |
| POST | `/api/inspection-templates` | `{ name, sections, terms }`; return `{ item: InspectionTemplate }` |
| POST | `/api/inspections/:id/send` | `{ channel: "WHATSAPP" | "EMAIL", recipient, revision, requestId }`; return `{ item: InspectionSendLog }` |

Register `send-history` and `uploads` before the `:id` route. Search list records by report/customer/phone/registration and history by report/customer/recipient/registration. Dates are inclusive ISO calendar dates. List ordering should be newest inspection first; history ordering newest send first. Every branch change must affect the query on the server.

## Reports and ratings

Defaults: Engine, Battery, Suspension, Tyres, Electrical, Transmission, Exterior, Brakes, Steering. Every checkpoint begins NOT_CHECKED. Sections are copied into the report, never read live from the template afterward. Empty sections and unchecked items block finalization. N/A is excluded from severity; all-N/A is N/A, not Good. Complete sections use worst severity BAD > AVERAGE > GOOD. Overall overrides require a reason but never bypass completeness. Apply the same rules server-side as `src/lib/inspection.ts`.

A final report is read-only. Revisions and send logs must preserve the exact document/attachment that was sent, including organization branding, photo files, terms, and vehicle/customer snapshots at finalization. Edits to CRM records or templates must not mutate old reports. Draft revisions must not overwrite a finalized revision before finalization succeeds.

Deleting a report must require explicit confirmation in the UI and be a server-side soft delete. Exclude deleted reports from active inspection search and their send logs from normal send-history results, while retaining report versions, send history, canonical PDFs, and linked photos for authorized audit/legal retrieval. Require a reason/audit actor on deletion where policy requires. Do not cascade-delete assets that are referenced by finalized or sent versions. Treat a repeated delete as idempotent or return a documented 404; do not delete another branch's report.

## Photos

Accept JPEG/PNG/WebP, up to 10 MB each, maximum 24 per report. Verify actual file contents; generate server asset IDs, store with tenant/branch ownership, and sanitize metadata. Pending uploads may occur before a report ID exists: link them on save, reject cross-tenant associations, and expire unlinked uploads. Check checkpoint associations against the report snapshot. Detached photos must follow retention policy; final/sent report assets must remain available as long as that version is retained. Serve uploads with correct MIME type and CORS headers for authorized frontend PDF generation.

## Sending

Generate/store a canonical finalized PDF server-side. The browser's download is a convenience, not the trusted outbound attachment. WhatsApp needs provider document-media support and approved templates when required outside the conversation window. Email needs a PDF attachment. Include report ID/revision and recipient in the durable audit record. Validate and normalize phone/email recipients server-side.

Use the client `requestId` as a tenant-scoped idempotency key to prevent repeated document sends from rapid or retried requests. Network retries retain the same key; explicitly retrying a known provider failure starts a new intent. Reject a reused key with a different payload. Persist QUEUED/SENT/DELIVERED/FAILED with provider message IDs, sender, timestamp, channel and errors; update delivery using authenticated provider webhooks. Do not mark a browser composer or mere API acceptance as delivered. Handle provider failures without losing history.

Send-history Resend uses the same send endpoint with the logged report revision, channel, recipient, and a fresh `requestId`. The server must resend the exact immutable revision/PDF represented by that history entry. History downloads use the item's authorized `pdfUrl`, not a PDF regenerated from the current report revision.

## Verification gates

- Two organizations cannot read, update, upload to, or send each other's reports.
- Branch-restricted users cannot query another branch by changing URL parameters.
- Unchecked/empty checklists cannot finalize; overrides need reasons.
- Duplicate report numbers and stale revision writes are rejected.
- Delete permission and branch scoping are enforced; soft-deleted reports and their send logs are absent from normal lists but retained for authorized audit retrieval.
- Templates and older sent versions remain unchanged after edits/new revisions.
- Missing/oversize/invalid photos fail visibly; orphan uploads are cleaned up.
- Failed/duplicate sends never appear as delivered; retries retain auditable outcomes.
- Authorized PDF/photo retrieval and unauthorized retrieval are tested separately.