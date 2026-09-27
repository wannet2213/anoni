// Kripto akun: menurunkan kunci dari kata sandi akun di perangkat, membungkus kunci ruang,
// dan menangani kode pemulihan.
//
// Aturan yang menjaga jaminannya:
// - Kata sandi akun tidak pernah dikirim ke server. Yang dikirim hanya turunannya (verifier).
// - wrapKey dan recoveryWrapKey tidak pernah dikirim, sehingga bungkusan kunci ruang yang
//   tersimpan di server tidak bisa dibuka oleh server.
// - authVerifier dan wrapKey berasal dari masterKey yang sama, tetapi dipisahkan lewat HKDF
//   dengan label berbeda, sehingga mengetahui verifier tidak membantu membuka bungkusan.
//
// Lihat README bagian "Kunci ruang disimpan di akun" untuk batas jaminannya.

const encoder = new TextEncoder();
const ITERASI_MIN = 100000;
export const ITERASI_BAWAAN = 600000;
const LABEL_AUTH = "anoni-auth-v1";
const LABEL_WRAP = "anoni-wrap-v1";
const LABEL_RECOVERY_AUTH = "anoni-recovery-auth-v1";
const LABEL_RECOVERY_WRAP = "anoni-recovery-wrap-v1";
const SALT_HKDF = "anoni-hkdf-salt-v1";
const PREFIX_BUNGKUSAN = "w1:";
const KODE_BYTES = 20; // 160 bit, cukup untuk kode pemulihan yang diketik manual

// Crockford base32: tanpa huruf yang mudah tertukar (I, L, O, U).
const ALFABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function webCrypto() {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new Error("Perangkat ini tidak mendukung enkripsi yang dibutuhkan.");
  return c;
}

export function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text) {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomBase64Url(bytes = 32) {
  const buf = new Uint8Array(bytes);
  webCrypto().getRandomValues(buf);
  return toBase64Url(buf);
}

// ---------- Turunan dari kata sandi ----------

export async function buatSalt() {
  return randomBase64Url(16);
}

// Kata sandi -> masterKey. Hanya di perangkat pengguna.
export async function turunkanMasterKey(password, saltB64, iterations = ITERASI_BAWAAN) {
  if (typeof password !== "string" || password.length < 6) {
    throw new Error("Kata sandi minimal 6 karakter");
  }
  const iter = Number(iterations) || ITERASI_BAWAAN;
  if (iter < ITERASI_MIN) throw new Error("Jumlah iterasi terlalu rendah");
  const bahan = await webCrypto().subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await webCrypto().subtle.deriveBits(
    { name: "PBKDF2", salt: fromBase64Url(saltB64), iterations: iter, hash: "SHA-256" },
    bahan,
    256
  );
  return toBase64Url(new Uint8Array(bits));
}

async function importHkdf(masterKeyB64) {
  const raw = fromBase64Url(masterKeyB64);
  // HKDF menerima bahan dengan panjang apa pun. Batas bawah 16 byte hanya untuk menolak
  // kunci yang jelas rusak, misalnya hasil potong karena salah salin.
  if (raw.length < 16) throw new Error("Kunci akun tidak sah");
  return webCrypto().subtle.importKey("raw", raw, "HKDF", false, ["deriveBits"]);
}

async function turunkan(masterKeyB64, label, bytes = 32) {
  const bahan = await importHkdf(masterKeyB64);
  const bits = await webCrypto().subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode(SALT_HKDF), info: encoder.encode(label) },
    bahan,
    bytes * 8
  );
  return toBase64Url(new Uint8Array(bits));
}

// Verifier dikirim ke server untuk mencocokkan identitas, tidak bisa dipakai membuka bungkusan.
export function verifierDariMasterKey(masterKeyB64) {
  return turunkan(masterKeyB64, LABEL_AUTH);
}

export function verifierPemulihanDariKode(kode) {
  return turunkan(kodeKeBase64(kode), LABEL_RECOVERY_AUTH);
}

// ---------- Bungkus dan buka kunci ruang ----------

async function kunciAes(dariBase64, label) {
  const bahan = label ? await turunkan(dariBase64, label) : dariBase64;
  return webCrypto().subtle.importKey("raw", fromBase64Url(bahan), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function bungkusKunciRuang(masterKeyB64, kunciRuang) {
  const key = await kunciAes(masterKeyB64, LABEL_WRAP);
  return bungkus(kunciRuang, key);
}

export async function bukaBungkusKunciRuang(masterKeyB64, bungkusan) {
  const key = await kunciAes(masterKeyB64, LABEL_WRAP);
  return buka(bungkusan, key);
}

export async function bungkusKunciDenganPemulihan(kode, kunciRuang) {
  const key = await kunciAes(kodeKeBase64(kode), LABEL_RECOVERY_WRAP);
  return bungkus(kunciRuang, key);
}

export async function bukaBungkusDenganPemulihan(kode, bungkusan) {
  const key = await kunciAes(kodeKeBase64(kode), LABEL_RECOVERY_WRAP);
  return buka(bungkusan, key);
}

async function bungkus(teks, key) {
  const iv = new Uint8Array(12);
  webCrypto().getRandomValues(iv);
  const ct = new Uint8Array(
    await webCrypto().subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(teks))
  );
  const gabung = new Uint8Array(iv.length + ct.length);
  gabung.set(iv, 0);
  gabung.set(ct, iv.length);
  return PREFIX_BUNGKUSAN + toBase64Url(gabung);
}

async function buka(bungkusan, key) {
  if (typeof bungkusan !== "string" || !bungkusan.startsWith(PREFIX_BUNGKUSAN)) {
    throw new Error("Bungkusan kunci tidak dikenali");
  }
  const raw = fromBase64Url(bungkusan.slice(PREFIX_BUNGKUSAN.length));
  const bersih = await webCrypto().subtle.decrypt(
    { name: "AES-GCM", iv: raw.slice(0, 12) },
    key,
    raw.slice(12)
  );
  return new TextDecoder().decode(bersih);
}

// ---------- Kode pemulihan ----------

function keBase32(bytes) {
  let bit = 0;
  let nilai = 0;
  let keluaran = "";
  for (const b of bytes) {
    nilai = (nilai << 8) | b;
    bit += 8;
    while (bit >= 5) {
      keluaran += ALFABET[(nilai >>> (bit - 5)) & 31];
      bit -= 5;
    }
  }
  if (bit > 0) keluaran += ALFABET[(nilai << (5 - bit)) & 31];
  return keluaran;
}

function dariBase32(teks) {
  let bit = 0;
  let nilai = 0;
  const keluaran = [];
  for (const c of teks) {
    const idx = ALFABET.indexOf(c);
    if (idx === -1) throw new Error("Kode pemulihan memuat karakter yang tidak dikenal");
    nilai = (nilai << 5) | idx;
    bit += 5;
    if (bit >= 8) {
      keluaran.push((nilai >>> (bit - 8)) & 0xff);
      bit -= 8;
    }
  }
  return new Uint8Array(keluaran);
}

export function kodePemulihanBaru() {
  const bytes = new Uint8Array(KODE_BYTES);
  webCrypto().getRandomValues(bytes);
  return kelompokkanKode(keBase32(bytes));
}

// Menerima bentuk apa pun yang wajar diketik orang: huruf kecil, spasi, tanda hubung.
export function rapikanKode(kode) {
  if (typeof kode !== "string") return "";
  return kode
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V");
}

function kelompokkanKode(teks) {
  return teks.replace(/(.{4})(?=.)/g, "$1-");
}

export function kodeSah(kode) {
  const rapi = rapikanKode(kode);
  if (rapi.length !== panjangKode()) return false;
  return [...rapi].every((c) => ALFABET.includes(c));
}

function panjangKode() {
  return Math.ceil((KODE_BYTES * 8) / 5);
}

function kodeKeBase64(kode) {
  const rapi = rapikanKode(kode);
  if (!kodeSah(rapi)) throw new Error("Kode pemulihan tidak sah");
  return toBase64Url(dariBase32(rapi));
}
