/* Membuat semua aset gambar dari logo ASLI di dalam MASTER RINCIAN MUATAN.xlsx
   (xl/media/image1.png, 569x493 RGBA) - jauh lebih tajam daripada logo JPEG
   yang sekarang tertanam di index.html, dan alpha-nya asli, bukan hasil
   mengeruk putih.

   Keluaran:
     logo-layar-<lebar>.png   logo tembus pandang untuk topbar aplikasi
     ikon-navy-<ukuran>.png   ikon aplikasi beralas biru tua (warna topbar)
     ikon-putih-<ukuran>.png  ikon aplikasi beralas putih
     ikon-maskable-512.png    ikon Android yang boleh dipotong bulat

   Semuanya diukur, dan hasilnya dilihat sendiri sebelum dipakai. */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SP = import.meta.dirname;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const SRC = readFileSync(join(SP, 'logo-excel.png')).toString('base64');

const PORT = 9950 + Math.floor(Math.random() * 40);
const profil = mkdtempSync(join(tmpdir(), 'aset-'));
const anak = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profil}`, '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let url, id = 0;
for (let i = 0; i < 80 && !url; i++) {
  try {
    const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    url = j.find((x) => x.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
  if (!url) await tidur(250);
}
const ws = new WebSocket(url);
await new Promise((r) => ws.addEventListener('open', r));
const t = new Map();
ws.addEventListener('message', (e) => {
  const p = JSON.parse(e.data);
  if (p.id && t.has(p.id)) { t.get(p.id)(p); t.delete(p.id); }
});
const kirim = (m, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  t.set(i, (p) => (p.error ? rej(new Error(JSON.stringify(p.error))) : res(p.result)));
  ws.send(JSON.stringify({ id: i, method: m, params }));
});
await kirim('Runtime.enable');
const ev = async (e) => {
  const r = await kirim('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
};

const hasil = await ev(`(async function(){
  var img = new Image();
  img.src = "data:image/png;base64," + ${JSON.stringify(SRC)};
  await img.decode();
  var W = img.naturalWidth, H = img.naturalHeight;
  var c = document.createElement('canvas'); c.width = W; c.height = H;
  var x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  var p = x.getImageData(0, 0, W, H).data;

  /* 1. PERIKSA: alpha-nya sungguh dipakai, atau semuanya 255 (alas putih)? */
  var nol = 0, penuh = 0, tengah = 0, putihPenuh = 0;
  for (var i = 0; i < W*H; i++) {
    var a = p[i*4+3];
    if (a === 0) nol++; else if (a === 255) penuh++; else tengah++;
    if (a === 255 && p[i*4] > 248 && p[i*4+1] > 248 && p[i*4+2] > 248) putihPenuh++;
  }
  var lap = {
    ukuran: W + 'x' + H,
    persenTembusPenuh: +(nol / (W*H) * 100).toFixed(1),
    persenSetengahTembus: +(tengah / (W*H) * 100).toFixed(1),
    persenPutihPekat: +(putihPenuh / (W*H) * 100).toFixed(1)
  };

  /* 2. potong pas ke lambang (alpha > 8) */
  var kiri = W, kanan = -1, atas = H, bawah = -1;
  for (var y = 0; y < H; y++) for (var xx = 0; xx < W; xx++) {
    if (p[(y*W + xx)*4 + 3] > 8) {
      if (xx < kiri) kiri = xx; if (xx > kanan) kanan = xx;
      if (y < atas) atas = y; if (y > bawah) bawah = y;
    }
  }
  var pw = kanan - kiri + 1, ph = bawah - atas + 1;
  lap.potong = pw + 'x' + ph;
  var pot = document.createElement('canvas'); pot.width = pw; pot.height = ph;
  pot.getContext('2d').drawImage(c, kiri, atas, pw, ph, 0, 0, pw, ph);

  var keluar = [];
  function simpan(nama, cv){ keluar.push({ nama: nama, png: cv.toDataURL('image/png').split(',')[1],
                                           ukuran: cv.width + 'x' + cv.height }); }
  function skala(lebar){
    var h2 = Math.round(lebar * ph / pw);
    var cv = document.createElement('canvas'); cv.width = lebar; cv.height = h2;
    var g = cv.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(pot, 0, 0, lebar, h2);
    return cv;
  }
  [96, 128, 160, 200].forEach(function(w2){ simpan('logo-layar-' + w2, skala(w2)); });

  /* 3. ikon aplikasi: lambang dipusatkan di kotak, dua pilihan alas.
        isiPersen = lebar lambang dibanding lebar ikon. */
  function ikon(sisi, alas, isiPersen, bulatMaskable){
    var cv = document.createElement('canvas'); cv.width = sisi; cv.height = sisi;
    var g = cv.getContext('2d');
    if (alas) { g.fillStyle = alas; g.fillRect(0, 0, sisi, sisi); }
    var lw = Math.round(sisi * isiPersen);
    var lh = Math.round(lw * ph / pw);
    if (lh > sisi * isiPersen) { lh = Math.round(sisi * isiPersen); lw = Math.round(lh * pw / ph); }
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(pot, Math.round((sisi - lw)/2), Math.round((sisi - lh)/2), lw, lh);
    return cv;
  }
  simpan('ikon-navy-192',  ikon(192, '#0C2340', 0.80, false));
  simpan('ikon-navy-512',  ikon(512, '#0C2340', 0.80, false));
  simpan('ikon-putih-192', ikon(192, '#FFFFFF', 0.86, false));
  simpan('ikon-putih-512', ikon(512, '#FFFFFF', 0.86, false));
  /* maskable: launcher boleh memotong sampai lingkaran 80%, jadi lambang
     dibuat lebih kecil supaya tulisan tepi tidak ikut terpotong */
  simpan('ikon-maskable-navy-512',  ikon(512, '#0C2340', 0.60, true));
  simpan('ikon-maskable-putih-512', ikon(512, '#FFFFFF', 0.62, true));

  return { lap: lap, keluar: keluar };
})()`);

console.log(JSON.stringify(hasil.lap, null, 2));
console.log('--- aset ---');
for (const k of hasil.keluar) {
  const buf = Buffer.from(k.png, 'base64');
  writeFileSync(join(SP, k.nama + '.png'), buf);
  console.log(`${k.nama.padEnd(26)} ${k.ukuran.padEnd(9)} ${(buf.length/1024).toFixed(1)} KB` +
              `  (base64 ${(buf.length*4/3/1024).toFixed(1)} KB)`);
}
try { anak.kill(); } catch {}
