"""Engendre DOC/final_base.pdf (et son aperçu .jpg) : une page A1 paysage blanche avec,
dans le cadre de la planche 1 du rendu final, la base du géomètre au 1:500, nord en
haut, la parcelle centrée.

Même procédé que tools/midterm-base.py : la base (DOC/site-plan_base.pdf) porte le
relevé entier, mais sa page A2 le découpe à son cadre ; on lève ces découpes, et le
dessin d'origine remplit le cadre, dans son propre style. Le calage se lit dans
src/data/planches.js (FINAL), qui fait foi ; ce script n'a aucun nombre à lui.

    python3 tools/final-base.py      (pymupdf et node requis)
"""
import json, subprocess, pymupdf

M, B, F = json.loads(subprocess.check_output(["node", "--input-type=module", "-e",
    "import('./src/data/planches.js').then(m=>console.log(JSON.stringify([m.FINAL,m.BASE,m.FORMATS[m.FINAL.format]])))"]))
base = pymupdf.open(B["pdf"])
bp = base[0]
CADRE = b"36 36 1611.779 1118.552 re"
n = 0
for x in bp.get_contents():
    c = base.xref_stream(x); n += c.count(CADRE)
    base.update_stream(x, c.replace(CADRE, b"-3000 -3000 9000 9000 re"))
assert n, "la base a changé : son cadre de découpe n'est plus " + CADRE.decode()
MB = (-1000, -1000, 3000, 2500)
for k in ("MediaBox", "CropBox"):
    base.xref_set_key(bp.xref, k, "[%d %d %d %d]" % MB)
out = pymupdf.open()
page = out.new_page(width=F["w"], height=F["h"])
H = page.rect.height
dx, dy = M["calage"]["ox"] - B["ox"], M["calage"]["oy"] - B["oy"]
x0, y0, x1, y1 = M["situation"]
src = pymupdf.Rect(x0 - dx - MB[0], MB[3] - (y1 - dy), x1 - dx - MB[0], MB[3] - (y0 - dy))   # y vers le bas
dst = pymupdf.Rect(x0, H - y1, x1, H - y0)
assert abs(B["k"] - M["calage"]["k"]) < 1e-9
page.show_pdf_page(dst, base, 0, clip=src)
out.save(M["pdf"], garbage=3, deflate=True)
pymupdf.open(M["pdf"])[0].get_pixmap(dpi=40).save(M["apercu"], jpg_quality=80)
print(M["pdf"], M["apercu"])
