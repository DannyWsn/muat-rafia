/* Membuktikan Kode Pabrik tidak lagi terpampang di layar, DAN bahwa
   menyembunyikannya tidak merusak penjaga lama: kotak yang terkosongkan tanpa
   sengaja tidak boleh menghapus sambungan (jebakan no. 10 di BLUEPRINT). */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const AKAR = join(import.meta.dirname, '..');
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = 9000 + Math.floor(Math.random() * 20);
const profil = mkdtempSync(join(tmpdir(), 'kode-'));
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
  if (p.method === 'Runtime.exceptionThrown') galat.push(p.params.exceptionDetails.exception?.description || '?'); });
const kirim = (m, params = {}) => new Promise((res, rej) => { const i = ++id;
  t.set(i, (p) => (p.error ? rej(new Error(JSON.stringify(p.error))) : res(p.result)));
  ws.send(JSON.stringify({ id: i, method: m, params })); });
await kirim('Page.enable'); await kirim('Runtime.enable');
const ev = async (e) => { const r = await kirim('Runtime.evaluate',
  { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
  return r.result.value; };

const hasil = [];
const cek = (nama, lulus, bukti) => { hasil.push({ nama, lulus });
  console.log((lulus ? '  LULUS ' : '  GAGAL ') + nama + '  ->  ' + bukti); };

await kirim('Emulation.setDeviceMetricsOverride', { width: 360, height: 700, deviceScaleFactor: 2, mobile: true });
await kirim('Page.navigate', { url: 'file:///' + join(AKAR, 'index.html').replace(/\\/g, '/') });
await tidur(2400);
await ev(`(function(){
  localStorage.setItem('wavi_muat_pusat_v1', JSON.stringify({
    url:'https://contoh/exec', kode:'kode-rahasia-123', sejak:0, peran:'pemilik'}));
  return 1; })()`);
await kirim('Page.reload');
await tidur(2500);
await ev(`document.getElementById('tab-set').click()`); await tidur(400);
await ev(`document.querySelector('[data-panel="set-pusat"]').click()`); await tidur(500);

const awal = await ev(`(function(){
  var e = document.getElementById('s-kode');
  return { jenis: e.type, nilai: e.value,
           tombol: (document.getElementById('b-lihat-kode')||{textContent:''}).textContent.trim(),
           lebarKotak: Math.round(e.getBoundingClientRect().width),
           lebarTombol: Math.round((document.getElementById('b-lihat-kode')||{getBoundingClientRect:function(){return{width:0}}}).getBoundingClientRect().width),
           barisSama: Math.abs(e.getBoundingClientRect().top -
             document.getElementById('b-lihat-kode').getBoundingClientRect().top) < 6 }; })()`);
cek('kode tidak terbaca di layar (titik-titik)', awal.jenis === 'password',
    'type="' + awal.jenis + '", isinya tetap tersimpan: ' + (awal.nilai === 'kode-rahasia-123'));
cek('tombol Lihat ada di baris yang sama dan tidak meluber',
    awal.barisSama && awal.lebarKotak > 120 && awal.lebarTombol > 40,
    'kotak ' + awal.lebarKotak + 'px + tombol "' + awal.tombol + '" ' + awal.lebarTombol + 'px');

await ev(`document.getElementById('b-lihat-kode').click()`); await tidur(300);
const dibuka = await ev(`(function(){
  return { jenis: document.getElementById('s-kode').type,
           tombol: document.getElementById('b-lihat-kode').textContent.trim() }; })()`);
cek('tombol Lihat membuka kode', dibuka.jenis === 'text' && /Sembunyikan/.test(dibuka.tombol),
    'type="' + dibuka.jenis + '", tombol "' + dibuka.tombol + '"');

await ev(`document.getElementById('b-lihat-kode').click()`); await tidur(300);
const ditutup = await ev(`document.getElementById('s-kode').type`);
cek('bisa disembunyikan lagi', ditutup === 'password', 'type="' + ditutup + '"');

/* jebakan no. 10 harus tetap terjaga */
await ev(`(function(){
  var e = document.getElementById('s-kode');
  e.value = '';
  e.dispatchEvent(new Event('input',{bubbles:true}));
  e.dispatchEvent(new Event('blur',{bubbles:true}));
  return 1; })()`);
await tidur(600);
const setelahDikosongkan = await ev(`(function(){
  var p = JSON.parse(localStorage.getItem('wavi_muat_pusat_v1')||'{}');
  return { tersimpan: p.kode, diKotak: document.getElementById('s-kode').value }; })()`);
cek('kotak dikosongkan tanpa sengaja TIDAK menghapus sambungan (jebakan no. 10)',
    setelahDikosongkan.tersimpan === 'kode-rahasia-123',
    'tersimpan tetap ada; kotak dipulihkan jadi "' +
    (setelahDikosongkan.diKotak ? '(terisi)' : '(kosong)') + '"');

cek('tidak ada galat', galat.length === 0, galat.length ? galat.slice(0, 2).join(' | ') : 'nol galat');

const gagal = hasil.filter((h) => !h.lulus);
console.log('\n' + (hasil.length - gagal.length) + '/' + hasil.length + ' pemeriksaan lulus');
try { anak.kill(); } catch {}
process.exit(gagal.length ? 1 : 0);
