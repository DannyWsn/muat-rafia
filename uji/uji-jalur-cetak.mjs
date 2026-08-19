/* Menguji JALUR CETAK SUNGGUHAN: menekan tombol Cetak, lalu meminta browser
   mencetak (Page.printToPDF) — persis yang terjadi saat pemilik menekan Print.
   Yang diperiksa: logo benar-benar ikut tercetak, dan hanya 1 halaman. */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SP = import.meta.dirname;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const PORT = 9335;
const profil = mkdtempSync(join(tmpdir(), 'ujiprint-'));
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
  await kirim('Page.navigate', { url: 'file:///D:/muat-rafia/index.html' });
  await tidur(2500);

  const siap = await ev(`(async function(){
    window.__cetak = false;
    window.print = function(){ window.__cetak = true; };
    var nilai = ['25,15','24,90','25,05','24,75','25,35','24,60','25,20','25,00','24,85','25,10','25,30','24,95'];
    for(var i=0;i<nilai.length;i++){
      var inp = document.querySelector('#tbl-wrap [data-cell="' + i + '"] input');
      inp.value = nilai[i]; inp.dispatchEvent(new Event('input',{bubbles:true}));
    }
    document.getElementById('i-penerima').value = 'TOKO SUMBER REJEKI';
    document.getElementById('i-penerima').dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('i-truk').value = 'K 1234 AB';
    document.getElementById('i-truk').dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('b-cetak').click();
    /* tunggu sampai aplikasi benar-benar memanggil print */
    for(var t=0;t<40;t++){
      if(window.__cetak) break;
      await new Promise(function(r){ setTimeout(r,100); });
    }
    var g = document.querySelector('#print-root .xl-logo');
    return {print: window.__cetak, gbrAda: !!g,
            gbrLengkap: g ? g.complete : null,
            gbrLebarAsli: g ? g.naturalWidth : null};
  })()`);
  console.log('aplikasi memanggil print :', siap.print);
  console.log('logo ada di lembar       :', siap.gbrAda);
  console.log('logo selesai dimuat      :', siap.gbrLengkap, '| lebar asli:', siap.gbrLebarAsli, 'px');

  /* cetak sungguhan */
  const hasil = await kirim('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true,
    paperWidth: 8.2677, paperHeight: 11.6929,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  });
  const pdf = Buffer.from(hasil.data, 'base64');
  writeFileSync(SP + '/hasil-print-browser.pdf', pdf);
  const t = pdf.toString('latin1');

  const halaman = (t.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const gambar = (t.match(/\/Subtype\s*\/Image/g) || []).length;
  let ok = true;
  const cek = (n, s) => { console.log(`  ${s ? 'OK  ' : 'GAGAL'}  ${n}`); if (!s) ok = false; };
  console.log(`\nhasil cetak browser: ${(pdf.length / 1024).toFixed(1)} KB -> ${SP}/hasil-print-browser.pdf`);
  cek(`hanya 1 halaman (dapat ${halaman})`, halaman === 1);
  cek(`LOGO ikut tercetak (objek gambar: ${gambar})`, gambar >= 1);
  cek('aplikasi menunggu logo siap sebelum mencetak', siap.print === true && siap.gbrLengkap === true);
  cek('logo terurai penuh (439px)', siap.gbrLebarAsli === 439);

  ws.close(); anak.kill();
  console.log(ok ? '\n=== JALUR CETAK SEHAT ===' : '\n=== MASIH BERMASALAH ===');
  process.exit(ok ? 0 : 1);
};
main().catch((e) => { console.error('GAGAL:', e.message); anak.kill(); process.exit(1); });
