/* ============================================================================
   TOUJOURS LA DERNIÈRE VERSION PUBLIÉE

   Le site n'a pas de build : ses modules s'appellent sans numéro de version,
   et le navigateur gardait jusqu'à dix minutes les anciens — un changement
   publié ne se voyait pas, ou à moitié (un module neuf qui en appelle un
   vieux). Ce service worker redemande chaque fichier du site au serveur
   (`no-cache` : un 304 sans corps s'il n'a pas changé). Le reste — la base,
   les polices — passe sans lui.
   ========================================================================= */
self.addEventListener("install", function(){ self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function(e){
  var r = e.request;
  if(r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r.url, { cache:"no-cache", credentials:"same-origin" }));
});
