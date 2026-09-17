import { el } from "../core/format.js";
import { S } from "../core/geometry.js";
import { NS, s } from "../core/svg.js";
import { layout, sel, z } from "./editor.js";
import { OV, TRAY, curFl, wpos } from "./levels.js";
import { PLINK, RMAP } from "./rooms.js";

export var PART = 0.1;   /* épaisseur de cloison : jeu exact entre deux surfaces */
export var TOUCH = 0.15; /* une adjacence est tenue si les pièces ne sont séparées que par la cloison */
export function gapBetween(id1, id2){
  var A = layout[id1], B = layout[id2];
  var dx = Math.max(0, Math.max(A.x - (B.x + B.w), B.x - (A.x + A.w)));
  var dy = Math.max(0, Math.max(A.y - (B.y + B.h), B.y - (A.y + A.h)));
  return Math.sqrt(dx * dx + dy * dy);
}
export function edgePt(L, tx2, ty2){
  var cx = L.x + L.w / 2, cy = L.y + L.h / 2, dx = tx2 - cx, dy = ty2 - cy;
  if(!dx && !dy) return [cx, cy];
  var t = Math.min(dx ? (L.w / 2) / Math.abs(dx) : Infinity, dy ? (L.h / 2) / Math.abs(dy) : Infinity);
  return [cx + dx * t, cy + dy * t];
}
export var linksOn = true, linkSvg = null, linkCount = null, strayCount = null;
/* Le calque des liens et son compteur appartiennent à ce module : il les crée,
   le plan interactif se contente de les poser dans sa barre et dans le monde. */
export function mountLinkLayer(){
  linkSvg = document.createElementNS(NS, "svg");
  linkSvg.setAttribute("class", "linklayer");
  linkSvg.setAttribute("overflow", "visible");
  return linkSvg;
}
export function mountLinkCount(){ linkCount = el("span","linkcount",""); return linkCount; }
export function setStray(n){ strayCount = n; }

export function toggleLinks(){ linksOn = !linksOn; drawLinks(); return linksOn; }

export function drawLinks(){
  if(!linkSvg) return;
  while(linkSvg.firstChild) linkSvg.removeChild(linkSvg.firstChild);
  linkSvg.style.display = linksOn ? "block" : "none";
  var okN = 0, cut = 0, pend = 0;
  PLINK.forEach(function(l){
    var A = layout[l.a], B = layout[l.b];
    if(!A || !B) return;
    var fa = RMAP[l.a].fl, fb = RMAP[l.b].fl;
    if(fa === TRAY || fb === TRAY){ pend++; return; }
    var g = gapBetween(l.a, l.b), ok = (fa === fb) && g <= TOUCH;
    if(ok) okN++;
    if(fa !== fb) cut++;
    if(!linksOn) return;
    if(!OV && (fa !== curFl || fb !== curFl)) return;
    A = wpos(l.a); B = wpos(l.b);
    var p1 = edgePt(A, B.x + B.w / 2, B.y + B.h / 2), p2 = edgePt(B, A.x + A.w / 2, A.y + A.h / 2);
    var split = fa !== fb;
    var ln = s("line", { x1: p1[0] * S, y1: p1[1] * S, x2: p2[0] * S, y2: p2[1] * S,
      stroke: "var(--danger)", "stroke-width": split ? 2.4 : (ok ? 1.2 : 2), "stroke-linecap": "round",
      "stroke-opacity": split ? 0.95 : (ok ? 0.3 : (sel && (l.a === sel || l.b === sel) ? 1 : 0.6)),
      "vector-effect": "non-scaling-stroke" });
    if(l.opt) ln.setAttribute("stroke-dasharray", "6 5");
    else if(split) ln.setAttribute("stroke-dasharray", "9 6");
    linkSvg.appendChild(ln);
    if(split){
      var mx0 = (p1[0] + p2[0]) / 2 * S, my0 = (p1[1] + p2[1]) / 2 * S;
      var t0 = "lien coupé", f0 = 10 / z, w0 = (t0.length * 6.1 + 12) / z, h0 = 14.5 / z;
      linkSvg.appendChild(s("rect", { x: mx0 - w0 / 2, y: my0 - h0 / 2, width: w0, height: h0,
        rx: 2 / z, fill: "var(--danger)" }));
      var tt0 = s("text", { x: mx0, y: my0 + f0 * 0.35, "text-anchor": "middle",
        "font-size": f0, fill: "var(--on-fill)", "font-family": "'IBM Plex Mono', monospace" });
      tt0.textContent = t0;
      linkSvg.appendChild(tt0);
      return;
    }
    /* la cote n'est affichée que pour la pièce sélectionnée, sinon les étiquettes se chevauchent */
    if(!ok && g > 1.5 && sel && (l.a === sel || l.b === sel) && fa === fb){
      var mx = (p1[0] + p2[0]) / 2 * S, my = (p1[1] + p2[1]) / 2 * S;
      var txt = (Math.round(g * 10) / 10) + " m";
      var fsz = 10 / z, bw = (txt.length * 6.3 + 10) / z, bh = 14.5 / z;
      linkSvg.appendChild(s("rect", { x: mx - bw / 2, y: my - bh / 2, width: bw, height: bh,
        rx: 2 / z, fill: "var(--danger)" }));
      var t = s("text", { x: mx, y: my + fsz * 0.35, "text-anchor": "middle",
        "font-size": fsz, fill: "var(--on-fill)", "font-family": "'IBM Plex Mono', monospace" });
      t.textContent = txt;
      linkSvg.appendChild(t);
    }
  });
  if(linkCount){
    while(linkCount.firstChild) linkCount.removeChild(linkCount.firstChild);
    /* Le dénominateur était `PLINK.length - pend` : chaque pièce laissée au bac
       retirait son lien du total. Avec vingt pièces au bac, l'indicateur
       affichait donc « 14 / 14 adjacences satisfaites » — une fraction pleine et
       le mot « satisfaites » — au moment précis où le projet n'était pas posé,
       tout en se colorant en rouge, puisque la COULEUR, elle, comparait bien à
       `PLINK.length`. C'était le texte qui mentait. */
    var done = okN === PLINK.length && !pend && !cut;
    linkCount.appendChild(document.createTextNode(
      okN + " / " + PLINK.length + " adjacences" + (done ? " satisfaites" : "")
      + (pend ? "  ·  " + pend + " en attente au bac" : "")
      + (cut ? "  ·  " + cut + " coupée" + (cut > 1 ? "s" : "") + " par un niveau" : "")));
    linkCount.style.color = done ? "var(--ok)" : "var(--ink-2)";
    linkCount.classList.toggle("is-done", done);
  }
}



/* ================= ÉTAGES =================
   Chaque pièce porte un niveau. Le plan ne montre qu'un niveau à la fois, celui
   du dessous en transparence pour caler les superpositions. Les règles de niveau
   sont tirées du règlement : ce qui a besoin du terrain reste au rez, ce qui doit
   être attenant reste au même niveau que sa référence. */
/* Un niveau porte sa cote architecturale : 0 le rez, 1, 2… les étages, −1, −2… les sous-sols.
   L'indice dans FLOORS reste l'ordre d'empilement, du plus bas au plus haut ; c'est la cote,
   pas l'indice, que lisent les règles du règlement. */
