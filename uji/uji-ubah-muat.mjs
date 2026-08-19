/* Kasus hari perdana muat: muat SUDAH tersimpan di pusat, lalu konsumen
   menambah barang. Membuka muat itu, menambah timbangan, dan menyimpan lagi
   harus LANGSUNG memperbarui pusat - tanpa bertanya lagi - dan HP lain harus
   melihat angka yang baru. */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const ALAMAT = 'http://127.0.0.1:8801/index.html', API = 'http://127.0.0.1:8801/api';
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

async function bukaHP(port) {
  const profil = mkdtempSync(join(tmpdir(), 'hpu-'));
  const anak = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profil}`, '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let url, id = 0;
  for (let i = 0; i < 60 && !url; i++) {
    try { const j = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
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
  await kirim('Page.navigate', { url: ALAMAT }); await tidur(2300);
  return { ev, tutup: () => { ws.close(); anak.kill(); } };
}
const atur = (kode) => `(function(){
  var u=document.getElementById('s-url'); u.value=${JSON.stringify(API)}; u.dispatchEvent(new Event('input',{bubbles:true}));
  var k=document.getElementById('s-kode'); k.value=${JSON.stringify(kode)}; k.dispatchEvent(new Event('input',{bubbles:true}));
  return true; })()`;

const main = async () => {
  const opr = await bukaHP(9801), pem = await bukaHP(9802);
  let ok = true;
  const cek = (n, d, hh) => { const l = JSON.stringify(d) === JSON.stringify(hh);
    if (!l) ok = false; console.log(`  ${l ? 'OK  ' : 'GAGAL'}  ${n.padEnd(54)} ${JSON.stringify(d)}`); };

  await opr.ev(atur('KODE-OPERATOR'));
  await pem.ev(atur('RAHASIA-PEMILIK'));

  /* muat pertama: 3 roll, dikirim ke pusat */
  const a = await opr.ev(`(async function(){
    function isi(id,v){var e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}
    for(var i=0;i<3;i++){
      var inp=document.querySelector('#tbl-wrap [data-cell="'+i+'"] input');
      inp.value='10,00'; inp.dispatchEvent(new Event('input',{bubbles:true}));
    }
    isi('i-truk','G 8726 MG'); isi('i-penerima','Bp. Rifai'); isi('i-tujuan','Brebes');
    document.getElementById('b-simpan').click();
    await new Promise(function(r){ setTimeout(r,500); });
    var tombol=document.querySelectorAll('#mo-aksi button');
    var ditanya = tombol.length > 0;
    if(tombol.length) tombol[0].click();           /* Kirim ke pusat */
    await new Promise(function(r){ setTimeout(r,1600); });
    return {ditanya: ditanya, roll: document.getElementById('ro-roll').textContent};
  })()`);
  cek('muat pertama: ditanya sekali, lalu dikirim', a, { ditanya: true, roll: '3' });

  await pem.ev("document.getElementById('b-sinkron').click()"); await tidur(1500);
  const b = await pem.ev(`JSON.parse(localStorage.getItem('wavi_muat_hist_v1'))[0].roll`);
  cek('pemilik melihat 3 roll', b, 3);

  /* konsumen menambah barang: muat yang SAMA ditambah 2 roll lalu disimpan lagi */
  const c = await opr.ev(`(async function(){
    for(var i=3;i<5;i++){
      var inp=document.querySelector('#tbl-wrap [data-cell="'+i+'"] input');
      inp.value='10,00'; inp.dispatchEvent(new Event('input',{bubbles:true}));
    }
    document.getElementById('b-simpan').click();
    await new Promise(function(r){ setTimeout(r,1800); });
    return {ditanyaLagi: document.querySelectorAll('#mo-aksi button').length > 0,
            modalMuncul: !document.getElementById('modal').hidden,
            roll: document.getElementById('ro-roll').textContent,
            jml: JSON.parse(localStorage.getItem('wavi_muat_hist_v1')).length,
            antre: JSON.parse(localStorage.getItem('wavi_muat_antre_v1')||'[]').length};
  })()`);
  cek('ditambah 2 roll: TIDAK ditanya lagi, langsung terkirim',
      c, { ditanyaLagi: false, modalMuncul: false, roll: '5', jml: 1, antre: 0 });

  await pem.ev("document.getElementById('b-sinkron').click()"); await tidur(1600);
  const d = await pem.ev(`(function(){
    var l = JSON.parse(localStorage.getItem('wavi_muat_hist_v1'));
    return {jml: l.length, roll: l[0].roll, tonase: l[0].tonase};
  })()`);
  cek('pemilik melihat pembaruannya, bukan muat kedua', d, { jml: 1, roll: 5, tonase: 50 });

  /* kartunya harus tetap bertanda "ada di pusat", bukan berubah jadi lokal */
  const e = await opr.ev(`(function(){
    /* kini titik hijau bertitel, bukan tulisan sebaris penuh */
    var k = document.querySelector('.hrec .hr-dot');
    return k ? (k.getAttribute('title') || '').trim() : 'tidak ada tanda';
  })()`);
  cek('kartu tetap bertanda ada di pusat', e, 'Ada di pusat — terlihat di semua HP');

  opr.tutup(); pem.tutup();
  console.log(ok ? '\n=== LULUS ===' : '\n=== ADA YANG GAGAL ===');
  process.exit(ok ? 0 : 1);
};
main().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
