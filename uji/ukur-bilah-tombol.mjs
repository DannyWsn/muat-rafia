/* Mengukur bilah tombol bawah di 320/360/412 px: berapa ruang tersisa kalau
   tulisan "Baru" diganti "Muat Baru". Supaya usulan kata bukan cuma enak
   didengar, tetapi memang muat. */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9100 + Math.floor(Math.random() * 40);
const profil = mkdtempSync(join(tmpdir(), 'actbar-'));
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
const t = new Map();
ws.addEventListener('message', (e) => { const p = JSON.parse(e.data);
  if (p.id && t.has(p.id)) { t.get(p.id)(p); t.delete(p.id); } });
const kirim = (m, params = {}) => new Promise((res, rej) => { const i = ++id;
  t.set(i, (p) => (p.error ? rej(new Error(JSON.stringify(p.error))) : res(p.result)));
  ws.send(JSON.stringify({ id: i, method: m, params })); });
await kirim('Runtime.enable');
const ev = async (e) => { const r = await kirim('Runtime.evaluate',
  { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
  return r.result.value; };
await kirim('Page.navigate', { url: 'file:///D:/muat-rafia/index.html' });
await tidur(2400);
for (const w of [320, 360, 412]) {
  await kirim('Emulation.setDeviceMetricsOverride', { width: w, height: 700, deviceScaleFactor: 2, mobile: true });
  await tidur(350);
  const u = await ev(`(function(){
    var bar = document.getElementById('actbar');
    var tombol = [].slice.call(bar.querySelectorAll('button, label.btn'));
    var lebarTotal = tombol.reduce(function(a,b){ return a + b.getBoundingClientRect().width; }, 0);
    var wadah = bar.querySelector('div:last-child') || bar;
    var hasil = { layar: innerWidth, tombol: tombol.map(function(b){
      return b.textContent.trim() + '=' + Math.round(b.getBoundingClientRect().width); }),
      totalLebar: Math.round(lebarTotal) };
    /* coba ganti tulisannya, ukur, lalu kembalikan */
    var baru = document.getElementById('b-baru');
    var asli = baru ? baru.textContent : '';
    if(baru){
      baru.textContent = 'Muat Baru';
      hasil.kalauMuatBaru = Math.round(baru.getBoundingClientRect().width);
      hasil.barisSetelahGanti = (function(){
        var atas = {};
        tombol.forEach(function(b){ atas[Math.round(b.getBoundingClientRect().top)] = 1; });
        return Object.keys(atas).length;
      })();
      baru.textContent = 'Tambah Muat';
      hasil.kalauTambahMuat = Math.round(baru.getBoundingClientRect().width);
      hasil.barisTambahMuat = (function(){
        var atas = {};
        tombol.forEach(function(b){ atas[Math.round(b.getBoundingClientRect().top)] = 1; });
        return Object.keys(atas).length;
      })();
      baru.textContent = asli;
    }
    return hasil;
  })()`);
  console.log(JSON.stringify(u));
}
try { anak.kill(); } catch {}
