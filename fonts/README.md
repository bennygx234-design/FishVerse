# Bundled fonts

Both families are embedded as base64 `data:` URIs inside `css/styles.css` so the game
works when opened directly from disk (a `file://` page cannot fetch separate font
files). The `.woff2` originals are kept here as the source of those data URIs.

| Font | Designer | License |
| --- | --- | --- |
| **Outfit** (display, numerals) | Smartsheet Inc., Rodrigo Fuenzalida | SIL Open Font License 1.1 |
| **Plus Jakarta Sans** (interface) | Tokotype | SIL Open Font License 1.1 |

Both are latin subsets of the variable fonts published on Google Fonts. The SIL Open
Font License 1.1 permits bundling and redistribution: https://openfontlicense.org

To regenerate the data URIs after replacing a `.woff2`, re-encode it with base64 and
swap the `src:` value in the matching `@font-face` block.
