// Penyimpanan kunci ruang di sisi perangkat.
//
// Pengelola ruang: kunci disimpan di localStorage supaya tombol "Salin tautan"
// tetap lengkap saat ruang dibuka lagi dari browser yang sama.
// Peserta: kunci hanya disimpan di sessionStorage, jadi hilang saat tab ditutup.

const SESSION_PREFIX = "roomKey_";
const ADMIN_STORE = "anoni.roomKeys";

function safe(store) {
  try {
    return typeof window === "undefined" ? null : window[store];
  } catch {
    return null;
  }
}

function readAdminStore() {
  const ls = safe("localStorage");
  if (!ls) return {};
  try {
    const parsed = JSON.parse(ls.getItem(ADMIN_STORE) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// Kunci dibaca dari fragmen tautan (`#k=...`). Fragmen tidak pernah dikirim ke server.
export function keyFromHash(hash) {
  if (!hash) return "";
  try {
    const value = new URLSearchParams(hash.replace(/^#/, "")).get("k");
    return value ? value.trim() : "";
  } catch {
    return "";
  }
}

// Kunci ruang berbentuk 32 byte dalam base64url, jadi panjangnya selalu 43 karakter.
// Fragmen tautan bisa terpotong saat tautan disalin lewat aplikasi lain, dan kunci
// yang terpotong harus dikenali sebagai rusak, bukan dicoba lalu gagal diam-diam.
export function isValidRoomKey(key) {
  return typeof key === "string" && /^[A-Za-z0-9_-]{43}$/.test(key.trim());
}

export function rememberRoomKey(slug, key, { persist = false } = {}) {
  if (!slug || !key) return;
  const ss = safe("sessionStorage");
  if (ss) {
    try {
      ss.setItem(`${SESSION_PREFIX}${slug}`, key);
    } catch {
      /* penyimpanan penuh atau diblokir: kunci tetap dipakai dari memori halaman */
    }
  }
  if (persist) {
    const ls = safe("localStorage");
    if (!ls) return;
    try {
      const all = readAdminStore();
      all[slug] = key;
      ls.setItem(ADMIN_STORE, JSON.stringify(all));
    } catch {
      /* idem */
    }
  }
}

export function storedRoomKey(slug) {
  if (!slug) return "";
  const ss = safe("sessionStorage");
  if (ss) {
    try {
      const value = ss.getItem(`${SESSION_PREFIX}${slug}`);
      if (value) return value;
    } catch {
      /* lanjut ke penyimpanan pengelola */
    }
  }
  return readAdminStore()[slug] || "";
}

export function buildRoomLink(origin, slug, key) {
  return `${origin}/room/${slug}${key ? `#k=${key}` : ""}`;
}

// Ruang yang dibuat dari browser lain tidak menyimpan kuncinya di sini, jadi
// tautan yang dihasilkan tidak bisa dipakai membuka pesan. Ini harus dikatakan
// terus terang ke pengelola, bukan disembunyikan.
export function keyMissingNotice() {
  return "Kunci ruang ini tidak ada di browser ini, jadi tautan yang disalin tidak bisa membuka pesan lama. Pakai tautan aslinya, atau buat ruang baru.";
}
