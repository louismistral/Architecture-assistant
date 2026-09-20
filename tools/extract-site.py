#!/usr/bin/env python3
"""Relevé du géomètre → src/data/site.js

Le fichier Rhino `DOC/site_plan.3dm` est la SOURCE : ce script en tire les
mesures et rien d'autre. Aucune règle de projet n'est écrite ici — elles vivent
dans src/data/rules.js.

Coordonnées : le fichier est en CENTIMÈTRES, en système suisse LV95. Le dessin
de l'application est en MÈTRES, origine au coin sud-ouest du périmètre du
concours — c'est l'origine qu'avait déjà site.js, et elle ne bouge pas.

    python3 tools/extract-site.py
"""
import json, math, sys
import rhino3dm as r
import numpy as np

SRC = "DOC/site_plan.3dm"
OUT = "src/data/site.js"

model = r.File3dm.Read(SRC)
if model is None:
    sys.exit("fichier Rhino illisible : " + SRC)

BY = {}
for o in model.Objects:
    BY.setdefault(model.Layers[o.Attributes.LayerIndex].FullPath, []).append(o)

def verts(g, n=40):
    """Les sommets d'une courbe, en centimètres, sans rien inventer."""
    if isinstance(g, r.PolylineCurve):
        return [(g.Point(i).X, g.Point(i).Y, g.Point(i).Z) for i in range(g.PointCount)]
    if isinstance(g, r.PolyCurve):
        out = []
        for i in range(g.SegmentCount):
            s = verts(g.SegmentCurve(i), 16)
            if out and s and abs(s[0][0]-out[-1][0]) < 1e-6 and abs(s[0][1]-out[-1][1]) < 1e-6:
                s = s[1:]
            out += s
        return out
    if isinstance(g, r.LineCurve):
        return [(g.PointAtStart.X, g.PointAtStart.Y, g.PointAtStart.Z),
                (g.PointAtEnd.X, g.PointAtEnd.Y, g.PointAtEnd.Z)]
    if hasattr(g, "ToNurbsCurve"):
        nc = g.ToNurbsCurve()
        if nc is None:
            return []
        d = nc.Domain
        out = []
        for i in range(n+1):
            p = nc.PointAt(d.T0 + (d.T1-d.T0)*i/n)
            out.append((p.X, p.Y, p.Z))
        return out
    return []

# --- origine : le coin sud-ouest du périmètre du concours -------------------
PERC = verts(BY["parcelle concours"][0].Geometry)
clean = [PERC[0]]
for p in PERC[1:]:
    if abs(p[0]-clean[-1][0]) > 1 or abs(p[1]-clean[-1][1]) > 1:
        clean.append(p)
X0 = min(p[0] for p in clean)
Y0 = min(p[1] for p in clean)

def L(p):   return (round((p[0]-X0)/100.0, 1), round((p[1]-Y0)/100.0, 1))
def LZ(p):  return round(p[2]/100.0, 2)

def poly(g, close=False, mind=0.25):
    """Une polyligne en mètres locaux, sommets confondus retirés."""
    v = verts(g)
    if not v:
        return []
    out = [L(v[0])]
    for p in v[1:]:
        q = L(p)
        if abs(q[0]-out[-1][0]) + abs(q[1]-out[-1][1]) >= mind:
            out.append(q)
    if close and len(out) > 2 and out[0] != out[-1]:
        out.append(out[0])
    return out if len(out) > 1 else []

def layer(name, close=False):
    out = []
    for o in BY.get(name, []):
        if isinstance(o.Geometry, r.Hatch):
            continue
        p = poly(o.Geometry, close)
        if p:
            out.append(p)
    return out

PER = poly(BY["parcelle concours"][0].Geometry, True)

# --- l'étendue de travail : le périmètre, et ce qu'on voit autour -----------
# Tout ce qui est plus loin ne se dessine ni en plan ni en 3D : le relevé
# couvre le coteau entier, et 12'000 points de courbes de niveau au-delà du
# cadre ne serviraient qu'à alourdir le fichier.
MARGE = 55.0
xs = [p[0] for p in PER]; ys = [p[1] for p in PER]
EXT = [min(xs)-MARGE, min(ys)-MARGE, max(xs)+MARGE, max(ys)+MARGE]

def dedans(p):
    return EXT[0] <= p[0] <= EXT[2] and EXT[1] <= p[1] <= EXT[3]
def garde(polys):
    return [p for p in polys if any(dedans(q) for q in p)]

par = garde(layer("parcelles", True))
rou = garde(layer("LRou"))
bat = garde(layer("batiments 2d v2", True))
enq = garde(layer("Batiments_mis_a_enquete", True))
foo = garde(layer("terrain de foot"))
mur = garde(layer("murets"))
esc = garde(layer("escaliers"))

# --- les bâtiments existants ont une HAUTEUR --------------------------------
# Le calque « batiments 3d » porte des solides : leur boîte englobante donne le
# pied et le faîte. On les rattache aux emprises 2D par le centre le plus
# proche — le relevé ne dit pas autrement lequel va avec lequel.
vol3d = []
for o in BY.get("batiments 3d", []):
    b = o.Geometry.GetBoundingBox()
    cx = ((b.Min.X + b.Max.X)/2 - X0)/100.0
    cy = ((b.Min.Y + b.Max.Y)/2 - Y0)/100.0
    vol3d.append((cx, cy, round(b.Min.Z/100.0, 2), round(b.Max.Z/100.0, 2)))

def hauteur(p):
    cx = sum(q[0] for q in p)/len(p); cy = sum(q[1] for q in p)/len(p)
    best, bd = None, 1e18
    for v in vol3d:
        d = (v[0]-cx)**2 + (v[1]-cy)**2
        if d < bd:
            bd, best = d, v
    if best is None or bd > 25*25:
        return None
    return [best[2], best[3]]
bath = [hauteur(p) for p in bat]

# --- les courbes de niveau, avec leur altitude ------------------------------
ctr = []
for o in BY.get("courbes de niveau 3d", []):
    g = o.Geometry
    if not isinstance(g, r.PolylineCurve):
        continue
    v = verts(g)
    if len(v) < 2:
        continue
    z = LZ(v[0])
    p = [L(q) for q in v]
    p = [p[0]] + [q for i, q in enumerate(p[1:], 1)
                  if abs(q[0]-p[i-1][0]) + abs(q[1]-p[i-1][1]) >= 0.3]
    if len(p) < 2 or not any(dedans(q) for q in p):
        continue
    ctr.append([z, p])
ctr.sort(key=lambda c: c[0])

# --- le terrain : une grille d'altitudes, lue dans les courbes --------------
# Le plan incliné qui servait jusqu'ici (z = a + bx + cy) tenait en trois
# nombres et se trompait de deux mètres au pied du coteau. Une grille au pas
# de quatre mètres, interpolée sur les huit points de courbe les plus proches,
# suit le terrain relevé — et un bâtiment posé dessus ne flotte plus.
PAS = 4.0
GX0, GY0 = math.floor(EXT[0]), math.floor(EXT[1])
NX = int(math.ceil((EXT[2]-GX0)/PAS)) + 1
NY = int(math.ceil((EXT[3]-GY0)/PAS)) + 1

src = []
for z, p in ctr:
    for q in p:
        src.append((q[0], q[1], z))
S = np.array(src, dtype=float)
print("points de courbe retenus :", len(S), "· niveaux :", len(set(c[0] for c in ctr)))

gx = GX0 + PAS*np.arange(NX)
gy = GY0 + PAS*np.arange(NY)
GX, GY = np.meshgrid(gx, gy, indexing="ij")
P = np.stack([GX.ravel(), GY.ravel()], axis=1)

K = 8
grid = np.empty(P.shape[0])
BLOC = 512
for i in range(0, P.shape[0], BLOC):
    ch = P[i:i+BLOC]
    d2 = ((ch[:, None, 0] - S[None, :, 0])**2 + (ch[:, None, 1] - S[None, :, 1])**2)
    idx = np.argpartition(d2, K, axis=1)[:, :K]
    dd = np.take_along_axis(d2, idx, axis=1)
    zz = S[idx, 2]
    w = 1.0/np.maximum(dd, 1e-4)
    grid[i:i+BLOC] = (w*zz).sum(axis=1)/w.sum(axis=1)
grid = grid.reshape(NX, NY)
ZG = [[round(float(grid[i][j]), 2) for j in range(NY)] for i in range(NX)]

# le plan incliné reste, comme repli et comme ordre de grandeur
A = np.stack([np.ones(len(S)), S[:, 0], S[:, 1]], axis=1)
coef, *_ = np.linalg.lstsq(A, S[:, 2], rcond=None)

SITE = {
    "per": PER,
    "z": [round(float(coef[0]), 3), round(float(coef[1]), 6), round(float(coef[2]), 6)],
    "ext": [round(v, 1) for v in EXT],
    "grid": {"x0": GX0, "y0": GY0, "pas": PAS, "nx": NX, "ny": NY, "z": ZG},
    "par": par, "rou": rou, "bat": bat, "bath": bath, "enq": enq,
    "foo": foo, "mur": mur, "esc": esc, "ctr": ctr,
}

aire = 0.0
for i in range(len(PER)-1):
    aire += PER[i][0]*PER[i+1][1] - PER[i+1][0]*PER[i][1]
aire = abs(aire)/2

HEAD = '''/* ============================================================================
   LE RELEVÉ DU GÉOMÈTRE — MESURES SEULEMENT, AUCUNE RÈGLE

   Ce fichier est ENGENDRÉ par `tools/extract-site.py` depuis `DOC/site_plan.3dm`,
   le relevé Rhino du concours. On ne le corrige pas à la main : on corrige le
   script, et on le rejoue.

   Le dessin est en MÈTRES, origine au coin sud-ouest du périmètre du concours.
   Le fichier Rhino, lui, est en centimètres et en coordonnées suisses LV95 ;
   la conversion vit dans le script et nulle part ailleurs.

     per   le périmètre du concours (%d m² au polygone ; 11'740 m² au règlement,
           qui ne compte pas les bords de route)
     ext   l'étendue dessinée : le périmètre et %d m autour. Le relevé couvre
           le coteau entier — au-delà du cadre, rien ne sert.
     grid  le TERRAIN, altitudes au pas de %g m, interpolées sur les courbes de
           niveau. Un plan incliné tenait en trois nombres et se trompait de
           deux mètres au pied du coteau ; `z` le garde comme repli.
     ctr   les courbes de niveau, [altitude, polyligne] — %d courbes
     bat   les emprises des bâtiments existants · bath leur [pied, faîte],
           lus dans les solides du calque « batiments 3d »
     par parcelles · rou routes · enq bâtiments mis à l'enquête ·
     foo terrain de foot · mur murets · esc escaliers

   Le fichier Rhino n'a PAS de calque d'arbres : ce qu'on ne relève pas ne
   s'invente pas ici.
   ========================================================================= */
''' % (round(aire), int(MARGE), PAS, len(ctr))

with open(OUT, "w", encoding="utf-8") as f:
    f.write(HEAD)
    f.write("export var SITE = " + json.dumps(SITE, separators=(",", ":")) + ";\n")
    f.write('''
export var NAPPE = 462.25;   /* msm — relevé du géomètre. Les distances d’implantation
                                 et la couverture de nappe sont des règles, pas des mesures :
                                 elles vivent dans src/data/rules.js. */
export var PER = SITE.per, PERAIRE = %d;
export var VANG = %.5f;   /* axe principal du périmètre : %.1f° */
''' % (round(aire), -0.10996, math.degrees(-0.10996)))

print("écrit :", OUT)
print("  périmètre", len(PER), "sommets ·", round(aire), "m²")
print("  grille", NX, "×", NY, "au pas de", PAS, "m")
print("  courbes", len(ctr), "· bâtiments", len(bat), "dont", sum(1 for h in bath if h), "cotés")
