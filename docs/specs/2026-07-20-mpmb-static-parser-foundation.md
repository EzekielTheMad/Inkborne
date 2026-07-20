# MPMB static parser foundation

## Purpose

Create the first importer boundary for MPMB community JavaScript without ever
executing uploaded code. This slice is deliberately a pure library: it parses,
statically folds a small data-only grammar, and returns typed entries or a typed
failure. Uploads, persistence, schema mapping, conflict resolution, and UI are
follow-up slices.

## Supported file shape

The parser accepts the common metadata prelude plus direct assignments to the
three registries in this slice:

```js
var iFileName = "Example.js";
RequiredSheetVersion("13.1.14");

SourceList["EX"] = { name: "Example", abbreviation: "EX" };
SpellsList.emberWard = { name: "Ember Ward", level: 1 };
FeatsList["steadfast"] = { name: "Steadfast", description: desc(["Line one", "Line two"]) };
```

Accepted values are JSON-like literals, arrays, plain object literals,
parentheses, unary `+`/`-`/`!`, deterministic primitive `+` expressions, static
template literals, and the allowlisted `desc([...])` formatting helper. The
helper is represented as data; Inkborne does not invoke the MPMB implementation.

Every other executable construct fails the whole parse. In particular, the
parser rejects functions, getters/setters, methods, spreads, identifier reads,
dynamic keys, loops, conditionals, imports, `eval`, constructors, assignments
outside the supported registries, and calls other than the metadata prelude and
the allowlisted static helper.

This foundation intentionally rejects many real community files that contain
`prereqeval`, `calcChanges`, identifier constants, or arbitrary helpers. It is
not yet the end-to-end Tasha-compatible importer. Later compatibility must add
explicit static grammar or unsupported-field diagnostics; a sandboxed execution
mode (including QuickJS) is permanently out of scope.

## Security invariants

- Uploaded source is text only and is never passed to `eval`, `Function`, a VM,
  a subprocess, a dynamic import, or any JavaScript runtime.
- The source-size cap is enforced before parsing.
- Token, AST node, nesting-depth, top-level statement, entry, object-property,
  array-element, key, per-string, and aggregate-string budgets are enforced
  before a result is returned.
- Registry keys and object keys are static and duplicate-free. Prototype-related
  keys (`__proto__`, `prototype`, and `constructor`) are rejected.
- Numeric results must be finite and JSON-safe. Sparse arrays and non-data object
  properties are rejected.
- A failure returns no partial import result.
- Output registries are ordered arrays rather than attacker-controlled object
  maps.

## Result contract

`parseMpmbSource` returns:

- optional `fileName` and `requiredSheetVersion` metadata;
- ordered `sources`, `spells`, and `feats` entry arrays;
- each entry's static key, data object, and source location;
- a copy of the effective parser limits for auditability.

Failures throw `MpmbParseError` with a stable code and, when available, a source
location. Callers can translate those codes into the later missing-information
or unsupported-mechanics workflow without inspecting error text.

## Initial verification matrix

- parses a synthetic file containing all three registries and the normal MPMB
  metadata prelude;
- preserves nested static data and the symbolic `desc` helper;
- rejects syntax errors, unknown statements, dynamic registry keys, duplicate
  entries, duplicate/dangerous object keys, functions, method calls, and global
  side effects;
- proves malicious fixtures do not execute;
- independently exercises every configured resource budget;
- confirms a failure never exposes a partial result.

## Follow-up slices

1. Map static MPMB fields into Inkborne Zod schemas and surface unsupported
   dynamic fields as explicit diagnostics.
2. Add private-by-default upload, licensing attestation, content hashing, and an
   import audit record.
3. Add review/missing-info/conflict UI before any database commit.
4. Add preview-character validation for calculation correctness.
5. Expand registry coverage only through new static grammar and fixture-backed
   mappings; never by executing MPMB code.
