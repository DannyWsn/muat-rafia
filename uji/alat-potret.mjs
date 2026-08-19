/* Potret akhir aplikasi yang sudah selesai, terang dan gelap, 360x640.
   Tema gelap ikut diperiksa karena pemilik atau operator bisa memakainya. */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SP = import.meta.dirname + '/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

const muat = (id, tgl, truk, pen, tuj, brg, harga, roll, per, oleh) => {
  const w = new Array(140).fill(null);
  for (let i = 0; i < roll; i++) w[i] = per;
  return { id, tanggal: tgl, noTruk: truk, penerima: pen, tujuan: tuj, barang: brg, harga,
           kendaraan: 'Truck', noSJ: '001', roll, tonase: roll * per, w, oleh };
};
const HIST = [
  muat('M1', '2026-08-19', 'K 1234 ABC', 'Bp. Rifai', 'Brebes', 'Rafia Kw 3', 11500, 100, 25, 'HP-A'),
  muat('M2', '2026-08-18', 'K 9876 XY', 'Toko Sumber Rejeki Makmur Jaya', 'Purwokerto', 'Rafia Kw 2', 12000, 50, 26, 'HP-A'),
  muat('M3', '2026-08-18', '', 'Bp. Slamet', 'Kudus', 'Rafia Kw 3', null, 12, 25, ''),
  muat('M4', '2026-08-17', 'K 4455 CD', 'Bp. Hartono', 'Semarang', 'Rafia Kw 3', 11500, 140, 25, 'HP-B'),
];
const KOP = { nama: 'WAVI RAFIA GRUP', al1: 'Jl. Raya Rembang - Blora KM 5',
              al2: 'Desa Sumberejo, Rembang', al3: 'Telp. 0812 3456 7890',
              kota: 'Rembang', bank: 'BCA', rek: '7835290611', an: 'Wahyu Tejo Sudarmawan' };
const PUSAT = { url: 'https://contoh/exec', kode: 'UJI', sejak: Date.now(), peran: 'pemilik' };

const PORT = 9300 + Math.floor(Math.random() * 80);
const profil = mkdtempSync(join(tmpdir(), 'potret-'));
const anak = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profil}`, '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let ws0, id = 0;
for (let i = 0; i < 80 && !ws0; i++) {
  try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    ws0 = j.find((x) => x.type === 'page')?.webSocketDebuggerUrl; } catch {}
  if (!ws0) await tidur(250);
}
const ws = new WebSocket(ws0);
await new Promise((r) => ws.addEventListener('open', r));
const t = new Map();
ws.addEventListener('message', (e) => { const p = JSON.parse(e.data);
  if (p.id && t.has(p.id)) { t.get(p.id)(p); t.delete(p.id); } });
const kirim = (m, params = {}) => new Promise((res, rej) => { const i = ++id;
  t.set(i, (p) => (p.error ? rej(new Error(JSON.stringify(p.error))) : res(p.result)));
  ws.send(JSON.stringify({ id: i, method: m, params })); });
await kirim('Page.enable'); await kirim('Runtime.enable');
const ev = async (e) => { const r = await kirim('Runtime.evaluate',
  { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
  return r.result.value; };

await kirim('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
await kirim('Page.navigate', { url: 'file:///D:/muat-rafia/index.html' });
await tidur(2400);
await ev(`(function(){
  localStorage.setItem('wavi_muat_hist_v1', ${JSON.stringify(JSON.stringify(HIST))});
  localStorage.setItem('wavi_muat_pusat_v1', ${JSON.stringify(JSON.stringify(PUSAT))});
  localStorage.setItem('wavi_muat_kop_v1', ${JSON.stringify(JSON.stringify(KOP))});
  return 1; })()`);

for (const tema of ['light', 'dark']) {
  await kirim('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: tema }] });
  await kirim('Page.reload');
  await tidur(2400);

  await ev(`document.getElementById('tab-hist').click()`);
  await tidur(700);
  let png = await kirim('Page.captureScreenshot', { format: 'png' });
  writeFileSync(SP + `akhir-${tema}-histori.png`, Buffer.from(png.data, 'base64'));

  await ev(`document.getElementById('tab-set').click()`);
  await tidur(600);
  png = await kirim('Page.captureScreenshot', { format: 'png' });
  writeFileSync(SP + `akhir-${tema}-pengaturan.png`, Buffer.from(png.data, 'base64'));

  await ev(`document.querySelector('[data-panel="set-profil"]').click()`);
  await tidur(600);
  png = await kirim('Page.captureScreenshot', { format: 'png' });
  writeFileSync(SP + `akhir-${tema}-profil.png`, Buffer.from(png.data, 'base64'));

  /* pemeriksaan kontras kasar: tulisan tidak boleh sewarna latarnya */
  const warna = await ev(`(function(){
    var amb = function(sel, prop){ var e=document.querySelector(sel);
      return e ? getComputedStyle(e)[prop||'color'] : 'tidak ada'; };
    return {
      body: amb('body','backgroundColor'),
      barisTul: amb('.s-tul b'),
      pratinjauLatar: amb('.s-pra','backgroundColor'),
      pratinjauTul: amb('.s-pra-t b')
    };
  })()`);
  console.log(tema + ': ' + JSON.stringify(warna));
}
console.log('potret akhir selesai');
try { anak.kill(); } catch {}
