"use client";

// Sesi akun di perangkat: menyimpan kunci akun yang sudah diturunkan dari kata sandi,
// membungkus dan membuka kunci ruang, serta mengurus kode pemulihan.
//
// Yang disimpan di perangkat:
// - masterKey (turunan kata sandi) -> sessionStorage, hilang saat tab ditutup.
// - kunci ruang yang sudah dibuka  -> sessionStorage, untuk menyusun tautan undangan.
// - kode pemulihan                 -> hanya kalau pengguna menyetujui (opt-in),
//   karena kode pemulihan bisa membuka semua ruang tanpa kata sandi.

import { api } from "./api";
import {
  bungkusKunciDenganPemulihan,
  bungkusKunciRuang,
  bukaBungkusKunciRuang,
  bukaBungkusDenganPemulihan,
  kodeSah,
  rapikanKode,
  turunkanMasterKey,
  verifierDariMasterKey,
} from "./accountCrypto";

const SESSION_MASTER = "akun.masterKey";
const SESSION_ROOM_KEYS = "akun.roomKeys";
const SESSION_KODE = "akun.kodePemulihanSesi";
const LOCAL_KODE = "akun.kodePemulihan";
const LEGACY_LOCAL_KEYS = "anoni.roomKeys";

function simpanan(nama) {
  try {
    return typeof window === "undefined" ? null : window[nama];
  } catch {
    return null;
  }
}

function bacaJson(store, kunci, bawaan = {}) {
  if (!store) return bawaan;
  try {
    const nilai = JSON.parse(store.getItem(kunci) || "null");
    return nilai && typeof nilai === "object" ? nilai : bawaan;
  } catch {
    return bawaan;
  }
}

// ---------- Kunci akun ----------

export function masterKey() {
  const ss = simpanan("sessionStorage");
  return ss ? ss.getItem(SESSION_MASTER) || "" : "";
}

export function kunciTerbuka() {
  return !!masterKey();
}

export function simpanMasterKey(master) {
  const ss = simpanan("sessionStorage");
  if (ss) ss.setItem(SESSION_MASTER, master);
}

export function tutupSesi() {
  const ss = simpanan("sessionStorage");
  if (ss) {
    ss.removeItem(SESSION_MASTER);
    ss.removeItem(SESSION_ROOM_KEYS);
    ss.removeItem(SESSION_KODE);
  }
}

// Menurunkan kunci akun dari kata sandi dan memastikan kata sandinya benar.
// Verifikasi dilakukan ke server memakai verifier, jadi kata sandi tetap tidak dikirim.
export async function bukaKunciDenganSandi(sandi, identitas) {
  // Identitas dipakai untuk mengambil parameter turunan kunci. Kalau belum tersimpan di
  // browser ini (misalnya login dilakukan di profil browser lain), pengguna diminta mengisinya.
  const login = identitas || sesiLogin();
  if (!login) {
    throw new Error("Isi email atau username akun Anda untuk membuka kunci di perangkat ini.");
  }
  const params = await api.kdfParams(login);
  if (params.mode !== "akun") {
    throw new Error("Akun ini belum memakai enkripsi akun. Masuk sekali lewat halaman login.");
  }
  const master = await turunkanMasterKey(sandi, params.kdfSalt, params.kdfIterations);
  const authVerifier = await verifierDariMasterKey(master);
  await api.verifyVerifier({ authVerifier });
  simpanMasterKey(master);
  simpanIdentitas(login);
  return master;
}

// Nama akun disimpan agar pembukaan kunci tidak perlu menebak identitas.
export function simpanIdentitas(login) {
  const ls = simpanan("localStorage");
  if (ls) ls.setItem("akun.login", login);
}

export function sesiLogin() {
  const ls = simpanan("localStorage");
  return ls ? ls.getItem("akun.login") || "" : "";
}

// ---------- Kode pemulihan ----------

export function kodePemulihanTersedia() {
  const ss = simpanan("sessionStorage");
  const dariSesi = ss ? ss.getItem(SESSION_KODE) : "";
  if (dariSesi) return dariSesi;
  const ls = simpanan("localStorage");
  return ls ? ls.getItem(LOCAL_KODE) || "" : "";
}

export function simpanKodePemulihan(kode, { diBrowser = false } = {}) {
  const rapi = rapikanKode(kode);
  if (!kodeSah(rapi)) throw new Error("Kode pemulihan tidak dikenali");
  const ss = simpanan("sessionStorage");
  if (ss) ss.setItem(SESSION_KODE, rapi);
  const ls = simpanan("localStorage");
  if (!ls) return;
  if (diBrowser) ls.setItem(LOCAL_KODE, rapi);
  else ls.removeItem(LOCAL_KODE);
}

export function lupakanKodePemulihan() {
  const ss = simpanan("sessionStorage");
  const ls = simpanan("localStorage");
  if (ss) ss.removeItem(SESSION_KODE);
  if (ls) ls.removeItem(LOCAL_KODE);
}

// ---------- Kunci ruang ----------

function simpananKunciRuang() {
  return bacaJson(simpanan("sessionStorage"), SESSION_ROOM_KEYS, {});
}

export function roomKeySesi(slug) {
  return simpananKunciRuang()[slug] || "";
}

function simpanRoomKeySesi(slug, kunci) {
  const ss = simpanan("sessionStorage");
  if (!ss) return;
  const semua = simpananKunciRuang();
  semua[slug] = kunci;
  ss.setItem(SESSION_ROOM_KEYS, JSON.stringify(semua));
}

function kunciLamaDiBrowser(slug) {
  return bacaJson(simpanan("localStorage"), LEGACY_LOCAL_KEYS, {})[slug] || "";
}

// Membuka semua kunci ruang milik akun dari bungkusan yang tersimpan di server.
// Kunci yang belum ada di server tetapi masih tersimpan di browser ini (dari versi
// sebelumnya) ikut dibungkus dan diunggah, supaya tidak hilang saat tautan berganti.
export async function muatKunciRuang() {
  const master = masterKey();
  if (!master) throw new Error("Kunci akun belum dibuka");
  const kode = kodePemulihanTersedia();
  const { keys } = await api.getKeys();
  const peta = {};
  const perluKode = [];

  for (const item of keys) {
    // Ruang yang belum dibungkus kode pemulihan perlu ditandai supaya pengguna tahu
    // dan bisa memasukkan kodenya, bukan dibiarkan tanpa pemberitahuan.
    if (item.wrappedRecovery === "none") perluKode.push(item.slug);
    try {
      const kunci = await bukaBungkusKunciRuang(master, item.wrappedPassword);
      peta[item.slug] = kunci;
      simpanRoomKeySesi(item.slug, kunci);
    } catch {
      // Bungkusan yang tidak cocok dibiarkan: artinya kata sandi akun berbeda dari kata
      // sandi saat kunci itu dibuat, dan itu harus terlihat, bukan disembunyikan.
    }
  }

  const daftarRuang = await api.getRooms().catch(() => ({ rooms: [] }));
  for (const room of daftarRuang.rooms || []) {
    if (peta[room.slug]) continue;
    const lokal = kunciLamaDiBrowser(room.slug);
    if (!lokal) continue;
    try {
      await simpanKunciRuang(room.slug, lokal, { kode });
      peta[room.slug] = lokal;
      simpanRoomKeySesi(room.slug, lokal);
      if (!kode) perluKode.push(room.slug);
    } catch {
      /* kunci lama tetap dipakai lewat roomKeySesi */
    }
  }

  return { keys: peta, perluKode };
}

export async function simpanKunciRuang(slug, kunci, { kode } = {}) {
  const master = masterKey();
  if (!master) throw new Error("Kunci akun belum dibuka");
  const kodePakai = kode || kodePemulihanTersedia();
  const wrappedPassword = await bungkusKunciRuang(master, kunci);
  const wrappedRecovery = kodePakai
    ? await bungkusKunciDenganPemulihan(kodePakai, kunci)
    : "none";
  await api.putKey(slug, { wrappedPassword, wrappedRecovery });
  simpanRoomKeySesi(slug, kunci);
}

export async function bukaBungkusanKode(slug, wrappedRecovery, kode) {
  return bukaBungkusDenganPemulihan(kode, wrappedRecovery);
}
