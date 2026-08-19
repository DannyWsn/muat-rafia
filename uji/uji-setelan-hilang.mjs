/* Menirukan kejadian di HP rekan: setelan pusat diisi, lalu aplikasi dipakai
   dan dimuat ulang beberapa kali (persis yang terjadi tiap ada versi baru).
   Yang diperiksa: apakah ISI KOTAK dan ISI PENYIMPANAN tetap ada. */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const ALAMAT = 'http://127.0.0.1:8801/index.html';
const API = 'http://127.0.0.1:8801/api';
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9890, profil = mkdtempSync(join(tmpdir(), 'setelan-'));
const anak = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profil}`, '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let id = 0;
const main = async () => {
  let url;
  for (let i = 0; i < 60 && !url; i++) {
    try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      url = j.find((x) => x.type === 'page')?.webSocketDebuggerUrl; } catch {}
    if (!url) await tidur(250);
  }
  const ws = new WebSocket(url);
  await new Promise((r) => ws.addEventListener('open', r));
  const t = new Map();
  ws.addEventListener('message', (e) => { const p = JSON.parse(e.data);
    if (p.id && t.has(p.id)) { t.get(p.id)(p); t.delete(p.id); } });
  const kirim = (m, params = {}) => new Promise((res, rej) => {
    const i = ++id; t.set(i, (p) => (p.error ? rej(new Error(JSON.stringify(p.error))) : res(p.result)));
    ws.send(JSON.stringify({ id: i, method: m, params })); });
  await kirim('Page.enable'); await kirim('Runtime.enable');
  const ev = async (e) => {
    const r = await kirim('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
    return r.result.value; };
  const keadaan = `(function(){
    var p = JSON.parse(localStorage.getItem('wavi_muat_pusat_v1')||'{}');
    return {kotakUrl: document.getElementById('s-url').value,
            kotakKode: document.getElementById('s-kode').value,
            simpanUrl: p.url || '', simpanKode: p.kode || ''};
  })()`;

  let ok = true;
  const cek = (n, d) => {
    const l = d.kotakUrl && d.kotakKode && d.simpanUrl && d.simpanKode;
    if (!l) ok = false;
    console.log(`  ${l ? 'OK  ' : 'GAGAL'}  ${n.padEnd(38)} kotak:[${d.kotakUrl ? 'isi' : 'KOSONG'}/${d.kotakKode ? 'isi' : 'KOSONG'}]  simpan:[${d.simpanUrl ? 'isi' : 'KOSONG'}/${d.simpanKode ? 'isi' : 'KOSONG'}]`);
  };

  await kirim('Page.navigate', { url: ALAMAT }); await tidur(2400);
  await ev(`(function(){
    var u=document.getElementById('s-url'); u.value=${JSON.stringify(API)}; u.dispatchEvent(new Event('input',{bubbles:true}));
    var k=document.getElementById('s-kode'); k.value='KODE-OPERATOR'; k.dispatchEvent(new Event('input',{bubbles:true}));
    return true; })()`);
  await tidur(400);
  cek('baru diisi', await ev(keadaan));

  for (let i = 1; i <= 3; i++) {
    await kirim('Page.reload'); await tidur(2400);
    cek('sesudah muat ulang ke-' + i, await ev(keadaan));
  }

  /* tirukan pemuatan ulang otomatis versi baru: reload sambil melewati simpanan */
  await kirim('Page.reload', { ignoreCache: true }); await tidur(2600);
  cek('muat ulang lewati simpanan', await ev(keadaan));

  /* tirukan kotak terhapus tanpa sengaja lalu dipakai lagi */
  const bahaya = await ev(`(function(){
    var u=document.getElementById('s-url');
    u.value=''; u.dispatchEvent(new Event('input',{bubbles:true}));
    var p = JSON.parse(localStorage.getItem('wavi_muat_pusat_v1')||'{}');
    return {simpanUrl: p.url || '', simpanKode: p.kode || ''};
  })()`);
  const aman = !!(bahaya.simpanUrl && bahaya.simpanKode);
  if (!aman) ok = false;
  console.log(`  ${aman ? 'OK  ' : 'GAGAL'}  ${'kotak dikosongkan tak sengaja'.padEnd(38)} simpanan ${aman ? 'BERTAHAN' : 'IKUT TERHAPUS'}`);

  ws.close(); anak.kill();
  console.log('\n' + (ok ? '=== TIDAK TERBUKTI HILANG ===' : '=== TERBUKTI ADA YANG HILANG ==='));
  process.exit(ok ? 0 : 1);
};
main().catch((e) => { console.error('GAGAL:', e.message); anak.kill(); process.exit(1); });
