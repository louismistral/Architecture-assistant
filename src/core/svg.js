/* ---------- svg ---------- */
export var NS = "http://www.w3.org/2000/svg";
export function s(tag, attrs){
  var e = document.createElementNS(NS, tag);
  for(var k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
export function wrapText(str, maxChars, maxLines){
  var words = str.split(/\s+/), lines = [], cur = "";
  for(var i = 0; i < words.length; i++){
    var t = cur ? cur + " " + words[i] : words[i];
    if(t.length > maxChars && cur){ lines.push(cur); cur = words[i]; }
    else cur = t;
    if(lines.length === maxLines - 1 && cur.length > maxChars){ cur = cur.slice(0, Math.max(1, maxChars - 1)) + "…"; break; }
  }
  if(cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

