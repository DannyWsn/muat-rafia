# BLUEPRINT — Kalkulator Muat Rafia (WAVI RAFIA GRUP)

> Dokumen ini ditulis supaya sesi Claude berikutnya **langsung paham tanpa
> bertanya-tanya**. Baca ini lebih dulu sebelum menyentuh kode.
> Terakhir diperbarui: 20 Agustus 2026 · aplikasi `sw.js` v20.

---

## 0. RINGKASAN SATU PARAGRAF

Aplikasi pencatat muatan tali rafia untuk WAVI RAFIA GRUP di Rembang. Operator
menimbang roll satu per satu di HP, aplikasi menjumlahkan, lalu mencetak tiga
dokumen yang **meniru blanko kertas milik pemilik**: Daftar Timbangan, Nota, dan
Surat Jalan. Seluruh aplikasi adalah **satu berkas `index.html`** tanpa server,
tanpa dependensi, diterbitkan sebagai halaman statis. Histori bisa disatukan
antar-HP lewat satu Google Spreadsheet. Di layar utama HP aplikasinya bernama
**WAC** (dari lambang WAVI ADHIKARI CENDANA).

---

## 1. TEMPAT DAN ALAMAT

| Hal | Nilai |
|---|---|
| Repo | `https://github.com/DannyWsn/muat-rafia` (PUBLIK) |
| Terbit di | `https://dannywsn.github.io/muat-rafia/` (GitHub Pages) |
| Klon lokal | `D:\muat-rafia` |
| Laptop | sudah tersambung `gh` sebagai DannyWsn, `git push` langsung jalan |
| Skrip pusat data | `C:\Users\danny\Downloads\Pusat Data Muat Rafia\Kode-Apps-Script.gs` |
| Panduan pemasangan | `C:\Users\danny\Downloads\Pusat Data Muat Rafia\PANDUAN.html` |

**Alamat Web App dan Kode Pabrik SENGAJA tidak ditulis di sini** karena repo ini
publik. Keduanya ada di aplikasi milik pemilik (⚙ Pengaturan → Pusat Data).
Jangan pernah menaruhnya di repo.

### Berkas di repo

```
index.html               SELURUH aplikasi (3.653 baris) - tampilan, logika, mesin PDF
sw.js                    penyimpan luring; VERSI dinaikkan tiap kali diunggah
manifest.webmanifest     supaya bisa dipasang sebagai aplikasi di HP
icon-192/512/maskable    ikon
BLUEPRINT.md             berkas ini
```

**Aturan mengunggah:** setiap kali `index.html` berubah, naikkan `var VERSI` di
`sw.js`. Kalau tidak, HP yang sudah memasang aplikasi akan tetap memakai versi
lama karena servis luringnya menyajikan salinan tersimpan.

---

## 2. YANG PALING PENTING DIKETAHUI TENTANG PEMILIK

Ini bukan basa-basi — semua keputusan rancangan di bawah lahir dari sini.

1. **Pemilik memeriksa hasil cetak dengan sangat teliti.** Beliau menemukan
   ketidaksejajaran 29pt hanya dengan melihat. Jangan pernah melapor "sudah
   rapi" tanpa mengukur.
2. **Jangan asal klaim.** Kata beliau: *"perbaiki dan testing dengan teliti,
   lalu verifikasi. tidak boleh asal klaim."* Setiap perbaikan harus dibuktikan
   dengan pengujian yang dijalankan, bukan dengan keyakinan.
3. **Ukur, jangan menaksir dari gambar.** Beberapa kali dugaan dari tangkapan
   layar ternyata salah, dan pengukuran yang membuktikannya.
4. **Pemilik tetap ingin Excel.** Rencana ke depan: aplikasi terhubung ke
   Spreadsheet lalu bisa diekspor ke Excel dengan format yang beliau tentukan.
5. Bahasa Indonesia untuk semua tulisan yang dilihat pemakai **dan** untuk
   komentar di dalam kode. Pertahankan.

---

## 3. ALAT YANG SUDAH TERPASANG DI LAPTOP INI

Jangan cari-cari lagi, semuanya sudah ada:

| Alat | Letak / cara pakai |
|---|---|
| `gh` CLI | terpasang, login DannyWsn, `git push` langsung jalan |
| poppler | `%LOCALAPPDATA%\Microsoft\WinGet\Packages\oschwartz10612.Poppler_*\poppler-*\Library\bin\` |
| `pdftoppm.exe` | PDF → gambar, **untuk benar-benar melihat hasil cetak** |
| `pdftotext.exe -bbox-layout` | posisi tiap teks dalam titik — **untuk mengukur, bukan menaksir** |
| Chrome | dikendalikan lewat CDP untuk menjalankan aplikasi sungguhan |
| Excel | ada, dipakai membongkar `MASTER RINCIAN MUATAN.xlsx` |

**Cara kerja yang terbukti:** ubah kode → hasilkan PDF dari aplikasi sungguhan →
render jadi gambar → **lihat** → ukur posisinya dengan `pdftotext -bbox-layout` →
baru simpulkan.

---

## 4. BENTUK APLIKASI

### 4.1 Layar

**Tiga layar**, dipilih dari bilah atas: tab **Input**, tab **Histori**, dan
tombol **⚙ Pengaturan**. Sebelum 20 Agustus 2026 setelan berserakan — kop surat
menempel di layar Input yang dipakai tiap hari, sedangkan Pusat Data, Cadangan,
dan Cek Sistem berdesakan di atas daftar histori sehingga muat pertama baru
terlihat setelah digulir **882 px**. Semuanya kini di ⚙ Pengaturan.

- **Input** — kisi Daftar Timbangan 14 kolom × 10 baris = **140 roll**.
  Kolom diberi nama 10, 20, …, 140. Kotak diberi `data-cell="<nomor roll - 1>"`.
  Urutan DOM **tidak** sama dengan urutan nomor roll (kisi digambar per baris,
  nomor roll berjalan per kolom). Saat menulis pengujian, isi lewat
  `[data-cell="N"]`, jangan lewat urutan tampilan.
- **Histori** — HANYA daftar muat. Di atasnya satu bilah lengket 44px berisi
  tombol cari (⌕) dan chip saring **Semua · Belum di pusat · Bulan ini**.
  Kartu dikelompokkan per tanggal dengan total tonase hari itu.
  Kartu memuat: nomor truk (atau "Tanpa nomor truk" kecil-miring), tanggal,
  penerima · kota tujuan · barang, lalu tonase besar + roll + rupiah.
  Tombolnya **Buka · PDF · (Kirim) · ⋯** semuanya **44 px**. **Hapus dan Cetak
  ada di dalam menu ⋯**, supaya tombol perusak data tidak lagi berdempetan 7 px
  dari tombol yang paling sering ditekan.
  Keadaan terhadap pusat = warna pita kiri + titik: biru **ada di pusat**
  (bertitel, tanpa tulisan — hemat satu baris di hampir semua kartu), kuning
  **Menunggu terkirim**, abu **Hanya di HP ini** — dua yang terakhir TETAP
  bertuliskan jelas karena perlu tindakan.
- **⚙ Pengaturan** — daftar setelan bergaya aplikasi HP, tiap baris 56 px dan
  keterangannya hidup (terbaca tanpa dibuka):
  **Profil Perusahaan** (kop + pratinjau kop seperti tercetak),
  **Rekening Transfer**, **Pusat Data**, **Cadangan Data**, **Cek Sistem**.
  Panelnya bergantian lewat `bukaPanel(id)`; `data-panel` membuka,
  `data-balik` kembali ke daftar.

### 4.2 Papan angka atas

`TOTAL ROLL` · `TOTAL TONASE` · `RUPIAH` · `POSISI`

- **TOTAL ROLL = jumlah kotak yang TERISI.** Bukan jumlah kolom, bukan nomor
  terakhir. Kalau roll 11 dilewati dan yang terisi 14 kotak, tertulis 14.
  Sudah diuji khusus untuk ini.
- **POSISI** menunjukkan **letak kursor** (mis. "Roll 15"), bukan hitungan.
  Pemilik sempat mengira ini total roll. Kalau nanti diminta, tulisannya boleh
  diperjelas — tetapi angkanya sudah benar, jangan diubah.
- **RUPIAH** hidup: begitu Harga @ diisi, seluruh muat langsung terhitung —
  termasuk bila harga baru diisi setelah setengah muat ditimbang. Selama harga
  kosong, kotaknya menampilkan "–" dan diredupkan. Harga **tidak wajib**.

### 4.3 Isian satu muat

| Id | Arti |
|---|---|
| `i-tanggal` | tanggal muat |
| `i-truk` | nomor polisi |
| `i-penerima` | nama penerima, mis. "Bp. Rifai" |
| `i-tujuan` | **kota tujuan**, mis. "Brebes" → baris "Toko" di Nota/Surat Jalan |
| `i-barang` | nama barang, mis. "Rafia Kw 3" |
| `i-harga` | harga per kg, **selalu diketik manual**, tidak pernah terisi sendiri |
| `i-kendaraan` | mis. "Truck" |
| `i-nosj` | nomor Surat Jalan, **manual** |

Keputusan pemilik yang harus dihormati: harga manual, nomor SJ manual, dan
penerima tetap **satu isian** (bukan dipecah Tuan/Toko), sedangkan kota tujuan
berdiri sendiri di `i-tujuan`.

### 4.4 Setelan (⚙ Pengaturan → Profil Perusahaan / Rekening Transfer)

`k-nama` `k-al1` `k-al2` `k-al3` `k-kota` (kota perusahaan, untuk baris tanda
tangan) `k-bank` `k-rek` `k-an` (rekening, dicetak di kolom Nama Barang pada
Nota) `s-url` `s-kode` (pusat data).

⚠️ `k-kota` = kota PERUSAHAAN (Rembang). `rec.tujuan` = kota TUJUAN (Brebes).
Jangan tertukar.

### 4.5 Kunci penyimpanan di HP

```
wavi_muat_hist_v1     histori muat
wavi_muat_draft_v1    muat yang sedang dikerjakan (disimpan tiap ketukan)
wavi_muat_kop_v1      setelan kop + rekening
wavi_muat_pusat_v1    alamat pusat + Kode Pabrik + penanda waktu + peran
wavi_muat_antre_v1    id muat yang belum terkirim ke pusat
wavi_muat_hapus_v1    penghapusan yang belum sampai ke pusat
wavi_muat_hp_v1       tanda pengenal HP ini
wavi_muat_wake_v1 / _tab_v1 / _pdfhint_v1
```

---

## 5. PERHITUNGAN — JANGAN PERNAH DIUBAH KE PECAHAN

Pemilik menegaskan penjumlahan desimal tidak boleh meleset.

- Berat diketik maksimal **dua desimal** (`RE_ANGKA`).
- Sebelum dijumlah, nilai diubah ke **satuan sen bilangan bulat**:
  `sen(n) = Math.round(n * 100)`. Penjumlahan selalu bilangan bulat.
- Rupiah = `Math.round(totalSen * hargaPerKg / 100)`, dibulatkan ke rupiah penuh.
- Sudah diuji: 999.999 nilai dua desimal (titik dan koma) dan 200.000 daftar
  acak 140 roll — **nol selisih**. Contoh terbukti: 8.623,40 kg × 11.500 =
  99.169.100.

**Jangan** mengganti ini menjadi penjumlahan pecahan biasa.

---

## 6. CETAK DAN PDF

### 6.1 Dua jalur, satu sumber angka

| Jalur | Mesin | Huruf |
|---|---|---|
| Tombol **Cetak** | HTML + CSS, lalu `window.print()` | Calibri |
| Tombol **Simpan PDF** | mesin PDF buatan sendiri di dalam `index.html` | Helvetica bawaan |

Keduanya memakai **angka tata letak yang sama** (`DOK`, `NOTA_KOL`, `SJ_KOL`,
dan tetapan di penggambar). Kalau mengubah satu, **wajib** mengubah yang lain,
lalu bandingkan hasilnya berdampingan.

Karena Helvetica lebih lebar dari Calibri, ukuran huruf pada jalur Cetak kadang
perlu dinaikkan agar lebarnya sepadan (kop Nota: ×1,19). Ini disengaja.

**Nama berkas PDF** (permintaan pemilik, 20 Agustus 2026):
`<Penerima>-<tgl-bln-thn>-<JenisDokumen>.pdf` — contoh
`Bp-Rifai-19-08-2026-Nota.pdf`. Lihat `dasarNama()`, `tglBerkas()`,
`bersihNama()`, `namaBerkas()`.
- Jenis dokumen **wajib** ikut di belakang. Tanpa itu, Nota dan Surat Jalan dari
  muat yang sama bernama sama persis dan HP menyimpannya jadi `…(1).pdf`.
- Penerima kosong → `Tanpa-Penerima`; nama > 40 huruf dipangkas.
- Tanggal dibalik sesuai permintaan. Akibatnya daftar berkas di HP **tidak lagi
  urut** menurut tanggal — sudah disampaikan ke pemilik.
- Jalur **Cetak** ikut: Chrome mengambil nama "Simpan sebagai PDF" dari
  `document.title`, jadi judul diganti sesaat sebelum `window.print()` lalu
  dikembalikan lewat `afterprint` (+ jaring pengaman 60 detik).

**Logo: dua berkas, sengaja.** Layar memakai PNG **tembus pandang**
(`LOGO_LAYAR_URI`, 128×102, +31 KB) yang diambil dari lambang asli di dalam
`MASTER RINCIAN MUATAN.xlsx` → `xl/media/image1.png` (569×493 RGBA, 81,6%
piksel tembus, 0% putih pekat — alpha-nya asli, tidak perlu mengeruk putih).
Cetak dan PDF **tetap** memakai `LOGO_URI` (JPEG beralas putih): di kertas
tembus pandang tidak ada gunanya, dan mesin PDF menyisipkan JPEG langsung —
menukarnya ke PNG bertopeng alpha berarti membongkar bagian yang hasil cetaknya
sudah disetujui pemilik.

### 6.2 Pilihan dokumen

Menekan Cetak atau Simpan PDF membuka pilihan: **Semua (2 lembar)** ·
**Daftar Timbangan** · **Nota & Surat Jalan** · **Nota saja** · **Surat Jalan saja**.

### 6.3 Daftar Timbangan

Salinan lembar `PRINT MUATAN` dari `MASTER RINCIAN MUATAN.xlsx`, angkanya
dibongkar langsung dari berkas Excel:

- lebar kolom Excel A 57,75 · B..H 51,75 (total 420), diskalakan menjadi
  A 69,48 · B..H 62,26 → **total 505,28pt**, margin 45pt kiri-kanan
- kop: logo 142pt rata kiri; teks kop **dipusatkan pada ruang di kanan logo**,
  bukan pada seluruh lebar lembar — kalau dipusatkan ke lembar, hasilnya timpang
  (teks mepet logo, kanan menganga) dan pemilik menyebutnya "tidak center"
- ukuran huruf kop diturunkan dari **lebar sasaran** (`ukuranKop`), bukan dipatok
  angka, supaya tetap seimbang walau isi kop diganti
- garis ganda di bawah kop; kepala kisi berlatar `#00B0F0`
- isi lembar setinggi 752,25pt. **Berkas Excel aslinya pecah dua halaman**
  (ruang A4 dengan margin Excel hanya 733,89pt); di sini margin bawah dipangkas
  supaya muat satu halaman tanpa mengecilkan apa pun

### 6.4 Nota dan Surat Jalan

Meniru blanko cetak pemilik. Bagian yang **tercetak** berwarna tinta biru
`#14539e`; yang **diisi** hitam.

- **Satu lembar A4 dibagi TEPAT DUA.** Nota di paruh atas, Surat Jalan di paruh
  bawah, masing-masing ditengahkan pada paruhnya, garis potong tepat di tengah
  kertas (420,945pt). Sekali sobek → dua slip berukuran sama dengan pinggiran
  seimbang. Ini permintaan pemilik: sisa kertas di atas-bawah membuat sobekan
  tidak rapi.
- `@page{margin:0}` dengan jarak dipasang sebagai isi halaman. Selain memberi
  kendali letak tegak, ini juga **menghilangkan kop bawaan browser** (judul
  halaman dan alamat berkas di tepi kertas) — keluhan nyata pemilik.
- **Nota**: kolom Banyaknya · Nama Barang · Harga @ · Jumlah, 9 baris isi.
  Nilai Harga @ dan Jumlah **di tengah kolom**, bukan rata kanan. Rekening
  transfer ditulis di kolom Nama Barang baris ke-3..5.
  "Tanda Terima", "Hormat Kami", dan "Jumlah Rp." berada **DI LUAR** kotak
  tabel; yang berkotak hanya angka jumlahnya.
- **Surat Jalan**: "SURAT JALAN" bergaris bawah **di samping** nama perusahaan,
  bukan judul terpisah di tengah. Kolom Banyaknya · Nama Barang · Keterangan,
  nilai Keterangan **di tengah**. Di bawah "Hormat Kami" tercetak **nama
  perusahaan**; di bawah "Tanda Terima" kurung titik-titik.
- Blok tanda tangan: label dan isian di bawahnya memakai kotak yang sama lalu
  sama-sama ditengahkan, jadi sejajar dengan sendirinya berapa pun lebar huruf.

---

## 7. PUSAT DATA (Google Spreadsheet)

### 7.1 Gagasannya

Satu Spreadsheet menjadi **satu-satunya kebenaran** histori, supaya histori di HP
siapa pun sama. Dipilih karena gratis, memakai akun Google yang sudah ada, dan
datanya mendarat di spreadsheet yang bisa pemilik buka sendiri.

**Aturan yang tidak boleh dilanggar: MENIMBANG TIDAK PERNAH MENUNGGU INTERNET.**
Data selalu ditulis ke HP lebih dulu, lalu dikirim saat ada sinyal. Kalau sinyal
mati di tengah muat, timbangan tetap jalan.

Selama alamat dan Kode Pabrik belum diisi, seluruh bagian ini **diam** dan
aplikasi berjalan persis seperti tanpa fitur ini.

### 7.2 Peran

| Peran | Boleh |
|---|---|
| **pemilik** | menambah, mengubah, dan menghapus muat siapa pun |
| **operator** | menambah, dan memperbaiki muat **buatannya sendiri**. TIDAK bisa menghapus |

"Hapus" tidak pernah membuang baris; hanya menandai kolom `dihapus`, jadi data
masih bisa diambil kembali dari Spreadsheet.

### 7.3 Percakapan aplikasi ↔ pusat

POST dengan `Content-Type: text/plain` **dengan sengaja** — itu membuat browser
tidak melakukan permintaan pendahuluan (preflight), yang tidak dilayani Apps
Script. Isinya tetap JSON.

```
{kode, oleh, aksi: "periksa" | "kirim" | "ambil", data: [...], sejak: <ms>}
-> {ok, peran, ditolak: [{id, sebab}], muat: [...], waktu}
```

### 7.4 Kolom di Spreadsheet (lembar `MUAT`)

```
id · tanggal · noTruk · penerima · barang · harga · kendaraan · noSJ ·
roll · tonase · timbangan · diubah · dihapus · oleh · diterima · tujuan
```

- `timbangan` = JSON array 140 nilai
- `diubah` = waktu muat disunting di HP → menentukan versi mana yang terbaru
- `diterima` = **waktu pusat menerimanya** → dipakai menyaring "apa yang baru"
- `oleh` = tanda pengenal HP pembuat baris
- Kolom baru **selalu ditambahkan di belakang**, dan baris judul melengkapi
  dirinya sendiri, sehingga data lama tidak bergeser

### 7.5 Perilaku menyimpan

- Muat **baru**: pemakai ditanya sekali — "Kirim ke pusat" atau "Simpan di HP
  ini saja". Yang "HP saja" tidak pernah masuk antrean.
- Muat yang **sudah ada di pusat**: setiap perubahan **langsung terkirim tanpa
  bertanya**. Kalau tidak begitu, pusat menyimpan versi lama sementara HP
  menyimpan versi baru — dan "satu kebenaran" jadi bohong.
- Tiap kartu histori bertanda: **Ada di pusat** · **Menunggu terkirim** ·
  **Hanya di HP ini** (yang terakhir punya tombol **Kirim**).

---

## 8. JEBAKAN YANG SUDAH MENGGIGIT — JANGAN DIULANG

Semua ini pernah benar-benar terjadi di proyek ini.

1. **Simpan yang tidak menyimpan apa pun.** Kalau muat yang sedang dibuka sudah
   dihapus pemilik dari pusat, kode lama menimpanya lewat `list.map` — dan
   karena tidak ada yang cocok, **tidak ada yang tersimpan, tanpa pesan apa
   pun**. Sekarang disimpan sebagai muat baru dengan nomor baru.
2. **Penyaringan "apa yang baru" memakai `diubah`.** Muat yang disimpan dulu
   lalu dikirim belakangan tidak pernah sampai ke HP lain, karena waktunya
   dianggap lama. Harus memakai `diterima`.
3. **`oleh` hilang saat muat ditimpa** → aplikasi mengira muat belum pernah
   masuk pusat, kartunya salah bertanda, dan pertanyaan kirim muncul lagi.
4. **Penolakan pusat mengendap di antrean** dan dicoba terus selamanya, sambil
   menyimpan versi lokal yang menyimpang. Sekarang penolakan diberitahukan,
   dikeluarkan dari antrean, lalu versi pusat ditarik ulang.
5. **`window.print()` memotret halaman seketika.** Logo data-URI yang belum
   selesai diurai tercetak sebagai **kotak kosong**. Cetak wajib menunggu
   `img.decode()`.
6. **Nilai baku tabel harus di `.xl-t`, bukan `.xl-t td`.** Kalau di td, aturan
   itu mengalahkan kelas per-sel dan semua ukuran huruf serta perataan diabaikan
   diam-diam — tampak jalan padahal salah.
7. **Teks rata-kanan yang lebih lebar dari selnya meluber ke KANAN** di HTML
   (Excel meluber ke kiri) sehingga menabrak angkanya.
8. **Helvetica lebih lebar dari Calibri**, jadi letak yang dipatok angka mati di
   PDF akan menabrak. Hitung dari `lebar()` teks sungguhan.
9. **`sed`/`perl` dan heredoc bash merusak kode** yang penuh kutip dan garis
   miring — pernah membuat `\d` menjadi `d` sehingga harga SELALU ditolak dan
   Nota selalu kosong. Untuk penyuntingan besar, **tulis berkas patch dengan
   alat Write lalu jalankan dengan node**, jangan `node -e` di dalam bash.
10. **Setelan penting jangan disimpan pada setiap ketukan.** Alamat pusat dan
    Kode Pabrik dulu ditimpa tiap `input`, sehingga kotak yang terkosongkan
    TANPA SENGAJA di HP langsung menghapus sambungan. Benar-benar terjadi pada
    HP rekan pemilik: histori utuh, tetapi alamat dan kode lenyap. Sekarang
    kotak kosong tidak pernah menimpa sambungan yang ada, isinya dikembalikan
    saat kotak ditinggalkan, dan memutus sambungan harus lewat tombol
    **Putus Sambungan** dengan konfirmasi.
11. **`index.html` berakhiran baris CRLF.** Pencocokan teks multi-baris harus
    memakai `\r\n`. `sed -i` menghapus CRLF — jangan dipakai untuk berkas ini.
    (Catatan: ada 2 baris komentar ber-LF tunggal sejak lama, di sekitar
    `white-space:pre`. Bukan kerusakan baru.)
12. **Media query yang ditaruh SEBELUM aturan yang dipengaruhinya tidak berbuat
    apa-apa.** Aturan layar sempit sempat diletakkan di bagian bilah atas;
    `.tab`, `.tabs`, dan `.gigi` ditulis lebih belakang sehingga menimpanya
    (kekhususan sama — yang belakangan menang). Gejalanya menipu: `.brand-sub`
    dan `font-size` ikut berubah, jadi seolah-olah media query bekerja.
    Sekarang seluruh aturan layar sempit ada di **akhir stylesheet**.
13. **Nama perusahaan menimpa tab "Input".** Setelah tombol ⚙ ditambahkan,
    ruang nama menyempit. `.brand-txt` harus `flex:1 1 auto;min-width:0;
    overflow:hidden` dan `.brand-name` harus `display:block`, kalau tidak
    titik-tiga tidak pernah bekerja dan tulisannya bertumpuk.
15. **GOOGLE SHEETS MENGUBAH TANGGAL MENJADI `Date`.** Teks `"2026-08-18"`
    yang ditulis aplikasi berubah menjadi tanggal sungguhan di dalam sel, lalu
    `baca()` mengirimnya lewat `String(sel)` sehingga HP menerima
    `"Tue Aug 18 2026 00:00:00 GMT+0700 (Waktu Indonesia Barat)"`.
    Akibatnya di HP penerima: tanggal di kartu KOSONG, kelompoknya
    "Tanpa tanggal", kotak Tanggal kosong saat muat dibuka (sehingga kalau
    langsung dicetak tanggalnya hilang dari Nota), nama berkas PDF memakai
    tanggal HARI INI, dan urutan daftar salah karena diurutkan sebagai teks.
    Yang paling menipu: **muat itu ikut rusak di HP yang MEMBUATNYA**, karena
    salinan dari pusat menimpa yang lokal (`>=` pada `diubah`). Notanya
    yang dicetak pada hari muat tetap benar — jadi gejalanya tampak
    bertentangan. Dijaga oleh `normalTgl()` di `terapkanMuat`, dan
    `tglTeks()` di Apps Script.
16. **MEMPERBAIKI GERBANG MASUK TIDAK MENYEMBUHKAN DATA YANG SUDAH TERSIMPAN.**
    Sesudah `normalTgl()` dipasang, muat yang sudah rusak tetap rusak —
    pusat hanya mengirim ulang muat yang `diterima`-nya lebih baru dari
    penanda waktu HP, jadi muat lama tidak pernah datang lagi. Karena itu ada
    `sembuhkanTanggal()` yang berjalan sekali setiap aplikasi dibuka.
    **Setiap perbaikan bentuk data harus ditanya: apa yang sudah tersimpan
    salah, dan bagaimana ia sembuh tanpa menyuruh pemilik menekan apa-apa?**
17. **`lapor()` pernah dipanggil dengan EMPAT argumen** pada tombol Unduh
    Cadangan (`lapor(nama, blob, unduhBlob(...), "Cadangan")`) padahal hanya
    menerima tiga — judul dialognya berbunyi "true siap" dan berkas terunduh
    dua kali. Sudah diperbaiki 20 Agustus 2026.

---

## 9. PENGUJIAN

Skrip di scratchpad sesi ini (Agustus 2026). Kalau hilang, tulis ulang dengan
pola yang sama: **jalankan aplikasi sungguhan di Chrome lewat CDP, kendalikan
lewat tombol seperti pemakai, lalu ukur keluarannya.**

| Skrip | Membuktikan |
|---|---|
| `periksa.mjs` | ketelitian desimal (999.999 nilai + 200.000 daftar acak) |
| `uji-cetak.mjs` | tiap baris & kolom Daftar Timbangan vs angka Excel |
| `uji-print-asli.mjs` | jalur cetak sungguhan lewat `Page.printToPDF` |
| `ambil-pdf.mjs` | menangkap PDF dari tombol Simpan PDF |
| `uji-roll.mjs` | roll = kotak terisi (termasuk kasus ada yang dilewati) |
| `uji-rupiah.mjs` | rupiah hidup, termasuk harga diisi di tengah jalan |
| `tiruan-pusat.mjs` | tiruan Apps Script untuk menguji sinkron tanpa Google |
| `uji-pusat.mjs` | 19 pemeriksaan sinkron dengan **dua HP** (dua Chrome terpisah) |
| `uji-ubah.mjs` | muat yang sudah di pusat lalu ditambah barang |
| `uji-google.mjs` | uji ke pusat data Google **sungguhan** |
| `ukur-memori.mjs` | ukuran satu muat, batas penyimpanan, izin permanen |
| `uji-tahap23.mjs` | 17 pemeriksaan: logo layar PNG tembus pandang + nama berkas PDF dari berkas yang BENAR-BENAR terunduh |
| `uji-tahap4.mjs` | 45 pemeriksaan: layar Pengaturan, cari/saring, kelompok tanggal, tombol 44px, menu ⋯, bilah atas di 320/360/412 |
| `uji-cetak-sama.mjs` | **paritas cetak**: PDF sebelum vs sesudah perubahan, posisi tiap kata dibandingkan sampai 0,01 titik |
| `cek-pusat-baca.mjs` | periksa pusat SUNGGUHAN tanpa menulis apa pun (peran, kolom yang dikirim, isi terbaru) |
| `uji-tanggal-sembuh.mjs` | 8 pemeriksaan: tanggal bentuk Sheets masuk lewat jalur sinkron dan keluar sebagai YYYY-MM-DD |
| `uji-sembuhkan.mjs` | 8 pemeriksaan: HP yang SUDAH berisi tanggal rusak sembuh sendiri saat dibuka |

⚠️ **`uji-pusat.mjs` dan `uji-aman.mjs` menuntut pusat tiruan yang BERSIH.**
`tiruan-pusat.mjs` menyimpan data di memori, jadi kalau sudah dipakai uji lain
lebih dulu, hitungannya berbeda dan tampak seperti kegagalan aplikasi —
padahal cuma kontaminasi. Matikan lalu nyalakan ulang sebelum tiap skrip.

**Dua HP diuji dengan dua proses Chrome ber-`--user-data-dir` berbeda.** Dua tab
tidak cukup — penyimpanannya sama.

---

## 10. YANG BELUM DIKERJAKAN

### 10.1 ⚠️ MENUNGGU PEMILIK — skrip Spreadsheet belum ditempel ulang

**Ini yang paling mendesak.** Kolom `tujuan` (Toko/Kota) sudah ada di aplikasi
tetapi **belum ada di pusat data**, karena skrip Google belum diperbarui.
Akibatnya kota tujuan tercetak di nota tetapi **tidak ikut tersimpan**, sehingga
HP lain tidak melihatnya.

Langkahnya:
1. buka `Downloads\Pusat Data Muat Rafia\Kode-Apps-Script.gs`, salin semuanya
2. Apps Script → hapus semua → tempel
3. **isi ulang dua baris Kode Pabrik** (berkas itu berisi tulisan `GANTI-...`)
4. Ctrl+S
5. **Terapkan → Kelola deployment → ikon pensil → Versi: Versi baru → Terapkan**

Aman untuk data yang sudah ada: kolom baru di paling belakang, baris judul
melengkapi diri sendiri.

### 10.2 Rencana keamanan data — SUDAH DIKERJAKAN (19 Agustus 2026)

Angka hasil pengukuran: satu muat penuh **1,0 KB**, batas penyimpanan HP
**5,0 MB**, muat ± **5.000**, penuh dalam ±2,3 tahun pada 6 muat/hari. Kalau
penuh, penyimpanan menolak dan aplikasi memberi peringatan merah — data lama
tidak hilang dan mencetak tetap jalan.

Yang sudah terpasang:

1. **Izin penyimpanan permanen** (`navigator.storage.persist()`) diminta saat
   aplikasi dibuka. Hasil ukur sebelumnya `persisted()` = **false**, artinya
   browser boleh membuang data situs saat memori HP sesak walau pemakaian baru
   1%. Ini bahaya nomor satu dan tidak ada hubungannya dengan penuh. Kalau izin
   belum diberikan, papan keadaan menulis "penyimpanan permanen BELUM aktif";
   memasang aplikasi ke layar utama sangat menaikkan peluang diberikan.
2. **Pemicu `onEdit` di Apps Script** mengisi `diubah` dan `diterima` setiap
   kali baris disunting TANGAN di Spreadsheet, sehingga koreksi pemilik ikut
   mengalir ke semua HP. Tanpa ini, suntingan manual tidak pernah sampai ke HP.
   Ditambah tombol **Tarik Ulang Semua** di aplikasi (menolkan penanda waktu
   lalu menarik seluruh isi pusat).
3. **Peringatan jam HP meleset** — kalau selisih jam HP dengan pusat lebih dari
   5 menit, muncul dialog sekali. Jam yang salah membuat versi keliru dianggap
   lebih baru.
4. **Penanda mencolok** di papan keadaan: "N muat belum pernah masuk pusat —
   hanya ada di HP ini, ikut hilang kalau HP hilang". Papan ini menyegarkan diri
   setiap kali daftar berubah.
5. **Tombol Rapikan Muat Lama** — membuang muat lama dari HP, menyisakan 200
   terbaru. **SENGAJA tidak otomatis**: menghapus data pemakai tanpa diminta itu
   tidak pantas. Hanya muat yang sudah dipastikan ada di pusat yang dibuang;
   muat bertanda "Hanya di HP ini" tidak pernah disentuh.

Diuji 7 pemeriksaan khusus, ditambah 19 sinkron dua HP + 5 ubah-muat + 9 roll
yang tetap lulus.

### 10.3 Rencana jangka panjang pemilik

Aplikasi akan terhubung dengan **stok rafia dan produksi**. Pemilik tetap ingin
Excel, jadi: aplikasi → Spreadsheet → ekspor ke Excel dengan format yang beliau
tentukan.

**Formatnya sudah ada di tangan.** `MASTER RINCIAN MUATAN.xlsx` berisi tiga
lembar, dua di antaranya persis untuk ini:

- **REKAP PRODUKSI** — produksi harian per pekerja (Irfan, M.Supri, M.Muji,
  M.Tri, M.Agus, Ali, Fajar, Bondan), HK, rata-rata harian/bulanan, Total Tanpa
  Kasbon
- **TUTUP BUKU** — stok Rafia KW 2 & KW 3, Kas, Kasbon Operasional, Biji Plastik
  dan Kemasan per pemasok (Solo, Surabaya, Pandaan, Jepara, Sidoarjo…), serta
  alat (Pengaduk, Tap-tapan, Corong, Penggulung)

Jangan mengarang format — bongkar angkanya dari berkas Excel pemilik, cara yang
sama seperti Daftar Timbangan. Satu Spreadsheet bisa menampung lembar `MUAT`,
`STOK`, dan `PRODUKSI` sekaligus dengan skrip dan Kode Pabrik yang sama.

**Yang perlu diminta ke pemilik saat waktunya:** berkas Excel bulan berjalan
yang **sudah terisi data asli** — versi kosong hanya menunjukkan rangkanya,
yang terisi memperlihatkan cara pakainya yang sebenarnya.

---

## 11. CARA MENGUNGGAH

```bash
cd /d/muat-rafia
# 1. naikkan VERSI di sw.js  (perl -pi -e, JANGAN sed -i: CRLF hilang)
# 2. commit + push
git add -A && git commit -F <pesan> && git push origin main
# 3. TUNGGU dan PASTIKAN sudah hidup, jangan asal klaim:
curl -s "https://dannywsn.github.io/muat-rafia/index.html?cb=$RANDOM" | grep -c '<penanda baru>'
```

GitHub Pages butuh ±1–3 menit. Selalu buktikan penanda baru benar-benar tersaji
sebelum melapor selesai.

---

## 12. TUGAS UNTUK SESI CLAUDE BERIKUTNYA

Urut menurut kepentingan. Yang di atas dikerjakan lebih dulu.

### A. ⏰ INGATKAN PEMILIK — skrip Apps Script belum ditempel ulang

**Ini bukan tugas coding, tetapi harus disebut di awal percakapan.** Skrip di
`DownloadsPusat Data Muat RafiaKode-Apps-Script.gs` sudah berisi DUA hal
baru yang belum ada di Google milik pemilik:

1. kolom `tujuan` (Toko/Kota) — tanpa ini, kota tujuan tercetak di nota tetapi
   **tidak tersimpan ke pusat**, sehingga HP lain tidak melihatnya
2. pemicu `onEdit` — tanpa ini, koreksi yang diketik pemilik **langsung di
   Spreadsheet tidak pernah sampai ke HP**

Langkahnya ada di §10.1. Cara memastikan berhasil: ketik apa saja di sel baris
muat lalu Enter — kolom `diubah` dan `diterima` di baris itu harus berubah
sendiri dalam beberapa detik.

### B. Sambungkan sekali-ketuk untuk HP operator

Pemilik harus mengetik alamat panjang dan Kode Pabrik di tiap HP operator.
Rencana: tombol **Buat Tautan Sambungan** di HP pemilik yang menghasilkan
tautan berisi alamat + kode pada bagian `#` (tidak terkirim ke server), lalu
dibagikan lewat WhatsApp. Operator cukup menekannya, aplikasi menawarkan
menyambung, menguji, dan menyimpan. Perlu diingat: kodenya ikut lewat
WhatsApp — sampaikan itu ke pemilik sebelum dibangun.

### C. Stok dan produksi + ekspor Excel

Rencana besar pemilik, rinciannya di §10.3. Formatnya SUDAH ADA di
`MASTER RINCIAN MUATAN.xlsx` (lembar REKAP PRODUKSI dan TUTUP BUKU) — bongkar
angkanya dari sana, jangan mengarang. Minta pemilik mengirim berkas bulan
berjalan yang **sudah terisi data asli** lebih dulu.

### D. Kalau diminta: perjelas tulisan kotak POSISI

Pemilik sempat mengira "Roll 15" pada kotak POSISI adalah total roll. Angkanya
benar dan **jangan diubah**; yang boleh diperjelas hanya tulisannya, misalnya
label "Sedang Isi" atau nilai "Roll ke-15". Kerjakan HANYA kalau diminta.

### E. Yang sudah selesai — jangan dikerjakan ulang

**Dikerjakan 20 Agustus 2026** (disetujui pemilik, rancangannya di
`Downloads\Rancangan Muat Rafia\`): Histori dirapikan; setelan pindah ke
⚙ Pengaturan; nama berkas PDF ikut nama penerima; logo layar tembus pandang;
ikon aplikasi diganti logo asli (alas putih); nama aplikasi jadi **WAC**.
Dibuktikan: 17/17 + 45/45 pemeriksaan baru, 5/5 dokumen cetak identik sampai
0,01 titik, dan uji lama tetap lulus (19/19 sinkron dua HP, 5/5 ubah-muat,
9/9 roll, rupiah, setelan-hilang, keamanan data, ketelitian desimal).

⚠️ **Pemilik perlu memasang ULANG aplikasi di HP** supaya nama dan ikon barunya
muncul — Android menyimpan keduanya sejak pemasangan. Histori tidak ikut
terhapus asal alamatnya sama, tetapi **Unduh Cadangan dulu** lebih aman.


Daftar Timbangan/Nota/Surat Jalan sudah sesuai blanko dan diperiksa pemilik;
rupiah hidup; pusat data dengan hak pemilik/operator; lima penangkal keamanan
data (§10.2); dan perbaikan sambungan yang bisa terhapus tanpa sengaja
(jebakan no. 10). Semuanya sudah diuji dan diunggah.
