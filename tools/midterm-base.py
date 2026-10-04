"""Engendre DOC/midterm_base.pdf (et son aperçu .jpg) : le gabarit MID_TERM.pdf,
intact, avec dans le cadre « Site Plan » la base du géomètre au 1:500, nord en
haut, la parcelle centrée. Le calage se lit dans src/data/planches.js (MIDTERM),
qui fait foi ; ce script n'a aucun nombre à lui.

    python3 tools/midterm-base.py      (pymupdf et node requis)
"""
import json, subprocess, pymupdf

M, B = json.loads(subprocess.check_output(["node", "--input-type=module", "-e",
    "import('./src/data/planches.js').then(m=>console.log(JSON.stringify([m.MIDTERM,m.BASE])))"]))
gab, base = pymupdf.open(M["gabarit"]), pymupdf.open(B["pdf"])
page, bp = gab[0], base[0]
H, Hb = page.rect.height, bp.rect.height
# même échelle des deux côtés : la base ne fait que glisser
dx, dy = M["calage"]["ox"] - B["ox"], M["calage"]["oy"] - B["oy"]
x0, y0, x1, y1 = M["situation"]
src = pymupdf.Rect(x0 - dx, Hb - (y1 - dy), x1 - dx, Hb - (y0 - dy))   # y vers le bas
dst = pymupdf.Rect(x0, H - y1, x1, H - y0)
assert abs(B["k"] - M["calage"]["k"]) < 1e-9
page.show_pdf_page(dst, base, 0, clip=src, overlay=False)
gab.save(M["pdf"], garbage=3, deflate=True)
page = pymupdf.open(M["pdf"])[0]
page.get_pixmap(dpi=40).save(M["apercu"], jpg_quality=80)
print(M["pdf"], "et", M["apercu"])
