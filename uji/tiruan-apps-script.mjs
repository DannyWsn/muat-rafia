/* TIRUAN GOOGLE APPS SCRIPT.
 *
 * Menjalankan berkas Kode-Apps-Script.gs YANG SUNGGUHAN di Node, dengan
 * Spreadsheet tiruan di dalam memori. Gunanya: skrip pusat bisa DIUJI sebelum
 * pemilik menempelnya ke Google - bukan dikirim dengan harapan.
 *
 * Yang ditiru hanya yang benar-benar dipakai skrip itu: SpreadsheetApp,
 * LockService, ContentService, dan Utilities.
 *
 * Berkas .gs-nya ada DI LUAR repo (berisi Kode Pabrik), jadi jalurnya
 * disebut lewat parameter atau memakai letak baku di Downloads.
 */
import { readFileSync, existsSync } from 'node:fs';

export const GS_BAKU = 'C:/Users/danny/Downloads/Pusat Data Muat Rafia/Kode-Apps-Script.gs';

/* ---------- Spreadsheet tiruan ---------- */
function buatBuku(zona) {
  const lembar = new Map();

  function buatLembar(nama) {
    /* baris disimpan sebagai larik larik; kolom bisa bertambah sendiri */
    const data = [];
    const format = new Map();
    const L = {
      nama,
      getName: () => nama,
      appendRow(baris) { data.push(baris.slice()); return L; },
      setFrozenRows() { return L; },
      getLastRow: () => data.length,
      getLastColumn: () => data.reduce((a, b) => Math.max(a, b.length), 0),
      getMaxRows: () => Math.max(data.length, 1000),
      getRange(r, c, nr, nc) {
        nr = nr == null ? 1 : nr;
        nc = nc == null ? 1 : nc;
        return {
          getRow: () => r,
          getColumn: () => c,
          getNumRows: () => nr,
          getNumColumns: () => nc,
          getSheet: () => L,
          getValues() {
            const out = [];
            for (let i = 0; i < nr; i++) {
              const baris = data[r - 1 + i] || [];
              const satu = [];
              for (let j = 0; j < nc; j++) {
                const v = baris[c - 1 + j];
                satu.push(v === undefined ? '' : v);
              }
              out.push(satu);
            }
            return out;
          },
          setValues(nilai) {
            for (let i = 0; i < nilai.length; i++) {
              const ri = r - 1 + i;
              while (data.length <= ri) data.push([]);
              for (let j = 0; j < nilai[i].length; j++) data[ri][c - 1 + j] = nilai[i][j];
            }
            return this;
          },
          getValue() { return this.getValues()[0][0]; },
          setValue(v) { return this.setValues([[v]]); },
          setNumberFormat(f) {
            /* Format TEKS ('@') ditiru sungguhan: kalau kolom bertanda teks,
               nilainya tidak boleh berubah jadi Date - inilah yang dijaga. */
            for (let j = 0; j < nc; j++) format.set(c - 1 + j, f);
            return this;
          },
        };
      },
      /* dipakai pengujian: apakah kolom ini ditandai TEKS */
      formatKolom: (kolom0) => format.get(kolom0) || '',
      isi: () => data,
    };
    return L;
  }

  return {
    getSheetByName: (n) => lembar.get(n) || null,
    insertSheet(n) { const L = buatLembar(n); lembar.set(n, L); return L; },
    getSpreadsheetTimeZone: () => zona,
    /* dipakai pengujian */
    _lembar: lembar,
  };
}

/**
 * Memuat skrip .gs yang sungguhan dan mengembalikan fungsi-fungsinya.
 * @param {string} jalur berkas .gs (baku: di Downloads)
 * @param {object} pilihan { zona, kodePemilik, kodeOperator }
 */
export function muatAppsScript(jalur = GS_BAKU, pilihan = {}) {
  if (!existsSync(jalur)) {
    throw new Error('Berkas Apps Script tidak ketemu: ' + jalur +
      '\n(Berkas itu SENGAJA di luar repo karena berisi Kode Pabrik.)');
  }
  let sumber = readFileSync(jalur, 'utf8');

  /* Kode contoh dipasang supaya pengujian tidak bergantung pada kode asli
     milik pemilik. Yang diganti hanya dua baris tetapan di kepala berkas. */
  if (pilihan.kodePemilik) {
    sumber = sumber.replace(/var KODE_PEMILIK\s*=\s*'[^']*'/,
      "var KODE_PEMILIK = '" + pilihan.kodePemilik + "'");
  }
  if (pilihan.kodeOperator) {
    sumber = sumber.replace(/var KODE_OPERATOR\s*=\s*'[^']*'/,
      "var KODE_OPERATOR = '" + pilihan.kodeOperator + "'");
  }

  const buku = buatBuku(pilihan.zona || 'Asia/Jakarta');
  const SpreadsheetApp = { getActiveSpreadsheet: () => buku };
  const LockService = {
    getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
  };
  const ContentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput(teks) {
      return { _teks: teks, setMimeType() { return this; }, getContent() { return this._teks; } };
    },
  };
  const Utilities = {
    getUuid: () => 'uji-' + Math.random().toString(36).slice(2) + Date.now().toString(36),
    formatDate(tanggal, zona, pola) {
      /* hanya pola yang dipakai skrip: yyyy-MM-dd, dalam zona Asia/Jakarta */
      const d = new Date(tanggal);
      const utc = d.getTime() + d.getTimezoneOffset() * 60000;
      const wib = new Date(utc + 7 * 3600000);
      const p = (n) => (n < 10 ? '0' : '') + n;
      if (pola !== 'yyyy-MM-dd') throw new Error('pola belum ditiru: ' + pola);
      return wib.getFullYear() + '-' + p(wib.getMonth() + 1) + '-' + p(wib.getDate());
    },
  };

  /* Skrip dijalankan apa adanya, lalu fungsi-fungsinya diambil. */
  const namaFungsi = [...sumber.matchAll(/^function\s+([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]);
  const pabrik = new Function('SpreadsheetApp', 'LockService', 'ContentService', 'Utilities',
    sumber + '\nreturn {' + namaFungsi.map((n) => n + ': ' + n).join(', ') + '};');
  const fungsi = pabrik(SpreadsheetApp, LockService, ContentService, Utilities);

  /* Pembungkus yang meniru satu permintaan HTTP dari aplikasi */
  function post(isi) {
    const hasil = fungsi.doPost({ postData: { contents: JSON.stringify(isi) } });
    return JSON.parse(hasil.getContent());
  }
  /* Meniru pemilik mengetik di sel Spreadsheet, lalu pemicu onEdit jalan */
  function ketikDiSel(namaLembar, baris, kolom, nilai) {
    const L = buku.getSheetByName(namaLembar);
    if (!L) throw new Error('lembar tidak ada: ' + namaLembar);
    L.getRange(baris, kolom).setValue(nilai);
    if (fungsi.onEdit) fungsi.onEdit({ range: L.getRange(baris, kolom) });
  }

  return { post, ketikDiSel, buku, fungsi, namaFungsi };
}
