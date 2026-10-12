# R12.6a — private standalone passive features, proposed bounded child

Planning source is root `60292745f3fb1cc6eb498ca3acf85d21407a3b05`.
This is a proposal for independent challenge, not implementation or permission
acceptance. It follows the remaining feature-authoring requirement in R12/M4.
Classes, subclasses, attachments and advanced feature mechanics remain separate
required children. No install, browser, database, content or runtime operation
occurred while writing this plan.

## Existing contract and useful outcome

`lib/schemas/content-types/feature.ts` requires a class string, level 1–20 and
description; it supports many additional mechanical fields and feature types.
`lib/supabase/feature-refs-server.ts` reconciles immutable captured feature grants
from saved class choices. A definition's descriptive class string alone neither
attaches it to a class nor activates it on a character. R12.5's standalone trait
form supplies the closest existing draft/uncertain-response/version-CAS pattern.

The first child creates a private **standalone passive feature** with explicitly
entered name, description, class slug, optional subclass slug and gain level.
Those slugs are descriptive unverified association metadata in this child, never
an entitlement proof or automatic relation. The form must explain this before
save. Do not offer ASI, subclass-selection, fighting-style, generic-choice,
spell-payment, effect, counter, relation or arbitrary-code editing here. This
does not satisfy all feature mechanics or class attachment.

For new definitions, explicitly write `feature_type: passive`, declared class,
subclass string or null, level and description; `effects: []`. Do not persist
canonical parser defaults for unrelated fields. Editing only name/description
on an owned existing canonically valid feature preserves the original raw class,
subclass, level, feature type, mechanics, relations, absence/null, extensions and
effect order. Show association/type/level as read-only. Unsupported or malformed
known data/effects is a read-only refusal, never silently normalized.

## Mutation and recovery boundaries

Use ordinary authenticated server pages/actions and request-scoped Supabase DAL;
exactly one published `dnd-5e-2014` system; owner/system/type/homebrew/personal/
active filters at read and final expected-version CAS. Update only name and raw
merged data. Validate original effects with the canonical effect schema without
using its stripped output or including effects in UPDATE. Confirm exact identity,
private envelope and intended data; changed writes require next PostgreSQL integer
version, genuine no-op returns unchanged version. Reject exhausted versions.

Use actual bounded named controls, cumulative UTF-8 transport budgeting before
parse, strict UUID/decimal versions and bounded errors, following the existing
authoring patterns. No new dependency, schema, SQL, public sharing or automatic
pin/manifest write. New slugs derive from names under existing identity rules;
they are not operation receipts or an exactly-once creation guarantee.

Retain controlled drafts across validation, native reset, rejected/malformed/
missing responses and conflicts. Pending duplicate submissions are blocked.
Uncertain CREATE requires Check Homebrew and explicit local acknowledgement
before another create; no automatic retry or success inference. Edit conflict or
uncertainty requires reload. Confirmed saved identity permits client navigation;
navigation failure cannot reinsert. Preserve actual framework navigation errors
where the action boundary uses them.

## Ownership and acceptance after challenge

Use a separate clean worker based on the accepted combined source. Own only new
feature mapper/DAL/form/actions/new/edit routes, their focused tests, handoff, and
minimal Homebrew discovery additions. Other workers are active; do not revert
their edits. Root remains sole integration writer. First independently challenge
whether the standalone association disclosure is sufficient and the minimal
create/edit contract preserves the current immutable manifest authority.

Meaningful tests cover named finite controls, association disclosure and locked
edit fields; malformed effects before any write; raw extensions/order/absence;
changed-old-version uncertainty and genuine no-op; owner/system/type/private/
active predicates, signed-out/foreign identities; transport loss, pending duplicate,
native reset, explicit check acknowledgement and confirmed-navigation failure.
Existing exact feature snapshot consumers must continue parsing untouched data.

Run focused npm-script tests, typecheck/lint, then independent source review.
Root runs combined `npm run check`, synthetic build and actual form desktop/mobile
offline browser with current compiled CSS/fonts. Simulated DAL/actions do not
prove actual permissions, triggers, historical v1/v2 or concurrent CAS. Those
remain approved real-runtime acceptance. Do not call R12/M4 complete after this
bounded child, or claim a standalone feature automatically applies to a character.
