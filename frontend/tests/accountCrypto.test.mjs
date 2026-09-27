// Uji kripto akun: turunan kata sandi, bungkus kunci ruang, dan kode pemulihan.
// Jalankan: npm test (dari frontend/)
import test from "node:test";
import assert from "node:assert/strict";

import {
  ITERASI_BAWAAN,
  buatSalt,
  bukaBungkusDenganPemulihan,
  bukaBungkusKunciRuang,
  bungkusKunciDenganPemulihan,
  bungkusKunciRuang,
  kodePemulihanBaru,
  kodeSah,
  randomBase64Url,
  rapikanKode,
  turunkanMasterKey,
  verifierDariMasterKey,
  verifierPemulihanDariKode,
} from "../src/lib/accountCrypto.js";

// Iterasi kecil khusus pengujian supaya tes tidak lambat; nilai produksi jauh lebih tinggi.
const ITERASI_UJI = 100000;
const sandi = "kata-sandi-uji-2026";

test("kata sandi dan salt yang sama menghasilkan kunci yang sama", async () => {
  const salt = await buatSalt();
  const a = await turunkanMasterKey(sandi, salt, ITERASI_UJI);
  const b = await turunkanMasterKey(sandi, salt, ITERASI_UJI);
  assert.equal(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
});

test("salt berbeda menghasilkan kunci berbeda", async () => {
  const a = await turunkanMasterKey(sandi, await buatSalt(), ITERASI_UJI);
  const b = await turunkanMasterKey(sandi, await buatSalt(), ITERASI_UJI);
  assert.notEqual(a, b);
});

test("iterasi terlalu rendah ditolak", async () => {
  const salt = await buatSalt();
  await assert.rejects(() => turunkanMasterKey(sandi, salt, 1000));
});

test("kata sandi terlalu pendek ditolak", async () => {
  const salt = await buatSalt();
  await assert.rejects(() => turunkanMasterKey("abc", salt, ITERASI_UJI));
});

test("verifier berbeda dari masterKey dan tetap sama setiap kali", async () => {
  const master = await turunkanMasterKey(sandi, await buatSalt(), ITERASI_UJI);
  const v1 = await verifierDariMasterKey(master);
  const v2 = await verifierDariMasterKey(master);
  assert.equal(v1, v2);
  assert.notEqual(v1, master);
});

test("bungkus lalu buka kunci ruang mengembalikan kunci yang sama", async () => {
  const master = await turunkanMasterKey(sandi, await buatSalt(), ITERASI_UJI);
  const kunciRuang = randomBase64Url(32);
  const bungkusan = await bungkusKunciRuang(master, kunciRuang);
  assert.ok(bungkusan.startsWith("w1:"));
  assert.equal(await bukaBungkusKunciRuang(master, bungkusan), kunciRuang);
});

test("masterKey lain tidak bisa membuka bungkusan", async () => {
  const master = await turunkanMasterKey(sandi, await buatSalt(), ITERASI_UJI);
  const lain = await turunkanMasterKey("kata-sandi-lain-2026", await buatSalt(), ITERASI_UJI);
  const bungkusan = await bungkusKunciRuang(master, randomBase64Url(32));
  await assert.rejects(() => bukaBungkusKunciRuang(lain, bungkusan));
});

test("verifier dan kunci akun tidak bisa dipakai untuk membuka bungkusan", async () => {
  const master = await turunkanMasterKey(sandi, await buatSalt(), ITERASI_UJI);
  const bungkusan = await bungkusKunciRuang(master, randomBase64Url(32));
  const verifier = await verifierDariMasterKey(master);
  // Verifier boleh diketahui server; kalau verifier bisa membuka bungkusan, jaminannya bocor.
  await assert.rejects(() => bukaBungkusKunciRuang(verifier, bungkusan));
});

test("kode pemulihan berbentuk 8 kelompok 4 karakter dan bisa dipakai", async () => {
  const kode = kodePemulihanBaru();
  assert.match(kode, /^[0-9A-Z]{4}(-[0-9A-Z]{4}){7}$/);
  assert.equal(kodeSah(kode), true);
  const kunciRuang = randomBase64Url(32);
  const bungkusan = await bungkusKunciDenganPemulihan(kode, kunciRuang);
  assert.equal(await bukaBungkusDenganPemulihan(kode, bungkusan), kunciRuang);
});

test("kode pemulihan dimaafkan huruf kecil, spasi, dan huruf yang mudah tertukar", async () => {
  const kode = kodePemulihanBaru();
  const bersih = rapikanKode(kode);
  assert.equal(kodeSah(kode.toLowerCase().split("-").join(" ")), true);
  const bungkusan = await bungkusKunciDenganPemulihan(bersih, randomBase64Url(32));
  assert.equal(await bukaBungkusDenganPemulihan(kode.toLowerCase(), bungkusan), await bukaBungkusDenganPemulihan(bersih, bungkusan));
  // O dibaca sebagai nol, I sebagai satu
  const denganHuruf = rapikanKode(bersih.replace(/0/g, "o").replace(/1/g, "l"));
  assert.equal(denganHuruf, bersih);
});

test("kode pemulihan salah ditolak", async () => {
  const kode = kodePemulihanBaru();
  const lain = kodePemulihanBaru();
  assert.notEqual(rapikanKode(kode), rapikanKode(lain));
  const bungkusan = await bungkusKunciDenganPemulihan(kode, randomBase64Url(32));
  await assert.rejects(() => bukaBungkusDenganPemulihan(lain, bungkusan));
  assert.equal(kodeSah("ABC"), false);
  assert.equal(kodeSah(""), false);
  assert.equal(kodeSah(undefined), false);
});

test("kode pemulihan dan kata sandi memakai jalur kunci yang berbeda", async () => {
  const master = await turunkanMasterKey(sandi, await buatSalt(), ITERASI_UJI);
  const kode = kodePemulihanBaru();
  const kunciRuang = randomBase64Url(32);
  const untukSandi = await bungkusKunciRuang(master, kunciRuang);
  const untukPemulihan = await bungkusKunciDenganPemulihan(kode, kunciRuang);
  assert.notEqual(untukSandi, untukPemulihan);
  assert.equal(await bukaBungkusKunciRuang(master, untukSandi), kunciRuang);
  assert.equal(await bukaBungkusDenganPemulihan(kode, untukPemulihan), kunciRuang);
  await assert.rejects(() => bukaBungkusKunciRuang(master, untukPemulihan));
  await assert.rejects(() => bukaBungkusDenganPemulihan(kode, untukSandi));
});

test("verifier pemulihan tidak bisa membuka bungkusan pemulihan", async () => {
  const kode = kodePemulihanBaru();
  const bungkusan = await bungkusKunciDenganPemulihan(kode, randomBase64Url(32));
  const verifier = await verifierPemulihanDariKode(kode);
  await assert.rejects(() => bukaBungkusDenganPemulihan(verifier, bungkusan));
});

test("nilai bawaan iterasi memenuhi saran minimum", () => {
  assert.ok(ITERASI_BAWAAN >= 600000);
});
