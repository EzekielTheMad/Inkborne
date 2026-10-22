# Inkborne homepage identity

The homepage uses the selected **The Scribe** horizontal lockup: ink on light
surfaces and reverse on dark surfaces. Both SVGs retain the transparent capital I
counter and outlined EB Garamond 600 lettering, with a 407 × 96 viewBox.

These are exact copies of the verified assets in
[`docs/design-briefs/field-journal-pilot/brand`](../../docs/design-briefs/field-journal-pilot/brand/README.md).
That directory contains the master, generator, source-font license, and export
manifest. Change the master and regenerate there before updating these copies;
do not edit the production derivatives independently. The root `.gitattributes`
keeps production SVGs at LF line endings so Windows checkouts preserve their hashes.

The homepage selects the two static assets through CSS against the document's
shared theme, so the mark matches before hydration. Keep clear space and the
intrinsic proportions; do not recolor it with character accents. Shared
authenticated navigation remains unchanged. The root `app/favicon.ico`,
`app/icon.svg`, and `app/apple-icon.png` use the matching small-size/app-icon
exports from the same verified asset pack.
