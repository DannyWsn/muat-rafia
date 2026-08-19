# Pengujian Kalkulator Muat Rafia

Semua skrip di sini **menjalankan aplikasi yang sungguhan di Chrome lewat CDP,
menekan tombolnya seperti pemakai, lalu mengukur keluarannya.** Tidak ada yang
memeriksa dengan cara membaca kode atau memanggil fungsi dalam.

Alasannya ada di `BLUEPRINT.md` bagian 2: pemilik memeriksa hasil cetak dengan
sangat teliti dan pernah menemukan ketidaksejajaran 29pt hanya dengan melihat.
Karena itu **tidak boleh melapor "sudah rapi" tanpa mengukur.**

## Cara menjalankan

```bash
cd D:\muat-rafia
node uji/uji-roll.mjs
```

Yang dibutuhkan sudah terpasang di laptop ini (lihat `BLUEPRINT.md` bagian 3):
Chrome, poppler (`pdftotext`), dan Node. Skripnya mencari `pdftotext.exe`
sendiri di folder WinGet.

## PALING PENTING — jalankan yang ini setiap kali menyentuh cetak

```bash
node uji/cetak-paritas.mjs
```

Menghasilkan kelima dokumen dari aplikasi, lalu membandingkan **posisi setiap
kata** dengan sidik jari acuan di `acuan-cetak/`. Satu titik pun bergeser =
GAGAL.

⚠️ `--rekam` merekam acuan baru. **Hanya dipakai kalau perubahan hasil cetak
memang disengaja dan sudah diperiksa pemilik.** Kalau ragu, jangan merekam —
kehilangan acuan berarti kehilangan satu-satunya penjaga hasil cetak.

## Daftar skrip

| Skrip | Membuktikan |
|---|---|
| `cetak-paritas.mjs` | **hasil cetak tidak bergeser** — 5 dokumen, posisi tiap kata sampai 0,01 titik |
| `uji-desimal.mjs` | ketelitian desimal: 999.999 nilai (titik dan koma) + 200.000 daftar acak 140 roll, nol selisih |
| `uji-roll.mjs` | roll = jumlah kotak TERISI, termasuk kalau ada yang dilewati; baris "Toko" berisi kota tujuan |
| `uji-rupiah.mjs` | rupiah hidup, termasuk harga yang diisi di tengah jalan lalu dihapus |
| `uji-daftar-timbangan.mjs` | tiap baris dan kolom Daftar Timbangan vs angka asli dari Excel |
| `uji-jalur-cetak.mjs` | jalur Cetak sungguhan lewat `Page.printToPDF` |
| `uji-pusat.mjs` | 19 pemeriksaan sinkron dengan **dua HP** (dua Chrome ber-`--user-data-dir` beda) |
| `uji-ubah-muat.mjs` | muat yang sudah di pusat lalu ditambah barang: tidak ditanya lagi, langsung terkirim |
| `uji-keamanan-data.mjs` | lima penangkal keamanan data (izin permanen, penanda, Rapikan Muat Lama) |
| `uji-setelan-hilang.mjs` | alamat pusat dan Kode Pabrik tidak bisa terhapus tanpa sengaja (jebakan no. 10) |
| `uji-pengaturan-histori.mjs` | 45 pemeriksaan: layar Pengaturan, cari/saring, kelompok tanggal, tombol 44px, menu ⋯, bilah atas di 320/360/412px |
| `uji-logo-nama-berkas.mjs` | logo layar PNG tembus pandang + nama berkas PDF, dibaca dari berkas yang BENAR-BENAR terunduh |
| `uji-tanggal-gerbang.mjs` | tanggal bentuk Google Sheets masuk lewat sinkron dan keluar sebagai `YYYY-MM-DD` |
| `uji-tanggal-pulih.mjs` | HP yang SUDAH berisi tanggal rusak sembuh sendiri saat aplikasi dibuka |
| `uji-peringatan-cetak.mjs` | tanggal lokal tidak tertimpa kiriman tak terbaca; peringatan sebelum mencetak dokumen kosong |
| `uji-tayang.mjs` | uji asap dari alamat TAYANG (https), sekaligus menguji servis luring |
| `ukur-memori.mjs` | ukuran satu muat, batas penyimpanan, izin permanen |
| `ukur-histori.mjs` | mengukur tampilan Histori di layar HP (tinggi kartu, tombol, gulir) |
| `ukur-bilah-atas.mjs` | lebar nama perusahaan vs ruang tersedia di bilah atas |
| `ukur-bilah-tombol.mjs` | ruang bilah tombol bawah, untuk menimbang tulisan tombol |
| `tiruan-pusat.mjs` | tiruan Apps Script di port 8801, untuk menguji sinkron tanpa Google |
| `alat-ambil-pdf.mjs` | menangkap PDF dari tombol Simpan PDF |
| `alat-potret.mjs` | potret aplikasi, tema terang dan gelap |
| `alat-aset-logo.mjs` | membuat ulang logo layar dan ketiga ikon dari lambang asli di `MASTER RINCIAN MUATAN.xlsx` |

## Dua hal yang mudah membuat salah paham

1. **`uji-pusat.mjs` dan `uji-keamanan-data.mjs` menuntut pusat tiruan yang
   BERSIH.** `tiruan-pusat.mjs` menyimpan data di memori. Kalau sudah dipakai
   skrip lain lebih dulu, hitungannya berbeda dan **tampak seperti kegagalan
   aplikasi padahal cuma kontaminasi**. Matikan lalu nyalakan ulang sebelum
   tiap skrip:

   ```powershell
   Get-NetTCPConnection -LocalPort 8801 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
   ```

2. **Dua HP diuji dengan dua proses Chrome ber-`--user-data-dir` berbeda.**
   Dua tab tidak cukup — penyimpanannya sama.

## Skrip yang SENGAJA tidak ada di sini

Skrip yang menguji ke **pusat data Google sungguhan** berisi alamat Web App dan
Kode Pabrik. Repo ini publik, jadi keempatnya disimpan di luar repo:

```
C:\Users\danny\Downloads\Muat Rafia (skrip uji)\
  cek-pusat-baca.mjs    periksa pusat sungguhan TANPA menulis apa pun
  uji-google.mjs        uji tulis ke pusat sungguhan (menulis satu baris bertanda)
  uji-google2.mjs
  uji-nyata.mjs
```

**Jangan pernah memindahkannya ke dalam repo.**
