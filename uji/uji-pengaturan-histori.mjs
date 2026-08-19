/* MEMBUKTIKAN Tahap 4 dari aplikasi yang SUNGGUHAN: layar Pengaturan dan
   Histori yang dirombak dikendalikan lewat tombol seperti pemakai, lalu
   hasilnya diukur di dalam halaman. */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SP = import.meta.dirname + '/';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

/* w = daftar berat 140 kotak; roll dan tonase dibuat pas supaya bisa diperiksa */
const muat = (id, tgl, truk, pen, tuj, brg, harga, roll, per, oleh) => {
  const w = new Array(140).fill(null);
  for (let i = 0; i < roll; i++) w[i] = per;
  return { id, tanggal: tgl, noTruk: truk, penerima: pen, tujuan: tuj, barang: brg,
           harga, kendaraan: 'Truck', noSJ: '001', roll, tonase: roll * per, w, oleh };
};
const HIST = [
  muat('M1', '2026-08-19', 'K 1234 ABC', 'Bp. Rifai', 'Brebes', 'Rafia Kw 3', 11500, 100, 25, 'HP-A'),
  muat('M2', '2026-08-18', 'K 9876 XY', 'Toko Sumber Rejeki Makmur Jaya', 'Purwokerto', 'Rafia Kw 2', 12000, 50, 26, 'HP-A'),
  muat('M3', '2026-08-18', '', 'Bp. Slamet', 'Kudus', 'Rafia Kw 3', null, 12, 25, ''),
  muat('M4', '2026-08-17', 'K 4455 CD', 'Bp. Hartono', 'Semarang', 'Rafia Kw 3', 11500, 140, 25, 'HP-B'),
  muat('M5', '2026-08-16', 'K 7788 EF', 'Bp. Rifai', 'Brebes', 'Rafia Kw 2', 12000, 77, 25, 'HP-A'),
];
const ANTRE = ['M5'];
const PUSAT = { url: 'https://contoh/exec', kode: 'UJI', sejak: Date.now(), peran: 'pemilik' };
const KOP = { nama: 'WAVI RAFIA GRUP', al1: 'Jl. Raya Rembang - Blora KM 5',
              al2: 'Desa Sumberejo, Rembang', al3: 'Telp. 0812 3456 7890',
              kota: 'Rembang', bank: 'BCA', rek: '7835290611', an: 'Wahyu Tejo Sudarmawan' };

const PORT = 9600 + Math.floor(Math.random() * 60);
const profil = mkdtempSync(join(tmpdir(), 'uji4-'));
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
const galat = [];
ws.addEventListener('message', (e) => {
  const p = JSON.parse(e.data);
  if (p.id && t.has(p.id)) { t.get(p.id)(p); t.delete(p.id); return; }
  if (p.method === 'Runtime.exceptionThrown') {
    galat.push('kecuali: ' + (p.params.exceptionDetails.exception?.description ||
                              p.params.exceptionDetails.text));
  }
  if (p.method === 'Log.entryAdded' && p.params.entry.level === 'error') {
    const teks = p.params.entry.text || '';
    if (!/manifest|CORS policy|ERR_FAILED/i.test(teks)) galat.push('log: ' + teks);
  }
});
const kirim = (m, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  t.set(i, (p) => (p.error ? rej(new Error(JSON.stringify(p.error))) : res(p.result)));
  ws.send(JSON.stringify({ id: i, method: m, params }));
});
await kirim('Page.enable'); await kirim('Runtime.enable'); await kirim('Log.enable');
const ev = async (e) => {
  const r = await kirim('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
};

const hasil = [];
const cek = (nama, lulus, bukti) => {
  hasil.push({ nama, lulus, bukti });
  console.log((lulus ? '  LULUS ' : '  GAGAL ') + nama + '  ->  ' + bukti);
};

await kirim('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
await kirim('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await kirim('Page.navigate', { url: 'file:///D:/muat-rafia/index.html' });
await tidur(2400);
await ev(`(function(){
  localStorage.setItem('wavi_muat_hist_v1', ${JSON.stringify(JSON.stringify(HIST))});
  localStorage.setItem('wavi_muat_antre_v1', ${JSON.stringify(JSON.stringify(ANTRE))});
  localStorage.setItem('wavi_muat_pusat_v1', ${JSON.stringify(JSON.stringify(PUSAT))});
  localStorage.setItem('wavi_muat_kop_v1', ${JSON.stringify(JSON.stringify(KOP))});
  return 1;
})()`);
await kirim('Page.reload');
await tidur(2600);

cek('halaman dimuat tanpa galat JavaScript', galat.length === 0,
    galat.length ? galat.slice(0, 3).join(' | ') : 'nol galat');

/* ================= LAYAR INPUT ================= */
const input = await ev(`(function(){
  var v = document.getElementById('view-input');
  return {
    adaKopSurat: /Pengaturan Kop Surat/i.test(v.innerHTML),
    adaTombolGigi: !!document.getElementById('tab-set'),
    namaMerek: document.getElementById('brand-name').textContent
  };
})()`);
cek('Kop Surat sudah TIDAK ada di layar Input', input.adaKopSurat === false,
    'ditemukan: ' + input.adaKopSurat);
cek('tombol Pengaturan ada di bilah atas', input.adaTombolGigi, 'tab-set ada');
cek('nama perusahaan terbaca dari setelan', input.namaMerek === 'WAVI RAFIA GRUP', input.namaMerek);

/* ================= LAYAR PENGATURAN ================= */
await ev(`document.getElementById('tab-set').click()`);
await tidur(600);
const set = await ev(`(function(){
  var v = document.getElementById('view-set');
  var amb = function(id){ var e=document.getElementById(id); return e ? e.textContent.trim() : 'TIDAK ADA'; };
  var pil = document.getElementById('s-pil-pusat');
  return {
    tampil: !v.hidden,
    menuTampil: !document.getElementById('set-menu').hidden,
    inputTersembunyi: document.getElementById('view-input').hidden,
    histTersembunyi: document.getElementById('view-hist').hidden,
    actbarTersembunyi: document.getElementById('actbar').hidden,
    subProfil: amb('s-sub-profil'), subRek: amb('s-sub-rek'),
    subPusat: amb('s-sub-pusat'), subCadangan: amb('s-sub-cadangan'),
    lencanaPusat: pil.hidden ? '(tersembunyi)' : pil.textContent,
    logoIkon: !!document.querySelector('#s-ikon-logo img')
  };
})()`);
cek('layar Pengaturan terbuka, layar lain tertutup',
    set.tampil && set.menuTampil && set.inputTersembunyi && set.histTersembunyi && set.actbarTersembunyi,
    'set tampil=' + set.tampil + ' input hidden=' + set.inputTersembunyi + ' actbar hidden=' + set.actbarTersembunyi);
cek('baris Profil Perusahaan berisi keterangan hidup',
    set.subProfil === 'WAVI RAFIA GRUP · Rembang', '"' + set.subProfil + '"');
cek('baris Rekening berisi bank dan nomor',
    /BCA 7835290611/.test(set.subRek), '"' + set.subRek + '"');
cek('baris Pusat Data menyebut peran', /pemilik/.test(set.subPusat), '"' + set.subPusat + '"');
cek('baris Cadangan menyebut jumlah muat', /^5 muat/.test(set.subCadangan), '"' + set.subCadangan + '"');
cek('lencana "belum terkirim" muncul di baris Pusat Data',
    set.lencanaPusat === '2', 'lencana = ' + set.lencanaPusat + ' (M3 hanya di HP + M5 menunggu)');
cek('logo tampil di baris Profil', set.logoIkon, 'ada <img>');

/* --- panel Profil Perusahaan --- */
await ev(`document.querySelector('[data-panel="set-profil"]').click()`);
await tidur(500);
let profilCek = await ev(`(function(){
  return {
    panelTampil: !document.getElementById('set-profil').hidden,
    menuTutup: document.getElementById('set-menu').hidden,
    isiNama: document.getElementById('k-nama').value,
    isiKota: document.getElementById('k-kota').value,
    praNama: document.getElementById('s-pra-nama').textContent,
    praAl1: document.getElementById('s-pra-al1').textContent,
    praLogo: !!document.querySelector('#s-pra-logo img')
  };
})()`);
cek('panel Profil terbuka dan isian terisi dari setelan',
    profilCek.panelTampil && profilCek.menuTutup && profilCek.isiNama === 'WAVI RAFIA GRUP'
      && profilCek.isiKota === 'Rembang',
    'nama="' + profilCek.isiNama + '" kota="' + profilCek.isiKota + '"');
cek('pratinjau kop menampilkan nama dan alamat',
    profilCek.praNama === 'WAVI RAFIA GRUP' && /Blora KM 5/.test(profilCek.praAl1) && profilCek.praLogo,
    '"' + profilCek.praNama + '" / "' + profilCek.praAl1 + '"');

/* pratinjau harus ikut berubah saat diketik */
await ev(`(function(){
  var e = document.getElementById('k-nama');
  e.value = 'WAVI RAFIA JAYA';
  e.dispatchEvent(new Event('input', {bubbles:true}));
  return 1;
})()`);
await tidur(300);
const hidup = await ev(`(function(){
  return { pra: document.getElementById('s-pra-nama').textContent,
           merek: document.getElementById('brand-name').textContent,
           tersimpan: JSON.parse(localStorage.getItem('wavi_muat_kop_v1')).nama };
})()`);
cek('pratinjau, bilah atas, dan penyimpanan ikut berubah saat kop diketik',
    hidup.pra === 'WAVI RAFIA JAYA' && hidup.merek === 'WAVI RAFIA JAYA' && hidup.tersimpan === 'WAVI RAFIA JAYA',
    'pratinjau="' + hidup.pra + '" merek="' + hidup.merek + '" tersimpan="' + hidup.tersimpan + '"');
/* dikembalikan */
await ev(`(function(){ var e=document.getElementById('k-nama'); e.value='WAVI RAFIA GRUP';
  e.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`);

/* --- tombol kembali --- */
await ev(`document.querySelector('#set-profil [data-balik]').click()`);
await tidur(400);
const balik = await ev(`(function(){ return {
  menu: !document.getElementById('set-menu').hidden,
  profil: document.getElementById('set-profil').hidden }; })()`);
cek('tombol kembali mengembalikan ke daftar Pengaturan', balik.menu && balik.profil,
    'menu tampil=' + balik.menu);

/* --- panel Pusat Data dan Cadangan: elemen lama harus utuh --- */
await ev(`document.querySelector('[data-panel="set-pusat"]').click()`);
await tidur(400);
const pusatPanel = await ev(`(function(){
  var ids = ['pusat-status','s-url','s-kode','b-uji','b-sinkron','b-unggah','b-tarik','b-rapikan','b-putus'];
  var hilang = ids.filter(function(i){ return !document.getElementById(i); });
  return { hilang: hilang, url: document.getElementById('s-url').value };
})()`);
cek('semua tombol dan isian Pusat Data pindah utuh', pusatPanel.hilang.length === 0,
    pusatPanel.hilang.length ? 'HILANG: ' + pusatPanel.hilang.join(',') : '9 elemen lengkap, alamat=' + pusatPanel.url);

await ev(`document.querySelector('#set-pusat [data-balik]').click()`);
await tidur(300);
await ev(`document.querySelector('[data-panel="set-cadangan"]').click()`);
await tidur(500);
const cadPanel = await ev(`(function(){
  var ids = ['hist-count','meter','meter-txt','b-export','f-import','b-cek'];
  var hilang = ids.filter(function(i){ return !document.getElementById(i); });
  return { hilang: hilang, meter: document.getElementById('meter-txt').textContent,
           lebar: document.querySelector('#meter i').style.width };
})()`);
cek('Cadangan Data pindah utuh dan meter terisi',
    cadPanel.hilang.length === 0 && /Pemakaian penyimpanan/.test(cadPanel.meter) && cadPanel.lebar !== '0%',
    cadPanel.hilang.length ? 'HILANG: ' + cadPanel.hilang.join(',') : cadPanel.meter + ' (lebar ' + cadPanel.lebar + ')');

/* ================= HISTORI ================= */
await ev(`document.getElementById('tab-hist').click()`);
await tidur(700);
const hist = await ev(`(function(){
  var isi = document.querySelector('#view-hist .stack').getBoundingClientRect();
  var recs = document.querySelectorAll('.hrec');
  var grup = document.querySelectorAll('.hgrup');
  var utuh = 0, tinggi = [];
  for(var i=0;i<recs.length;i++){
    var r = recs[i].getBoundingClientRect();
    tinggi.push(Math.round(r.height));
    if(r.bottom <= innerHeight + 0.5) utuh++;
  }
  var kecil = [], tb = document.querySelectorAll('.hr-act .hb');
  for(var k=0;k<tb.length;k++){
    var b = tb[k].getBoundingClientRect();
    if(b.height < 44 || b.width < 44) kecil.push((tb[k].textContent||'?') + '=' +
      Math.round(b.width) + 'x' + Math.round(b.height));
  }
  /* .hr-2 dan .hr-truk MEMANG dipotong titik-tiga, jadi scrollWidth-nya
     sengaja lebih besar - itu bukan meluber. Yang benar-benar salah adalah
     kalau KARTUNYA melebihi lebar wadah atau halaman bisa digulir ke samping. */
  var wadah = document.querySelector('#view-hist .stack').getBoundingClientRect();
  var luber = [];
  for(var m=0;m<recs.length;m++){
    var rr = recs[m].getBoundingClientRect();
    if(rr.width > wadah.width + 0.5) luber.push('kartu ke-' + (m+1) + ' lebar ' + Math.round(rr.width));
  }
  if(document.documentElement.scrollWidth > innerWidth + 1)
    luber.push('halaman bisa digulir ke samping: ' + document.documentElement.scrollWidth + ' > ' + innerWidth);
  /* titik-tiga harus benar-benar bekerja pada penerima yang panjang */
  var panjang = null;
  for(m=0;m<recs.length;m++) if(/Toko Sumber/.test(recs[m].textContent)) panjang = recs[m].querySelector('.hr-2');
  var t = document.getElementById('view-hist').textContent;
  return {
    jumlahKartu: recs.length,
    jumlahGrup: grup.length,
    grupTeks: Array.prototype.map.call(grup, function(g){ return g.textContent.replace(/\\s+/g,' ').trim(); }),
    tinggi: tinggi,
    kartuUtuh: utuh,
    gulirKeKartuPertama: recs.length ? Math.round(recs[0].getBoundingClientRect().top - isi.top) : -1,
    tombolKecil: kecil,
    meluber: luber,
    titikTigaBekerja: panjang ? (getComputedStyle(panjang).textOverflow === 'ellipsis' &&
      panjang.scrollWidth > panjang.clientWidth) : false,
    adaTulisanAdaDiPusat: /Ada di pusat/.test(t),
    adaHanyaDiHP: /Hanya di HP ini/.test(t),
    adaMenunggu: /Menunggu terkirim/.test(t),
    rupiahM1: (function(){
      var a = document.querySelectorAll('.hrec');
      var e = a[0].querySelector('.hr-rp');
      return e ? e.textContent : '(tidak ada)';
    })(),
    kartuTanpaHarga: (function(){
      var a = document.querySelectorAll('.hrec');
      for(var i=0;i<a.length;i++) if(/Bp. Slamet/.test(a[i].textContent))
        return a[i].querySelector('.hr-rp') ? 'ADA RUPIAH' : 'tanpa rupiah';
      return 'kartu tidak ketemu';
    })(),
    tombolKirim: document.querySelectorAll('.hr-act .hb.kirim').length,
    chipLokal: (function(){ var c=document.getElementById('chip-lokal');
      return c.hidden ? '(tersembunyi)' : c.textContent; })()
  };
})()`);
cek('lima kartu muat tampil', hist.jumlahKartu === 5, hist.jumlahKartu + ' kartu');
cek('kartu dikelompokkan per tanggal dengan total harian', hist.jumlahGrup === 4,
    hist.jumlahGrup + ' kelompok: ' + hist.grupTeks.join(' | '));
cek('total harian benar (18/08 = 2 muat, 1.300+300 = 1.600,00 kg)',
    hist.grupTeks.some((g) => /18\/08/.test(g) && /2 muat/.test(g) && /1\.600,00 kg/.test(g)),
    hist.grupTeks.find((g) => /18\/08/.test(g)) || '(tidak ketemu)');
cek('gulir sampai kartu pertama jauh lebih pendek dari 882 px',
    hist.gulirKeKartuPertama > 0 && hist.gulirKeKartuPertama < 200,
    hist.gulirKeKartuPertama + ' px (sebelumnya 882 px)');
cek('kartu muat sudah terlihat tanpa digulir', hist.kartuUtuh >= 2,
    hist.kartuUtuh + ' kartu utuh dalam layar 360x640 (sebelumnya 0)');
cek('tinggi kartu turun dari 192 px', Math.min(...hist.tinggi) <= 160,
    'tinggi kartu: ' + hist.tinggi.join(', '));
cek('semua tombol kartu minimal 44 px', hist.tombolKecil.length === 0,
    hist.tombolKecil.length ? hist.tombolKecil.join(' ') : 'nol tombol di bawah 44 px');
cek('kartu tidak melebihi lebar layar dan halaman tidak bisa digulir ke samping',
    hist.meluber.length === 0, hist.meluber.length ? hist.meluber.join(' ; ') : 'nol');
cek('penerima panjang dipotong titik-tiga, bukan memanjangkan kartu',
    hist.titikTigaBekerja, 'text-overflow ellipsis aktif dan teks memang terpotong');
cek('tulisan "Ada di pusat" diringkas jadi titik', hist.adaTulisanAdaDiPusat === false,
    'ada tulisan: ' + hist.adaTulisanAdaDiPusat);
cek('yang perlu tindakan TETAP bertuliskan jelas',
    hist.adaHanyaDiHP && hist.adaMenunggu,
    'Hanya di HP ini=' + hist.adaHanyaDiHP + ', Menunggu terkirim=' + hist.adaMenunggu);
cek('rupiah dihitung benar (2.500,00 kg x 11.500 = 28.750.000)',
    hist.rupiahM1 === 'Rp 28.750.000', hist.rupiahM1);
cek('kartu tanpa harga tidak menampilkan rupiah', hist.kartuTanpaHarga === 'tanpa rupiah',
    hist.kartuTanpaHarga);
cek('tombol Kirim hanya pada muat yang perlu dikirim', hist.tombolKirim === 1,
    hist.tombolKirim + ' tombol Kirim (hanya M3 yang hanya di HP)');
cek('chip "Belum di pusat" menunjukkan jumlah', /Belum di pusat · 2/.test(hist.chipLokal),
    hist.chipLokal);

/* --- pencarian --- */
await ev(`document.getElementById('b-cari').click()`);
await tidur(300);
await ev(`(function(){ var e=document.getElementById('h-cari'); e.value='rifai';
  e.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`);
await tidur(400);
const cari1 = await ev(`(function(){ return {
  n: document.querySelectorAll('.hrec').length,
  teks: document.getElementById('hist-list').textContent.replace(/\\s+/g,' ').slice(0,80),
  chipsTersembunyi: document.getElementById('hchips').hidden }; })()`);
cek('cari "rifai" menyisakan dua muat Bp. Rifai', cari1.n === 2,
    cari1.n + ' kartu · ' + cari1.teks);
cek('chip saring disembunyikan saat kotak cari terbuka', cari1.chipsTersembunyi, 'hidden=true');

await ev(`(function(){ var e=document.getElementById('h-cari'); e.value='brebes';
  e.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`);
await tidur(400);
const cari2 = await ev(`document.querySelectorAll('.hrec').length`);
cek('cari bisa memakai KOTA TUJUAN ("brebes")', cari2 === 2, cari2 + ' kartu');

await ev(`(function(){ var e=document.getElementById('h-cari'); e.value='zzz';
  e.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`);
await tidur(400);
const cari3 = await ev(`(function(){ return {
  n: document.querySelectorAll('.hrec').length,
  pesan: (document.querySelector('#hist-list .empty')||{textContent:''}).textContent.replace(/\\s+/g,' ').trim() }; })()`);
cek('pencarian tanpa hasil memberi pesan yang jelas',
    cari3.n === 0 && /Tidak ada yang cocok/.test(cari3.pesan), '"' + cari3.pesan + '"');

await ev(`document.getElementById('b-cari-tutup').click()`);
await tidur(400);
const tutup = await ev(`(function(){ return {
  n: document.querySelectorAll('.hrec').length,
  isiKotak: document.getElementById('h-cari').value,
  chipTampil: !document.getElementById('hchips').hidden }; })()`);
cek('tombol tutup mengosongkan pencarian dan memulihkan daftar',
    tutup.n === 5 && tutup.isiKotak === '' && tutup.chipTampil,
    tutup.n + ' kartu, kotak="' + tutup.isiKotak + '"');

/* --- saring chip --- */
await ev(`document.querySelector('#hchips [data-saring="lokal"]').click()`);
await tidur(400);
const saring = await ev(`(function(){ return {
  n: document.querySelectorAll('.hrec').length,
  aktif: document.querySelector('#hchips [aria-pressed="true"]').getAttribute('data-saring') }; })()`);
cek('saring "Belum di pusat" menyisakan 2 muat', saring.n === 2 && saring.aktif === 'lokal',
    saring.n + ' kartu, chip aktif=' + saring.aktif);

await ev(`document.querySelector('#hchips [data-saring="semua"]').click()`);
await tidur(300);

/* --- menu titik tiga --- */
await ev(`document.querySelector('.hrec .hb.lain').click()`);
await tidur(600);
const menu = await ev(`(function(){
  var m = document.querySelector('.modal');
  if(!m) return {ada:false};
  var b = Array.prototype.map.call(m.querySelectorAll('.aksi'), function(x){
    return x.textContent.split('\\n')[0].trim().slice(0,24); });
  return { ada:true, judul: document.getElementById('mo-judul').textContent, pilihan: b };
})()`);
cek('menu titik tiga berisi Cetak dan Hapus (bukan di baris tombol)',
    menu.ada && menu.pilihan.some((x) => /^Cetak/.test(x)) && menu.pilihan.some((x) => /^Hapus muat/.test(x)),
    menu.ada ? 'judul "' + menu.judul + '" · pilihan: ' + menu.pilihan.join(' | ') : 'dialog tidak muncul');
const hapusDiBaris = await ev(`document.querySelectorAll('.hr-act [data-act="hapus"]').length`);
cek('tombol Hapus tidak lagi ada di baris tombol kartu', hapusDiBaris === 0,
    hapusDiBaris + ' tombol hapus di kartu');

/* Hapus harus tetap bertanya dulu */
await ev(`(function(){
  var b = Array.prototype.slice.call(document.querySelectorAll('.modal .aksi'));
  for(var i=0;i<b.length;i++) if(/^Hapus muat/.test(b[i].textContent)){ b[i].click(); return 1; }
  return 0;
})()`);
await tidur(600);
const konfirm = await ev(`(function(){
  return { judul: document.getElementById('mo-judul').textContent,
           masihLima: JSON.parse(localStorage.getItem('wavi_muat_hist_v1')).length }; })()`);
cek('Hapus tetap meminta pemastian dan belum menghapus apa pun',
    /Hapus muat\?/.test(konfirm.judul) && konfirm.masihLima === 5,
    'dialog "' + konfirm.judul + '", histori masih ' + konfirm.masihLima + ' muat');
/* dibatalkan */
await ev(`(function(){ var b=document.querySelectorAll('.modal button');
  for(var i=0;i<b.length;i++) if(/Batal/.test(b[i].textContent)){ b[i].click(); break; } return 1; })()`);
await tidur(400);

/* ================= BILAH ATAS: tidak boleh bertabrakan =================
   Bug nyata yang sudah terjadi: setelah tombol Pengaturan ditambahkan,
   nama perusahaan menimpa tab "Input". Diuji di tiga lebar layar. */
for (const lebar of [320, 360, 412]) {
  await kirim('Emulation.setDeviceMetricsOverride',
    { width: lebar, height: 700, deviceScaleFactor: 2, mobile: true });
  await tidur(400);
  const bar = await ev(`(function(){
    var txt = document.querySelector('.brand-txt').getBoundingClientRect();
    var tabs = document.querySelector('.tabs').getBoundingClientRect();
    var nama = document.getElementById('brand-name');
    var nr = nama.getBoundingClientRect();
    return {
      tumpang: Math.round(Math.max(0, txt.right - tabs.left)),
      namaTumpang: Math.round(Math.max(0, nr.right - tabs.left)),
      gulirSamping: document.documentElement.scrollWidth > innerWidth + 1,
      tinggiBilah: Math.round(document.querySelector('.brand').getBoundingClientRect().height),
      namaTerpotong: nama.scrollWidth > nama.clientWidth
    };
  })()`);
  cek('bilah atas tidak bertabrakan di layar ' + lebar + 'px',
      bar.tumpang === 0 && bar.namaTumpang === 0 && !bar.gulirSamping,
      'tumpang ' + bar.tumpang + 'px, gulir samping=' + bar.gulirSamping +
      ', tinggi bilah ' + bar.tinggiBilah + 'px' +
      (bar.namaTerpotong ? ', nama dipotong titik-tiga' : ', nama utuh'));
}
await kirim('Emulation.setDeviceMetricsOverride',
  { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
await tidur(400);

cek('tidak ada galat sampai akhir pengujian', galat.length === 0,
    galat.length ? galat.slice(0, 3).join(' | ') : 'nol galat');

/* potret bukti */
let png = await kirim('Page.captureScreenshot', { format: 'png' });
writeFileSync(SP + 'bukti-histori-baru.png', Buffer.from(png.data, 'base64'));
await ev(`document.getElementById('tab-set').click()`);
await tidur(500);
png = await kirim('Page.captureScreenshot', { format: 'png' });
writeFileSync(SP + 'bukti-pengaturan.png', Buffer.from(png.data, 'base64'));

const gagal = hasil.filter((h) => !h.lulus);
console.log('\n' + (hasil.length - gagal.length) + '/' + hasil.length + ' pemeriksaan lulus');
if (gagal.length) console.log('GAGAL:\n' + gagal.map((g) => ' - ' + g.nama + ': ' + g.bukti).join('\n'));
try { anak.kill(); } catch {}
process.exit(gagal.length ? 1 : 0);
