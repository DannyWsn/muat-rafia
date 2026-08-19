/* Uji asap dari alamat TAYANG (https), bukan file://. Ini sekaligus menguji
   servis luring: di https servis luring benar-benar terdaftar, sesuatu yang
   tidak pernah terjadi saat diuji dari file://. */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9250 + Math.floor(Math.random() * 40);
const profil = mkdtempSync(join(tmpdir(), 'tayang-'));
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
  if (p.method === 'Runtime.exceptionThrown') galat.push(p.params.exceptionDetails.exception?.description || p.params.exceptionDetails.text);
  if (p.method === 'Log.entryAdded' && p.params.entry.level === 'error') galat.push(p.params.entry.text); });
const kirim = (m, params = {}) => new Promise((res, rej) => { const i = ++id;
  t.set(i, (p) => (p.error ? rej(new Error(JSON.stringify(p.error))) : res(p.result)));
  ws.send(JSON.stringify({ id: i, method: m, params })); });
await kirim('Page.enable'); await kirim('Runtime.enable'); await kirim('Log.enable');
const ev = async (e) => { const r = await kirim('Runtime.evaluate',
  { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
  return r.result.value; };
await kirim('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
await kirim('Page.navigate', { url: 'https://dannywsn.github.io/muat-rafia/index.html' });
await tidur(5000);
const h = await ev(`(function(){
  var v = document.getElementById('view-set');
  return {
    judul: document.title,
    adaGigi: !!document.getElementById('tab-set'),
    adaPengaturan: !!v,
    logoPNG: (document.querySelector('#brand-mark img')||{src:''}).src.slice(0,15),
    kopDiInput: /Pengaturan Kop Surat/.test(document.getElementById('view-input').innerHTML),
    swTerdaftar: !!navigator.serviceWorker
  };
})()`);
/* buka Pengaturan dan Histori seperti pemakai */
await ev(`document.getElementById('tab-set').click()`); await tidur(700);
const set = await ev(`(function(){ return {
  tampil: !document.getElementById('view-set').hidden,
  profil: (document.getElementById('s-sub-profil')||{textContent:''}).textContent.trim() }; })()`);
await ev(`document.getElementById('tab-hist').click()`); await tidur(700);
const hist = await ev(`(function(){ return {
  bilahCari: !!document.getElementById('b-cari'),
  pesanKosong: (document.querySelector('#hist-list .empty')||{textContent:''}).textContent.trim().slice(0,30) }; })()`);
const sw = await ev(`(async function(){
  if(!navigator.serviceWorker) return 'tidak didukung';
  var r = await navigator.serviceWorker.getRegistrations();
  return r.length ? 'terdaftar: ' + r.length : 'belum terdaftar';
})()`);
console.log(JSON.stringify({ ...h, ...set, ...hist, servisLuring: sw,
  galat: galat.filter((g) => !/favicon/i.test(g)) }, null, 2));
try { anak.kill(); } catch {}
