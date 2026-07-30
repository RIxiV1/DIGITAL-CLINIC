"""
Regenerate src/app/services/pdfBrandFont.ts — the Domine faces the exported
PDF embeds so it renders in the app's display serif instead of Helvetica.

Run only when the font changes; the output is committed.

    pip install fonttools brotli
    python scripts/build-pdf-font.py

Why this exists at all: public/fonts ships Domine as a VARIABLE font, and
jsPDF can't select an instance from one — it would render the default weight
for both regular and bold, silently flattening every heading. So we snap the
wght axis to 400 and 700 up front and embed two static faces.

Each face is subset to the characters the PDF can actually emit (printable
Latin-1 plus the typographic and clinical marks asciize() lets through).
Unsubset, the pair is ~200 KB of base64; subset, it's ~100 KB.

Note: Domine has no glyph for U+2265/U+2264 (>= / <=), so asciize() still has
to fold those. It stays in the pipeline.
"""

import base64
import os
import tempfile

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SRC = "public/fonts/Domine-VariableFont_wght.ttf"
OUT = "src/app/services/pdfBrandFont.ts"

# Printable Latin-1, plus the marks that survive asciize().
CHARS = set(chr(c) for c in range(0x20, 0x7F))
CHARS |= set(chr(c) for c in range(0xA0, 0x100))
CHARS |= set("–—…‘’“”−·×µμ²³°")
UNICODES = sorted(ord(c) for c in CHARS)


def build(weight: int) -> str:
    font = TTFont(SRC)
    instancer.instantiateVariableFont(font, {"wght": weight}, inplace=True)
    opts = Options()
    opts.layout_features = ["*"]
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG"]
    sub = Subsetter(options=opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    font.flavor = None
    fd, tmp = tempfile.mkstemp(suffix=".ttf")
    os.close(fd)
    try:
        font.save(tmp)
        with open(tmp, "rb") as fh:
            return base64.b64encode(fh.read()).decode("ascii")
    finally:
        os.unlink(tmp)


def main() -> None:
    regular = build(400)
    bold = build(700)
    header = f'''/**
 * Domine (regular + bold), base64 TrueType, for embedding in the exported
 * PDF via jsPDF's virtual file system.
 *
 * GENERATED — do not hand-edit. Run `python scripts/build-pdf-font.py`.
 *
 * Domine is the app's display serif (--font-display / --font-editorial in
 * index.css). Before this, the PDF was entirely Helvetica, so the one
 * document a user hands to someone else looked unrelated to the product it
 * came from. Body text and data rows stay on Helvetica by design: the second
 * pair of faces would have doubled the payload on a lazily-loaded chunk for a
 * difference almost nobody would notice, whereas the serif headings are the
 * whole visual signature.
 *
 * Subset to printable Latin-1 plus the typographic marks asciize() permits.
 * Domine has no U+2265/U+2264, so asciize() still folds >= and <=.
 */

export const DOMINE_REGULAR_B64 =
  '{regular}';

export const DOMINE_BOLD_B64 =
  '{bold}';
'''
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(header)
    kb = (len(regular) + len(bold)) / 1024
    print(f"wrote {OUT} ({kb:.1f} KB of base64)")


if __name__ == "__main__":
    main()
