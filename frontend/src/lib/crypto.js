// Enkripsi isi pesan dilakukan di perangkat pengguna (end-to-end).
//
// Kunci ruang dibuat di browser, dibawa di bagian fragmen tautan (`#k=...`),
// dan tidak pernah dikirim ke server. Yang tersimpan di server hanya bentuk
// terenkripsinya, sehingga basis data yang bocor pun tidak memuat isi percakapan.
//
// Batas jaminan yang perlu diketahui (lihat README bagian "Enkripsi pesan"):
// - Tautan adalah satu-satunya salinan kunci. Tautan hilang berarti isi pesan
//   tidak bisa dibuka lagi, termasuk oleh pembuatnya.
// - Halaman web ini dikirim oleh server yang sama, jadi pemilik server yang
//   sengaja menyisipkan kode jahat tetap bisa mencuri kunci dari browser.
//   Enkripsi ini melindungi dari kebocoran basis data dan cadangan, bukan dari
//   server yang aktif menyerang penggunanya.

const PREFIX = "e2e1:";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function webCrypto() {
  const c = globalThis.crypto;
  if (!c || !c.subtle) {
    throw new Error("Perangkat ini tidak mendukung enkripsi yang dibutuhkan.");
  }
  return c;
}

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function newRoomKey() {
  const bytes = new Uint8Array(KEY_BYTES);
  webCrypto().getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

async function importRoomKey(key) {
  if (typeof key !== "string" || !key) throw new Error("Kunci ruang tidak tersedia");
  const raw = fromBase64Url(key);
  if (raw.length !== KEY_BYTES) throw new Error("Kunci ruang tidak sah");
  return webCrypto().subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// Mengembalikan teks berbentuk "e2e1:<iv><ciphertext>" dalam base64url.
export async function encryptText(key, plaintext) {
  const cryptoKey = await importRoomKey(key);
  const iv = new Uint8Array(IV_BYTES);
  webCrypto().getRandomValues(iv);
  const ciphertext = new Uint8Array(
    await webCrypto().subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      new TextEncoder().encode(plaintext)
    )
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return PREFIX + toBase64Url(combined);
}

// Hasil: { ok: true, text } kalau berhasil dibuka,
// { ok: false, legacy: true, text } untuk pesan yang ditulis sebelum enkripsi aktif,
// { ok: false, reason } kalau kunci tidak cocok atau data rusak.
export async function decryptText(key, payload) {
  if (!isEncrypted(payload)) {
    return { ok: false, legacy: true, text: typeof payload === "string" ? payload : "" };
  }
  try {
    const cryptoKey = await importRoomKey(key);
    const raw = fromBase64Url(payload.slice(PREFIX.length));
    if (raw.length <= IV_BYTES) throw new Error("Data terenkripsi terlalu pendek");
    const plaintext = await webCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: raw.slice(0, IV_BYTES) },
      cryptoKey,
      raw.slice(IV_BYTES)
    );
    return { ok: true, text: new TextDecoder().decode(plaintext) };
  } catch {
    return { ok: false, reason: "kunci-tidak-cocok" };
  }
}
