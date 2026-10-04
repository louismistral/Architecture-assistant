"""Engendre DOC/midterm_base.pdf (et l'aperçu .jpg de ses deux pages) : le gabarit MID_TERM.pdf,
intact, avec dans le cadre « Site Plan » la base du géomètre au 1:500, nord en
haut, la parcelle centrée, sur TOUT le cadre.

La base (DOC/site-plan_base.pdf) porte le relevé entier, 405 × 256 m, mais sa page
A2 n'en montre que 285 × 197 : chaque objet y est découpé par le cadre de la page.
On lève ces découpes et l'on agrandit la page, en mémoire : le dessin d'origine
remplit alors le cadre du midterm, dans son propre style, sans rien redessiner. Le calage se lit dans src/data/planches.js (MIDTERM),
qui fait foi ; ce script n'a aucun nombre à lui.

    python3 tools/midterm-base.py      (pymupdf et node requis)
"""
import json, subprocess, pymupdf

M, B = json.loads(subprocess.check_output(["node", "--input-type=module", "-e",
    "import('./src/data/planches.js').then(m=>console.log(JSON.stringify([m.MIDTERM,m.BASE])))"]))
gab, base = pymupdf.open(M["gabarit"]), pymupdf.open(B["pdf"])
page, bp = gab[0], base[0]
# le cadre de la page A2, qui découpe chaque objet de la base : levé
CADRE = b"36 36 1611.779 1118.552 re"
n = 0
for x in bp.get_contents():
    c = base.xref_stream(x); n += c.count(CADRE)
    base.update_stream(x, c.replace(CADRE, b"-3000 -3000 9000 9000 re"))
assert n, "la base a changé : son cadre de découpe n'est plus " + CADRE.decode()
# une page assez grande pour tout le relevé (repère du PDF, y vers le haut)
MB = (-1000, -1000, 3000, 2500)
for k in ("MediaBox", "CropBox"):
    base.xref_set_key(bp.xref, k, "[%d %d %d %d]" % MB)
bp = base[0]
H = page.rect.height
# même échelle des deux côtés : la base ne fait que glisser
dx, dy = M["calage"]["ox"] - B["ox"], M["calage"]["oy"] - B["oy"]
x0, y0, x1, y1 = M["situation"]
src = pymupdf.Rect(x0 - dx - MB[0], MB[3] - (y1 - dy), x1 - dx - MB[0], MB[3] - (y0 - dy))   # y vers le bas
dst = pymupdf.Rect(x0, H - y1, x1, H - y0)
assert abs(B["k"] - M["calage"]["k"]) < 1e-9
page.show_pdf_page(dst, base, 0, clip=src, overlay=False)
gab.save(M["pdf"], garbage=3, deflate=True)
out = pymupdf.open(M["pdf"])
out[0].get_pixmap(dpi=40).save(M["apercu"], jpg_quality=80)
out[1].get_pixmap(dpi=40).save(M["apercu2"], jpg_quality=80)
print(M["pdf"], M["apercu"], M["apercu2"])
