/* Mengukur berapa piksel nama perusahaan terpotong di bilah atas, di beberapa
   lebar layar, lalu memotretnya. Supaya keputusan ukuran huruf berdasar angka. */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SP = import.meta.dirname + '/';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = 9550 + Math.floor(Math.random() * 40);
const profil = mkdtempSync(join(tmpdir(), 'bilah-'));
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
await kirim('Runtime.enable');
const ev = async (e) => {
  const r = await kirim('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
};

await kirim('Page.navigate', { url: 'file:///D:/muat-rafia/index.html' });
await tidur(2400);
await ev(`(function(){ localStorage.setItem('wavi_muat_kop_v1',
  JSON.stringify({nama:'WAVI RAFIA GRUP',al1:'a',al2:'b',al3:'c',kota:'Rembang',bank:'BCA',rek:'1',an:'x'}));
  return 1; })()`);
await kirim('Page.reload');
await tidur(2200);

for (const w of [320, 360, 390, 412]) {
  await kirim('Emulation.setDeviceMetricsOverride', { width: w, height: 300, deviceScaleFactor: 2, mobile: true });
  await tidur(350);
  const u = await ev(`(function(){
    var n = document.getElementById('brand-name');
    var g = getComputedStyle(n);
    return { perlu: n.scrollWidth, dapat: n.clientWidth, huruf: g.fontSize,
             kurang: Math.max(0, n.scrollWidth - n.clientWidth) };
  })()`);
  console.log(`${w}px: huruf ${u.huruf} · butuh ${u.perlu}px, tersedia ${u.dapat}px` +
              (u.kurang ? ` -> KURANG ${u.kurang}px` : ' -> utuh'));
  const png = await kirim('Page.captureScreenshot', { format: 'png' });
  writeFileSync(SP + `bilah-${w}.png`, Buffer.from(png.data, 'base64'));
}
try { anak.kill(); } catch {}
