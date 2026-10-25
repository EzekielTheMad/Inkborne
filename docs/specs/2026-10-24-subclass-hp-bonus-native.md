# Native subclass HP parity

The staged `character-builder-hp-bonus.sql` companion installs after the explicit
Fiend version-correction companion. It replaces only
`private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)`. No character pin,
immutable content version, accepted receipt/history, class origin, role, HP roll,
inventory row or activation gate is rewritten.

The first supported contract is an optional immutable subclass-root field
`data.hit_points_bonus_per_class_level: 1`. Absence preserves the previous base
formula. Explicit null, zero, another amount or a non-number refuses the
calculation. The source importer supplies the reviewed Draconic root mechanics;
the native reader recognizes the field through exact source ownership, never a
class/subclass slug exception or mutable current-catalog fallback. Existing old
Draconic subclass/feature versions retain their saved mechanics. This does not
add a historical Draconic update command; the explicit historical command stays
Fiend-only.

The helper receives the compiler's next choices and next graph, before the
compiler seals that graph into the capability. It validates unique selected
class/occurrence identities, every active occurrence, the immutable class
controller tuple and selected subclass reference, character/system ownership,
subclass parent pairing, exact source context and occurrence-specific choice
source. Extra, duplicate, missing, ended or mismatched roots refuse rather than
produce a guessed HP value. The original first-class proof still determines the
maximal first die, independently of array order. Ended historical occurrences
remain in the graph without contributing.

A positive declaration additionally requires explicit earned progression in
both immutable roots: a valid unique selected class-level row, a class
`levels[].subclass_level === true` gate at or below that own class level, and
valid unique subclass level rows whose first level is earned. Missing or
malformed progression supplies no guessed default gate.

Each raw stored die contribution and Constitution modifier retains the existing
per-level minimum of one HP. A valid subclass bonus adds its own class level
after those minima. It does not multiply by total character level or apply to
another class. The existing progression/downlevel and class-removal compilers
already call this helper when clamping a saved `current_hp` against their next
graph. Their command, receipt, revision and row producers remain unchanged.

The installer admits the exact original helper body MD5
`59eac94525f960c399a080e6c758cb12` and checks the replacement postimage
`6f4e810b99cfd755babcc0fc058c2431`. It preserves the postgres owner, stable
volatility, definer setting, empty search path and owner-only execution ACL.
It requires the final builder companions, no active capability, thirteen closed
writer-readiness rows and closed class-origin/hit-die gates before and after.

Focused PGlite vectors execute the complete real installer and admitted original
body with explicit original-proof and Constitution-score doubles. They cover
average/rolled/manual contributions, Constitution changes and extreme negative
modifiers, original/secondary class ownership and reordering, next-graph
downlevel/removal HP caps, old metadata absence, unsupported metadata,
duplicate/orphan/mismatched source evidence, installer drift and ACL/profile
closure. Those vectors do not prove real Auth, the complete native compiler,
protected triggers, concurrent commands or browser behavior. Disposable actual
application verification must separately exercise a newly published Draconic
subclass version, builder/sheet/reload HP and AC, raw roll preservation, relevant
level changes, and unchanged historical snapshots before product acceptance.

The durable hit-die TypeScript planner must use the same validated HP result and
saved-choice effect resolver as the sheet. Its existing transaction accepts a
trusted, snapshot-checked candidate maximum; it has no separate SQL maximum-HP
formula to change here. This companion opens no R09 activation gate and makes
no claim that the broader native writer/lifecycle queue is complete.
