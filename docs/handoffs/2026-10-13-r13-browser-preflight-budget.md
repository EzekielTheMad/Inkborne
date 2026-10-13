# Item-sharing browser preflight budget — source correction

The explicit offline gate at clean `dcda49d` reached its 240-second outer
Playwright deadline before rendering. Its wrapper began at17:50:59.981Z;
the private runner was born at17:53:09.975615Z and completed its entry/process
proof at17:54:46.591Z. Only its process receipt and production manifest exist:
no rendered proof, bundle, browser identity, screenshots or successful form cases.
This is guard-budget evidence, not a product timeout or browser acceptance.

The fresh synthetic build passed first, with23 observed process identities absent.
The failed browser gate preserved its logs/artifacts; all166 observed identities
were absent and owned listeners empty at17:55:00.738Z. No force was necessary.

This correction changes only the outer test budget to600 seconds. Full installed
package/file-set/raw-byte proofs, root/assets/helper binding, initial/final/force
checks and every form/response/assertion timeout remain unchanged. The bound
leaves time for the repeated complete proofs and actual24 cases/38 screenshots.
Those intended cases have not run successfully. Root requires independent review,
a fresh exact-source build manifest and a separate browser release before retry.
Database/RLS/CAS/sharing/snapshot authority is still untested and SQL unapplied.
