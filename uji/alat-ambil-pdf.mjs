/* Menekan tombol "Simpan PDF" di aplikasi lalu menyimpan berkas hasilnya. */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SP = import.meta.dirname;
const KELUAR = process.argv[3] || (SP + '/coba.pdf');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const PORT = 9340 + Math.floor(Math.random() * 40);
const profil = mkdtempSync(join(tmpdir(), 'ambilpdf-'));
const anak = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profil}`, '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
let idKe = 0;

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
  const tunggu = new Map();
  ws.addEventListener('message', (e) => {
    const p = JSON.parse(e.data);
    if (p.id && tunggu.has(p.id)) { tunggu.get(p.id)(p); tunggu.delete(p.id); }
  });
  const kirim = (m, params = {}) => new Promise((res, rej) => {
    const id = ++idKe;
    tunggu.set(id, (p) => (p.error ? rej(new Error(JSON.stringify(p.error))) : res(p.result)));
    ws.send(JSON.stringify({ id, method: m, params }));
  });
  const ev = async (e) => {
    const r = await kirim('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };

  await kirim('Page.enable'); await kirim('Runtime.enable');
  await kirim('Page.navigate', { url: process.argv[2] || 'file:///D:/muat-rafia/index.html' });
  await tidur(2600);

  const b64 = await ev(`(async function(){
    var Asli = window.Blob;
    window.__blob = null;
    window.Blob = function(bagian, opsi){
      var b = new Asli(bagian, opsi);
      if(opsi && String(opsi.type).indexOf('pdf') >= 0) window.__blob = b;
      return b;
    };
    var nilai = ['98,66','88,56','96,12','58,63','75,40','82,15','91,08','67,72','88,90','79,35',
                 '84,21','93,47','71,60','86,05','90,12'];
    for(var i=0;i<nilai.length;i++){
      var td = document.querySelector('#tbl-wrap [data-cell="' + i + '"]');
      var inp = td ? td.querySelector('input') : document.querySelectorAll('#tbl-wrap input')[i];
      if(!inp) continue;
      inp.value = nilai[i];
      inp.dispatchEvent(new Event('input', {bubbles:true}));
    }
    [['i-barang','Rafia Kw 3'],['i-harga','11500'],['i-kendaraan','Truck'],['i-nosj','242. 05. 26']].forEach(function(p){var e=document.getElementById(p[0]); if(e){e.value=p[1]; e.dispatchEvent(new Event('input',{bubbles:true}));}});
    var pn = document.getElementById('i-penerima');
    if(pn){ pn.value = 'TOKO SUMBER REJEKI MAKMUR'; pn.dispatchEvent(new Event('input',{bubbles:true})); }
    var tr = document.getElementById('i-truk');
    if(tr){ tr.value = 'K 1234 AB'; tr.dispatchEvent(new Event('input',{bubbles:true})); }

    document.getElementById('b-pdf').click();
    await new Promise(function(r){ setTimeout(r, 400); });
    /* dialog pilih dokumen: pilihan pertama = semua */
    var pilihan = document.querySelector('#mo-aksi button');
    if(pilihan){ pilihan.click(); await new Promise(function(r){ setTimeout(r, 400); }); }
    /* peringatan roll kosong / harga -> Lanjut */
    for(var z=0; z<3; z++){
      if(document.getElementById('modal').hidden) break;
      var ya = document.getElementById('mo-ya');
      if(!ya.hidden) ya.click();
      else { var a2 = document.querySelector('#mo-aksi button'); if(a2) a2.click(); else break; }
      await new Promise(function(r){ setTimeout(r, 400); });
    }
    for(var t=0;t<50;t++){
      if(window.__blob) break;
      await new Promise(function(r){ setTimeout(r,120); });
    }
    if(!window.__blob) return 'TIDAK ADA PDF';
    var buf = new Uint8Array(await window.__blob.arrayBuffer());
    var s = '', CH = 8192;
    for(var j=0;j<buf.length;j+=CH) s += String.fromCharCode.apply(null, buf.subarray(j, j+CH));
    return btoa(s);
  })()`);

  ws.close(); anak.kill();
  if (b64 === 'TIDAK ADA PDF') { console.log('GAGAL: tombol Simpan PDF tidak menghasilkan berkas'); process.exit(1); }
  const pdf = Buffer.from(b64, 'base64');
  writeFileSync(KELUAR, pdf);
  console.log(`PDF: ${KELUAR}  ${(pdf.length / 1024).toFixed(1)} KB`);
};
main().catch((e) => { console.error('GAGAL:', e.message); anak.kill(); process.exit(1); });
