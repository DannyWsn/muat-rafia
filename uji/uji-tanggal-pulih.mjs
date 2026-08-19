/* MEMBUKTIKAN penyembuhan muat yang tanggalnya SUDAH rusak di HP.

   Keadaan awal dibuat persis seperti HP pemilik sekarang: histori berisi muat
   dengan tanggal bentuk Google Sheets, ditambah satu muat yang tanggalnya
   memang kosong (harus dibiarkan kosong, bukan ditebak), dan satu yang sudah
   benar (tidak boleh ikut diubah). Lalu aplikasi dibuka seperti biasa. */
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SP = import.meta.dirname + '/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const UNDUH = mkdtempSync(join(tmpdir(), 'sembuh-'));

const w = new Array(140).fill(null);
for (let i = 0; i < 10; i++) w[i] = 25;
const HIST = [
  { id: 'MR1', tanggal: 'Tue Aug 18 2026 00:00:00 GMT+0700 (Waktu Indonesia Barat)',
    noTruk: 'K 8138 HS', penerima: 'Bp.Rudy', tujuan: 'Brebes', barang: 'Rafia Kw 3',
    harga: 11500, kendaraan: 'Truck', noSJ: '001', roll: 10, tonase: 250, w, oleh: 'HP-A' },
  { id: 'MR2', tanggal: 'Wed Aug 19 2026 00:00:00 GMT+0700 (Waktu Indonesia Barat)',
    noTruk: 'K 1234 ABC', penerima: 'Bp. Rifai', tujuan: 'Kudus', barang: 'Rafia Kw 2',
    harga: 12000, kendaraan: 'Truck', noSJ: '002', roll: 10, tonase: 260, w, oleh: 'HP-A' },
  { id: 'MOK', tanggal: '2026-08-17', noTruk: 'K 4455 CD', penerima: 'Bp. Hartono',
    tujuan: 'Semarang', barang: 'Rafia Kw 3', harga: 11500, kendaraan: 'Truck',
    noSJ: '003', roll: 10, tonase: 250, w, oleh: 'HP-A' },
  { id: 'MKOSONG', tanggal: '', noTruk: 'K 7788 EF', penerima: 'Bp. Slamet',
    tujuan: 'Pati', barang: 'Rafia Kw 3', harga: null, kendaraan: 'Truck',
    noSJ: '', roll: 10, tonase: 250, w, oleh: 'HP-A' },
];

const PORT = 9050 + Math.floor(Math.random() * 40);
const profil = mkdtempSync(join(tmpdir(), 'sembuh-p-'));
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
const t = new Map(); const galat = [];
ws.addEventListener('message', (e) => { const p = JSON.parse(e.data);
  if (p.id && t.has(p.id)) { t.get(p.id)(p); t.delete(p.id); return; }
  if (p.method === 'Runtime.exceptionThrown') galat.push(p.params.exceptionDetails.exception?.description || '?'); });
const kirim = (m, params = {}) => new Promise((res, rej) => { const i = ++id;
  t.set(i, (p) => (p.error ? rej(new Error(JSON.stringify(p.error))) : res(p.result)));
  ws.send(JSON.stringify({ id: i, method: m, params })); });
await kirim('Page.enable'); await kirim('Runtime.enable');
await kirim('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH });
const ev = async (e) => { const r = await kirim('Runtime.evaluate',
  { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
  return r.result.value; };

const hasil = [];
const cek = (nama, lulus, bukti) => { hasil.push({ nama, lulus });
  console.log((lulus ? '  LULUS ' : '  GAGAL ') + nama + '  ->  ' + bukti); };

await kirim('Emulation.setDeviceMetricsOverride', { width: 360, height: 700, deviceScaleFactor: 2, mobile: true });
await kirim('Page.navigate', { url: 'file:///D:/muat-rafia/index.html' });
await tidur(2400);
await ev(`(function(){
  localStorage.setItem('wavi_muat_hist_v1', ${JSON.stringify(JSON.stringify(HIST))});
  localStorage.setItem('wavi_muat_kop_v1', JSON.stringify({nama:'WAVI RAFIA GRUP',
    al1:'Jl. Raya', al2:'Rembang', al3:'Telp', kota:'Rembang', bank:'BCA', rek:'1', an:'x'}));
  return 1; })()`);

/* aplikasi dibuka seperti biasa - tidak ada tombol khusus yang ditekan */
await kirim('Page.reload');
await tidur(2600);

const simpan = await ev(`(function(){
  return JSON.parse(localStorage.getItem('wavi_muat_hist_v1')).map(function(x){
    return x.id + '=' + x.tanggal; }); })()`);
cek('tanggal rusak dipulihkan tanpa pemakai melakukan apa pun',
    simpan.indexOf('MR1=2026-08-18') >= 0 && simpan.indexOf('MR2=2026-08-19') >= 0,
    simpan.join(' , '));
cek('tanggal yang sudah benar TIDAK ikut diubah', simpan.indexOf('MOK=2026-08-17') >= 0,
    simpan.find((x) => x.startsWith('MOK')) || '?');
cek('tanggal kosong dibiarkan kosong, tidak ditebak', simpan.indexOf('MKOSONG=') >= 0,
    simpan.find((x) => x.startsWith('MKOSONG')) || '?');

await ev(`document.getElementById('tab-hist').click()`);
await tidur(800);
const tampil = await ev(`(function(){
  return {
    grup: [].slice.call(document.querySelectorAll('.hgrup b')).map(function(g){ return g.textContent.trim(); }),
    tglKartu: [].slice.call(document.querySelectorAll('.hrec')).map(function(r){
      return (r.querySelector('.hr-truk')||{textContent:''}).textContent.trim() + ':' +
             (r.querySelector('.hr-tgl')||{textContent:''}).textContent.trim(); })
  };
})()`);
cek('tidak ada lagi "Tanpa tanggal" untuk muat yang tanggalnya bisa dipulihkan',
    tampil.grup.filter((g) => /Tanpa tanggal/.test(g)).length === 1,
    tampil.grup.join(' | ') + '   (satu-satunya "Tanpa tanggal" = muat yang memang tanpa tanggal)');
cek('tanggal tampil di kartu', tampil.tglKartu.some((x) => /18\/08\/2026/.test(x)),
    tampil.tglKartu.join(' , '));

/* muat yang dipulihkan dibuka: kotak Tanggal harus terisi, dan PDF harus bertanggal benar */
await ev(`(function(){
  var r = [].slice.call(document.querySelectorAll('.hrec'))
            .filter(function(x){ return /8138/.test(x.textContent); })[0];
  r.querySelector('[data-act="buka"]').click(); return 1; })()`);
await tidur(1300);
const kotak = await ev(`document.getElementById('i-tanggal').value`);
cek('kotak Tanggal terisi saat muat dibuka', kotak === '2026-08-18', '"' + kotak + '"');

rmSync(UNDUH, { recursive: true, force: true }); mkdirSync(UNDUH, { recursive: true });
await kirim('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH });
await ev(`document.getElementById('b-pdf').click()`);
await tidur(900);
await ev(`(function(){ var b=[].slice.call(document.querySelectorAll('.modal .aksi'));
  for(var i=0;i<b.length;i++) if(/^Nota saja/.test(b[i].textContent)){ b[i].click(); return 1; } return 0; })()`);
await tidur(1700);
await ev(`(function(){ var b=[].slice.call(document.querySelectorAll('.modal .aksi'));
  for(var i=0;i<b.length;i++) if(/^Unduh ke folder/.test(b[i].textContent)){ b[i].click(); return 1; } return 0; })()`);
await tidur(1700);
let berkas = [];
for (let i = 0; i < 25 && !berkas.length; i++) {
  berkas = readdirSync(UNDUH).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (!berkas.length) await tidur(300);
}
cek('nama berkas memakai tanggal muat yang sudah pulih',
    berkas[0] === 'Bp-Rudy-18-08-2026-Nota.pdf', berkas[0] || '(tidak terunduh)');
if (berkas[0]) writeFileSync(SP + "nota-tanggal-pulih.pdf", readFileSync(join(UNDUH, berkas[0])));

/* dibuka lagi: tidak boleh menulis ulang terus-terusan */
await kirim('Page.reload');
await tidur(2600);
cek('tidak ada galat', galat.length === 0, galat.length ? galat.slice(0,2).join(' | ') : 'nol galat');

const gagal = hasil.filter((h) => !h.lulus);
console.log('\n' + (hasil.length - gagal.length) + '/' + hasil.length + ' pemeriksaan lulus');
try { anak.kill(); } catch {}
process.exit(gagal.length ? 1 : 0);
