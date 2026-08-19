/* Membuktikan dua hal sekaligus, dari keluaran cetak yang sungguhan:

   1. ROLL = jumlah kotak yang TERISI, bukan jumlah kolom dan bukan nomor
      terakhir. Diuji justru pada kasus tersulit: ada kotak DILEWATI di
      tengah, sehingga nomor terakhir dan jumlah terisi berbeda.
   2. Baris "Toko" pada Nota dan Surat Jalan berisi kota tujuan.

   Angkanya dibaca dari PDF hasil aplikasi, bukan dari variabel dalam. */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SP = import.meta.dirname;
const PDFTOTEXT = 'C:/Users/danny/AppData/Local/Microsoft/WinGet/Packages/oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe/poppler-25.07.0/Library/bin/pdftotext.exe';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

async function jalankan(kasus) {
  const PORT = 9750 + Math.floor(Math.random() * 40);
  const profil = mkdtempSync(join(tmpdir(), 'ujiroll-'));
  const anak = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profil}`, '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let url, id = 0;
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
  await kirim('Page.navigate', { url: 'file:///D:/muat-rafia/index.html' });
  await tidur(2600);
  const ev = async (e) => {
    const r = await kirim('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };

  const layar = await ev(`(async function(){
    function isi(id,v){var e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}
    var terisi = ${JSON.stringify(kasus.terisi)};
    for(var i=0;i<terisi.length;i++){
      var td = document.querySelector('#tbl-wrap [data-cell="' + terisi[i][0] + '"]');
      var inp = td ? td.querySelector('input') : null;
      if(!inp) continue;
      inp.value = terisi[i][1];
      inp.dispatchEvent(new Event('input', {bubbles:true}));
    }
    isi('i-truk','G 8726 MG'); isi('i-penerima','Bp. Rifai');
    isi('i-tujuan','Brebes'); isi('i-barang','Rafia Kw 3');
    isi('i-harga','11500'); isi('i-kendaraan','Truck'); isi('i-nosj','242. 05. 26');
    await new Promise(function(r){ setTimeout(r, 400); });
    return {roll: document.getElementById('ro-roll').textContent,
            ton: document.getElementById('ro-ton').textContent};
  })()`);

  /* tangkap PDF "Semua" */
  const b64 = await ev(`(async function(){
    var Asli = window.Blob; window.__b = null;
    window.Blob = function(bag, o){ var x = new Asli(bag, o);
      if(o && String(o.type).indexOf('pdf') >= 0) window.__b = x; return x; };
    document.getElementById('b-pdf').click();
    await new Promise(function(r){ setTimeout(r, 400); });
    var p = document.querySelector('#mo-aksi button'); if(p) p.click();
    await new Promise(function(r){ setTimeout(r, 400); });
    for(var z=0; z<4; z++){
      if(document.getElementById('modal').hidden) break;
      var ya = document.getElementById('mo-ya');
      if(!ya.hidden) ya.click();
      else { var a = document.querySelector('#mo-aksi button'); if(a) a.click(); else break; }
      await new Promise(function(r){ setTimeout(r, 400); });
    }
    for(var w=0; w<60 && !window.__b; w++) await new Promise(function(r){ setTimeout(r, 120); });
    if(!window.__b) return null;
    var buf = new Uint8Array(await window.__b.arrayBuffer());
    var s = '', CH = 8192;
    for(var j=0;j<buf.length;j+=CH) s += String.fromCharCode.apply(null, buf.subarray(j, j+CH));
    return btoa(s);
  })()`);
  ws.close(); anak.kill();
  if (!b64) throw new Error('PDF tidak dihasilkan');
  const berkas = SP + '/roll-' + kasus.nama + '.pdf';
  writeFileSync(berkas, Buffer.from(b64, 'base64'));
  execFileSync(PDFTOTEXT, ['-layout', berkas, berkas + '.txt']);
  return { layar, teks: readFileSync(berkas + '.txt', 'utf8') };
}

const main = async () => {
  let ok = true;
  const cek = (nama, dapat, harus) => {
    const lolos = String(dapat) === String(harus);
    if (!lolos) ok = false;
    console.log(`  ${lolos ? 'OK  ' : 'GAGAL'}  ${nama.padEnd(52)} dapat "${dapat}"  harus "${harus}"`);
  };

  /* ---- KASUS 1: 12 kotak berurutan, tanpa lubang ---- */
  {
    const terisi = [];
    for (let i = 0; i < 12; i++) terisi.push([i, '10,00']);
    const { layar, teks } = await jalankan({ nama: 'rapat', terisi });
    console.log('=== KASUS 1: 12 kotak berurutan ===');
    cek('papan angka', layar.roll, '12');
    const totalRoll = (teks.match(/TOTAL ROLL\s*=?\s*(\d+)/) || [])[1];
    cek('Daftar Timbangan: TOTAL ROLL', totalRoll, '12');
    const semuaRoll = [...teks.matchAll(/(\d+)\s+roll/g)].map((m) => m[1]);
    cek('Nota & Surat Jalan: Banyaknya', semuaRoll.join(','), '12,12');
  }

  /* ---- KASUS 2: kotak 1-10 dan 12-15 (nomor 11 DILEWATI) ---- */
  {
    const terisi = [];
    for (let i = 0; i < 10; i++) terisi.push([i, '10,00']);
    for (let i = 11; i < 15; i++) terisi.push([i, '10,00']);   /* indeks 10 sengaja dilewati */
    const { layar, teks } = await jalankan({ nama: 'berlubang', terisi });
    console.log('\n=== KASUS 2: 14 kotak terisi, nomor 11 DILEWATI ===');
    console.log('    (nomor terakhir = 15, jumlah kolom terpakai = 2, jumlah TERISI = 14)');
    cek('papan angka menghitung yang TERISI', layar.roll, '14');
    cek('tonase ikut benar (14 x 10,00)', layar.ton, '140,00');
    const totalRoll = (teks.match(/TOTAL ROLL\s*=?\s*(\d+)/) || [])[1];
    cek('Daftar Timbangan: TOTAL ROLL', totalRoll, '14');
    const semuaRoll = [...teks.matchAll(/(\d+)\s+roll/g)].map((m) => m[1]);
    cek('Nota & Surat Jalan: Banyaknya', semuaRoll.join(','), '14,14');

    console.log('\n=== Baris "Toko" berisi kota tujuan ===');
    const toko = [...teks.matchAll(/Toko\s+(\S+)/g)].map((m) => m[1]);
    cek('muncul di Nota dan Surat Jalan', toko.join(','), 'Brebes,Brebes');
    cek('Daftar Timbangan menggabungkan nama + kota',
        /PENERIMA\s*=?\s*Bp\. Rifai Brebes/.test(teks), 'true');
  }

  console.log('\n' + (ok ? '=== LULUS ===' : '=== ADA YANG GAGAL ==='));
  process.exit(ok ? 0 : 1);
};
main().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
