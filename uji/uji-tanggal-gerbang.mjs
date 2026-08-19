/* MEMBUKTIKAN perbaikan tanggal lewat JALUR SINKRON SUNGGUHAN.

   Pusat tiruan dipaksa menjawab dengan tanggal bentuk Google Sheets - persis
   seperti pusat sungguhan menjawab - lalu aplikasi disinkronkan seperti biasa.
   Yang diperiksa: tanggal tersimpan sebagai YYYY-MM-DD, kartu menampilkannya,
   kelompok tanggal benar, kotak Tanggal terisi saat muat dibuka, dan nama
   berkas PDF memakai tanggal MUAT - bukan tanggal hari ini. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const AKAR = 'D:/muat-rafia';
const KODE = 'uji-kode';
const UNDUH = mkdtempSync(join(tmpdir(), 'tglok-'));

/* dua bentuk tanggal yang benar-benar mungkin datang dari Spreadsheet */
const w = new Array(140).fill(null);
for (let i = 0; i < 10; i++) w[i] = 25;
const DARI_PUSAT = [
  { id: 'MA', tanggal: 'Tue Aug 18 2026 00:00:00 GMT+0700 (Waktu Indonesia Barat)',
    noTruk: 'K 8138 HS', penerima: 'Bp.Rudy', tujuan: 'Brebes', barang: 'Rafia Kw 3',
    harga: 11500, kendaraan: 'Truck', noSJ: '001', roll: 10, tonase: 250, w,
    diubah: Date.now() - 5000, dihapus: 0, oleh: 'HP-LAIN' },
  { id: 'MB', tanggal: '2026-08-19', noTruk: 'K 1234 ABC', penerima: 'Bp. Rifai',
    tujuan: 'Kudus', barang: 'Rafia Kw 2', harga: 12000, kendaraan: 'Truck',
    noSJ: '002', roll: 10, tonase: 260, w,
    diubah: Date.now() - 4000, dihapus: 0, oleh: 'HP-LAIN' },
];

/* ---------- pusat tiruan yang menjawab seperti Google ---------- */
const JENIS = { '.html': 'text/html', '.js': 'text/javascript',
                '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1:8877');
  if (u.pathname === '/api') {
    let body = '';
    for await (const c of req) body += c;
    const minta = JSON.parse(body || '{}');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    if (minta.kode !== KODE) return res.end(JSON.stringify({ ok: false, pesan: 'Kode Pabrik salah' }));
    return res.end(JSON.stringify({ ok: true, peran: 'pemilik', ditolak: [],
      muat: DARI_PUSAT, waktu: Date.now() }));
  }
  const nama = u.pathname === '/' ? '/index.html' : u.pathname;
  try {
    const { readFileSync, existsSync } = await import('node:fs');
    const p = join(AKAR, nama);
    if (!existsSync(p)) { res.writeHead(404); return res.end('tidak ada'); }
    const ext = nama.slice(nama.lastIndexOf('.'));
    res.writeHead(200, { 'Content-Type': JENIS[ext] || 'application/octet-stream' });
    res.end(readFileSync(p));
  } catch { res.writeHead(500); res.end('galat'); }
});
await new Promise((r) => srv.listen(8877, r));

/* ---------- Chrome ---------- */
const PORT = 9150 + Math.floor(Math.random() * 40);
const profil = mkdtempSync(join(tmpdir(), 'tglok-p-'));
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
await kirim('Page.navigate', { url: 'http://127.0.0.1:8877/index.html' });
await tidur(2600);
await ev(`(function(){
  localStorage.setItem('wavi_muat_kop_v1', JSON.stringify({nama:'WAVI RAFIA GRUP',
    al1:'Jl. Raya', al2:'Rembang', al3:'Telp', kota:'Rembang', bank:'BCA', rek:'1', an:'x'}));
  return 1; })()`);
await kirim('Page.reload');
await tidur(2600);

/* sambungkan ke pusat tiruan lewat layar Pengaturan, seperti pemakai */
await ev(`document.getElementById('tab-set').click()`);
await tidur(500);
await ev(`document.querySelector('[data-panel="set-pusat"]').click()`);
await tidur(500);
await ev(`(function(){
  function isi(id,v){var e=document.getElementById(id);e.value=v;
    e.dispatchEvent(new Event('input',{bubbles:true}));
    e.dispatchEvent(new Event('change',{bubbles:true}));
    e.dispatchEvent(new Event('blur',{bubbles:true}));}
  isi('s-url','http://127.0.0.1:8877/api');
  isi('s-kode',${JSON.stringify(KODE)});
  return 1; })()`);
await tidur(600);
await ev(`document.getElementById('b-sinkron').click()`);
await tidur(2600);

const simpan = await ev(`(function(){
  var l = JSON.parse(localStorage.getItem('wavi_muat_hist_v1')||'[]');
  return l.map(function(x){ return {id:x.id, tanggal:x.tanggal}; });
})()`);
cek('tanggal dari pusat tersimpan sebagai YYYY-MM-DD',
    simpan.length === 2 && simpan.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.tanggal)),
    JSON.stringify(simpan));
cek('tanggalnya benar 18 Agustus, tidak bergeser sehari',
    !!simpan.find((x) => x.id === 'MA' && x.tanggal === '2026-08-18'),
    (simpan.find((x) => x.id === 'MA') || {}).tanggal);

await ev(`document.getElementById('tab-hist').click()`);
await tidur(800);
const kartu = await ev(`(function(){
  var r = [].slice.call(document.querySelectorAll('.hrec'))
            .filter(function(x){ return /8138/.test(x.textContent); })[0];
  return {
    tgl: (r.querySelector('.hr-tgl')||{textContent:''}).textContent.trim(),
    grup: [].slice.call(document.querySelectorAll('.hgrup b')).map(function(g){ return g.textContent.trim(); }),
    urut: [].slice.call(document.querySelectorAll('.hrec .hr-truk')).map(function(x){ return x.textContent.trim(); })
  };
})()`);
cek('tanggal tampil di kartu', kartu.tgl === '18/08/2026', '"' + kartu.tgl + '"');
cek('kelompok tanggal benar, bukan "Tanpa tanggal"',
    kartu.grup.length === 2 && !kartu.grup.some((g) => /Tanpa tanggal/.test(g)),
    kartu.grup.join(' | '));
cek('urutan daftar: tanggal terbaru di atas',
    kartu.urut[0] === 'K 1234 ABC' && kartu.urut[1] === 'K 8138 HS',
    kartu.urut.join(' , '));

/* buka muat itu: kotak Tanggal harus terisi */
await ev(`(function(){
  var r = [].slice.call(document.querySelectorAll('.hrec'))
            .filter(function(x){ return /8138/.test(x.textContent); })[0];
  r.querySelector('[data-act="buka"]').click(); return 1; })()`);
await tidur(1300);
const kotak = await ev(`document.getElementById('i-tanggal').value`);
cek('kotak Tanggal terisi saat muat dibuka', kotak === '2026-08-18', '"' + kotak + '"');

/* nama berkas harus memakai tanggal MUAT */
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
cek('nama berkas memakai tanggal MUAT (18-08-2026), bukan hari ini',
    berkas[0] === 'Bp-Rudy-18-08-2026-Nota.pdf', berkas[0] || '(tidak terunduh)');

cek('tidak ada galat', galat.length === 0, galat.length ? galat.slice(0,2).join(' | ') : 'nol galat');

const gagal = hasil.filter((h) => !h.lulus);
console.log('\n' + (hasil.length - gagal.length) + '/' + hasil.length + ' pemeriksaan lulus');
try { anak.kill(); } catch {}
srv.close();
process.exit(gagal.length ? 1 : 0);
