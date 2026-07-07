-- ======================================================================
-- Proposals & Contract/SOW rebuild fixtures (HANDOFF-DELTA-2026-07-07).
-- Replaces the old A/B hand fixture; gives the demo the full phased model:
--   deal_harbor_0003 — approved phased proposal (Talden-shaped $225k) + draft contract
--   deal_harbor_0001 — sent 2-path proposal ($180k) so the badge is live + sign flow demoable
-- ======================================================================
DELETE FROM proposal_options WHERE proposal_id = 'prop_harbor_0001';
DELETE FROM proposals WHERE id = 'prop_harbor_0001';

UPDATE deals SET discovery_note = 'Harbor Point runs slip bookings and fuel dock sales on paper and a shared spreadsheet. Bob wants one system dockside staff can use on tablets, with fuel sales reconciling automatically at close.' WHERE id = 'deal_harbor_0001';
UPDATE deals SET discovery_note = 'Dockside staff currently ring up fuel and ship-store sales on a consumer card reader with no inventory sync. Bob wants a proper POS pilot at one dock before rolling out fleet-wide.' WHERE id = 'deal_harbor_0002';

INSERT OR IGNORE INTO deals (id, organization_id, name, stage, stage_entered_at, owner_user_id, primary_contact_id, origin, value_cents, readiness_score, discovery_note, created_at, updated_at) VALUES
 ('deal_harbor_0003', 'org_harbor_0001', 'Harbor Point — platform build', 'committed', 1783641600, 'usr_staff_kai_0001', 'ct_harbor_bob_0001', 'qualified_from_triage', 22500000, 9.0,
  'The marina platform grew into a full build: slip operations, fuel reconciliation, and a legal-grade audit trail for the harbor authority. Bob has sign-off and wants a phased commitment.',
  1783036800, 1783641600);

-- Approved phased proposal (master signature on file; Phase 1 active)
INSERT OR IGNORE INTO proposals (id, organization_id, deal_id, version, status, title, executive_summary_md, complexity_score, complexity_rationale, share_token, sent_at, responded_at, responded_by_name, selected_option_id, approvers, contract, created_by_user_id, created_at, updated_at) VALUES
 ('prop_harbor_1001', 'org_harbor_0001', 'deal_harbor_0003', 1, 'approved',
  'Harbor Point — platform build — proposal',
  'Harbor Point''s operation has outgrown paper and spreadsheets — slip bookings, fuel reconciliation, and the harbor authority''s audit requirements all need one system dockside staff actually use. This engagement builds that platform in confirmed phases, so each stage of the buildout is committed only when you reach it.',
  2, '',
  'demoharbor1001demoharbor1001demoharbor1001demoharbor1001demo1001',
  1783123200, 1783296000, 'Bob Ross', 'po_harbor_1002',
  '[{"name":"Bob Ross","role":"Owner"}]',
  '{"status":"draft","proposalNumber":"WG-2026-629","scopeOfEngagement":"Wahala Group will provide the software engineering, architecture, implementation, testing, and deployment services required to deliver the scope described in this proposal. This engagement excludes ongoing operational support, feature work outside the agreed scope, and any activity not explicitly listed below unless authorized through a written change order.","phases":[{"name":"Private beta","amountCents":6500000,"weeks":8,"objective":"Deliver Private beta as scoped in this engagement.","scopeText":"Design and implement Private beta.\nTesting and quality assurance for Private beta.\nDocumentation for Private beta.","deliverablesText":"Private beta, delivered and accepted.","acceptanceText":"Private beta meets agreed scope and passes review."},{"name":"Legal workflows","amountCents":9500000,"weeks":12,"objective":"Deliver Legal workflows as scoped in this engagement.","scopeText":"Design and implement Legal workflows.\nTesting and quality assurance for Legal workflows.\nDocumentation for Legal workflows.","deliverablesText":"Legal workflows, delivered and accepted.","acceptanceText":"Legal workflows meets agreed scope and passes review."},{"name":"Commercial readiness","amountCents":6500000,"weeks":8,"objective":"Deliver Commercial readiness as scoped in this engagement.","scopeText":"Design and implement Commercial readiness.\nTesting and quality assurance for Commercial readiness.\nDocumentation for Commercial readiness.","deliverablesText":"Commercial readiness, delivered and accepted.","acceptanceText":"Commercial readiness meets agreed scope and passes review."}],"depositPct":10,"outOfScopeEnabled":false,"outOfScopeText":"Features not described in this Statement of Work.\nWork outside the phases and deliverables listed above.\nOngoing operations and maintenance after project completion.\nThird-party integrations outside agreed scope.","changeManagementEnabled":false,"changeManagementText":"Any requested work outside the scope defined in this Statement of Work requires a written Change Order describing the requested change, schedule impact, and any adjustment to cost. No additional work begins until the Change Order is approved by both parties.","acceptanceReviewDays":5,"clientSignerName":"Bob Ross","clientSignerTitle":"Owner","ourSignerName":"Jason Milton","ourSignerTitle":"Managing Member","sourceOptionId":"po_harbor_1002","sourceSignature":"[{\"n\":\"Private beta\",\"a\":6500000,\"w\":8},{\"n\":\"Legal workflows\",\"a\":9500000,\"w\":12},{\"n\":\"Commercial readiness\",\"a\":6500000,\"w\":8}]","amendments":[],"generatedAt":"2026-07-06T18:00:00.000Z"}',
  'usr_staff_kai_0001', 1783036800, 1783296000);

INSERT OR IGNORE INTO proposal_options (id, proposal_id, label, name, summary_md, timeline_note, price_cents, sort_order, phases, recommended, created_at) VALUES
 ('po_harbor_1001', 'prop_harbor_1001', 'A', 'Standard rollout', 'One delivery: the full platform lands at once, with a single acceptance at the end.', '~14 weeks · one delivery', 15000000, 0, NULL, 0, 1783036800),
 ('po_harbor_1002', 'prop_harbor_1001', 'B', 'Phased buildout', 'Three confirmed phases — each stage committed as the engagement reaches it, no re-signing.', 'phased · each phase confirmed as we reach it', 22500000, 1,
  '[{"name":"Private beta","amountCents":6500000,"weeks":8,"status":"active"},{"name":"Legal workflows","amountCents":9500000,"weeks":12,"status":"awaiting_amendment"},{"name":"Commercial readiness","amountCents":6500000,"weeks":8,"status":"awaiting_amendment"}]', 1, 1783036800);

-- Sent 2-path proposal on the marina deal ($180k) — live badge + public sign demo
INSERT OR IGNORE INTO proposals (id, organization_id, deal_id, version, status, title, executive_summary_md, complexity_score, complexity_rationale, share_token, sent_at, approvers, created_by_user_id, created_at, updated_at) VALUES
 ('prop_harbor_1101', 'org_harbor_0001', 'deal_harbor_0001', 1, 'sent',
  'Harbor Point — marina ops platform — proposal',
  'Harbor Point runs slip bookings and fuel dock sales on paper and a shared spreadsheet. Bob wants one system dockside staff can use on tablets, with fuel sales reconciling automatically at close. Two paths below — a straight delivery and a phased one, so you can pick the risk level that fits.',
  3, '',
  'demoharbor1101demoharbor1101demoharbor1101demoharbor1101demo1101',
  1783555200,
  '[{"name":"Bob Ross","role":"Owner"}]',
  'usr_staff_kai_0001', 1783468800, 1783555200);

INSERT OR IGNORE INTO proposal_options (id, proposal_id, label, name, summary_md, timeline_note, price_cents, sort_order, phases, recommended, created_at) VALUES
 ('po_harbor_1101', 'prop_harbor_1101', 'A', 'Standard rollout', 'The whole marina platform in one delivery.', '~12 weeks · one delivery', 18000000, 0, NULL, 0, 1783468800),
 ('po_harbor_1102', 'prop_harbor_1101', 'B', 'Phased buildout', 'Dockside tablets first, fuel reconciliation second — each phase confirmed as we reach it.', 'phased · each phase confirmed as we reach it', 18000000, 1,
  '[{"name":"Dockside operations","amountCents":9000000,"weeks":6,"status":"awaiting_amendment"},{"name":"Fuel reconciliation & close","amountCents":9000000,"weeks":6,"status":"awaiting_amendment"}]', 1, 1783468800);
