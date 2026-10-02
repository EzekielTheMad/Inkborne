# Character creation recovery

The builder-first priority starts before the race/class steps: a failed or malformed
new-character submission must offer a readable path back instead of a runtime
exception or database internals.

Keep the existing authenticated server action and Supabase authorization. Validate
that name and game-system form entries are strings, trim them, and reject empty
values before inserting. Handle thrown inserts, database rejections and absent
returned rows through one stable error code. Never expose the database error in
the URL or log the player's submitted name/identity on every creation.

The page maps internal errors to recovery copy instead of decoding arbitrary
query text. An unavailable game-system list disables Begin and explains whether
the player should refresh or try later. Keep the single published-system shortcut.

Tests use mocked database responses only: string/file validation, rejected and
empty inserts, correct successful navigation, malformed error-query values,
single-system entry, empty catalogs and rejected catalog queries. No schema,
provider, campaign or hosted-data change is part of this task.

An insert that commits but loses its response remains an ambiguous outcome.
This task does not add automatic retries or claim idempotent creation. A future
submission-status design can address that if actual use demonstrates the need.
