/* Dua HP sungguhan (dua Chrome terpisah, penyimpanan sendiri-sendiri):
   satu operator, satu pemilik. Semua lewat TOMBOL di layar.

   Yang dibuktikan:
     - saat muat selesai, pemakai DIBERI PILIHAN: HP saja, atau HP + pusat
     - pilihan "HP saja" benar-benar TIDAK terkirim ke pusat
     - muat "HP saja" masih bisa dikirim belakangan lewat tombol Kirim
     - histori jadi satu kebenaran di semua HP
     - operator tidak bisa menghapus
     - tanpa internet, menimbang tetap jalan dan terkirim belakangan */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const ALAMAT = 'http://127.0.0.1:8801/index.html';
const API = 'http://127.0.0.1:8801/api';
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

const TEKAN_SINKRON = "(function(){ document.getElementById('b-sinkron').click(); return true; })()";
const DAFTAR_TRUK = "JSON.parse(localStorage.getItem('wavi_muat_hist_v1')||'[]').map(function(m){return m.noTruk;}).sort()";
const JML_ANTRE = "JSON.parse(localStorage.getItem('wavi_muat_antre_v1')||'[]').length";
const PERAN = "(JSON.parse(localStorage.getItem('wavi_muat_pusat_v1')||'{}').peran||'')";

async function bukaHP(port) {
  const profil = mkdtempSync(join(tmpdir(), 'hp-'));
  const anak = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profil}`, '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let url;
  for (let i = 0; i < 60 && !url; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      url = j.find((x) => x.type === 'page')?.webSocketDebuggerUrl;
    } catch {}
    if (!url) await tidur(250);
  }
  const ws = new WebSocket(url);
  await new Promise((r) => ws.addEventListener('open', r));
  const tunggu = new Map();
  let id = 0;
  ws.addEventListener('message', (e) => {
    const p = JSON.parse(e.data);
    if (p.id && tunggu.has(p.id)) { tunggu.get(p.id)(p); tunggu.delete(p.id); }
  });
  const kirim = (m, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    tunggu.set(i, (p) => (p.error ? rej(new Error(JSON.stringify(p.error))) : res(p.result)));
    ws.send(JSON.stringify({ id: i, method: m, params }));
  });
  await kirim('Page.enable'); await kirim('Runtime.enable');
  const ev = async (ekspresi) => {
    const r = await kirim('Runtime.evaluate', { expression: ekspresi, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };
  const muat = async () => { await kirim('Page.navigate', { url: ALAMAT }); await tidur(2200); };
  return { ev, muat, tutup: () => { ws.close(); anak.kill(); } };
}

const atur = (kode) => `(function(){
  var u = document.getElementById('s-url');
  u.value = ${JSON.stringify(API)}; u.dispatchEvent(new Event('input',{bubbles:true}));
  var k = document.getElementById('s-kode');
  k.value = ${JSON.stringify(kode)}; k.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
})()`;

/* pilihan: 0 = "Kirim ke pusat", 1 = "Simpan di HP ini saja" */
const simpanMuat = (truk, penerima, pilihan) => `(async function(){
  /* Mulai muat baru dulu - kalau tidak, isian yang masih terbuka akan
     TERTIMPA, persis seperti kalau pemakai lupa menekan Baru. */
  document.getElementById('b-baru').click();
  await new Promise(function(r){ setTimeout(r, 350); });
  if(!document.getElementById('modal').hidden){
    var ya = document.getElementById('mo-ya');
    if(!ya.hidden) ya.click();
    else { var a = document.querySelector('#mo-aksi button'); if(a) a.click(); }
    await new Promise(function(r){ setTimeout(r, 350); });
  }
  function isi(id,v){var e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}
  var a=['100,00','90,50','80,25'];
  for(var i=0;i<a.length;i++){
    var td=document.querySelector('#tbl-wrap [data-cell="'+i+'"]');
    var inp=td?td.querySelector('input'):null; if(!inp) continue;
    inp.value=a[i]; inp.dispatchEvent(new Event('input',{bubbles:true}));
  }
  isi('i-truk', ${JSON.stringify(truk)});
  isi('i-penerima', ${JSON.stringify(penerima)});
  document.getElementById('b-simpan').click();
  await new Promise(function(r){ setTimeout(r, 500); });

  var tombol = [].slice.call(document.querySelectorAll('#mo-aksi button'));
  var pilihanAda = tombol.map(function(b){ return b.textContent.trim().split('Terlihat')[0].split('Tidak masuk')[0].trim(); });
  if(tombol.length) tombol[${pilihan}].click();
  await new Promise(function(r){ setTimeout(r, 1600); });
  return {pilihanAda: pilihanAda,
          jml: JSON.parse(localStorage.getItem('wavi_muat_hist_v1')||'[]').length,
          antre: JSON.parse(localStorage.getItem('wavi_muat_antre_v1')||'[]').length};
})()`;

const TANDA = (truk) => `(function(){
  var kartu = [].slice.call(document.querySelectorAll('.hrec'));
  var k = kartu.filter(function(x){ return x.textContent.indexOf(${JSON.stringify(truk)}) >= 0; })[0];
  if(!k) return 'kartu tidak ada';
  /* Yang sudah aman di pusat kini ditandai TITIK bertitel; yang perlu
     tindakan tetap bertuliskan jelas. Keduanya dibaca di sini. */
  var t = k.querySelector('.hr-tanda');
  var dot = k.querySelector('.hr-dot');
  return {tanda: t ? t.textContent.trim() : (dot ? dot.getAttribute('title') : '(tanpa tanda)'),
          adaTombolKirim: !!k.querySelector('button[data-act="kirim"]')};
})()`;

const TEKAN_KIRIM = (truk) => `(async function(){
  var kartu = [].slice.call(document.querySelectorAll('.hrec'));
  var k = kartu.filter(function(x){ return x.textContent.indexOf(${JSON.stringify(truk)}) >= 0; })[0];
  k.querySelector('button[data-act="kirim"]').click();
  await new Promise(function(r){ setTimeout(r, 1700); });
  return true;
})()`;

/* Hapus kini di dalam menu titik tiga. Bagi operator pilihannya MATI dan
   alasannya tertulis, jadi penolakan terlihat sebelum diketuk - bukan sesudah. */
const COBA_HAPUS_OPERATOR = `(async function(){
  document.querySelector('button[data-act="lain"]').click();
  await new Promise(function(r){ setTimeout(r, 500); });
  var b = [].slice.call(document.querySelectorAll('.modal .aksi'))
            .filter(function(x){ return /^Hapus muat/.test(x.textContent); })[0];
  var mati = !!(b && b.disabled);
  var alasan = b ? b.textContent : '';
  if(b) b.click();
  await new Promise(function(r){ setTimeout(r, 500); });
  var pesan = (document.querySelector('.toast')||{}).textContent || '';
  return {ditolak: mati && /pemilik/i.test(alasan) || /pemilik/i.test(pesan),
          dialogMuncul: !document.getElementById('modal').hidden,
          jml: JSON.parse(localStorage.getItem('wavi_muat_hist_v1')||'[]').length};
})()`;

const HAPUS_OLEH_PEMILIK = (truk) => `(async function(){
  var kartu = [].slice.call(document.querySelectorAll('.hrec'));
  var mau = kartu.filter(function(k){ return k.textContent.indexOf(${JSON.stringify(truk)}) >= 0; })[0];
  mau.querySelector('button[data-act="lain"]').click();
  await new Promise(function(r){ setTimeout(r, 500); });
  [].slice.call(document.querySelectorAll('.modal .aksi'))
    .filter(function(x){ return /^Hapus muat/.test(x.textContent); })[0].click();
  await new Promise(function(r){ setTimeout(r, 550); });
  document.getElementById('mo-ya').click();
  await new Promise(function(r){ setTimeout(r, 1600); });
  return {sisa: JSON.parse(localStorage.getItem('wavi_muat_hist_v1')||'[]').length};
})()`;

const setOnline = (v) => `(function(){
  Object.defineProperty(navigator, 'onLine', {get:function(){return ${v};}, configurable:true});
  return navigator.onLine;
})()`;

const main = async () => {
  const operator = await bukaHP(9501);
  const pemilik = await bukaHP(9502);
  let ok = true;
  const cek = (nama, dapat, harus) => {
    const lolos = JSON.stringify(dapat) === JSON.stringify(harus);
    if (!lolos) ok = false;
    console.log(`  ${lolos ? 'OK  ' : 'GAGAL'}  ${nama.padEnd(56)} ${JSON.stringify(dapat)}`);
  };

  await operator.muat();
  await operator.ev(atur('KODE-OPERATOR'));
  await pemilik.muat();
  await pemilik.ev(atur('RAHASIA-PEMILIK'));

  /* --- 1. muat dikirim ke pusat --- */
  const s1 = await operator.ev(simpanMuat('G 1111 AA', 'Bp. Rifai Brebes', 0));
  cek('pemakai ditawari dua pilihan', s1.pilihanAda, ['Kirim ke pusat', 'Simpan di HP ini saja']);
  cek('pilih "kirim": tersimpan dan antrean bersih', { jml: s1.jml, antre: s1.antre }, { jml: 1, antre: 0 });
  cek('kartunya bertanda ada di pusat', await operator.ev(TANDA('G 1111 AA')),
      { tanda: 'Ada di pusat — terlihat di semua HP', adaTombolKirim: false });

  await pemilik.ev(TEKAN_SINKRON); await tidur(1500);
  cek('pemilik melihat muat itu', await pemilik.ev(DAFTAR_TRUK), ['G 1111 AA']);

  /* --- 2. muat HP saja: TIDAK boleh terkirim --- */
  const s2 = await operator.ev(simpanMuat('N 9999 XY', 'Rahasia', 1));
  cek('pilih "HP saja": tersimpan, tidak masuk antrean', { jml: s2.jml, antre: s2.antre }, { jml: 2, antre: 0 });
  cek('kartunya bertanda hanya di HP ini', await operator.ev(TANDA('N 9999 XY')),
      { tanda: 'Hanya di HP ini', adaTombolKirim: true });

  await pemilik.ev(TEKAN_SINKRON); await tidur(1500);
  cek('pemilik TIDAK melihat muat "HP saja"', await pemilik.ev(DAFTAR_TRUK), ['G 1111 AA']);

  /* --- 3. dikirim belakangan lewat tombol Kirim --- */
  await operator.ev(TEKAN_KIRIM('N 9999 XY'));
  cek('sesudah ditekan Kirim, tandanya berubah', await operator.ev(TANDA('N 9999 XY')),
      { tanda: 'Ada di pusat — terlihat di semua HP', adaTombolKirim: false });
  await pemilik.ev(TEKAN_SINKRON); await tidur(1500);
  cek('sekarang pemilik melihatnya', await pemilik.ev(DAFTAR_TRUK), ['G 1111 AA', 'N 9999 XY']);

  /* --- 4. hak hapus --- */
  cek('operator dikenali sebagai operator', await operator.ev(PERAN), 'operator');
  cek('operator menekan Hapus -> ditolak', await operator.ev(COBA_HAPUS_OPERATOR),
      { ditolak: true, dialogMuncul: true, jml: 2 });   /* menu titik tiga masih terbuka */
  cek('pemilik dikenali sebagai pemilik', await pemilik.ev(PERAN), 'pemilik');
  cek('pemilik menghapus satu muat', await pemilik.ev(HAPUS_OLEH_PEMILIK('G 1111 AA')), { sisa: 1 });
  await operator.ev(TEKAN_SINKRON); await tidur(1500);
  cek('penghapusan sampai ke HP operator', await operator.ev(DAFTAR_TRUK), ['N 9999 XY']);

  /* --- 5. tanpa internet --- */
  cek('internet dimatikan', await operator.ev(setOnline(false)), false);
  const s3 = await operator.ev(simpanMuat('B 3333 CC', 'Tanpa sinyal', 0));
  cek('tanpa sinyal: tersimpan dan menunggu di antrean',
      { jml: s3.jml, antre: s3.antre }, { jml: 2, antre: 1 });
  cek('kartunya bertanda menunggu', (await operator.ev(TANDA('B 3333 CC'))).tanda,
      'Menunggu terkirim');

  await operator.ev(setOnline(true));
  await operator.ev(TEKAN_SINKRON); await tidur(1700);
  cek('sinyal kembali: antrean habis', await operator.ev(JML_ANTRE), 0);
  await pemilik.ev(TEKAN_SINKRON); await tidur(1500);
  cek('muat luring itu sampai ke HP pemilik', await pemilik.ev(DAFTAR_TRUK), ['B 3333 CC', 'N 9999 XY']);

  operator.tutup(); pemilik.tutup();
  console.log(ok ? '\n=== LULUS ===' : '\n=== ADA YANG GAGAL ===');
  process.exit(ok ? 0 : 1);
};
main().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
