/* MEMBUKTIKAN Tahap 7.
   1. Pusat tiruan mengirim tanggal yang TIDAK TERBACA ("besok") untuk muat
      yang di HP tanggalnya sudah benar -> yang lokal harus dipertahankan.
      Ditambah kasus muat BARU bertanggal tidak terbaca -> kosong, tidak
      boleh mengarang.
   2. Mencetak muat tanpa tanggal harus memberi peringatan lebih dulu, dan
      peringatan tanggal + harga muncul dalam SATU dialog. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const AKAR = 'D:/muat-rafia';
const KODE = 'uji-kode';
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

const w = new Array(140).fill(null);
for (let i = 0; i < 10; i++) w[i] = 25;
const dasar = { noTruk: 'K 1 A', penerima: 'Bp. Rifai', tujuan: 'Brebes', barang: 'Rafia Kw 3',
                harga: 11500, kendaraan: 'Truck', noSJ: '001', roll: 10, tonase: 250, w,
                dihapus: 0, oleh: 'HP-LAIN' };
/* MLOKAL sudah ada di HP dengan tanggal benar; pusat mengirimnya lagi dengan
   tanggal hasil ketikan tangan yang tidak bisa dibaca */
const DARI_PUSAT = [
  Object.assign({}, dasar, { id: 'MLOKAL', tanggal: 'besok', diubah: Date.now() }),
  Object.assign({}, dasar, { id: 'MBARU', tanggal: '18 agst', diubah: Date.now(),
                             noTruk: 'K 2 B', penerima: 'Bp. Slamet' }),
];
const DI_HP = [{ id: 'MLOKAL', tanggal: '2026-08-18', noTruk: 'K 1 A', penerima: 'Bp. Rifai',
                 tujuan: 'Brebes', barang: 'Rafia Kw 3', harga: 11500, kendaraan: 'Truck',
                 noSJ: '001', roll: 10, tonase: 250, w, diubah: Date.now() - 90000, oleh: 'HP-LAIN' }];

const JENIS = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png',
                '.webmanifest': 'application/manifest+json', '.mjs': 'text/javascript' };
const srv = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1:8878');
  if (u.pathname === '/api') {
    let body = ''; for await (const c of req) body += c;
    const minta = JSON.parse(body || '{}');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (minta.kode !== KODE) return res.end(JSON.stringify({ ok: false, pesan: 'Kode Pabrik salah' }));
    return res.end(JSON.stringify({ ok: true, peran: 'pemilik', ditolak: [], muat: DARI_PUSAT, waktu: Date.now() }));
  }
  const nama = u.pathname === '/' ? '/index.html' : u.pathname;
  const p = join(AKAR, nama);
  if (!existsSync(p)) { res.writeHead(404); return res.end('tidak ada'); }
  res.writeHead(200, { 'Content-Type': JENIS[nama.slice(nama.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8878, r));

const PORT = 9020 + Math.floor(Math.random() * 20);
const profil = mkdtempSync(join(tmpdir(), 'uji7-'));
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
const ev = async (e) => { const r = await kirim('Runtime.evaluate',
  { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
  return r.result.value; };

const hasil = [];
const cek = (nama, lulus, bukti) => { hasil.push({ nama, lulus });
  console.log((lulus ? '  LULUS ' : '  GAGAL ') + nama + '  ->  ' + bukti); };

await kirim('Emulation.setDeviceMetricsOverride', { width: 360, height: 700, deviceScaleFactor: 2, mobile: true });
await kirim('Page.navigate', { url: 'http://127.0.0.1:8878/index.html' });
await tidur(2500);
await ev(`(function(){
  localStorage.setItem('wavi_muat_hist_v1', ${JSON.stringify(JSON.stringify(DI_HP))});
  localStorage.setItem('wavi_muat_kop_v1', JSON.stringify({nama:'WAVI RAFIA GRUP',
    al1:'Jl. Raya', al2:'Rembang', al3:'Telp', kota:'Rembang', bank:'BCA', rek:'1', an:'x'}));
  return 1; })()`);
await kirim('Page.reload');
await tidur(2600);

/* sambungkan lalu sinkron */
await ev(`document.getElementById('tab-set').click()`); await tidur(400);
await ev(`document.querySelector('[data-panel="set-pusat"]').click()`); await tidur(400);
await ev(`(function(){
  function isi(id,v){var e=document.getElementById(id);e.value=v;
    e.dispatchEvent(new Event('input',{bubbles:true}));
    e.dispatchEvent(new Event('blur',{bubbles:true}));}
  isi('s-url','http://127.0.0.1:8878/api'); isi('s-kode',${JSON.stringify(KODE)});
  return 1; })()`);
await tidur(500);
await ev(`document.getElementById('b-sinkron').click()`);
await tidur(2600);

const simpan = await ev(`(function(){
  var l = JSON.parse(localStorage.getItem('wavi_muat_hist_v1')||'[]');
  var p = {}; l.forEach(function(x){ p[x.id] = x.tanggal; }); return p; })()`);
cek('tanggal lokal yang benar DIPERTAHANKAN walau kiriman tidak terbaca',
    simpan.MLOKAL === '2026-08-18', 'MLOKAL = "' + simpan.MLOKAL + '"');
cek('muat baru bertanggal tidak terbaca jadi kosong, bukan dikarang',
    simpan.MBARU === '', 'MBARU = "' + simpan.MBARU + '"');

/* ---------- peringatan sebelum cetak ---------- */
await ev(`document.getElementById('tab-hist').click()`); await tidur(700);
await ev(`(function(){
  var r = [].slice.call(document.querySelectorAll('.hrec'))
            .filter(function(x){ return /K 2 B/.test(x.textContent); })[0];
  r.querySelector('[data-act="buka"]').click(); return 1; })()`);
await tidur(1300);
const kotakTgl = await ev(`document.getElementById('i-tanggal').value`);
/* kotak Tanggal diisi hari ini oleh apply(), jadi dikosongkan dulu supaya
   yang diuji benar-benar keadaan "tanpa tanggal" */
await ev(`(function(){ var e=document.getElementById('i-tanggal'); e.value='';
  e.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`);
await tidur(500);
await ev(`document.getElementById('b-pdf').click()`);
await tidur(800);
await ev(`(function(){ var b=[].slice.call(document.querySelectorAll('.modal .aksi'));
  for(var i=0;i<b.length;i++) if(/^Surat Jalan saja/.test(b[i].textContent)){ b[i].click(); return 1; } return 0; })()`);
await tidur(900);
const per1 = await ev(`(function(){
  return { judul: document.getElementById('mo-judul').textContent,
           isi: document.getElementById('mo-isi').textContent.replace(/\\s+/g,' ').trim().slice(0,150) }; })()`);
cek('mencetak tanpa tanggal diperingatkan lebih dulu',
    /tercetak kosong/i.test(per1.judul) && /Tanggal belum diisi/.test(per1.isi),
    '"' + per1.judul + '" — ' + per1.isi.slice(0, 70));
cek('Surat Jalan tidak diperingatkan soal harga (tidak relevan)',
    !/Harga belum diisi/.test(per1.isi), 'isi hanya menyebut tanggal');
await ev(`(function(){ var b=document.querySelectorAll('.modal button');
  for(var i=0;i<b.length;i++) if(/Batal/.test(b[i].textContent)){ b[i].click(); break; } return 1; })()`);
await tidur(500);

/* Nota tanpa tanggal DAN tanpa harga -> satu dialog menyebut keduanya */
await ev(`(function(){
  function isi(id,v){var e=document.getElementById(id);e.value=v;
    e.dispatchEvent(new Event('input',{bubbles:true}));}
  isi('i-tanggal',''); isi('i-harga',''); return 1; })()`);
await tidur(500);
await ev(`document.getElementById('b-pdf').click()`); await tidur(800);
await ev(`(function(){ var b=[].slice.call(document.querySelectorAll('.modal .aksi'));
  for(var i=0;i<b.length;i++) if(/^Nota saja/.test(b[i].textContent)){ b[i].click(); return 1; } return 0; })()`);
await tidur(900);
const per2 = await ev(`(function(){
  var isi = document.getElementById('mo-isi').textContent;
  return { tgl: /Tanggal belum diisi/.test(isi), harga: /Harga belum diisi/.test(isi),
           jumlahDialog: document.querySelectorAll('.modal').length }; })()`);
cek('tanggal DAN harga kosong disebut dalam SATU dialog',
    per2.tgl && per2.harga && per2.jumlahDialog === 1,
    'tanggal=' + per2.tgl + ' harga=' + per2.harga + ' dialog=' + per2.jumlahDialog);
await ev(`(function(){ var b=document.querySelectorAll('.modal button');
  for(var i=0;i<b.length;i++) if(/Batal/.test(b[i].textContent)){ b[i].click(); break; } return 1; })()`);
await tidur(400);

/* yang LENGKAP tidak boleh diganggu peringatan */
await ev(`(function(){
  function isi(id,v){var e=document.getElementById(id);e.value=v;
    e.dispatchEvent(new Event('input',{bubbles:true}));}
  isi('i-tanggal','2026-08-19'); isi('i-harga','11500'); return 1; })()`);
await tidur(500);
await ev(`document.getElementById('b-pdf').click()`); await tidur(800);
await ev(`(function(){ var b=[].slice.call(document.querySelectorAll('.modal .aksi'));
  for(var i=0;i<b.length;i++) if(/^Nota saja/.test(b[i].textContent)){ b[i].click(); return 1; } return 0; })()`);
await tidur(1500);
const per3 = await ev(`(function(){
  return { judul: document.getElementById('mo-judul').textContent }; })()`);
cek('muat lengkap langsung ke pilihan simpan, tanpa peringatan',
    /siap$/.test(per3.judul.trim()), '"' + per3.judul + '"');

cek('tidak ada galat', galat.length === 0, galat.length ? galat.slice(0,2).join(' | ') : 'nol galat');

const gagal = hasil.filter((h) => !h.lulus);
console.log('\n' + (hasil.length - gagal.length) + '/' + hasil.length + ' pemeriksaan lulus');
try { anak.kill(); } catch {}
srv.close();
process.exit(gagal.length ? 1 : 0);
