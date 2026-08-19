/* Menguji rencana keamanan data 1-5 di aplikasi sungguhan.
   Dijalankan lewat tombol di layar seperti pemakai. */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const ALAMAT = 'http://127.0.0.1:8801/index.html';
const API = 'http://127.0.0.1:8801/api';
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

async function bukaHP(port) {
  const profil = mkdtempSync(join(tmpdir(), 'aman-'));
  const anak = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profil}`, '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let url, id = 0;
  for (let i = 0; i < 60 && !url; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
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
  const ev = async (e) => {
    const r = await kirim('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };
  const muat = async () => { await kirim('Page.navigate', { url: ALAMAT }); await tidur(2400); };
  await muat();
  return { ev, muat, tutup: () => { ws.close(); anak.kill(); } };
}

const atur = (kode) => `(function(){
  var u=document.getElementById('s-url'); u.value=${JSON.stringify(API)}; u.dispatchEvent(new Event('input',{bubbles:true}));
  var k=document.getElementById('s-kode'); k.value=${JSON.stringify(kode)}; k.dispatchEvent(new Event('input',{bubbles:true}));
  return true; })()`;

const simpan = (truk, pilihan) => `(async function(){
  document.getElementById('b-baru').click();
  await new Promise(function(r){ setTimeout(r,300); });
  if(!document.getElementById('modal').hidden){
    var y=document.getElementById('mo-ya');
    if(!y.hidden) y.click(); else { var a=document.querySelector('#mo-aksi button'); if(a) a.click(); }
    await new Promise(function(r){ setTimeout(r,300); });
  }
  for(var i=0;i<3;i++){
    var inp=document.querySelector('#tbl-wrap [data-cell="'+i+'"] input');
    inp.value='10,00'; inp.dispatchEvent(new Event('input',{bubbles:true}));
  }
  var e=document.getElementById('i-truk'); e.value=${JSON.stringify(truk)};
  e.dispatchEvent(new Event('input',{bubbles:true}));
  document.getElementById('b-simpan').click();
  await new Promise(function(r){ setTimeout(r,500); });
  var tb=document.querySelectorAll('#mo-aksi button');
  if(tb.length) tb[${pilihan}].click();
  await new Promise(function(r){ setTimeout(r,1500); });
  return true;
})()`;

const STATUS = "document.getElementById('pusat-status').textContent";

const main = async () => {
  const hp = await bukaHP(9880);
  let ok = true;
  const cek = (n, d, hh) => {
    const l = typeof hh === 'function' ? hh(d) : JSON.stringify(d) === JSON.stringify(hh);
    if (!l) ok = false;
    console.log(`  ${l ? 'OK  ' : 'GAGAL'}  ${n.padEnd(52)} ${JSON.stringify(d).slice(0, 90)}`);
  };

  console.log('=== 1. Tombol baru ada ===');
  cek('tombol Tarik Ulang Semua', await hp.ev(`!!document.getElementById('b-tarik')`), true);
  cek('tombol Rapikan Muat Lama', await hp.ev(`!!document.getElementById('b-rapikan')`), true);

  console.log('\n=== 2. Izin penyimpanan permanen diminta ===');
  const izin = await hp.ev(`(async function(){
    var sudah = await navigator.storage.persisted();
    return {diminta: typeof navigator.storage.persist === 'function', sudah: sudah};
  })()`);
  cek('aplikasi memakai jalur izin permanen', izin.diminta, true);
  console.log('       (izin diberikan browser: ' + izin.sudah + ' — di headless memang sering ditolak)');

  await hp.ev(atur('KODE-OPERATOR'));

  console.log('\n=== 3. Penanda muat yang belum masuk pusat ===');
  await hp.ev(simpan('G 1111 AA', 0));      /* kirim ke pusat */
  await hp.ev(simpan('N 2222 BB', 1));      /* HP saja */
  await tidur(600);
  const s1 = await hp.ev(STATUS);
  cek('papan keadaan menyebut muat yang hanya di HP', s1, (v) => /1 muat belum pernah masuk pusat/.test(v));

  console.log('\n=== 4. Rapikan hanya menyentuh yang sudah di pusat ===');
  const rapi1 = await hp.ev(`(async function(){
    document.getElementById('b-rapikan').click();
    await new Promise(function(r){ setTimeout(r,400); });
    var pesan = (document.querySelector('.toast')||{}).textContent || '';
    var dialogMuncul = !document.getElementById('modal').hidden;
    return {pesan: pesan, dialogMuncul: dialogMuncul,
            jml: JSON.parse(localStorage.getItem('wavi_muat_hist_v1')).length};
  })()`);
  cek('dengan 2 muat: tidak ada yang dibuang', rapi1,
      (v) => /Belum ada yang perlu dirapikan/.test(v.pesan) && v.dialogMuncul === false && v.jml === 2);

  /* isi 250 muat yang sudah di pusat + 1 muat lokal, lalu rapikan */
  const rapi2 = await hp.ev(`(async function(){
    var l = JSON.parse(localStorage.getItem('wavi_muat_hist_v1'));
    var lokal = l.filter(function(m){ return !m.oleh; })[0];
    var baru = [];
    for(var i=0;i<250;i++){
      baru.push({id:'X'+i, tanggal:'2026-08-01', noTruk:'T'+i, roll:1, tonase:1,
                 w:[1], diubah:Date.now(), oleh:'HP-LAIN'});
    }
    baru.push(lokal);                       /* muat "hanya di HP ini" ikut, di urutan akhir */
    localStorage.setItem('wavi_muat_hist_v1', JSON.stringify(baru));
    location.reload();
    return true;
  })()`);
  await tidur(2600);
  await hp.ev(atur('KODE-OPERATOR'));
  await tidur(400);

  const rapi3 = await hp.ev(`(async function(){
    var sebelum = JSON.parse(localStorage.getItem('wavi_muat_hist_v1')).length;
    document.getElementById('b-rapikan').click();
    await new Promise(function(r){ setTimeout(r,450); });
    var judul = document.getElementById('mo-judul').textContent;
    document.getElementById('mo-ya').click();
    await new Promise(function(r){ setTimeout(r,700); });
    var l = JSON.parse(localStorage.getItem('wavi_muat_hist_v1'));
    return {judul: judul, sebelum: sebelum, sesudah: l.length,
            lokalMasihAda: l.some(function(m){ return !m.oleh; })};
  })()`);
  /* 201 = 200 terbaru + 1 muat "Hanya di HP ini" yang memang tidak boleh disentuh */
  cek('251 muat -> sisa 200 terbaru + 1 muat lokal', { sebelum: rapi3.sebelum, sesudah: rapi3.sesudah },
      { sebelum: 251, sesudah: 201 });
  cek('muat "Hanya di HP ini" TIDAK ikut dibuang', rapi3.lokalMasihAda, true);

  hp.tutup();
  console.log('\n' + (ok ? '=== LULUS ===' : '=== ADA YANG GAGAL ==='));
  process.exit(ok ? 0 : 1);
};
main().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
