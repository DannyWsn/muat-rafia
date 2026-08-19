/* Penyimpan luring Kalkulator Muat Rafia.
   Aplikasi disimpan di HP saat pertama dibuka, lalu berjalan penuh tanpa internet.
   Naikkan angka VERSI setiap kali aplikasi diperbarui. */
var VERSI = "v18";
var CACHE = "muat-rafia-" + VERSI;
var ASET = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(ASET); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(kunci){
      return Promise.all(kunci.map(function(k){
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  if(e.request.url.indexOf("http") !== 0) return;

  e.respondWith(
    caches.match(e.request).then(function(tersimpan){
      if(tersimpan){
        /* pakai salinan lokal dulu supaya cepat, lalu segarkan diam-diam */
        fetch(e.request).then(function(res){
          if(res && res.ok){
            caches.open(CACHE).then(function(c){ c.put(e.request, res); });
          }
        }).catch(function(){});
        return tersimpan;
      }
      return fetch(e.request).then(function(res){
        if(res && res.ok){
          var salinan = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, salinan); });
        }
        return res;
      }).catch(function(){
        return caches.match("./index.html");
      });
    })
  );
});
