// Uji modul kripto klien. Jalankan: npm test (dari frontend/)
import test from "node:test";
import assert from "node:assert/strict";

import { decryptText, encryptText, isEncrypted, newRoomKey } from "../src/lib/crypto.js";
import { buildRoomLink, isValidRoomKey, keyFromHash } from "../src/lib/roomKey.js";

// Batas panjang di server (backend/src/socket/index.js). Isi pesan dikirim dalam
// bentuk terenkripsi, jadi batas ini harus memuat teks terpanjang yang boleh
// diketik (1000 karakter) setelah dienkripsi, termasuk karakter 4 byte.
const SERVER_CONTENT_LIMIT = 8192;
const MAX_INPUT_CHARS = 1000;

test("teks kembali utuh setelah dienkripsi lalu didekripsi", async () => {
  const key = newRoomKey();
  const asli = "Pendapat saya: rapat terlalu panjang, tapi anggarannya belum jelas.";
  const tersimpan = await encryptText(key, asli);

  assert.ok(isEncrypted(tersimpan));
  assert.notEqual(tersimpan, asli);

  const hasil = await decryptText(key, tersimpan);
  assert.equal(hasil.ok, true);
  assert.equal(hasil.text, asli);
});

test("teks yang sama menghasilkan ciphertext berbeda (IV acak)", async () => {
  const key = newRoomKey();
  const a = await encryptText(key, "sama");
  const b = await encryptText(key, "sama");
  assert.notEqual(a, b);
  assert.equal((await decryptText(key, a)).text, (await decryptText(key, b)).text);
});

test("kunci berbeda tidak bisa membuka pesan", async () => {
  const tersimpan = await encryptText(newRoomKey(), "rahasia");
  const hasil = await decryptText(newRoomKey(), tersimpan);
  assert.equal(hasil.ok, false);
  assert.equal(hasil.reason, "kunci-tidak-cocok");
  assert.equal(hasil.text, undefined);
});

test("ciphertext yang diubah ditolak, bukan dibuka sebagian", async () => {
  const key = newRoomKey();
  const tersimpan = await encryptText(key, "pesan asli");
  // ubah satu karakter di bagian ciphertext
  const rusak = tersimpan.slice(0, -2) + (tersimpan.endsWith("AA") ? "BB" : "AA");
  const hasil = await decryptText(key, rusak);
  assert.equal(hasil.ok, false);
});

test("pesan lama (belum terenkripsi) dikenali sebagai legacy", async () => {
  const hasil = await decryptText(newRoomKey(), "pesan dari sebelum enkripsi aktif");
  assert.equal(hasil.ok, false);
  assert.equal(hasil.legacy, true);
  assert.equal(hasil.text, "pesan dari sebelum enkripsi aktif");
});

test("teks 1000 karakter tetap di bawah batas server", async () => {
  const key = newRoomKey();
  const ascii = await encryptText(key, "a".repeat(MAX_INPUT_CHARS));
  const emoji = await encryptText(key, "🙂".repeat(MAX_INPUT_CHARS));
  assert.ok(ascii.length < SERVER_CONTENT_LIMIT, `ascii ${ascii.length}`);
  assert.ok(emoji.length < SERVER_CONTENT_LIMIT, `emoji ${emoji.length}`);
});

test("kunci ruang 32 byte, acak, dan berbentuk base64url", () => {
  const a = newRoomKey();
  const b = newRoomKey();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
});

test("kunci dibaca dari fragmen tautan, dan fragmen rusak diabaikan", () => {
  const key = newRoomKey();
  assert.equal(keyFromHash(`#k=${key}`), key);
  assert.equal(keyFromHash(`#k=${key}&lain=1`), key);
  assert.equal(keyFromHash("#lain=1"), "");
  assert.equal(keyFromHash(""), "");
  assert.equal(keyFromHash(undefined), "");
});

test("tautan pengelola memuat kunci, tautan tanpa kunci tetap terbentuk", () => {
  const key = newRoomKey();
  assert.equal(buildRoomLink("https://chanonim.web.id", "abc", key), `https://chanonim.web.id/room/abc#k=${key}`);
  assert.equal(buildRoomLink("https://chanonim.web.id", "abc", ""), "https://chanonim.web.id/room/abc");
});

test("kunci terpotong atau kosong dikenali sebagai tidak sah", () => {
  const key = newRoomKey();
  assert.equal(isValidRoomKey(key), true);
  assert.equal(isValidRoomKey(key.slice(0, 42)), false, "kurang satu karakter");
  assert.equal(isValidRoomKey(`${key}A`), false, "kelebihan satu karakter");
  assert.equal(isValidRoomKey("palsu-kunci-uji"), false);
  assert.equal(isValidRoomKey(""), false);
  assert.equal(isValidRoomKey(undefined), false);
  assert.equal(isValidRoomKey(`${key} `), true, "spasi di ujung dimaafkan");
});

test("kunci tidak sah tidak dipakai untuk enkripsi", async () => {
  await assert.rejects(() => encryptText("palsu-kunci-uji", "pesan"));
  await assert.rejects(() => encryptText("", "pesan"));
});
