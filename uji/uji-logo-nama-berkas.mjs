/* MEMBUKTIKAN Tahap 2 & 3 dari aplikasi yang SUNGGUHAN, bukan dari kode:
     - halaman dimuat tanpa satu pun galat JavaScript
     - logo bilah atas benar PNG tembus pandang, dan keping putihnya hilang
     - nama berkas PDF diambil dari NAMA BERKAS YANG BENAR-BENAR DIUNDUH,
       lewat tombol Simpan PDF seperti pemakai menekannya
     - diuji empat kasus: penerima biasa, penerima panjang, penerima kosong,
       dan dua jenis dokumen berbeda dari muat yang sama (tidak boleh senama) */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const UNDUH = mkdtempSync(join(tmpdir(), 'unduh-'));

const PORT = 9700 + Math.floor(Math.random() * 60);
const profil = mkdtempSync(join(tmpdir(), 'uji23-'));
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
const galat = [];
ws.addEventListener('message', (e) => {
  const p = JSON.parse(e.data);
  if (p.id && t.has(p.id)) { t.get(p.id)(p); t.delete(p.id); return; }
  if (p.method === 'Runtime.exceptionThrown') {
    galat.push('kecuali: ' + JSON.stringify(p.params.exceptionDetails.exception ||
               p.params.exceptionDetails.text));
  }
  if (p.method === 'Runtime.consoleAPICalled' && p.params.type === 'error') {
    galat.push('console.error: ' + JSON.stringify(p.params.args.map((a) => a.value)));
  }
  if (p.method === 'Log.entryAdded' && p.params.entry.level === 'error') {
    /* Manifest diblokir CORS HANYA karena diuji dari file:// - di GitHub Pages
       (https) tidak terjadi. Bukan galat aplikasi, jadi tidak dihitung. */
    const teks = p.params.entry.text || '';
    const wajarDiFile = /manifest|CORS policy|ERR_FAILED/i.test(teks);
    if (!wajarDiFile) galat.push('log: ' + teks);
  }
});
const kirim = (m, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  t.set(i, (p) => (p.error ? rej(new Error(JSON.stringify(p.error))) : res(p.result)));
  ws.send(JSON.stringify({ id: i, method: m, params }));
});
await kirim('Page.enable'); await kirim('Runtime.enable'); await kirim('Log.enable');
await kirim('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH });
const ev = async (e) => {
  const r = await kirim('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
};

const hasil = [];
const cek = (nama, lulus, bukti) => {
  hasil.push({ nama, lulus, bukti });
  console.log((lulus ? '  LULUS ' : '  GAGAL ') + nama + '  ->  ' + bukti);
};

await kirim('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 2, mobile: true });
await kirim('Page.navigate', { url: 'file:///D:/muat-rafia/index.html' });
await tidur(2800);

/* ---------- 1. tidak ada galat saat memuat ---------- */
cek('halaman dimuat tanpa galat JavaScript', galat.length === 0,
    galat.length ? galat.slice(0, 3).join(' | ') : 'nol galat');

/* ---------- 2. logo bilah atas ---------- */
const logo = await ev(`(function(){
  var m = document.getElementById('brand-mark');
  var img = m.querySelector('img');
  var gm = getComputedStyle(m), gi = img ? getComputedStyle(img) : null;
  var r = img ? img.getBoundingClientRect() : null;
  return {
    ada: !!img,
    jenis: img ? img.src.slice(0, 22) : '',
    alasKeping: gm.backgroundColor,
    tampil: r ? Math.round(r.width) + 'x' + Math.round(r.height) : '',
    alami: img ? img.naturalWidth + 'x' + img.naturalHeight : ''
  };
})()`);
cek('logo layar memakai PNG (bukan JPEG)', logo.jenis.indexOf('data:image/png') === 0, logo.jenis);
cek('keping putih di bilah atas sudah hilang',
    /rgba\(0, 0, 0, 0\)|transparent/.test(logo.alasKeping), 'background: ' + logo.alasKeping);
cek('logo terpasang dan tajam (alami >= 2x tampil)',
    logo.ada && parseInt(logo.alami) >= parseInt(logo.tampil) * 2,
    'tampil ' + logo.tampil + ', gambar asli ' + logo.alami);

/* ---------- 3. logo CETAK harus tetap JPEG (hasil cetak tak boleh berubah) ---------- */
const cetakLogo = await ev(`(function(){
  var s = document.documentElement.innerHTML;
  return { adaJpeg: s.indexOf('data:image/jpeg;base64,') >= 0 };
})()`);
cek('logo JPEG untuk cetak masih ada di aplikasi', cetakLogo.adaJpeg, 'ditemukan data:image/jpeg');

/* ---------- 4. nama berkas PDF, lewat tombol sungguhan ---------- */
async function isiMuat(m) {
  await ev(`(function(){
    function isi(id, v){ var e=document.getElementById(id); e.value=v;
      e.dispatchEvent(new Event('input',{bubbles:true})); }
    isi('i-tanggal', ${JSON.stringify(m.tanggal)});
    isi('i-truk', ${JSON.stringify(m.truk)});
    isi('i-penerima', ${JSON.stringify(m.penerima)});
    isi('i-tujuan', 'Brebes');
    isi('i-barang', 'Rafia Kw 3');
    isi('i-harga', '11500');
    isi('i-kendaraan', 'Truck');
    isi('i-nosj', '001');
    var berat = ['25,50','26,10','24,90'];
    for(var i=0;i<berat.length;i++){
      var td = document.querySelector('[data-cell="' + i + '"]');
      var inp = td ? (td.matches('input') ? td : td.querySelector('input')) : null;
      if(inp){ inp.value = berat[i]; inp.dispatchEvent(new Event('input',{bubbles:true})); }
    }
    return 1;
  })()`);
}

/* pilih dokumen di dialog dengan menekan tombolnya, seperti pemakai */
async function simpanPDF(labelDokumen) {
  await ev(`document.getElementById('b-pdf').click()`);
  await tidur(700);
  const ok = await ev(`(function(){
    var t = ${JSON.stringify(labelDokumen)};
    var b = Array.prototype.slice.call(document.querySelectorAll('.modal .aksi, .modal button'));
    for(var i=0;i<b.length;i++){
      if((b[i].textContent||'').indexOf(t) === 0){ b[i].click(); return 'ketuk: ' + t; }
    }
    return 'TIDAK KETEMU: ' + b.map(function(x){return (x.textContent||'').slice(0,20);}).join(' / ');
  })()`);
  if (String(ok).startsWith('TIDAK')) throw new Error(ok);
  await tidur(1600);
  /* Muncul dialog kedua "PDF siap": namanya DITAMPILKAN di situ, dan salah satu
     pilihannya benar-benar mengunduh. Keduanya dipakai sebagai bukti. */
  const ditampilkan = await ev(`(function(){
    var b = document.querySelector('.modal .berkas');
    return b ? b.textContent.trim() : '';
  })()`);
  const unduh = await ev(`(function(){
    var b = Array.prototype.slice.call(document.querySelectorAll('.modal .aksi, .modal button'));
    for(var i=0;i<b.length;i++){
      if((b[i].textContent||'').indexOf('Unduh ke folder Download') === 0){ b[i].click(); return 'ok'; }
    }
    return 'TIDAK KETEMU tombol unduh: ' + b.map(function(x){return (x.textContent||'').slice(0,24);}).join(' / ');
  })()`);
  if (String(unduh).startsWith('TIDAK')) throw new Error(unduh);
  await tidur(1400);
  /* dialog terakhir ditutup supaya kasus berikutnya bersih */
  await ev(`(function(){
    var b = Array.prototype.slice.call(document.querySelectorAll('.modal button'));
    for(var i=0;i<b.length;i++){ if(/Mengerti|Batal|Tutup/.test(b[i].textContent||'')){ b[i].click(); break; } }
    return 1;
  })()`);
  await tidur(400);
  return ditampilkan;
}

const kasus = [
  { nama: 'penerima biasa', tanggal: '2026-08-19', truk: 'K 1234 ABC', penerima: 'Bp. Rifai',
    dok: 'Nota saja', harap: 'Bp-Rifai-19-08-2026-Nota.pdf' },
  { nama: 'dokumen lain, muat sama (tidak boleh senama)', tanggal: '2026-08-19', truk: 'K 1234 ABC',
    penerima: 'Bp. Rifai', dok: 'Surat Jalan saja', harap: 'Bp-Rifai-19-08-2026-Surat-Jalan.pdf' },
  { nama: 'penerima panjang', tanggal: '2026-07-05', truk: 'K 9876 XY',
    penerima: 'Toko Sumber Rejeki Makmur Jaya', dok: 'Nota saja',
    harap: 'Toko-Sumber-Rejeki-Makmur-Jaya-05-07-2026-Nota.pdf' },
  { nama: 'penerima kosong', tanggal: '2026-01-09', truk: '', penerima: '', dok: 'Nota saja',
    harap: 'Tanpa-Penerima-09-01-2026-Nota.pdf' },
  { nama: 'Daftar Timbangan', tanggal: '2026-12-31', truk: 'K 1 A', penerima: 'Bp. Slamet',
    dok: 'Daftar Timbangan', harap: 'Bp-Slamet-31-12-2026-Daftar-Timbangan.pdf' },
];

for (const k of kasus) {
  rmSync(UNDUH, { recursive: true, force: true }); mkdirSync(UNDUH, { recursive: true });
  await kirim('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: UNDUH });
  await isiMuat(k);
  const ditampilkan = await simpanPDF(k.dok);
  let berkas = [];
  for (let i = 0; i < 25 && !berkas.length; i++) {
    berkas = readdirSync(UNDUH).filter((f) => f.toLowerCase().endsWith('.pdf'));
    if (!berkas.length) await tidur(300);
  }
  cek('nama ditampilkan aplikasi · ' + k.nama, ditampilkan === k.harap,
      '"' + ditampilkan + '" (harap "' + k.harap + '")');
  cek('nama berkas terunduh · ' + k.nama, berkas.length === 1 && berkas[0] === k.harap,
      berkas.length ? berkas.join(', ') : 'TIDAK ADA BERKAS TERUNDUH');
}

/* ---------- 5. judul halaman: WAC, dan pulih setelah cetak ---------- */
const judul = await ev(`document.title`);
cek('judul halaman = WAC', judul === 'WAC', 'title = "' + judul + '"');

cek('tidak ada galat baru sampai akhir pengujian', galat.length === 0,
    galat.length ? galat.slice(0, 3).join(' | ') : 'nol galat');

const gagal = hasil.filter((h) => !h.lulus);
console.log('\n' + (hasil.length - gagal.length) + '/' + hasil.length + ' pemeriksaan lulus');
if (gagal.length) { console.log('GAGAL:\n' + gagal.map((g) => ' - ' + g.nama + ': ' + g.bukti).join('\n')); }
try { anak.kill(); } catch {}
process.exit(gagal.length ? 1 : 0);
