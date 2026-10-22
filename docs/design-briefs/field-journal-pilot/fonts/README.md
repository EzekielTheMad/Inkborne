# Notebook typography sources and subsets

`EBGaramond[wght].ttf` is the variable source used for the outlined logo wordmark and page typography. Its source is the [Google Fonts EB Garamond directory](https://github.com/google/fonts/tree/main/ofl/ebgaramond). Keep [OFL.txt](OFL.txt) with redistributed copies.

`EBGaramond-latin.ttf` is a fontTools subset for this English-language static page, generated from the same source. It retains the variable weight range and the characters used by the pilot. The source page includes the full font as a fallback; the self-contained previews embed the subset. Neither page font is needed to display the outlined SVG logos.

| File | SHA-256 |
| --- | --- |
| `EBGaramond[wght].ttf` | `ef9512f92f6d579e5dc75af59a5a4b1b8b47d2eda89e00b954d44520e5369027` |
| `EBGaramond-latin.ttf` | `46f50e308bfc01788bac923878491f237d219e0544b4be4c6671e538f5a51032` |

The exact subset command is recorded in [the asset regeneration instructions](../brand/README.md#regeneration).

## Version 2 notebook additions

The display face is the unmodified [Marcellus Regular](https://github.com/google/fonts/tree/main/ofl/marcellus) from Google Fonts. Keep [Marcellus-OFL.txt](Marcellus-OFL.txt) with it. Copyright 2012 Brian J. Bonislawsky DBA Astigmatic; the reserved font name is Marcellus.

The real italic face comes from [EB Garamond Italic](https://github.com/google/fonts/blob/main/ofl/ebgaramond/EBGaramond-Italic%5Bwght%5D.ttf). Its full variable source is retained with the existing [OFL.txt](OFL.txt). The preview embeds a static weight-400 Latin subset alongside the existing normal subset and full Marcellus Regular. The normal and italic subsets have not been renamed; the EB Garamond license has no reserved font name. The outlined logo wordmark is unchanged.

| File | SHA-256 |
| --- | --- |
| `Marcellus-Regular.ttf` | `1cf0cd10b17d35e852729962cc1ffaffed94514895972458345e2df34abb2f81` |
| `EBGaramond-Italic[wght].ttf` | `bba2c4499c93c9612b90b9825d32b07da52fce2fe57562a1eb6b833553f93c4e` |
| `EBGaramond-Italic-latin.ttf` | `60b1107a2bfd2247aa01a84ee20ce8a6474bfff73ad90fe618db30bc93d14e88` |

Generate the italic subset with fontTools from this directory:

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.subset import Options, Subsetter

font = TTFont("EBGaramond-Italic[wght].ttf", recalcTimestamp=False)
font = instantiateVariableFont(font, {"wght": 400}, inplace=False)
options = Options()
options.layout_features = ["*"]
options.notdef_outline = True
options.recommended_glyphs = True
subset = Subsetter(options=options)
subset.populate(unicodes=list(range(0x20, 0x250)) + [
    0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d,
    0x2026, 0x2192, 0x2212, 0xfffd,
])
subset.subset(font)
font.save("EBGaramond-Italic-latin.ttf")
```

These local assets make both packaged studies independent of a network font request. Application adoption should use the existing `next/font` pipeline rather than copying the prototype's embedded data URLs into app components.
