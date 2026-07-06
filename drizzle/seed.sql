-- Phase 0 seed — minimum to exercise login + the scoped-query layer.
--   • one client org (Acme Corp), with its Account Owner assigned + accepted
--   • one Wahala staff admin (no org)  → logs in, sees all orgs + internal rows
--   • one test client user (Acme)      → logs in, sees only Acme + client-visible rows
--   • one project + two tasks (one client-visible, one internal) to prove visibility
--
-- Idempotent via fixed ids + INSERT OR IGNORE. Apply with:
--   npm run db:seed:local   (then db:seed:remote for production)

-- Order matters: users.organization_id has a FK to organizations, so the org row
-- must exist first. organizations.account_owner_user_id has NO FK, so pointing it
-- at the staff user before that user exists is fine.
INSERT OR IGNORE INTO organizations
  (id, name, slug, status, account_owner_user_id, owner_assigned_at, owner_accepted_at, created_at, updated_at)
VALUES
  ('org_acme_0001', 'Acme Corp', 'acme', 'active', 'usr_staff_admin_0001', unixepoch(), unixepoch(), unixepoch(), unixepoch());

INSERT OR IGNORE INTO users
  (id, organization_id, user_type, role, name, email, status, created_at)
VALUES
  ('usr_staff_admin_0001', NULL, 'wahala', 'wahala_admin', 'Adam (Wahala)', 'beachme785@gmail.com', 'active', unixepoch()),
  ('usr_client_admin_0001', 'org_acme_0001', 'client', 'client_admin', 'Acme Admin', 'client@acme.test', 'invited', unixepoch());

INSERT OR IGNORE INTO projects
  (id, organization_id, name, description, work_type, status, lead_engineer_user_id, created_at, updated_at)
VALUES
  ('prj_acme_0001', 'org_acme_0001', 'Acme Website Revamp', 'Initial engagement', 'software', 'active', 'usr_staff_admin_0001', unixepoch(), unixepoch());

INSERT OR IGNORE INTO tasks
  (id, organization_id, project_id, title, status, visibility, ai_assisted, created_by_user_id, created_at, updated_at)
VALUES
  ('tsk_acme_visible_0001', 'org_acme_0001', 'prj_acme_0001', 'Design homepage', 'in_progress', 'client_visible', 0, 'usr_staff_admin_0001', unixepoch(), unixepoch()),
  ('tsk_acme_internal_0001', 'org_acme_0001', 'prj_acme_0001', 'Internal: margin & staffing review', 'todo', 'internal', 0, 'usr_staff_admin_0001', unixepoch(), unixepoch());

-- ── Isolation fixtures ────────────────────────────────────────────────────────
-- A SECOND org (Beta) + its client, and a Wahala ENGINEER assigned to Acme ONLY.
-- These exercise: cross-tenant denial (client B vs Acme) and project-scoped staff
-- (the engineer sees Acme, never Beta).

INSERT OR IGNORE INTO organizations
  (id, name, slug, status, account_owner_user_id, owner_assigned_at, owner_accepted_at, created_at, updated_at)
VALUES
  ('org_beta_0001', 'Beta Corp', 'beta', 'active', 'usr_staff_admin_0001', unixepoch(), unixepoch(), unixepoch(), unixepoch());

INSERT OR IGNORE INTO users
  (id, organization_id, user_type, role, name, email, status, created_at)
VALUES
  ('usr_engineer_0001', NULL, 'wahala', 'engineer', 'Eng (Wahala)', 'eng@wahala.test', 'active', unixepoch()),
  ('usr_client_beta_0001', 'org_beta_0001', 'client', 'client_admin', 'Beta Admin', 'clientb@beta.test', 'invited', unixepoch());

INSERT OR IGNORE INTO projects
  (id, organization_id, name, description, work_type, status, lead_engineer_user_id, created_at, updated_at)
VALUES
  ('prj_beta_0001', 'org_beta_0001', 'Beta Mobile App', 'Initial engagement', 'software', 'active', 'usr_staff_admin_0001', unixepoch(), unixepoch());

-- Engineer is on the Acme roster only (NOT Beta) → must see Acme, never Beta.
INSERT OR IGNORE INTO project_members
  (id, organization_id, project_id, user_id, project_role, created_at)
VALUES
  ('pm_acme_eng_0001', 'org_acme_0001', 'prj_acme_0001', 'usr_engineer_0001', 'engineer', unixepoch());

-- ======================================================================
-- TRAINING-AND-SCORECARD.md seed (frames 38–41): Kai in training mode,
-- Harbor Point Marina fixtures (good calls → readiness 8.7; bad follow-up
-- → the 3.1 nudge fixture), Vega lost deal + post-mortem, process events.
-- ======================================================================

INSERT OR IGNORE INTO users (id, organization_id, user_type, role, name, email, status, training_mode, created_at) VALUES
  ('usr_staff_jason_0001', NULL, 'wahala', 'wahala_admin', 'Jason Milton', 'jason@wahala.group', 'active', 0, unixepoch()),
  ('usr_staff_kai_0001', NULL, 'wahala', 'wahala_admin', 'Kai Udo', 'kai@wahala.group', 'active', 1, 1780326000);

INSERT OR IGNORE INTO organizations (id, name, slug, status, account_owner_user_id, owner_assigned_at, owner_accepted_at, created_at, updated_at) VALUES
  ('org_harbor_0001', 'Harbor Point Marina', 'harbor-point', 'prospect', 'usr_staff_kai_0001', 1782918000, 1782918000, 1782918000, 1782918000),
  ('org_vega_0001', 'Vega Studio', 'vega', 'prospect', 'usr_staff_jason_0001', 1780066800, 1780066800, 1780066800, 1780066800);

INSERT OR IGNORE INTO contacts (id, organization_id, name, email, phone, state, source, est_value_cents, created_by_user_id, created_at, updated_at) VALUES
  ('ct_harbor_bob_0001', 'org_harbor_0001', 'Bob Ross', 'bob@harborpointmarina.com', NULL, 'qualified', 'Referral', 18000000, 'usr_staff_kai_0001', 1782918000, 1782918000),
  ('ct_vega_mia_0001', 'org_vega_0001', 'Mia Vega', 'mia@vegastudio.co', NULL, 'qualified', 'Website form', 4800000, 'usr_staff_jason_0001', 1780066800, 1780066800);

INSERT OR IGNORE INTO contact_companies (id, contact_id, organization_id, is_primary, current, created_at) VALUES
  ('cc_harbor_0001', 'ct_harbor_bob_0001', 'org_harbor_0001', 1, 1, 1782918000),
  ('cc_vega_0001', 'ct_vega_mia_0001', 'org_vega_0001', 1, 1, 1780066800);

INSERT OR IGNORE INTO deals (id, organization_id, name, stage, stage_entered_at, owner_user_id, primary_contact_id, origin, value_cents, readiness_score, post_mortem_md, created_at, updated_at) VALUES
  ('deal_harbor_0001', 'org_harbor_0001', 'Harbor Point — marina ops platform', 'discovery', 1782918000, 'usr_staff_kai_0001', 'ct_harbor_bob_0001', 'qualified_from_triage', 18000000, 8.7, NULL, 1782918000, 1782918000),
  ('deal_harbor_0002', 'org_harbor_0001', 'Harbor Point — dockside POS pilot', 'discovery', 1783004400, 'usr_staff_kai_0001', 'ct_harbor_bob_0001', 'captured', 3500000, 3.1, NULL, 1783004400, 1783004400),
  ('deal_vega_0001', 'org_vega_0001', 'Vega — mobile rebuild', 'lost', 1783004400, 'usr_staff_jason_0001', 'ct_vega_mia_0001', 'captured', 4800000, 5.8, '## Post-mortem — auto-generated

**Lost after 34 days** · reason: went with cheaper vendor

### Actual vs. expected
- **captured** — 29 May
- **Discovery → Proposal out** — 8 Jun · readiness 5.8/10
  ⚠ advanced below proposal-ready (5.8/7 expected)
- **Proposal out → Lost** — 2 Jul
  ⚠ expected follow-up within 5 days of sending — the proposal went silent 18 days

### What could have gone better
1. **Decision maker never identified.** The proposal went to whoever answered → nobody inside Vega had to say yes → a working session with the named decision maker before drafting would have surfaced the real buyer or disqualified the deal early.
2. **Advanced at 5.8/10 readiness** (expected ≥ 7). The proposal was written on a thin package → it argued price instead of the customer''s own pain → holding one more discovery call would have either armed the proposal or saved the effort.
3. **3 nudges overridden** (3 fired · 0 acted on). The process flagged the risk in real time → the override removed the safety margin → treating an override as a debt to repay keeps speed without losing the signal.

_Logged to the deal + account timeline · scorecard math comes only from process events._', 1780066800, 1783004400);

INSERT OR IGNORE INTO discovery_packages (id, deal_id, fields, updated_at, created_at) VALUES
  ('dp_harbor_0001', 'deal_harbor_0001', '{"business_profile": {"status": "ok", "evidence": "420 wet slips \u00b7 260 dry storage \u00b7 65 staff in season", "source": "Discovery call 1"}, "current_workflow": {"status": "ok", "evidence": "paper work orders + whiteboard for haul-outs; billing in QuickBooks once a month", "source": "Discovery call 1"}, "pain_points": {"status": "ok", "evidence": "lost work orders, double-booked lifts, month-end billing surprises", "source": "Discovery call 1"}, "budget_posture": {"status": "ok", "evidence": "budget range named and confirmed by owner: $140\u2013220k over two seasons", "source": "Follow-up call"}, "decision_makers": {"status": "ok", "evidence": "Bob Ross (owner) decides; GM Karen consulted on operations", "source": "Discovery call 1"}, "success_metrics": {"status": "ok", "evidence": "zero lost work orders; billing out within 48h of month end", "source": "Follow-up call"}, "mvp_priorities": {"status": "ok", "evidence": "work orders + lift scheduling first; owner portal second season", "source": "Follow-up call"}, "timeline": {"status": "ok", "evidence": "pilot before spring haul-out season (March)", "source": "Follow-up call"}, "customer_terminology": {"status": "ok", "evidence": "wet slips / dry stack, haul-out, splash, winterization", "source": "Discovery call 1"}, "deferred_scope": {"status": "partial", "evidence": "fuel-dock POS mentioned, ''maybe later'' \u2014 not scoped", "source": "Follow-up call"}}', 1783090800, 1783090800),
  ('dp_harbor_0002', 'deal_harbor_0002', '{"business_profile": {"status": "ok", "evidence": "same marina \u2014 fuel dock + ship store side", "source": "Follow-up (bad)"}, "current_workflow": {"status": "partial", "evidence": "\u201cthe register works fine mostly\u201d", "source": "Follow-up (bad)"}, "pain_points": {"status": "partial", "evidence": "\u201cit could just be\u2026 better\u201d", "source": "Follow-up (bad)"}, "budget_posture": {"status": "missing", "evidence": "\u201cwe''d see what it costs first\u201d", "source": "Follow-up (bad)"}, "decision_makers": {"status": "missing", "evidence": "\u201cdepends who answers the phone\u201d", "source": "Follow-up (bad)"}, "success_metrics": {"status": "missing", "evidence": "\u201cfewer headaches, I guess\u201d", "source": "Follow-up (bad)"}, "mvp_priorities": {"status": "missing", "evidence": "no first-thing named \u2014 \u201call of it, ideally\u201d", "source": "Follow-up (bad)"}, "timeline": {"status": "partial", "evidence": "\u201cno rush\u2026 whenever\u201d", "source": "Follow-up (bad)"}, "customer_terminology": {"status": "ok", "evidence": "fuel dock, ship store, transient traffic", "source": "Follow-up (bad)"}, "deferred_scope": {"status": "missing", "evidence": null, "source": null}}', 1783090800, 1783090800);

INSERT OR IGNORE INTO deal_calls (id, deal_id, title, recorded_at, duration_min, transcript_md, fields_extracted, created_by_user_id, created_at) VALUES
  ('call_harbor_0001', 'deal_harbor_0001', 'Discovery call 1 — Bob Ross', 1783087200, 72, 'Sales Discovery Call Transcript
Project: Marina Operations & Boat Owner Service Platform
Date: July 3, 2026
Duration: 1 hour 12 minutes
Participants
	•	Jason Milton – Founder & Solutions Architect, Wahala Group
	•	Bob Ross – Owner, Harbor Point Marina

Jason Milton:  Morning, Bob. Appreciate you taking the time to meet today.
Before we get into ideas or technology, I’d really just like to understand your business. My goal isn’t to sell you software today. I want to understand what problems you’re trying to solve and whether we’re actually the right fit.
Bob Ross:  I appreciate that. We’ve talked to a couple software companies already, and honestly most of them jump straight into demos before they understand what we actually do.
Jason Milton:  That happens a lot.
So tell me about Harbor Point.

Bob Ross:  We’re a full-service marina here in Florida.
We’ve got about 420 wet slips.
Another 260 boats in dry storage.
We have a fuel dock.
Ship’s store.
A service department.
Travel lift.
Forklifts.
Bottom cleaning.
Detailing.
Mechanical service.
Fiberglass work.
Pretty much anything a boat owner needs.
We’ve been around for almost thirty years.
The marina has grown a lot, but honestly our software hasn’t.

Jason Milton:  How are customers requesting work today?

Bob Ross:  That’s probably our biggest headache.
Some people call.
Some text.
Some send emails.
Some walk into the office.
Some tell the dockhands.
Some Facebook message us.
You’d be amazed.
By the end of the day nobody knows who’s supposed to do what.

Jason Milton:  So requests are coming from everywhere.

Bob Ross:  Exactly.
And then somebody writes it on a sticky note.
Or enters it into QuickBooks.
Or forgets.

Jason Milton:  What happens if something gets forgotten?

Bob Ross:  Customer shows up Friday morning expecting their boat to be floating at the dock…
…and it’s still sitting in dry storage.
That conversation never goes well.

Jason Milton:  I can imagine.
Walk me through a typical customer.

Bob Ross:  Let’s say you own a 38-foot center console.
You call us Wednesday.
You want to fish Saturday.
You need fuel.
Ice.
Boat washed.
Battery charged.
Engines flushed.
Maybe you want the boat dropped in the water Friday afternoon.
Maybe your wife wants flowers on board because it’s your anniversary.
I’m serious…
People ask for everything.

Jason Milton:  How does your team keep track of all of those requests today?

Bob Ross:  Honestly?
Memory.
Whiteboards.
Phone calls.
Radio traffic.
It isn’t scalable anymore.

Jason Milton:  How many employees?

Bob Ross:  About sixty-five depending on the season.

Jason Milton:  How many people touch one customer request?

Bob Ross:  Quite a few.
Office.
Dockmaster.
Forklift operator.
Fuel dock.
Service department.
Cleaning crew.
Sometimes management.
Sometimes accounting.

Jason Milton:  So one simple request actually becomes a workflow involving multiple departments.

Bob Ross:  Exactly.
That’s why it’s so hard.

Jason Milton:  Tell me about the service department.

Bob Ross:  That’s another mess.
Customers don’t remember maintenance intervals.
They’ll run their engines four hundred hours and then wonder why something failed.
We try to keep spreadsheets.
Sometimes the mechanics remember.
Sometimes they don’t.
I’d love for the system to know…
This boat just hit one hundred hours.
Recommend service.
Notify the customer.
Let them schedule it.

Jason Milton:  That makes sense.
Would you want reminders based on calendar dates too?

Bob Ross:  Absolutely.
Annual service.
Bottom paint.
Generator maintenance.
Outboard maintenance.
Warranty inspections.
Everything.

Jason Milton:  If you could wave a magic wand…
What would the perfect customer experience look like?

Bob Ross:  Honestly?
I’d like the customer to never have to call us.
Open an app.
Select their boat.
Tap…
Need fuel.
Need ice.
Launch my boat.
Schedule service.
Wash it.
Fill live wells.
Pump out.
Whatever.
Then they get notifications as everything happens.
Boat launched.
Fuel complete.
Cleaning complete.
Ready for pickup.

Jason Milton:  Almost like ordering an Uber.

Bob Ross:  Exactly!
That’s actually what I tell people.
Uber for your boat.

Jason Milton:  I like that.
What about your employees?

Bob Ross:  Each department should have their own queue.
Dock guys shouldn’t see accounting stuff.
Mechanics shouldn’t care about fuel.
Fuel dock shouldn’t see fiberglass repair.
Everybody just sees what they’re responsible for.

Jason Milton:  Makes sense.
How important is visibility?

Bob Ross:  Huge.
Right now if somebody asks…
Where’s my boat?
Nobody knows.
Someone has to get on the radio.
Five minutes later maybe someone answers.
It’s embarrassing.

Jason Milton:  Would live status solve that?

Bob Ross:  Absolutely.
Boat Waiting
Boat Being Fueled
Boat Being Washed
Boat Ready
Boat In Water
Boat In Service
Boat Picked Up
Something simple.

Jason Milton:  What about photos?

Bob Ross:  That’s actually a great idea.
Take a picture after detailing.
Take a picture after service.
Customer sees it.
Less arguing.

Jason Milton:  Do customers currently approve estimates electronically?

Bob Ross:  No.
Everything’s emails.
PDFs.
Phone calls.
It’s ancient.

Jason Milton:  Would you like customers to approve work directly inside the app?

Bob Ross:  Absolutely.
Mechanic finds another issue…
Customer gets notified.
Reviews estimate.
Approves.
We continue working.
No waiting.

Jason Milton:  How much business do you think you’re losing today because of the current process?

Bob Ross:  That’s hard to answer.
But I know we’re leaving money on the table.
People don’t order services because they don’t know what’s available.
Our employees don’t always remember to upsell.
Customers forget maintenance.
It’s probably hundreds of thousands a year.

Jason Milton:  Interesting.
If the app could recommend services based on the boat…
Would that be valuable?

Bob Ross:  Very.
Let’s say somebody schedules a launch.
The app could ask…
Need fuel?
Need ice?
Need drinks?
Need bait?
Need detailing?
Need the fridge stocked?
Need engine service?
Customers would spend more money.

Jason Milton:  That’s exactly where my head was going.
Instead of waiting for customers to think about services…
the platform becomes your salesperson.

Bob Ross:  Exactly.

Jason Milton:  How are boats identified today?

Bob Ross:  Slip number.
Rack location.
Registration.
Owner name.
Sometimes all four.

Jason Milton:  Would you want customers with multiple boats?

Bob Ross:  Definitely.
Some of our members have four or five.

Jason Milton:  How many active members?

Bob Ross:  Around seven hundred.

Jason Milton:  Do you expect that to grow?

Bob Ross:  Absolutely.
We’ve got another expansion planned.

Jason Milton:  Let’s switch gears for a minute.
When companies invest in software like this, I always like to understand the business side.
Have you allocated a budget for solving this problem?

Bob Bob Ross:  We have.
Nothing officially approved yet, but we’ve been discussing it with ownership for almost a year.

Jason Milton:  What kind of investment were you expecting?

Bob Ross:  Honestly…
I have no clue what software like this costs.
I know it isn’t twenty thousand dollars.
I also know it probably isn’t two million.

Jason Milton:  Fair answer.
Custom software can vary quite a bit depending on complexity. I ask because I don’t want to design a Ferrari if the expectation is a pickup truck. If we find the right solution, are ownership and the business in a position to invest this year?

Bob Ross:  Yes.
If we can clearly show that it improves operations and creates new revenue, ownership is prepared to move forward. We’ve set aside capital for technology improvements, and this is one of the projects we’re evaluating.

Jason Milton:  That’s helpful.
Besides efficiency, what would success look like a year after launch?

Bob Ross:  Customers stop calling to ask where their boat is.
Our employees know exactly what they’re supposed to be doing.
Service revenue increases.
Launch requests become organized.
Maintenance gets scheduled automatically.
Customer satisfaction goes up.
Honestly…
I’d like people talking about our marina because the experience is unlike anywhere else.

Jason Milton:  I love that answer.
Because what I’m hearing isn’t that you need an app.
You want to create a better experience.

Bob Ross:  Exactly.
The app is just how we get there.

Jason Milton:  Can I share how I’d approach this?

Bob Ross:  Please.

Jason Milton:  One thing we try very hard not to do is simply build what someone asks for. Instead, we focus on the business outcome. I think there’s an opportunity to create a connected platform where the customer app, your staff operations, and your service department all work together.
The boat owner opens the app, requests a launch, adds fuel, ice, detailing, or maintenance, and the platform automatically routes each task to the right team. Your staff sees live work queues, managers see overall operations, and customers receive updates every step of the way.
Then we layer AI on top. The system learns each customer’s habits, recommends services before they ask, reminds them about upcoming maintenance, predicts seasonal needs, and helps your team identify revenue opportunities automatically.
Over time, the platform becomes more than an operations tool—it becomes part of what differentiates Harbor Point from every other marina in the region.

Bob Ross:  That’s exactly what I’ve been trying to explain to people.
Nobody has painted the picture like that.

Jason Milton:  And the good news is we don’t have to build everything at once. We’d start with the highest-value workflows, get them into production, measure the results, and then expand from there. That reduces risk and gets value into your hands much sooner.

Bob Ross:  I really like that approach.

Jason Milton:  Our next step would be to prepare two proposals. One would outline a fully custom platform that your organization owns outright. The second would leverage components from our existing platform to reduce cost and accelerate delivery while still allowing room for customization.
We’ll walk through the pros and cons of each, and together decide which path makes the most sense for your business.

Bob Ross:  That sounds great.
I’m actually excited about this now.

Jason Milton:  That’s what we like to hear. We’ll put together a preliminary proposal, review it with you, answer any questions, and if it aligns with your vision, we’ll move into a detailed Scope of Work and project planning phase.

Bob Ross:  Perfect. Looking forward to it.
Meeting Ends
Duration: 1 hour 12 minutes', 9, 'usr_staff_kai_0001', 1783094400),
  ('call_harbor_0002', 'deal_harbor_0001', 'Follow-up discovery — budget + roadmap', 1784296800, 58, 'Follow-Up Discovery Call Transcript
Project: Harbor Point Marina Operations Platform
Meeting: Proposal Review & Solution Refinement
Date: July 17, 2026
Duration: 58 minutes
Participants
	•	Jason Milton – Founder & Solutions Architect, Wahala Group
	•	Bob Ross – Owner, Harbor Point Marina

Jason Milton:  Hey Bob, good to see you again. How have things been since we last talked?
Bob Ross:  Busy as ever. Actually, after our last meeting I’ve been paying a lot more attention to how requests come in, and it’s honestly worse than I realized.
Jason Milton:  That’s usually what happens. Once you start watching the workflow, all the little inefficiencies become obvious.
Have you had a chance to discuss this internally with ownership?

Bob Ross:  I did.
I met with my partners last week. They actually liked the idea a lot more than I expected.
The biggest takeaway was that they don’t just want software. They want something that helps us stand apart from the marina down the road.

Jason Milton:  That’s good to hear.
Did they have any concerns?

Bob Ross:  Mainly cost and how disruptive it’ll be.
We’ve bought software before that promised the world and ended up making everyone’s life harder.

Jason Milton:  That’s completely fair.
One of the reasons we start with discovery is so we’re solving your business problems rather than trying to force your business into someone else’s software.
Instead of asking your employees to change how they work, we’d rather build software that supports the way your marina already operates.

Bob Ross:  That’s exactly what I told them.

Jason Milton:  Perfect.
Since our last meeting, what additional ideas have come up?

Bob Ross:  Actually…quite a few.
The dockmaster wants weather notifications.
Our mechanics want maintenance history.
Accounting wants customers to keep a credit card on file.
The dockhands want barcode scanning.
Our fuel dock wants automatic fuel logging.
Everybody suddenly has ideas.

Jason Milton:  That’s actually a good sign.
It usually means people are starting to picture themselves using the system.

Bob Ross:  Exactly.

Jason Milton:  Let’s talk priorities.
If we only built Version One…
What absolutely has to be there?

Bob Ross:  Customer app.
Launch requests.
Fuel requests.
Ice.
Wash requests.
Basic service scheduling.
Push notifications.
Staff work queues.
Boat status.
Those are the big ones.

Jason Milton:  No payments yet?

Bob Ross:  Not initially.
Nice to have…
Not required.

Jason Milton:  How about maintenance reminders?

Bob Ross:  Definitely.
Those are important.
Even if it’s just based on engine hours for now.

Jason Milton:  Got it.
One thing I wanted to ask…
How do you currently know how many engine hours a boat has?

Bob Ross:  Mostly the customer tells us.
Sometimes our mechanics write it down.
Sometimes we plug into the engine computer.
There’s really no standard process.

Jason Milton:  Would customers be willing to enter hours themselves?

Bob Ross:  Most of them would.
Especially if it meant getting reminders before something expensive breaks.

Jason Milton:  Makes sense.

Bob Ross:  Actually…
One thing my service manager mentioned…
Wouldn’t it be nice if every boat had a digital history?

Jason Milton:  Tell me more.

Bob Ross:  Imagine buying a used boat.
The owner could show you every oil change.
Every service.
Every repair.
Every warranty claim.
Everything.
Almost like Carfax.

Jason Milton:  That’s actually a really interesting idea.
Instead of simply tracking work…
The platform becomes the permanent service record for the boat.

Bob Ross:  Exactly.

Jason Milton:  That opens up some interesting possibilities later.

Bob Ross:  That’s what we thought.

Jason Milton:  How important is scheduling?

Bob Ross:  Huge.
Right now we overbook without realizing it.
We’ll promise five boats Friday morning…
Then realize we only have two forklift operators.

Jason Milton:  So resource scheduling matters just as much as customer scheduling.

Bob Ross:  Exactly.

Jason Milton:  Could the system prevent overbooking?

Bob Ross:  That would save us constantly apologizing.

Jason Milton:  What about assigning work?
Should managers assign tasks manually…
Or should the software do it?

Bob Ross:  Initially I’d like managers to assign it.
Later…
Maybe AI suggests who’s available.

Jason Milton:  I like that.
Walk before we run.

Bob Ross:  Exactly.

Jason Milton:  I also wanted to revisit something you mentioned last time…
You said you’d like customers spending more money without feeling like they’re being sold.

Bob Ross:  Yeah.

Jason Milton:  One thing we could do…
If someone requests a launch…
The app already knows their boat.
It knows it’s Saturday.
It knows they’re going fishing.
It could recommend…
Fuel.
Ice.
Bait.
Food.
Detailing.
Pump out.
Everything relevant.
Not because we’re trying to sell…
Because we’re trying to help.

Bob Ross:  That’s brilliant.
That’s exactly what Amazon does.

Jason Milton:  Right.
You’re already making the trip.
The app simply asks…
“Would you like us to take care of these things before you arrive?”

Bob Ross:  Customers would absolutely use that.

Jason Milton:  Then over time…
The system learns habits.
Maybe every Friday Bob buys 120 gallons.
Three bags of ice.
Launch at 6 AM.
The app simply asks…
“Would you like to repeat last week’s trip?”

Bob Ross:  Now you’re getting me excited again.

Jason Milton:  That’s the fun part.
Technology shouldn’t just replace paperwork.
It should create experiences people remember.

Bob Ross:  Exactly.

Jason Milton:  Let’s talk implementation.
How comfortable is your staff with technology?

Bob Ross:  Mixed.
Some of the younger guys live on their phones.
Some of the older employees still carry flip phones.

Jason Milton:  That’s actually helpful.
It tells us simplicity has to be one of our design principles.
If someone needs training every day…
We’ve failed.

Bob Ross:  Couldn’t agree more.

Jason Milton:  One thing we focus on at Wahala is reducing complexity.
The best software disappears.
People shouldn’t think about using it.
They should just get work done.

Bob Ross:  That’s refreshing.
Most software seems designed by engineers.

Jason Milton:  We’re engineers too…
But we spend a lot of time understanding the people who actually have to use what we build.

Bob Ross:  I can tell.

Jason Milton:  I wanted to ask another business question.
If we save your staff…
Let’s say…
Three hours a day across multiple departments…
What does that mean financially?

Bob Ross:  Honestly…
Probably a couple hundred thousand dollars a year between labor savings and increased service revenue.

Jason Milton:  That’s important.
Because software shouldn’t be viewed as an expense.
It should produce a measurable return.

Bob Ross:  That’s exactly how ownership is looking at it.

Jason Milton:  Good.
Now let’s talk timeline.
Are you hoping to have something ready before next boating season?

Bob Ross:  Ideally.
If we had Version One by March…
That would be fantastic.

Jason Milton:  I think that’s realistic if we keep the first phase focused.
We’ll prioritize the highest-value workflows, get those into production, collect feedback from your team, and then continue building additional features in phases. That way your staff starts benefiting early instead of waiting for a giant “big bang” release.

Bob Ross:  I like phased delivery.
Less risk.

Jason Milton:  Exactly.
We also talked internally after our last meeting, and I think there are two ways we could approach this.
One is a completely custom application built specifically for Harbor Point.
The second is to build on top of some core platform components we’ve already developed. That would reduce both the timeline and the upfront investment while still giving you a product that’s tailored to your business.
We’ll outline both options in the proposal so you can make an informed decision.

Bob Ross:  Perfect.
I’d like to compare them side by side.

Jason Milton:  Great.
Our next step is to finalize the proposal, including estimated investment ranges, implementation phases, timeline, and deliverables. Once you’ve had a chance to review it with your partners, we’ll meet again to answer questions and, if everything aligns, move into a Master Services Agreement, Scope of Work, and project kickoff.

Bob Ross:  Sounds like a plan.
I appreciate how you’ve approached this. It doesn’t feel like you’re trying to sell me software—it feels like you’re trying to understand my business.

Jason Milton:  That’s because the software is just the tool. If we understand the business and solve the right problems, the technology becomes the easy part.

Bob Ross:  Well, I think we’re headed in the right direction.
Looking forward to seeing the proposal.

Meeting Ends
Duration: 58 minutes

AI-Extractable Information in This Follow-Up Call
This transcript includes additional details that are useful for testing AI extraction and CRM workflows:
	•	New stakeholder feedback from ownership
	•	Concerns about implementation and adoption
	•	Prioritized MVP feature list
	•	Deferred features (payments, AI scheduling)
	•	New product ideas (digital boat service history / “Carfax for boats”)
	•	Resource scheduling requirements
	•	Staffing and technology adoption constraints
	•	Revenue opportunity through intelligent upselling
	•	ROI discussion and estimated business value
	•	Desired implementation timeline (before boating season)
	•	Agreement to a phased delivery approach
	•	Decision to review two proposal options (custom vs. platform-based)
	•	Clear next steps leading toward proposal approval, MSA, Scope of Work, and project kickoff', 4, 'usr_staff_kai_0001', 1783094400),
  ('call_harbor_0003', 'deal_harbor_0002', 'Follow-up — dockside POS (thin)', 1783692000, 26, 'Sales Discovery Call Transcript
Project: Initial Discovery Call (Undefined Product Vision)
Date: July 3, 2026
Duration: 1 hour 6 minutes
Participants
	•	Jason Milton – Founder & Solutions Architect, Wahala Group
	•	Bob Ross – Owner, Harbor Point Marina

Jason Milton:  Hey Bob, thanks for making the time today. Before we talk about software or technology, I’d really like to understand your business. My goal isn’t to figure out what app you want—it’s to understand the problems you’re trying to solve.
Sound fair?

Bob Ross:  Absolutely. Honestly…that’s kind of why I’m here. I know we’ve got problems, but I don’t really know what the solution looks like.

Jason Milton:  That’s actually pretty common.
If everyone knew exactly what software they needed, companies like ours wouldn’t exist.
Let’s start with your business instead.
Tell me about Harbor Point.

Bob Ross:  We’re a marina.
About seven hundred customers.
Dry storage.
Wet slips.
Service department.
Fuel dock.
Ship’s store.
It’s been in my family for almost thirty years.
Business is good…
Operations…not always.

Jason Milton:  What keeps you up at night?

Bob Ross:  Honestly?
Chaos.
Some days it feels like everybody’s running around putting out fires.
Customers are generally happy…
But internally it’s exhausting.

Jason Milton:  Tell me about one of those fires.

Bob Ross:  Well…
Last Saturday was a good example.
Customer shows up at six in the morning expecting his boat in the water.
Boat never got launched.
Turns out someone wrote the request on a sticky note.
The sticky note disappeared.
Nobody knew about it.
Customer’s furious.
The dock crew is apologizing.
The office is trying to figure out what happened.
Meanwhile we’ve got fifteen other customers waiting.

Jason Milton:  How often does something like that happen?

Bob Ross:  Not every day…
But often enough that everybody just expects something to go wrong.

Jason Milton:  What systems are you using today?

Bob Ross:  QuickBooks.
A scheduling calendar.
Some spreadsheets.
Whiteboards.
Emails.
Text messages.
Phones.
Radios.
Honestly…
Whatever works at the moment.

Jason Milton:  Would you say information lives in one place…
Or in people’s heads?

BobBob Ross:  Mostly people’s heads.
And that’s part of the problem.
If our office manager is on vacation…
Everything slows down.
She knows where everything is.

Jason Milton:  That’s an interesting point.
If someone left tomorrow…
Would the business still operate the same?

Bob Ross:  No.
Not even close.

Jason Milton:  That tells me you don’t have a software problem.
You have a process problem.

Bob Ross:  Yeah…
I think that’s true.

Jason Milton:  Walk me through a customer from beginning to end.
Let’s pretend I own a boat here.
What happens?

Bob Ross:  Well…
You buy a storage membership.
You leave the boat with us.
Then whenever you want to use it…
You call.
Sometimes two days ahead.
Sometimes an hour ahead.
You might ask us to launch it.
Fuel it.
Wash it.
Charge batteries.
Sometimes service it.
Sometimes you don’t know what you want until you call.

Jason Milton:  And where does that request go?

Bob Ross:  Depends who answers the phone.

Jason Milton:  Really?

Bob Ross:  Yeah.
Could be the office.
Could be the dockmaster.
Could be one of the girls at the front desk.
Sometimes customers text employees directly because they’ve known them for years.

Jason Milton:  So there’s no standard workflow.

Bob Ross:  Exactly.

Jason Milton:  When you called me, what were you originally thinking you wanted built?

Bob Ross:  Honestly…
I thought maybe just an app.

Jason Milton:  An app that does what?

Bob Ross:  …
That’s kind of the problem.
I don’t really know.

Jason Milton:  That’s okay.
When you picture using this software a year from now…
What’s different?

Bob Ross:  Less confusion.
Fewer phone calls.
Employees knowing what they’re supposed to be doing.
Customers happier.
I spend less time solving problems.

Jason Milton:  Notice something?
You didn’t mention software once.

Bob Ross:  (Laughs)
You’re right.

Jason Milton:  You described business outcomes.
That’s actually much more valuable.

Bob Ross:  I never thought about it that way.

Jason Milton:  What part of your day consumes the most time?

Bob Ross:  Answering questions.
Where’s my boat?
Has it been fueled?
Who’s washing it?
Can we launch another one?
Did someone order ice?
It’s constant.

Jason Milton:  How many of those questions do you think people ask because they simply can’t see what’s happening?

Bob Ross:  Probably most of them.

Jason Milton:  Interesting.
So maybe the problem isn’t communication.
Maybe it’s visibility.

Bob Ross:  Yeah…
That sounds right.

Jason Milton:  Let’s say every employee and every customer could see exactly where every request stood.
Would that eliminate a lot of those calls?

Bob Ross:  Absolutely.

Jason Milton:  Would customers use their phones if it meant they didn’t have to call?

Bob Ross:  Definitely.
Everybody lives on their phones now.

Jason Milton:  What kinds of things would customers want to request?

Bob Ross:  Launch.
Fuel.
Ice.
Cleaning.
Repairs.
Pump out.
Maybe reserve transient slips.
Maybe order supplies.
Honestly…
I’m thinking of things as we’re talking.

Jason Milton:  That’s exactly why we have these conversations.

Bob Ross:  Actually…
One customer asked if we could stock the boat before they arrived.
Beer.
Food.
Ice.
Stuff like that.
We told them no because it was too complicated.

Jason Milton:  Was it too complicated…
Or did you not have a process?

Bob Ross:  …
Probably the process.

Jason Milton:  That’s an important distinction.
Technology can’t fix broken businesses.
But it can make good processes incredibly efficient.

Bob Ross:  Makes sense.

Jason Milton:  Do you know how much revenue comes from fuel?

Bob Ross:  Sure.

Jason Milton:  Cleaning?

Bob Ross:  Yep.

Jason Milton:  Launches?

Bob Ross:  Yep.

Jason Milton:  How much revenue do you lose because customers don’t know those services exist?

Bob Ross:  …
I’ve honestly never thought about that.

Jason Milton:  Imagine every customer interaction became an opportunity.
Not a sales pitch…
Just a reminder.
You’re launching Saturday.
Would you like fuel?
Need ice?
Need the boat washed?
Need your engines serviced?
Need bait?

Bob Ross:  I bet we’d sell a lot more services.

Jason Milton:  Exactly.
Instead of software replacing employees…
Software helps employees create more value.

Bob Ross:  That’s really interesting.

Jason Milton:  I have another question.
If you could solve just one problem this year…
Which one creates the biggest impact?

Bob Ross:  Organization.
Without question.
Everything else comes after that.

Jason Milton:  Good answer.
Because that’s where I’d start too.

Bob Ross:  I thought I wanted an app.
Now I’m thinking maybe I need a better operating system for the marina.

Jason Milton:  That’s exactly how I’d describe it.
Not a mobile app.
A platform.
The app is just one window into that platform.
Your customers have one experience.
Your dock crew has another.
Your mechanics have another.
Management has dashboards.
Accounting has reports.
Everybody works from the same information.

Bob Ross:  I never thought about it like that.

Jason Milton:  Most people don’t.
That’s why discovery is important.
We’re not trying to figure out what screens to build.
We’re trying to understand how your business works.

Bob Ross:  Honestly…
You’ve already changed the way I’m thinking about this.

Jason Milton:  Good.
Because I don’t think we’re ready to write a proposal yet.

Bob Ross:  Really?

Jason Milton:  Not yet.
Right now we’d just be guessing.
I’d rather spend another session mapping out your business processes—how work flows from the moment a customer makes a request until the boat leaves the marina. Once we understand that, we can identify where technology adds the most value.

Bob Ross:  That actually makes me feel a lot better.
The last company talked numbers after twenty minutes.

Jason Milton:  We could certainly build whatever you ask for.
But I’d rather help you build what your business actually needs.

Bob Ross:  I appreciate that.

Jason Milton:  For our next meeting, I’d like to invite your dockmaster, your service manager, and someone from the office. They’ll each see different parts of the business, and together we’ll map out your current workflow. From there, we can identify bottlenecks, opportunities, and priorities before we ever discuss features.

Bob Ross:  I think that’s exactly the right next step.

Jason Milton:  Perfect. I’ll send over a discovery agenda, and next time we’ll spend our time understanding your operation rather than talking about software.

Meeting Ends
Duration: 1 hour 6 minutes

Why this is a strong “Call 1” transcript
This conversation reflects what often happens in a real consulting engagement:
	•	The customer starts with a vague request (“I think I need an app.”)
	•	Jason avoids solutioning too early and instead uncovers business problems.
	•	Through questioning, the conversation shifts from building an app to improving marina operations.
	•	Jason qualifies the opportunity without pushing a sale.
	•	No proposal is presented yet; instead, the next step is a structured discovery workshop with additional stakeholders.
This type of transcript is particularly useful for testing AI systems that need to extract ambiguous requirements, identify pain points, recommend follow-up questions, and determine when a project is not yet ready for scoping.', 2, 'usr_staff_kai_0001', 1783094400);

-- Process events: Kai (clean, training), Jason (Vega: low-readiness advance, 3 overridden nudges, day-34 loss).
INSERT OR IGNORE INTO process_events (id, organization_id, deal_id, owner_user_id, actor_user_id, kind, from_step, to_step, readiness_score, metadata, created_at) VALUES
  ('pe_harbor_0001', 'org_harbor_0001', 'deal_harbor_0001', 'usr_staff_kai_0001', 'usr_staff_kai_0001', 'call_ingested', NULL, NULL, 7.5, '{"callId": "call_harbor_0001", "title": "Discovery call 1"}', 1783094400),
  ('pe_harbor_0002', 'org_harbor_0001', 'deal_harbor_0001', 'usr_staff_kai_0001', 'usr_staff_kai_0001', 'call_ingested', NULL, NULL, 8.7, '{"callId": "call_harbor_0002", "title": "Follow-up discovery"}', 1783098000),
  ('pe_harbor_0003', 'org_harbor_0001', 'deal_harbor_0002', 'usr_staff_kai_0001', 'usr_staff_kai_0001', 'call_ingested', NULL, NULL, 3.1, '{"callId": "call_harbor_0003", "title": "Follow-up (bad)"}', 1783101600),
  ('pe_harbor_0004', 'org_harbor_0001', 'deal_harbor_0002', 'usr_staff_kai_0001', 'usr_staff_kai_0001', 'nudge_fired', 'discovery', 'proposal_out', 3.1, NULL, 1783101600),
  ('pe_harbor_0005', 'org_harbor_0001', 'deal_harbor_0002', 'usr_staff_kai_0001', 'usr_staff_kai_0001', 'nudge_acted', 'discovery', 'proposal_out', 3.1, '{"choice": "keep_in_discovery"}', 1783101600),
  ('pe_vega_0001', 'org_vega_0001', 'deal_vega_0001', 'usr_staff_jason_0001', 'usr_staff_jason_0001', 'stage_moved', 'discovery', 'proposal_out', 5.8, NULL, 1780930800),
  ('pe_vega_0002', 'org_vega_0001', 'deal_vega_0001', 'usr_staff_jason_0001', 'usr_staff_jason_0001', 'nudge_fired', 'discovery', 'proposal_out', 5.8, NULL, 1780930800),
  ('pe_vega_0003', 'org_vega_0001', 'deal_vega_0001', 'usr_staff_jason_0001', 'usr_staff_jason_0001', 'nudge_overridden', 'discovery', 'proposal_out', 5.8, '{"via": "advance_anyway"}', 1780930800),
  ('pe_vega_0004', 'org_vega_0001', 'deal_vega_0001', 'usr_staff_jason_0001', 'usr_staff_jason_0001', 'nudge_fired', NULL, NULL, 5.8, '{"surface": "followup"}', 1781622000),
  ('pe_vega_0005', 'org_vega_0001', 'deal_vega_0001', 'usr_staff_jason_0001', 'usr_staff_jason_0001', 'nudge_overridden', NULL, NULL, 5.8, '{"via": "ignored_followup"}', 1781622000),
  ('pe_vega_0006', 'org_vega_0001', 'deal_vega_0001', 'usr_staff_jason_0001', 'usr_staff_jason_0001', 'nudge_fired', NULL, NULL, 5.8, '{"surface": "followup"}', 1782313200),
  ('pe_vega_0007', 'org_vega_0001', 'deal_vega_0001', 'usr_staff_jason_0001', 'usr_staff_jason_0001', 'nudge_overridden', NULL, NULL, 5.8, '{"via": "ignored_followup"}', 1782313200),
  ('pe_vega_0008', 'org_vega_0001', 'deal_vega_0001', 'usr_staff_jason_0001', 'usr_staff_jason_0001', 'stage_moved', 'proposal_out', 'lost', 5.8, '{"reason": "went with cheaper vendor"}', 1783004400),
  ('pe_vega_0009', 'org_vega_0001', 'deal_vega_0001', 'usr_staff_jason_0001', 'usr_staff_jason_0001', 'postmortem_created', NULL, NULL, 5.8, '{"findings": 3, "reason": "went with cheaper vendor"}', 1783004400);

-- ======================================================================
-- Demo-review stages (design frame 05 / quote builder): Acme Website Revamp
-- gets the full pay-as-you-go spine — Stage 1 accepted, Stage 2 in_progress
-- (paid, with an acceptance checklist), Stage 3 quoted (awaiting approval).
-- ======================================================================
INSERT OR IGNORE INTO stages (id, organization_id, project_id, name, sequence, scope_description, status, total_amount_cents, billing_mode, requires_admin_approval, approved_by_user_id, quote_approved_at, paid_at, delivered_at, accepted_by_user_id, accepted_at, created_at, updated_at) VALUES
 ('stg_acme_0001', 'org_acme_0001', 'prj_acme_0001', 'Stage 1 — Discovery & information architecture', 1,
  'Content audit of the current site, stakeholder interviews, and the sitemap + wireframes the rebuild is scoped against.',
  'accepted', 450000, 'upfront', 0, 'usr_client_admin_0001', 1782000000, 1782086400, 1782432000, 'usr_client_admin_0001', 1782518400, 1781913600, 1782518400),
 ('stg_acme_0002', 'org_acme_0001', 'prj_acme_0001', 'Stage 2 — Design system & site build', 2,
  'The visual design system, CMS setup, and the build of every page from the approved wireframes. Ends with a staging walkthrough.',
  'in_progress', 1200000, 'upfront', 1, 'usr_client_admin_0001', 1782604800, 1782691200, NULL, NULL, NULL, 1782518400, 1782691200),
 ('stg_acme_0003', 'org_acme_0001', 'prj_acme_0001', 'Stage 3 — Launch & handover', 3,
  'Content migration, redirects, analytics, launch checklist, and a training session so the Acme team owns the CMS.',
  'quoted', 680000, 'upfront', 0, NULL, NULL, NULL, NULL, NULL, NULL, 1782691200, 1782691200);

INSERT OR IGNORE INTO stage_line_items (id, stage_id, group_label, description, estimate_note, amount_cents, sort_order, accepted, completed, created_at) VALUES
 ('sli_acme_0201', 'stg_acme_0002', 'Design system', 'Color, type, and component library in Figma + code', 'tokens shared with the app team', 0, 0, 0, 1, 1782604800),
 ('sli_acme_0202', 'stg_acme_0002', 'Design system', 'Responsive page templates (home, product, article, contact)', NULL, 0, 1, 0, 1, 1782604800),
 ('sli_acme_0203', 'stg_acme_0002', 'Site build', 'CMS collections + editor roles configured', NULL, 0, 2, 0, 0, 1782604800),
 ('sli_acme_0204', 'stg_acme_0002', 'Site build', 'All 14 pages built from approved wireframes', 'staging walkthrough at the end', 0, 3, 0, 0, 1782604800),
 ('sli_acme_0301', 'stg_acme_0003', 'Launch', 'Content migration + 301 redirect map', NULL, 0, 0, 0, 0, 1782691200),
 ('sli_acme_0302', 'stg_acme_0003', 'Launch', 'Analytics, search console, and launch checklist', NULL, 0, 1, 0, 0, 1782691200),
 ('sli_acme_0303', 'stg_acme_0003', 'Handover', 'CMS training session + editor guide', NULL, 0, 2, 0, 0, 1782691200);
