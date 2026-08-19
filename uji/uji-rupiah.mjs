/* Menguji papan rupiah hidup, khususnya kasus pemilik: harga BARU diisi
   setelah sebagian muat sudah ditimbang - angkanya harus langsung benar
   tanpa perlu menyentuh timbangan lagi. */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const PORT = 9433;
const profil = mkdtempSync(join(tmpdir(), 'ujirp-'));
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
  await tidur(2600);

  const hasil = await ev(`(async function(){
    function isi(id, v){
      var e = document.getElementById(id);
      e.value = v; e.dispatchEvent(new Event('input', {bubbles:true}));
    }
    function berat(i, v){
      var td = document.querySelector('#tbl-wrap [data-cell="' + i + '"]');
      var inp = td ? td.querySelector('input') : null;
      if(!inp) return;
      inp.value = v; inp.dispatchEvent(new Event('input', {bubbles:true}));
    }
    var jejak = {};

    /* 1. belum ada apa-apa */
    jejak.awal = document.getElementById('ro-rp').textContent;
    jejak.awalRedup = document.getElementById('s-rp').classList.contains('kosong');

    /* 2. timbang 5 roll DULU, harga masih kosong */
    var a = ['100,00','90,50','80,25','70,75','60,10'];
    for(var i=0;i<a.length;i++) berat(i, a[i]);
    await new Promise(function(r){ setTimeout(r, 200); });
    jejak.sebelumHarga = document.getElementById('ro-rp').textContent;
    jejak.tonSebelum = document.getElementById('ro-ton').textContent;

    /* 3. BARU isi harga di tengah jalan - harus langsung terhitung */
    isi('i-harga', '11500');
    await new Promise(function(r){ setTimeout(r, 200); });
    jejak.setelahHarga = document.getElementById('ro-rp').textContent;
    jejak.redupSetelah = document.getElementById('s-rp').classList.contains('kosong');

    /* 4. lanjut menimbang - rupiah ikut naik */
    berat(5, '50,40');
    await new Promise(function(r){ setTimeout(r, 200); });
    jejak.lanjut = document.getElementById('ro-rp').textContent;
    jejak.tonLanjut = document.getElementById('ro-ton').textContent;

    /* 5. harga dihapus lagi - kembali tidak wajib, tidak menghalangi */
    isi('i-harga', '');
    await new Promise(function(r){ setTimeout(r, 200); });
    jejak.hargaDihapus = document.getElementById('ro-rp').textContent;
    jejak.redupLagi = document.getElementById('s-rp').classList.contains('kosong');
    jejak.tonTetap = document.getElementById('ro-ton').textContent;
    return jejak;
  })()`);

  ws.close(); anak.kill();

  const kg1 = 100 + 90.5 + 80.25 + 70.75 + 60.10;
  const kg2 = kg1 + 50.40;
  const rp1 = Math.round(Math.round(kg1 * 100) * 11500 / 100);
  const rp2 = Math.round(Math.round(kg2 * 100) * 11500 / 100);
  const f = (v) => v.toLocaleString('id-ID');

  let ok = true;
  const cek = (nama, dapat, harus) => {
    const lolos = String(dapat) === String(harus);
    if (!lolos) ok = false;
    console.log(`  ${lolos ? 'OK  ' : 'GAGAL'}  ${nama.padEnd(46)} dapat "${dapat}"  harus "${harus}"`);
  };

  console.log('=== papan rupiah hidup ===');
  cek('sebelum apa pun diisi', hasil.awal, '–');
  cek('kotak diredupkan saat harga kosong', hasil.awalRedup, true);
  cek('5 roll ditimbang, harga masih kosong', hasil.sebelumHarga, '–');
  cek('tonase 5 roll', hasil.tonSebelum, kg1.toLocaleString('id-ID', {minimumFractionDigits:2, maximumFractionDigits:2}));
  cek('HARGA DIISI DI TENGAH JALAN -> langsung terhitung', hasil.setelahHarga, f(rp1));
  cek('kotak tidak redup lagi', hasil.redupSetelah, false);
  cek('menimbang lagi -> rupiah ikut naik', hasil.lanjut, f(rp2));
  cek('tonase ikut naik', hasil.tonLanjut, kg2.toLocaleString('id-ID', {minimumFractionDigits:2, maximumFractionDigits:2}));
  cek('harga dihapus -> kembali tanda "-"', hasil.hargaDihapus, '–');
  cek('kotak redup lagi', hasil.redupLagi, true);
  cek('timbangan TIDAK terganggu saat harga dihapus', hasil.tonTetap, kg2.toLocaleString('id-ID', {minimumFractionDigits:2, maximumFractionDigits:2}));

  console.log(ok ? '\n=== LULUS ===' : '\n=== ADA YANG GAGAL ===');
  process.exit(ok ? 0 : 1);
};
main().catch((e) => { console.error('GAGAL:', e.message); anak.kill(); process.exit(1); });
