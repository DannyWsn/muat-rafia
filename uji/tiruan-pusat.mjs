/* Tiruan Apps Script: menjalankan aturan yang sama persis dengan Kode-Apps-Script.gs,
   supaya alur sinkron bisa diuji tanpa menyentuh Google. */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const KODE_PEMILIK = 'RAHASIA-PEMILIK';
const KODE_OPERATOR = 'KODE-OPERATOR';
const AKAR = 'D:/muat-rafia';

/* "Spreadsheet" di dalam ingatan */
const lembar = [];   // {id, ..., diubah, dihapus, oleh}

const perankan = (k) => (k === KODE_PEMILIK ? 'pemilik' : k === KODE_OPERATOR ? 'operator' : null);

function simpan(daftar, peran, oleh) {
  const ditolak = [];
  for (const m of daftar) {
    if (!m || !m.id) continue;
    const i = lembar.findIndex((x) => x.id === m.id);
    if (i >= 0) {
      const pemilikBaris = lembar[i].oleh || '';
      if (peran !== 'pemilik') {
        if (pemilikBaris && pemilikBaris !== oleh) { ditolak.push({ id: m.id, sebab: 'bukan milik HP ini' }); continue; }
        if (m.dihapus) { ditolak.push({ id: m.id, sebab: 'hanya pemilik yang boleh menghapus' }); continue; }
      }
      lembar[i] = { ...m, diubah: Number(m.diubah || Date.now()), dihapus: m.dihapus ? 1 : 0, oleh: pemilikBaris || oleh, diterima: Date.now() };
    } else {
      if (m.dihapus && peran !== 'pemilik') { ditolak.push({ id: m.id, sebab: 'hanya pemilik yang boleh menghapus' }); continue; }
      lembar.push({ ...m, diubah: Number(m.diubah || Date.now()), dihapus: m.dihapus ? 1 : 0, oleh, diterima: Date.now() });
    }
  }
  return ditolak;
}
/* menyaring dengan waktu PENERIMAAN, bukan waktu pembuatan */
const baca = (sejak) => lembar.filter((m) => !sejak || Number(m.diterima || 0) > sejak);

const JENIS = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png',
                '.webmanifest': 'application/manifest+json' };

createServer((req, res) => {
  const kepala = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, kepala); return res.end(); }

  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api') {
    let badan = '';
    req.on('data', (c) => (badan += c));
    req.on('end', () => {
      let j = {};
      try { j = JSON.parse(badan); } catch {}
      const peran = perankan(j.kode);
      const kirimBalik = (o) => {
        res.writeHead(200, { ...kepala, 'Content-Type': 'application/json' });
        res.end(JSON.stringify(o));
      };
      if (!peran) return kirimBalik({ ok: false, pesan: 'Kode Pabrik salah' });
      if (j.aksi === 'periksa') return kirimBalik({ ok: true, peran, waktu: Date.now() });
      if (j.aksi === 'kirim') {
        const ditolak = simpan(j.data || [], peran, j.oleh || '');
        return kirimBalik({ ok: true, peran, ditolak, muat: baca(j.sejak || 0), waktu: Date.now() });
      }
      if (j.aksi === 'ambil') return kirimBalik({ ok: true, peran, muat: baca(j.sejak || 0), waktu: Date.now() });
      if (j.aksi === '__isi') return kirimBalik({ ok: true, lembar });   /* hanya untuk uji */
      return kirimBalik({ ok: false, pesan: 'Aksi tidak dikenal' });
    });
    return;
  }

  /* sajikan berkas aplikasi */
  const nama = u.pathname === '/' ? '/index.html' : u.pathname;
  const berkas = join(AKAR, nama);
  if (!existsSync(berkas)) { res.writeHead(404); return res.end('tidak ada'); }
  res.writeHead(200, { 'Content-Type': JENIS[extname(berkas)] || 'application/octet-stream' });
  res.end(readFileSync(berkas));
}).listen(8801, () => console.log('tiruan pusat siap di http://127.0.0.1:8801'));
