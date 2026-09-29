/* ============================================================================
   FORENSICS — la planche du groupe, côté base

   Une planche par groupe, une ligne par élément (`public.board_item`) : une
   image, une note, un lien, ou une flèche qui en relie deux. Les images vivent
   dans le bucket privé `forensics`, sous le dossier de l'équipe ; la ligne n'en
   garde que le chemin, et l'on demande des URL signées pour les montrer.

   Le dernier qui écrit gagne, comme pour les réglages du groupe : deux
   personnes qui déplacent la même carte à la même seconde se le diront.

   Aucune vue ici : `views/forensics.js` dessine, ce module lit et écrit.
   ========================================================================= */
import { CPT } from "./compte.js";
import { deleteApi, insertApi, patchApi, selectApi, stockage, urlStockage } from "./supa.js";

var BUCKET = "forensics";
var CHAMPS = "id,team_id,author_id,kind,x,y,w,h,z,body,url,title,path,src,dst,created_at,updated_at";

export async function lirePlanche(){
  if(!CPT.equipe) return [];
  return await selectApi("board_item",
    "team_id=eq." + CPT.equipe.id + "&select=" + CHAMPS + "&order=z.asc,created_at.asc") || [];
}

export async function poser(item){
  var row = Object.assign({}, item, { team_id: CPT.equipe.id });
  delete row.id;
  var r = await insertApi("board_item", row);
  return r && r[0];
}

export async function modifier(id, champs){
  var r = await patchApi("board_item", "id=eq." + id, champs);
  return r && r[0];
}

/* Retirer une carte retire ses flèches (la base le fait, par cascade) et son
   image du stockage — sinon le bucket garderait des fichiers que plus rien ne
   montre. */
export async function retirer(item){
  await deleteApi("board_item", "id=eq." + item.id);
  if(item.path){
    try{ await stockage("object/" + BUCKET, { method:"DELETE", body:{ prefixes:[item.path] } }); }
    catch(_){ /* le fichier restera ; la carte, elle, est partie */ }
  }
}

/* ---------- les images ---------- */
var EXT = { "image/png":"png", "image/jpeg":"jpg", "image/webp":"webp", "image/gif":"gif",
            "image/svg+xml":"svg", "image/avif":"avif" };
export var MAX_OCTETS = 10 * 1024 * 1024;
export function imageAdmise(f){ return !!(f && EXT[f.type]); }

/* Un nom de fichier, pas un tirage : il n'a rien à voir avec la seed, donc
   rien à faire dans `core/rand.js`. */
function uuid(){
  if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
  var b = crypto.getRandomValues(new Uint8Array(16)), h = "";
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  for(var i = 0; i < 16; i++) h += (b[i] + 256).toString(16).slice(1) + ([3, 5, 7, 9].indexOf(i) >= 0 ? "-" : "");
  return h;
}

/* Le chemin commence par l'équipe : c'est ce que la règle du stockage lit. */
export async function televerser(fichier){
  if(!CPT.equipe) throw new Error("aucun groupe");
  if(!imageAdmise(fichier)) throw new Error("Seules les images passent : PNG, JPEG, WebP, GIF, SVG ou AVIF.");
  if(fichier.size > MAX_OCTETS) throw new Error("Image trop lourde : 10 Mo au plus.");
  var path = CPT.equipe.id + "/" + uuid() + "." + EXT[fichier.type];
  await stockage("object/" + BUCKET + "/" + path, { method:"POST", body:fichier });
  return path;
}

/* Des URL signées, en une requête pour toute la planche. Elles durent une
   journée ; la vue les redemande en rouvrant l'onglet. */
var SIGNEES = {};
export function urlDe(path){ return SIGNEES[path] || ""; }
export async function signer(paths){
  var neufs = paths.filter(function(p){ return p && !SIGNEES[p]; });
  if(!neufs.length) return;
  var l = await stockage("object/sign/" + BUCKET, { method:"POST", body:{ expiresIn: 86400, paths: neufs } });
  (l || []).forEach(function(x){
    if(x && x.signedURL && x.path) SIGNEES[x.path] = urlStockage(x.signedURL);
  });
}
export function oublierSignatures(){ SIGNEES = {}; }
