import { el, fmt } from "../core/format.js";
import { ESTT, GRAND, PROG, VARITEMS } from "../core/model.js";
import { FAM } from "../data/families.js";

/* ---------- legend ---------- */
export function renderLegend(){
  var track = document.getElementById("legTrack"), key = document.getElementById("legKey");
  while(track.firstChild) track.removeChild(track.firstChild);
  while(key.firstChild) key.removeChild(key.firstChild);
  FAM.forEach(function(f){
    var seg = el("div","legend-seg");
    seg.style.flex = f.total + " 0 0";
    seg.style.background = "var(" + f.c + ")";
    seg.title = f.name + " — " + fmt(f.total) + " m²";
    track.appendChild(seg);

    var k = el("div","k");
    var sw = el("i","sw"); sw.style.background = "var(" + f.c + ")";
    k.appendChild(sw);
    var lb = el("div","lb"); lb.appendChild(document.createTextNode(f.name));
    lb.appendChild(el("i", null, f.d));
    k.appendChild(lb);
    k.appendChild(el("div","vl", fmt(f.total) + " m²"));
    key.appendChild(k);
  });
  var hp = document.getElementById("heroProg");
  if(hp){
    hp.textContent = fmt(PROG);
    hp.appendChild(el("span","u","m\u00b2"));
  }
  var he = document.getElementById("heroEst");
  if(he) he.textContent = "+ " + fmt(ESTT) + " m² à préciser (vestiaires, sanitaires, halls) = " + fmt(GRAND) + " m²";
  renderVarStrip();
}

export function renderVarStrip(){
  var box = document.getElementById("varStrip");
  if(!box) return;
  while(box.firstChild) box.removeChild(box.firstChild);
  var pending = VARITEMS.filter(function(it){ return !it.set; }).length;
  box.appendChild(el("h3", null, "Surfaces à préciser — " + VARITEMS.length + " postes"));
  box.appendChild(el("p", null,
    "Le règlement compte ces postes en nombre de pièces, ou les renvoie « selon projet », sans leur donner de m². "
    + "Les valeurs ci-dessous sont provisoires : sélectionne la pièce dans l'onglet Plan pour saisir la tienne, "
    + "et tous les totaux de la page suivent. Les postes que tu as fixés passent en vert."));
  var ul = el("ul");
  VARITEMS.forEach(function(it){
    var li = el("li", it.set ? "done" : null);
    li.appendChild(el("span", null, it.n + (it.nb > 1 ? " ×" + it.nb : "")));
    li.appendChild(el("b", null, fmt(it.tot) + " m²"));
    ul.appendChild(li);
  });
  box.appendChild(ul);
  var t = el("div","vtot");
  t.textContent = fmt(ESTT) + " m² provisoires · " + pending + " poste" + (pending > 1 ? "s" : "")
    + " encore à la valeur par défaut";
  box.appendChild(t);
}

