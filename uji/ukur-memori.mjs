/* Mengukur pemakaian penyimpanan sesungguhnya di HP:
   berapa besar satu muat, berapa yang bisa ditampung, dan apakah browser
   mengizinkan penyimpanan permanen (tidak dibuang sendiri saat memori sesak). */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const PORT = 9862;
const profil = mkdtempSync(join(tmpdir(), 'ukur-'));
const anak = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profil}`, '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
let id = 0;

const KODE = `(async function(){
  var w = [];
  for(var i=0;i<140;i++) w.push(70 + (i%30) + (i%7)/100);
  var satu = {id:"Mxxxxxxxxxxxx", tanggal:"2026-08-19", noTruk:"G 8726 MG",
    penerima:"Bp. Rifai", tujuan:"Brebes", barang:"Rafia Kw 3", harga:11500,
    kendaraan:"Truck", noSJ:"242. 05. 26", roll:140, tonase:11900.5, w:w,
    diubah:Date.now(), oleh:"HPxxxxxxxxxxx"};
  var besarSatu = JSON.stringify(satu).length;

  /* Cari batas penyimpanan dengan menggandakan ukuran - jauh lebih cepat
     daripada menulis ribuan kali, hasilnya sama. */
  var KUNCI = "__uji_penuh__", batas = 0, n = 65536;
  try{
    while(n < 67108864){
      localStorage.setItem(KUNCI, "x".repeat(n));
      batas = n; n = Math.floor(n * 1.5);
    }
  }catch(e){}
  var tambah = Math.floor(batas / 4);
  while(tambah > 16384){
    try{ localStorage.setItem(KUNCI, "x".repeat(batas + tambah)); batas += tambah; }
    catch(e){ tambah = Math.floor(tambah / 2); }
  }
  try{ localStorage.removeItem(KUNCI); }catch(e){}

  var permanen = null, kuota = null, dipakai = null;
  try{ permanen = await navigator.storage.persisted(); }catch(e){}
  try{ var q = await navigator.storage.estimate(); kuota = q.quota; dipakai = q.usage; }catch(e){}

  return {besarSatu: besarSatu, batas: batas,
          muatMasuk: Math.floor(batas / besarSatu),
          permanen: permanen, kuota: kuota, dipakai: dipakai};
})()`;

const main = async () => {
  let url;
  for (let i = 0; i < 60 && !url; i++) {
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
  await kirim('Page.enable'); await kirim('Runtime.enable');
  await kirim('Page.navigate', { url: 'https://dannywsn.github.io/muat-rafia/' });
  await tidur(3000);
  const r = await kirim('Runtime.evaluate', { expression: KODE, returnByValue: true, awaitPromise: true });
  ws.close(); anak.kill();
  if (r.exceptionDetails) { console.error(JSON.stringify(r.exceptionDetails.exception)); process.exit(1); }
  const h = r.result.value;

  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
  console.log('=== UKURAN SESUNGGUHNYA ===');
  console.log('  satu muat PENUH (140 roll)  : ' + h.besarSatu + ' huruf (~' + kb(h.besarSatu) + ')');
  console.log('  batas penyimpanan localStorage: ' + mb(h.batas));
  console.log('  muat yang bisa ditampung     : ~' + h.muatMasuk.toLocaleString('id-ID') + ' muat');
  console.log('');
  console.log('=== KEADAAN PENYIMPANAN BROWSER ===');
  console.log('  penyimpanan PERMANEN aktif   : ' + h.permanen +
              (h.permanen === false ? '   <-- browser BOLEH membuangnya sendiri' : ''));
  console.log('  kuota keseluruhan            : ' + (h.kuota ? mb(h.kuota) : '-'));
  console.log('  terpakai sekarang            : ' + (h.dipakai ? kb(h.dipakai) : '-'));
  console.log('');
  [3, 6, 12].forEach((n) => {
    console.log('  kalau ' + String(n).padStart(2) + ' muat sehari -> penuh dalam ~' +
      (h.muatMasuk / n / 365).toFixed(1) + ' tahun');
  });
};
main().catch((e) => { console.error('GAGAL:', e.message); anak.kill(); process.exit(1); });
