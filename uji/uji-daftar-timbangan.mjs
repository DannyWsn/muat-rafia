/* Membuka aplikasi di Chrome sungguhan, mengisi timbangan lewat ANTARMUKA
   (bukan memanggil fungsi dalam), menekan tombol Cetak, lalu:
     - memotret lembar cetaknya dalam mode cetak
     - MENGUKUR tiap baris & kolom lalu membandingkan dengan angka Excel  */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SP = import.meta.dirname;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
].find((p) => p && existsSync(p));
if (!CHROME) { console.log('Chrome tidak ditemukan'); process.exit(1); }

const PORT = 9333;
const profil = mkdtempSync(join(tmpdir(), 'ujichrome-'));
const anak = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profil}`,
  '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--allow-file-access-from-files', '--window-size=1200,2400', 'about:blank',
], { stdio: 'ignore' });

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetWS() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const j = await r.json();
      const t = j.find((x) => x.type === 'page');
      if (t) return t.webSocketDebuggerUrl;
    } catch {}
    await tidur(250);
  }
  throw new Error('Chrome tidak menyahut');
}

let idKe = 0;
function buatKlien(ws) {
  const tunggu = new Map();
  ws.addEventListener('message', (ev) => {
    const p = JSON.parse(ev.data);
    if (p.id && tunggu.has(p.id)) { tunggu.get(p.id)(p); tunggu.delete(p.id); }
  });
  return (method, params = {}) => new Promise((res, rej) => {
    const id = ++idKe;
    tunggu.set(id, (p) => (p.error ? rej(new Error(method + ': ' + JSON.stringify(p.error))) : res(p.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function nilai(kirim, ekspresi) {
  const r = await kirim('Runtime.evaluate', {
    expression: ekspresi, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(ekspresi.slice(0, 60) + ' -> ' + JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
}

const main = async () => {
  const url = await targetWS();
  const ws = new WebSocket(url);
  await new Promise((r) => ws.addEventListener('open', r));
  const kirim = buatKlien(ws);

  await kirim('Page.enable');
  await kirim('Runtime.enable');
  await kirim('Page.navigate', { url: 'file:///D:/muat-rafia/index.html' });
  await tidur(2500);

  /* ---- isi lewat antarmuka, seperti pemilik memakainya ---- */
  const terisi = await nilai(kirim, `(function(){
    window.print = function(){ window.__cetakDipanggil = true; };
    /* isi menurut NOMOR ROLL (data-cell), bukan urutan tampilan */
    var kotak = [];
    for(var q=0;q<140;q++){
      var td = document.querySelector('#tbl-wrap [data-cell="' + q + '"]');
      kotak.push(td ? td.querySelector('input') : null);
    }
    /* 23 roll: campuran desimal yang "jahat" supaya penjumlahan benar-benar diuji */
    var uji = ['25,15','24,90','25,05','24,75','25,35','24,60','25,20','25,00','24,85','25,10',
               '25,30','24,95','25,45','24,70','25,25','25,05','24,80','25,15','25,00','24,90',
               '25,35','24,65','25,20'];
    for(var i=0;i<uji.length;i++){
      kotak[i].value = uji[i];
      kotak[i].dispatchEvent(new Event('input', {bubbles:true}));
    }
    document.getElementById('i-penerima').value = 'TOKO SUMBER REJEKI';
    document.getElementById('i-penerima').dispatchEvent(new Event('input', {bubbles:true}));
    document.getElementById('i-truk').value = 'K 1234 AB';
    document.getElementById('i-truk').dispatchEvent(new Event('input', {bubbles:true}));
    document.getElementById('i-tanggal').value = '2026-08-16';
    document.getElementById('i-tanggal').dispatchEvent(new Event('input', {bubbles:true}));
    return {roll: document.getElementById('ro-roll').textContent,
            ton: document.getElementById('ro-ton').textContent};
  })()`);
  console.log('terbaca di layar  : roll =', terisi.roll, ', tonase =', terisi.ton);

  /* jumlah yang benar, dihitung terpisah */
  const uji = ['25,15','24,90','25,05','24,75','25,35','24,60','25,20','25,00','24,85','25,10',
               '25,30','24,95','25,45','24,70','25,25','25,05','24,80','25,15','25,00','24,90',
               '25,35','24,65','25,20'];
  const benarSen = uji.reduce((a, s) => a + Math.round(parseFloat(s.replace(',', '.')) * 100), 0);
  const benarTeks = (benarSen / 100).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  console.log('seharusnya        : roll = ' + uji.length + ' , tonase = ' + benarTeks);
  const cocokLayar = terisi.roll === String(uji.length) && terisi.ton === benarTeks;
  console.log(cocokLayar ? '  -> COCOK' : '  -> TIDAK COCOK');

  /* ---- tekan tombol Cetak ---- */
  await nilai(kirim, `(function(){
    window.__galat = [];
    window.addEventListener('error', function(e){ window.__galat.push(String(e.message) + ' @ ' + e.lineno); });
    return true;
  })()`);
  await nilai(kirim, `document.getElementById('b-cetak').click()`);
  await tidur(600);
  const adaLembar = await nilai(kirim, `!!document.querySelector('#print-root .xl')`);
  console.log('lembar cetak dibuat:', adaLembar);
  if (!adaLembar) {
    console.log('galat        :', await nilai(kirim, `JSON.stringify(window.__galat || [])`));
    console.log('modal muncul :', await nilai(kirim, `!document.getElementById('modal').hidden`));
    console.log('judul modal  :', await nilai(kirim, `document.getElementById('mo-judul').textContent`));
    console.log('isi modal    :', await nilai(kirim, `document.getElementById('mo-isi').textContent.slice(0,200)`));
    console.log('toast        :', await nilai(kirim, `(document.querySelector('.toast')||{}).textContent || '-'`));
    console.log('print-root   :', await nilai(kirim, `document.getElementById('print-root').innerHTML.slice(0,200)`));
    ws.close(); anak.kill(); return;
  }

  /* ---- UKUR: bandingkan dengan angka Excel ---- */
  const TB_EXCEL = [15,21,15,15,15,15,15,15.75,16.5,16.5,
                    15.75,15.75,15.75,15.75,15.75,15.75,15.75,15.75,15.75,16.5,
                    15.75,15.75,16.5,15.75,15.75,15.75,15.75,15.75,15.75,15.75,
                    15.75,15.75,16.5,16.5,15,15,15,15,15,15.75,
                    15.75,15,15,15,15,15,15,15];
  const KOL_EXCEL = [62.25,54.75,54.75,54.75,54.75,54.75,54.75,54.75];

  /* Ukur DALAM MODE CETAK — di layar biasa lembar ini sengaja disembunyikan,
     sehingga tidak punya ukuran sama sekali. */
  await kirim('Emulation.setEmulatedMedia', { media: 'print' });
  await tidur(500);

  const ukur = await nilai(kirim, `(function(){
    var t = document.querySelector('#print-root .xl-t');
    var baris = [].map.call(t.rows, function(r){ return r.getBoundingClientRect().height; });
    var sel1 = [].map.call(t.rows[0].cells, function(c){ return c.getBoundingClientRect().width; });
    var img = document.querySelector('#print-root .xl-logo').getBoundingClientRect();
    var lebar = t.getBoundingClientRect().width;
    return {baris: baris, kolomBaris1: sel1, lebar: lebar,
            logo: {w: img.width, h: img.height, x: img.left - t.getBoundingClientRect().left,
                   y: img.top - t.getBoundingClientRect().top}};
  })()`);

  const PX = 96 / 72;                       /* 1 pt = 1,3333 px */
  const bulat = (x) => Math.round(x * 1000) / 1000;
  let bedaBaris = [];
  ukur.baris.forEach((h, i) => {
    const harus = TB_EXCEL[i] * PX;
    if (Math.abs(h - harus) > 0.51) bedaBaris.push(`baris ${i + 1}: ${bulat(h)}px vs Excel ${bulat(harus)}px`);
  });
  let bedaKolom = [];
  ukur.kolomBaris1.forEach((w, i) => {
    const harus = KOL_EXCEL[i] * PX;
    if (Math.abs(w - harus) > 0.51) bedaKolom.push(`kolom ${String.fromCharCode(65 + i)}: ${bulat(w)}px vs Excel ${bulat(harus)}px`);
  });

  console.log('\n=== UKURAN vs EXCEL (toleransi 0,5px pembulatan) ===');
  console.log(`jumlah baris  : ${ukur.baris.length} (Excel 48)`);
  console.log(`lebar tabel   : ${bulat(ukur.lebar)}px  vs Excel ${bulat(445.5 * PX)}px`);
  console.log(`logo          : ${bulat(ukur.logo.w)}x${bulat(ukur.logo.h)}px di (${bulat(ukur.logo.x)},${bulat(ukur.logo.y)})`);
  console.log(`                vs Excel ${bulat(143.5876 * PX)}x${bulat(114 * PX)}px di (0,0)`);
  console.log(bedaBaris.length ? 'BARIS MELESET:\n  ' + bedaBaris.join('\n  ') : 'tinggi baris  : 48/48 COCOK');
  console.log(bedaKolom.length ? 'KOLOM MELESET:\n  ' + bedaKolom.join('\n  ') : 'lebar kolom   : 8/8 COCOK');

  /* ---- apakah teks di kaki saling bertabrakan? diukur, bukan dikira ---- */
  const tabrak = await nilai(kirim, `(function(){
    var t = document.querySelector('#print-root .xl-t');
    /* Membaca kotak teks yang BENAR-BENAR tergambar (bukan menebak dari
       perataan): Range di atas isi sel memberi persegi hasil tata letak asli. */
    function kotakTeks(td){
      var rng = document.createRange();
      rng.selectNodeContents(td);
      var r = rng.getBoundingClientRect();
      if(!(r.width > 0)) throw new Error('kotak teks kosong untuk "' + td.textContent + '"');
      return {teks: td.textContent, kiri: r.left, kanan: r.right, lebar: r.width,
              rata: getComputedStyle(td).textAlign,
              sel: td.getBoundingClientRect().left + '..' + td.getBoundingClientRect().right};
    }
    var hasil = [];
    [36,37].forEach(function(nb){
      var sel = t.rows[nb-1].cells;
      var isi = [];
      for(var i=0;i<sel.length;i++){
        if(sel[i].textContent.trim()) isi.push(kotakTeks(sel[i]));
      }
      for(var j=1;j<isi.length;j++){
        if(isi[j].kiri < isi[j-1].kanan - 0.01){
          hasil.push('baris ' + nb + ': "' + isi[j-1].teks.trim() + '" menabrak "' + isi[j].teks.trim() +
                     '" sebanyak ' + (isi[j-1].kanan - isi[j].kiri).toFixed(2) + 'px');
        }
      }
      isi.forEach(function(x){ hasil.push('  baris ' + nb + ' | "' + x.teks.trim() + '" teks ' +
        x.kiri.toFixed(1) + '..' + x.kanan.toFixed(1) + '  sel ' + x.sel + '  rata=' + x.rata); });
    });
    return hasil;
  })()`);
  console.log('\n=== TABRAKAN TEKS DI KAKI ===');
  const bentrok = tabrak.filter((s) => s.includes('menabrak'));
  console.log(bentrok.length ? bentrok.join('\n') : 'tidak ada teks yang bertabrakan');
  tabrak.filter((s) => !s.includes('menabrak')).forEach((s) => console.log(s));

  /* ---- tinggi keseluruhan: harus muat satu halaman A4 ---- */
  const totalPt = TB_EXCEL.reduce((a, b) => a + b, 0);
  const ruangA4 = 841.89 - 54 - 32;
  console.log(`\ntinggi isi    : ${totalPt}pt   ruang A4 (margin 54 atas / 32 bawah): ${bulat(ruangA4)}pt`);
  console.log(totalPt <= ruangA4 ? '  -> MUAT SATU HALAMAN' : '  -> MASIH PECAH DUA HALAMAN');

  /* ---- potret ---- */
  const kotak = await nilai(kirim, `(function(){
    var e = document.querySelector('#print-root .xl').getBoundingClientRect();
    return {x: e.left + scrollX, y: e.top + scrollY, w: e.width, h: e.height};
  })()`);
  const foto = await kirim('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: kotak.x, y: kotak.y, width: kotak.w, height: kotak.h, scale: 2 },
  });
  writeFileSync(SP + '/hasil-cetak.png', Buffer.from(foto.data, 'base64'));
  console.log(`\npotret lembar : ${SP}/hasil-cetak.png  (${bulat(kotak.w)}x${bulat(kotak.h)}px)`);

  ws.close();
  anak.kill();
};

main().catch((e) => { console.error('GAGAL:', e.message); anak.kill(); process.exit(1); });
