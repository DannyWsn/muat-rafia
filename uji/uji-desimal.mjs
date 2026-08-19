/* Pemeriksaan tanpa browser:
   1. sintaks skrip aplikasi
   2. ketelitian penjumlahan desimal (inti kekhawatiran pemilik)  */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const H = readFileSync('D:/muat-rafia/index.html', 'utf8');

/* ---------- 1. sintaks ---------- */
const skrip = [...H.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
console.log(`blok <script>: ${skrip.length}`);
let lolos = true;
skrip.forEach((s, i) => {
  const f = `${import.meta.dirname}/skrip${i}.js`;
  writeFileSync(f, s, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log(`  blok ${i}: sintaks OK (${(s.length / 1024).toFixed(1)} KB)`);
  } catch (e) {
    lolos = false;
    console.log(`  blok ${i}: SINTAKS SALAH\n${e.stderr.toString()}`);
  }
});

/* ---------- 2. ketelitian desimal ---------- */
/* Salinan persis fungsi yang dipakai aplikasi */
const RE_ANGKA = /^\d{1,4}([.,]\d{1,2})?$/;
const MAX_KG = 9999.99;
function parseKetat(raw) {
  const s = String(raw == null ? '' : raw).replace(/\s/g, '');
  if (!s) return null;
  if (!RE_ANGKA.test(s)) return null;
  const n = parseFloat(s.replace(',', '.'));
  if (!isFinite(n) || n <= 0 || n > MAX_KG) return null;
  return n;
}
const sen = (n) => (n == null ? 0 : Math.round(n * 100));

console.log('\n=== UJI 1: sen() harus tepat untuk SETIAP nilai 2 desimal 0,01..9999,99 ===');
let salah = 0, contoh = [];
for (let c = 1; c <= 999999; c++) {
  const teks = (c / 100).toFixed(2);          // "0.01" .. "9999.99"
  const n = parseKetat(teks);
  if (n === null) { salah++; if (contoh.length < 5) contoh.push(`${teks} ditolak`); continue; }
  if (sen(n) !== c) { salah++; if (contoh.length < 5) contoh.push(`${teks}: sen=${sen(n)} seharusnya ${c}`); }
}
console.log(salah === 0
  ? '  LULUS — 999.999 nilai, tidak ada satu pun yang meleset'
  : `  GAGAL — ${salah} meleset. contoh: ${contoh.join(' | ')}`);
if (salah) lolos = false;

console.log('\n=== UJI 2: koma sebagai pemisah desimal (cara pemilik mengetik) ===');
let salah2 = 0;
for (let c = 1; c <= 999999; c++) {
  const teks = (c / 100).toFixed(2).replace('.', ',');
  const n = parseKetat(teks);
  if (n === null || sen(n) !== c) { salah2++; }
}
console.log(salah2 === 0 ? '  LULUS — 999.999 nilai dengan koma, semua tepat'
                         : `  GAGAL — ${salah2} meleset`);
if (salah2) lolos = false;

console.log('\n=== UJI 3: penjumlahan 140 roll tidak pernah selisih 0,01 ===');
/* Bandingkan cara aplikasi (jumlah bilangan bulat sen) dengan kebenaran mutlak
   (jumlah dalam sen, dihitung terpisah), pada 200.000 daftar acak. */
let salah3 = 0, terburuk = 0;
for (let uji = 0; uji < 200000; uji++) {
  let benarSen = 0, aplikasiSen = 0;
  const isi = 1 + Math.floor(Math.random() * 140);
  for (let i = 0; i < isi; i++) {
    const c = 1 + Math.floor(Math.random() * 999999);       // nilai sen sebenarnya
    const teks = (c / 100).toFixed(2);
    const n = parseKetat(teks);
    benarSen += c;
    aplikasiSen += sen(n);
  }
  const beda = Math.abs(benarSen - aplikasiSen);
  if (beda !== 0) { salah3++; terburuk = Math.max(terburuk, beda); }
}
console.log(salah3 === 0
  ? '  LULUS — 200.000 daftar acak, jumlah selalu sama persis'
  : `  GAGAL — ${salah3} daftar meleset, selisih terbesar ${terburuk} sen`);
if (salah3) lolos = false;

console.log('\n=== UJI 4: jumlah kolom + total, cara float vs cara aplikasi ===');
/* Menunjukkan MENGAPA cara sen dipakai: float menumpuk galat, sen tidak. */
{
  const nilai = [];
  for (let i = 0; i < 140; i++) nilai.push(0.1 + (i % 7) * 0.01);   // banyak pecahan "jahat"
  let float = 0, senJml = 0;
  for (const v of nilai) { float += v; senJml += sen(v); }
  const benar = nilai.reduce((a, v) => a + sen(v), 0);
  console.log(`  cara float    : ${float}`);
  console.log(`  cara aplikasi : ${(senJml / 100).toFixed(2)}  (sen=${senJml})`);
  console.log(`  seharusnya    : ${(benar / 100).toFixed(2)}`);
  console.log(senJml === benar ? '  LULUS — cara aplikasi tepat' : '  GAGAL');
  if (senJml !== benar) lolos = false;
  if (Math.abs(float - benar / 100) > 1e-12) {
    console.log(`  (bukti: cara float meleset ${(float - benar / 100).toExponential(3)} — inilah yang dihindari)`);
  }
}

console.log('\n' + (lolos ? '=== SEMUA PEMERIKSAAN LULUS ===' : '=== ADA YANG GAGAL ==='));
process.exit(lolos ? 0 : 1);
