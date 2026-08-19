/* MENGUKUR tampilan Histori yang ADA SEKARANG di layar HP.
   Bukan menaksir dari kode: aplikasi sungguhan dijalankan di Chrome, diisi
   histori tiruan yang mewakili kasus nyata, lalu tiap kartu diukur dan
   dipotret. Aturan blueprint §2.3: ukur, jangan menaksir dari gambar. */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SP = import.meta.dirname;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

/* Enam muat yang mewakili kasus nyata di pabrik:
   - nomor truk panjang dan pendek, ada yang kosong
   - penerima panjang (paling sering memanjang di HP)
   - satu masih di antrean kirim, satu hanya di HP ini */
const HIST = [
  { id: 'M1', tanggal: '2026-08-19', noTruk: 'K 1234 ABC', penerima: 'Bp. Rifai', tujuan: 'Brebes', barang: 'Rafia Kw 3', harga: 11500, kendaraan: 'Truck', noSJ: '001', roll: 140, tonase: 8623.4, oleh: 'HP-A' },
  { id: 'M2', tanggal: '2026-08-18', noTruk: 'K 9876 XY', penerima: 'Toko Sumber Rejeki Makmur Jaya', tujuan: 'Purwokerto', barang: 'Rafia Kw 2', harga: 12000, kendaraan: 'Truck', noSJ: '002', roll: 98, tonase: 5312.75, oleh: 'HP-A' },
  { id: 'M3', tanggal: '2026-08-18', noTruk: '', penerima: 'Bp. Slamet', tujuan: 'Kudus', barang: 'Rafia Kw 3', harga: 0, kendaraan: 'Truck', noSJ: '', roll: 12, tonase: 740.5, oleh: '' },
  { id: 'M4', tanggal: '2026-08-17', noTruk: 'K 4455 CD', penerima: 'Bp. Hartono', tujuan: 'Semarang', barang: 'Rafia Kw 3', harga: 11500, kendaraan: 'Truck', noSJ: '003', roll: 140, tonase: 8801.05, oleh: 'HP-B' },
  { id: 'M5', tanggal: '2026-08-16', noTruk: 'K 7788 EF', penerima: 'Bp. Rifai', tujuan: 'Brebes', barang: 'Rafia Kw 2', harga: 12000, kendaraan: 'Truck', noSJ: '004', roll: 77, tonase: 4210, oleh: 'HP-A' },
  { id: 'M6', tanggal: '2026-08-15', noTruk: 'K 2211 GH', penerima: 'Toko Maju Lancar', tujuan: 'Pati', barang: 'Rafia Kw 3', harga: 11500, kendaraan: 'Truck', noSJ: '005', roll: 55, tonase: 3105.9, oleh: 'HP-A' },
];
const ANTRE = ['M5'];                        /* M5 = menunggu terkirim  */
const PUSAT = { url: 'https://contoh/exec', kode: 'UJI', sejak: Date.now(), peran: 'pemilik' };

const LAYAR = [
  { nama: 'HP-kecil', w: 360, h: 640 },     /* HP 5 inci, yang paling sesak */
  { nama: 'HP-biasa', w: 412, h: 915 },     /* Infinix Note 40 dan sekelasnya */
];

async function sesi() {
  const PORT = 9780 + Math.floor(Math.random() * 40);
  const profil = mkdtempSync(join(tmpdir(), 'histori-'));
  const anak = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profil}`, '--disable-gpu', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let url, id = 0;
  for (let i = 0; i < 80 && !url; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
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
  return { kirim, ev, tutup: () => { try { anak.kill(); } catch {} } };
}

/* Pengukur: dijalankan DI DALAM halaman, membaca geometri sungguhan. */
const UKUR = `(function(){
  var out = { layar: innerWidth + 'x' + innerHeight, kartu: [], kartuPertama: null };
  var sec = document.getElementById('view-hist');
  out.tinggiSeluruhTab = Math.round(sec.getBoundingClientRect().height);
  var kartuAtas = sec.querySelectorAll('.card');
  out.kartuSetelan = [];
  for (var j = 0; j < kartuAtas.length; j++) {
    var t = kartuAtas[j].querySelector('.card-title');
    out.kartuSetelan.push({
      judul: t ? t.textContent : '?',
      tinggi: Math.round(kartuAtas[j].getBoundingClientRect().height)
    });
  }
  var recs = document.querySelectorAll('.hrec');
  out.jumlahKartuMuat = recs.length;
  for (var i = 0; i < recs.length; i++) {
    var r = recs[i].getBoundingClientRect();
    var tombol = recs[i].querySelectorAll('.hrec-act button');
    var barisTombol = {}, kecil = [];
    for (var k = 0; k < tombol.length; k++) {
      var b = tombol[k].getBoundingClientRect();
      barisTombol[Math.round(b.top)] = 1;
      if (b.height < 44 || b.width < 44) {
        kecil.push(tombol[k].textContent + '=' + Math.round(b.width) + 'x' + Math.round(b.height));
      }
    }
    var pen = recs[i].querySelector('.hrec-sub');
    out.kartu.push({
      no: i + 1,
      tinggi: Math.round(r.height),
      jumlahTombol: tombol.length,
      barisTombol: Object.keys(barisTombol).length,
      tombolDiBawah44px: kecil,
      penerimaTerpotong: pen ? (pen.scrollWidth > pen.clientWidth + 1) : null,
      adaTanda: !!recs[i].querySelector('.hrec-tanda')
    });
  }
  /* berapa kartu muat yang benar-benar terlihat dalam satu layar, dihitung
     dari puncak daftar kartu muat sampai batas bawah layar */
  var daftar = document.getElementById('hist-list');
  out.puncakDaftarDariAtasHalaman = Math.round(daftar.getBoundingClientRect().top + scrollY);
  var satu = recs.length ? Math.round(recs[0].getBoundingClientRect().height) : 0;
  out.tinggiSatuKartu = satu;
  var bar = document.getElementById('actbar');
  out.tinggiBilahBawah = bar ? Math.round(bar.getBoundingClientRect().height) : 0;
  var ruang = innerHeight - out.tinggiBilahBawah;
  out.kartuTerlihatSekaliLayar = satu ? +(ruang / (satu + 10)).toFixed(2) : 0;
  out.gulirUntukSampaiKartuPertama = out.puncakDaftarDariAtasHalaman;
  return out;
})()`;

const s = await sesi();
const hasil = {};

for (const L of LAYAR) {
  await s.kirim('Emulation.setDeviceMetricsOverride',
    { width: L.w, height: L.h, deviceScaleFactor: 2, mobile: true });
  await s.kirim('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await s.kirim('Page.navigate', { url: 'file:///D:/muat-rafia/index.html' });
  await tidur(2200);
  /* histori tiruan dipasang lalu halaman dimuat ulang, supaya aplikasi
     membacanya lewat jalur normalnya sendiri */
  await s.ev(`(function(){
    localStorage.setItem('wavi_muat_hist_v1', ${JSON.stringify(JSON.stringify(HIST))});
    localStorage.setItem('wavi_muat_antre_v1', ${JSON.stringify(JSON.stringify(ANTRE))});
    localStorage.setItem('wavi_muat_pusat_v1', ${JSON.stringify(JSON.stringify(PUSAT))});
    return 1;
  })()`);
  await s.kirim('Page.reload');
  await tidur(2400);
  /* pindah ke tab Histori seperti pemakai: menekan tombol tabnya */
  await s.ev(`(function(){ document.getElementById('tab-hist').click(); return 1; })()`);
  await tidur(700);

  hasil[L.nama] = await s.ev(UKUR);

  /* potret 1: apa yang pemilik lihat begitu membuka tab Histori */
  let png = await s.kirim('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SP, `kini-${L.nama}-layar1.png`), Buffer.from(png.data, 'base64'));

  /* potret 2: seluruh tab dari atas sampai bawah */
  png = await s.kirim('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(join(SP, `kini-${L.nama}-penuh.png`), Buffer.from(png.data, 'base64'));

  /* potret 3: digulir sampai kartu muat pertama, supaya kartunya terlihat jelas */
  await s.ev(`(function(){ var d=document.getElementById('hist-list');
    scrollTo(0, d.getBoundingClientRect().top + scrollY - 8); return 1; })()`);
  await tidur(500);
  png = await s.kirim('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SP, `kini-${L.nama}-kartu.png`), Buffer.from(png.data, 'base64'));
}

s.tutup();
writeFileSync(join(SP, 'ukuran-histori-kini.json'), JSON.stringify(hasil, null, 2));
console.log(JSON.stringify(hasil, null, 2));
