/* PARITAS CETAK - penjaga aturan nomor satu pemilik:
   hasil cetak TIDAK BOLEH berubah.

   Cara kerjanya: kelima dokumen dihasilkan dari aplikasi yang sungguhan lewat
   tombol Simpan PDF, lalu posisi SETIAP kata dibaca dengan
   pdftotext -bbox-layout dan dibandingkan dengan sidik jari acuan di
   uji/acuan-cetak/. Satu titik pun bergeser = GAGAL.

   Sidik jari dipakai supaya tidak perlu menyimpan salinan index.html yang lama.

   Pakai:
     node uji/cetak-paritas.mjs            memeriksa terhadap acuan
     node uji/cetak-paritas.mjs --rekam    merekam acuan BARU

   ⚠️ --rekam hanya dipakai kalau perubahan hasil cetak memang DISENGAJA dan
   sudah diperiksa pemilik. Kalau ragu, jangan merekam. */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readdirSync, readFileSync, writeFileSync,
         mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const DIR = import.meta.dirname;
const AKAR = join(DIR, '..');
const ACUAN = join(DIR, 'acuan-cetak');
const REKAM = process.argv.includes('--rekam');
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
/* poppler dipasang lewat winget; jalurnya berisi nomor versi, jadi dicari */
function cariPdftotext() {
  const dasar = 'C:/Users/danny/AppData/Local/Microsoft/WinGet/Packages';
  if (!existsSync(dasar)) return null;
  for (const d of readdirSync(dasar)) {
    if (!/Poppler/i.test(d)) continue;
    for (const v of readdirSync(join(dasar, d))) {
      const p = join(dasar, d, v, 'Library/bin/pdftotext.exe');
      if (existsSync(p)) return p;
    }
  }
  return null;
}
const PDFTOTEXT = cariPdftotext();
if (!CHROME) throw new Error('Chrome tidak ketemu');
if (!PDFTOTEXT) throw new Error('pdftotext (poppler) tidak ketemu - lihat BLUEPRINT bagian 3');

/* Muat contoh yang TETAP. Angkanya tidak boleh diubah, kalau diubah seluruh
   acuan ikut berubah dan uji ini kehilangan gunanya. */
const MUAT = { tanggal: '2026-08-19', truk: 'K 1234 ABC', penerima: 'Bp. Rifai',
               tujuan: 'Brebes', barang: 'Rafia Kw 3', harga: '11500',
               kendaraan: 'Truck', nosj: '242. 05. 26' };
const KOP = { nama: 'WAVI RAFIA GRUP', al1: 'Jl. Raya Rembang - Blora KM 5',
              al2: 'Desa Sumberejo, Rembang', al3: 'Telp. 0812 3456 7890',
              kota: 'Rembang', bank: 'BCA', rek: '7835290611', an: 'Wahyu Tejo Sudarmawan' };
const DOKUMEN = [
  ['semua',     'Semua (2 lembar)'],
  ['timbangan', 'Daftar Timbangan'],
  ['notasj',    'Nota & Surat Jalan'],
  ['nota',      'Nota saja'],
  ['sj',        'Surat Jalan saja'],
];

async function pdfDari(label, unduhDir) {
  const PORT = 9400 + Math.floor(Math.random() * 150);
  const profil = mkdtempSync(join(tmpdir(), 'paritas-'));
  const anak = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profil}`, '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let ws0, id = 0;
  for (let i = 0; i < 80 && !ws0; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      ws0 = j.find((x) => x.type === 'page')?.webSocketDebuggerUrl;
    } catch {}
    if (!ws0) await tidur(250);
  }
  const ws = new WebSocket(ws0);
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
  await kirim('Page.enable'); await kirim('Runtime.enable');
  await kirim('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: unduhDir });
  const ev = async (e) => {
    const r = await kirim('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };
  const alamat = 'file:///' + join(AKAR, 'index.html').replace(/\\/g, '/');
  await kirim('Page.navigate', { url: alamat });
  await tidur(2600);
  await ev(`(function(){ localStorage.setItem('wavi_muat_kop_v1',
    ${JSON.stringify(JSON.stringify(KOP))}); return 1; })()`);
  await kirim('Page.reload');
  await tidur(2600);
  await ev(`(function(){
    function isi(id,v){var e=document.getElementById(id);e.value=v;
      e.dispatchEvent(new Event('input',{bubbles:true}));}
    isi('i-tanggal', ${JSON.stringify(MUAT.tanggal)});
    isi('i-truk', ${JSON.stringify(MUAT.truk)});
    isi('i-penerima', ${JSON.stringify(MUAT.penerima)});
    isi('i-tujuan', ${JSON.stringify(MUAT.tujuan)});
    isi('i-barang', ${JSON.stringify(MUAT.barang)});
    isi('i-harga', ${JSON.stringify(MUAT.harga)});
    isi('i-kendaraan', ${JSON.stringify(MUAT.kendaraan)});
    isi('i-nosj', ${JSON.stringify(MUAT.nosj)});
    for(var i=0;i<20;i++){
      var td = document.querySelector('[data-cell="' + i + '"]');
      var inp = td ? (td.matches('input') ? td : td.querySelector('input')) : null;
      if(inp){ inp.value = (25 + (i % 5)) + ',5' + (i % 10);
               inp.dispatchEvent(new Event('input',{bubbles:true})); }
    }
    return 1; })()`);
  await tidur(400);
  await ev(`document.getElementById('b-pdf').click()`);
  await tidur(900);
  const p1 = await ev(`(function(){
    var b = Array.prototype.slice.call(document.querySelectorAll('.modal .aksi'));
    for(var i=0;i<b.length;i++) if((b[i].textContent||'').indexOf(${JSON.stringify(label)}) === 0){ b[i].click(); return 'ok'; }
    return 'TIDAK KETEMU'; })()`);
  if (p1 !== 'ok') { try { anak.kill(); } catch {} throw new Error('pilihan dokumen tidak ketemu: ' + label); }
  await tidur(1800);
  const p2 = await ev(`(function(){
    var b = Array.prototype.slice.call(document.querySelectorAll('.modal .aksi'));
    for(var i=0;i<b.length;i++) if((b[i].textContent||'').indexOf('Unduh ke folder Download') === 0){ b[i].click(); return 'ok'; }
    return 'TIDAK KETEMU'; })()`);
  if (p2 !== 'ok') { try { anak.kill(); } catch {} throw new Error('tombol unduh tidak ketemu'); }
  await tidur(1800);
  let berkas = [];
  for (let i = 0; i < 30 && !berkas.length; i++) {
    berkas = readdirSync(unduhDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
    if (!berkas.length) await tidur(300);
  }
  try { anak.kill(); } catch {}
  if (!berkas.length) throw new Error('PDF tidak terunduh untuk ' + label);
  return join(unduhDir, berkas[0]);
}

/* Sidik jari: setiap kata beserta kotaknya dalam satuan titik. Nama berkas
   TIDAK ikut - yang dijaga hanya isi dan letaknya di kertas. */
function sidik(pdf) {
  const xml = execFileSync(PDFTOTEXT, ['-bbox-layout', pdf, '-'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const kata = [];
  const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
  let m;
  while ((m = re.exec(xml))) {
    kata.push([(+m[1]).toFixed(2), (+m[2]).toFixed(2), (+m[3]).toFixed(2), (+m[4]).toFixed(2), m[5]].join('|'));
  }
  return { halaman: (xml.match(/<page /g) || []).length, kata: kata };
}

mkdirSync(ACUAN, { recursive: true });
const hasil = [];
for (const [kode, label] of DOKUMEN) {
  const dir = mkdtempSync(join(tmpdir(), 'paritas-unduh-'));
  const pdf = await pdfDari(label, dir);
  const s = sidik(pdf);
  const berkasAcuan = join(ACUAN, kode + '.json');
  if (REKAM) {
    writeFileSync(berkasAcuan, JSON.stringify(s, null, 1), 'utf8');
    console.log(`  DIREKAM  ${label}  ->  ${s.halaman} halaman, ${s.kata.length} kata`);
    hasil.push({ label, lulus: true });
  } else if (!existsSync(berkasAcuan)) {
    console.log(`  TIDAK ADA ACUAN  ${label} - jalankan dengan --rekam dulu`);
    hasil.push({ label, lulus: false });
  } else {
    const a = JSON.parse(readFileSync(berkasAcuan, 'utf8'));
    const beda = [];
    if (a.halaman !== s.halaman) beda.push(`jumlah halaman ${a.halaman} -> ${s.halaman}`);
    if (a.kata.length !== s.kata.length) beda.push(`jumlah kata ${a.kata.length} -> ${s.kata.length}`);
    const n = Math.min(a.kata.length, s.kata.length);
    for (let i = 0; i < n && beda.length < 6; i++) {
      if (a.kata[i] !== s.kata[i]) beda.push(`kata ke-${i + 1}: "${a.kata[i]}" -> "${s.kata[i]}"`);
    }
    const lulus = beda.length === 0;
    hasil.push({ label, lulus, beda });
    console.log((lulus ? '  LULUS ' : '  GAGAL ') + label +
      `  ->  ${s.halaman} halaman, ${s.kata.length} kata, posisi identik sampai 0,01 titik` +
      (lulus ? '' : '\n         BEDA: ' + beda.join(' ; ')));
  }
  rmSync(dir, { recursive: true, force: true });
}

const gagal = hasil.filter((h) => !h.lulus);
console.log('\n' + (hasil.length - gagal.length) + '/' + hasil.length +
  (REKAM ? ' acuan direkam' : ' dokumen identik dengan acuan'));
process.exit(gagal.length ? 1 : 0);
