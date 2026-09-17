export function fmt(n){
  var s = (Math.round(n*10)/10).toString().split(".");
  return s[0].replace(/\B(?=(\d{3})+(?!\d))/g,"’") + (s[1] ? "." + s[1] : "");
}
export function el(tag, cls, txt){
  var e = document.createElement(tag);
  if(cls) e.className = cls;
  if(txt != null) e.textContent = txt;
  return e;
}

export function slug(t){
  return t.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()
          .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,26);
}
/* Virgule décimale. « Marge sur la nappe » affichait « 3.42 m » avec un point,
   et son propre sous-texte, deux lignes plus bas dans le même bloc, écrivait
   « il faut 3,00 m » avec une virgule. */
export function dec(n, k){ return n.toFixed(k == null ? 2 : k).replace(".", ","); }
export function r2(n){ return Math.round(n * 100) / 100; }
export function dim(n){
  return (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/,"").replace(".", ",");
}
