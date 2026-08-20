/* MENGUJI SKRIP PUSAT (Kode-Apps-Script.gs) SEBELUM DITEMPEL KE GOOGLE.
 *
 * Skripnya dijalankan sungguhan di atas Spreadsheet tiruan, lalu diperlakukan
 * seperti aplikasi memperlakukannya: kirim, ambil, periksa, dan mengetik
 * langsung di sel.
 *
 * Kenapa penting: sebelum ini, satu-satunya cara mengetahui skrip pusat
 * bekerja adalah menyuruh pemilik menempelnya ke Google lalu mencoba. Kalau
 * salah, yang rugi data sungguhan.
 */
import { muatAppsScript, GS_BAKU } from './tiruan-apps-script.mjs';
import { existsSync } from 'node:fs';

if (!existsSync(GS_BAKU)) {
  console.log('DILEWATI: ' + GS_BAKU + ' tidak ada di laptop ini.');
  console.log('(Berkas itu SENGAJA di luar repo karena berisi Kode Pabrik.)');
  process.exit(0);
}

/* Jeda kecil: penyaringan memakai "diterima <= sejak", dan seluruh uji ini
   berjalan dalam hitungan milidetik. Tanpa jeda, suntingan bisa jatuh pada
   milidetik yang SAMA dengan penanda waktu lalu ikut tersaring - itu
   kekeliruan uji, bukan cacat skrip. */
const jeda = (ms) => new Promise((r) => setTimeout(r, ms));

const KP = 'kode-pemilik-uji';
const KO = 'kode-operator-uji';
const hasil = [];
const cek = (nama, lulus, bukti) => {
  hasil.push({ nama, lulus });
  console.log((lulus ? '  LULUS ' : '  GAGAL ') + nama + '  ->  ' + bukti);
};

const muat = (id, tanggal, extra) => Object.assign({
  id, tanggal, noTruk: 'K 1 A', penerima: 'Bp. Rifai', barang: 'Rafia Kw 3',
  harga: 11500, kendaraan: 'Truck', noSJ: '001', roll: 10, tonase: 250,
  w: [25, 25, 25], tujuan: 'Brebes', diubah: Date.now(),
}, extra || {});

/* ================= 1. peran dan Kode Pabrik ================= */
{
  const g = muatAppsScript(GS_BAKU, { kodePemilik: KP, kodeOperator: KO });
  cek('kode pemilik dikenali', g.post({ kode: KP, aksi: 'periksa' }).peran === 'pemilik',
      JSON.stringify(g.post({ kode: KP, aksi: 'periksa' })));
  cek('kode operator dikenali', g.post({ kode: KO, aksi: 'periksa' }).peran === 'operator', 'peran=operator');
  const salah = g.post({ kode: 'ngawur', aksi: 'periksa' });
  cek('kode salah ditolak', salah.ok === false && /Kode Pabrik salah/.test(salah.pesan), JSON.stringify(salah));
  const kosong = g.post({ aksi: 'periksa' });
  cek('tanpa kode ditolak', kosong.ok === false, JSON.stringify(kosong));
}

/* ================= 2. lembar KODE: bisa diganti dari Spreadsheet ================= */
{
  const g = muatAppsScript(GS_BAKU, { kodePemilik: KP, kodeOperator: KO });
  g.post({ kode: KP, aksi: 'periksa' });                 /* memicu pembuatan lembar */
  const L = g.buku.getSheetByName('KODE');
  cek('lembar KODE dibuat sendiri dan terisi dari skrip',
      !!L && L.isi().length === 3 && L.isi()[1][1] === KP && L.isi()[2][1] === KO,
      L ? JSON.stringify(L.isi()) : 'lembar KODE tidak dibuat');
  cek('kolom kode dijadikan TEKS (kode berupa angka tidak berubah)',
      L.formatKolom(1) === '@', 'format kolom kode = "' + L.formatKolom(1) + '"');

  /* pemilik mengganti kode operator dengan mengetik di sel */
  L.getRange(3, 2).setValue('kode-operator-baru');
  cek('kode operator LAMA langsung tidak berlaku',
      g.post({ kode: KO, aksi: 'periksa' }).ok === false, 'ditolak setelah diganti');
  cek('kode operator BARU langsung berlaku',
      g.post({ kode: 'kode-operator-baru', aksi: 'periksa' }).peran === 'operator',
      'peran=operator, tanpa menempel skrip dan tanpa Terapkan versi baru');
  cek('kode pemilik tidak ikut terganggu',
      g.post({ kode: KP, aksi: 'periksa' }).peran === 'pemilik', 'peran=pemilik');
}

/* ================= 3. kirim, ambil, dan hak operator ================= */
{
  const g = muatAppsScript(GS_BAKU, { kodePemilik: KP, kodeOperator: KO });
  const a = g.post({ kode: KO, oleh: 'HP-A', aksi: 'kirim', data: [muat('M1', '2026-08-18')], sejak: 0 });
  cek('operator boleh menambah muat', a.ok === true && (a.ditolak || []).length === 0,
      JSON.stringify({ ok: a.ok, ditolak: a.ditolak }));

  const b = g.post({ kode: KO, oleh: 'HP-B', aksi: 'kirim',
                     data: [muat('M1', '2026-08-18', { penerima: 'DIUBAH ORANG LAIN' })], sejak: 0 });
  cek('operator TIDAK boleh mengubah muat HP lain',
      (b.ditolak || []).some((x) => x.id === 'M1' && /bukan milik/.test(x.sebab)),
      JSON.stringify(b.ditolak));

  const c = g.post({ kode: KO, oleh: 'HP-A', aksi: 'kirim',
                     data: [{ id: 'M1', dihapus: 1, diubah: Date.now() }], sejak: 0 });
  cek('operator TIDAK boleh menghapus',
      (c.ditolak || []).some((x) => /hanya pemilik/.test(x.sebab)), JSON.stringify(c.ditolak));

  const d = g.post({ kode: KP, oleh: 'HP-PEMILIK', aksi: 'kirim',
                     data: [{ id: 'M1', dihapus: 1, diubah: Date.now() }], sejak: 0 });
  const dihapus = (d.muat || []).find((x) => x.id === 'M1');
  cek('pemilik boleh menghapus, dan barisnya hanya DITANDAI',
      d.ok === true && dihapus && dihapus.dihapus === 1,
      'dihapus=' + (dihapus ? dihapus.dihapus : '?') + ', baris tetap ada di lembar');
}

/* ================= 4. tanggal: tidak boleh kembali sebagai Date ================= */
{
  const g = muatAppsScript(GS_BAKU, { kodePemilik: KP, kodeOperator: KO });
  g.post({ kode: KO, oleh: 'HP-A', aksi: 'kirim', data: [muat('M9', '2026-08-18')], sejak: 0 });

  /* Google Sheets mengubah teks tanggal menjadi Date. Itu ditiru di sini. */
  const L = g.buku.getSheetByName('MUAT');
  L.getRange(2, 2).setValue(new Date('2026-08-18T00:00:00+07:00'));

  const r = g.post({ kode: KO, aksi: 'ambil', sejak: 0 });
  const m = (r.muat || []).find((x) => x.id === 'M9');
  cek('sel tanggal berisi Date tetap dikirim sebagai YYYY-MM-DD',
      !!m && m.tanggal === '2026-08-18', 'tanggal = "' + (m ? m.tanggal : '?') + '"');
  cek('kolom tanggal dijadikan TEKS supaya Sheets berhenti mengubahnya',
      L.formatKolom(1) === '@', 'format kolom tanggal = "' + L.formatKolom(1) + '"');
}

/* ================= 5. penyaringan "apa yang baru" pakai DITERIMA ================= */
{
  const g = muatAppsScript(GS_BAKU, { kodePemilik: KP, kodeOperator: KO });
  const lama = Date.now() - 3600000;                  /* dibuat sejam yang lalu */
  g.post({ kode: KO, oleh: 'HP-A', aksi: 'kirim',
           data: [muat('MLAMBAT', '2026-08-18', { diubah: lama })], sejak: 0 });
  /* HP lain menyinkron memakai penanda waktu setengah jam lalu: kalau
     penyaringan memakai DIUBAH, muat ini akan hilang selamanya. */
  await jeda(5);
  const r = g.post({ kode: KP, aksi: 'ambil', sejak: Date.now() - 1800000 });
  cek('muat yang dikirim belakangan tetap sampai ke HP lain',
      (r.muat || []).some((x) => x.id === 'MLAMBAT'),
      (r.muat || []).map((x) => x.id).join(',') || '(kosong)');
}

/* ================= 6. pemicu onEdit ================= */
{
  const g = muatAppsScript(GS_BAKU, { kodePemilik: KP, kodeOperator: KO });
  g.post({ kode: KO, oleh: 'HP-A', aksi: 'kirim', data: [muat('ME', '2026-08-18')], sejak: 0 });
  const penanda = Date.now();
  await jeda(8);
  /* pemilik membetulkan nama penerima langsung di Spreadsheet */
  g.ketikDiSel('MUAT', 2, 4, 'Bp. Rudy');
  const r = g.post({ kode: KP, aksi: 'ambil', sejak: penanda });
  const m = (r.muat || []).find((x) => x.id === 'ME');
  cek('suntingan tangan di Spreadsheet mengalir ke HP (onEdit)',
      !!m && m.penerima === 'Bp. Rudy',
      m ? 'terkirim dengan penerima "' + m.penerima + '"' : 'TIDAK ikut terkirim');
  cek('onEdit memperbarui penanda waktu diubah dan diterima',
      !!m && Number(m.diubah) >= penanda, 'diubah = ' + (m ? m.diubah : '?'));
}

/* ================= 7. kolom baru tidak menggeser data lama ================= */
{
  const g = muatAppsScript(GS_BAKU, { kodePemilik: KP, kodeOperator: KO });
  g.post({ kode: KO, oleh: 'HP-A', aksi: 'kirim', data: [muat('MK', '2026-08-18')], sejak: 0 });
  const L = g.buku.getSheetByName('MUAT');
  cek('baris judul memakai urutan kolom yang benar',
      L.isi()[0][0] === 'id' && L.isi()[0][15] === 'tujuan',
      L.isi()[0].join(','));
  const r = g.post({ kode: KO, aksi: 'ambil', sejak: 0 });
  const m = (r.muat || []).find((x) => x.id === 'MK');
  cek('kota tujuan ikut tersimpan dan kembali utuh', !!m && m.tujuan === 'Brebes',
      'tujuan = "' + (m ? m.tujuan : '?') + '"');
}

const gagal = hasil.filter((h) => !h.lulus);
console.log('\n' + (hasil.length - gagal.length) + '/' + hasil.length + ' pemeriksaan lulus');
if (gagal.length) console.log('GAGAL:\n' + gagal.map((g) => ' - ' + g.nama).join('\n'));
process.exit(gagal.length ? 1 : 0);
