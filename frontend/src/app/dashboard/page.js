"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useSocket } from "@/lib/socket";
import { newRoomKey } from "@/lib/crypto";
import { buildRoomLink } from "@/lib/roomKey";
import {
  bukaKunciDenganSandi,
  kodePemulihanTersedia,
  kunciTerbuka,
  muatKunciRuang,
  sesiLogin,
  simpanKodePemulihan,
  simpanKunciRuang,
  tutupSesi,
} from "@/lib/account";
import { rapikanKode } from "@/lib/accountCrypto";
import ThemeToggle from "@/components/ThemeToggle";

export default function DashboardPage() {
  const router = useRouter();
  const socket = useSocket();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", password: "", slug: "" });
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [copied, setCopied] = useState(null);
  const [roomKeys, setRoomKeys] = useState({});
  const [created, setCreated] = useState(null);
  // "memuat" -> "siap" kalau kunci akun sudah terbuka, "terkunci" kalau belum.
  const [status, setStatus] = useState("memuat");
  const [sandi, setSandi] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [kodeAda, setKodeAda] = useState("");
  const [perluKode, setPerluKode] = useState(false);
  const [kodeInput, setKodeInput] = useState("");
  const [kodeDiingat, setKodeDiingat] = useState(false);
  const [kodeError, setKodeError] = useState("");
  const [identitas, setIdentitas] = useState("");

  async function writeClipboard(text, slug) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }

  // Kunci ruang dibuka dari bungkusan yang tersimpan di akun. Server tidak bisa membukanya.
  // Daftar ruang ikut diambil di sini, karena tab yang tadinya terkunci belum pernah
  // memuatnya dan tanpa itu halaman berhenti di "Memuat dashboard...".
  async function siapkanKunci() {
    try {
      const { keys, perluKode } = await muatKunciRuang();
      setRoomKeys(keys);
      setKodeAda(kodePemulihanTersedia());
      setPerluKode(perluKode.length > 0);
      setStatus("siap");
      await fetchRooms();
    } catch (err) {
      setUnlockError(err.message);
      setStatus("terkunci");
    }
  }

  async function bukaKunci(e) {
    e.preventDefault();
    setUnlockError("");
    try {
      await bukaKunciDenganSandi(sandi, identitas.trim());
      setSandi("");
      await siapkanKunci();
    } catch (err) {
      setUnlockError(err.message);
    }
  }

  // Kode pemulihan membuat kunci ruang bisa dibuka lagi kalau kata sandi lupa.
  // Tanpa kode ini, ruang baru hanya terikat pada kata sandi akun.
  async function pakaiKode(e) {
    e.preventDefault();
    setKodeError("");
    try {
      simpanKodePemulihan(kodeInput, { diBrowser: kodeDiingat });
      const kode = rapikanKode(kodeInput);
      for (const [slug, key] of Object.entries(roomKeys)) {
        await simpanKunciRuang(slug, key, { kode });
      }
      setKodeAda(kode);
      setPerluKode(false);
      setKodeInput("");
    } catch (err) {
      setKodeError(err.message);
    }
  }

  async function copyLink(slug) {
    const key = roomKeys[slug];
    if (!key) return;
    await writeClipboard(buildRoomLink(window.location.origin, slug, key), slug);
  }

  // Ruang yang dibuat sebelum enkripsi akun aktif belum punya kunci: kuncinya dibuat
  // sekarang, lalu disimpan di akun dalam bentuk terbungkus.
  async function activateEncryption(slug) {
    setError("");
    try {
      const key = newRoomKey();
      await simpanKunciRuang(slug, key);
      setRoomKeys((prev) => ({ ...prev, [slug]: key }));
      setCreated({ slug, link: buildRoomLink(window.location.origin, slug, key), activated: true });
    } catch (err) {
      setError(err.message);
    }
  }

  async function fetchRooms() {
    setLoadError("");
    try {
      const data = await api.getRooms();
      setRooms(data.rooms);
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      } else {
        setLoadError("Tidak bisa memuat ruang. Periksa koneksi lalu coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Identitas akun dibaca dari penyimpanan browser, bukan saat render, supaya tidak
    // menyentuh localStorage pada proses render di server.
    setIdentitas(sesiLogin());
  }, []);

  useEffect(() => {
    // Kunci akun hanya ada selama tab ini hidup. Browser baru berarti perlu dibuka ulang
    // dengan kata sandi akun, dan kata sandinya tidak dikirim ke server.
    if (kunciTerbuka()) {
      siapkanKunci();
    } else {
      setStatus("terkunci");
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = ({ slug }) => {
      setRooms((prev) => prev.filter((r) => r.slug !== slug));
    };
    socket.on("room_deleted", handler);
    return () => socket.off("room_deleted", handler);
  }, [socket]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return;
    // Kunci dibuat di browser ini dan tidak pernah dikirim ke server.
    const key = newRoomKey();
    try {
      const data = await api.createRoom({ name: form.name, password: form.password || undefined, slug: form.slug || undefined });
      const slug = data?.room?.slug;
      if (slug) {
        // Kunci ruang dibuat di perangkat, lalu disimpan di akun dalam bentuk terbungkus.
        await simpanKunciRuang(slug, key);
        setRoomKeys((prev) => ({ ...prev, [slug]: key }));
        setCreated({
          slug,
          link: buildRoomLink(window.location.origin, slug, key),
          activated: false,
        });
      }
      setShowCreate(false);
      setForm({ name: "", password: "", slug: "" });
      fetchRooms();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Hapus room ini? Semua pesan akan hilang permanen.")) return;
    setDeleting(id);
    try {
      await api.deleteRoom(id);
      fetchRooms();
    } catch {
      setError("Gagal menghapus room");
    } finally {
      setDeleting(null);
    }
  }

  function handleLogout() {
    // Kunci akun dan kunci ruang yang sudah dibuka hanya hidup selama tab ini, jadi
    // keluar berarti keduanya ikut dilupakan.
    tutupSesi();
    localStorage.removeItem("token");
    router.push("/login");
  }

  if (loading && status === "siap") {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-gray-700 dark:text-gray-300 text-sm" role="status">Memuat dashboard...</div>
      </main>
    );
  }

  if (status !== "siap") {
    return (
      <main className="page-shell min-h-[100dvh] flex items-center justify-center py-12">
        <ThemeToggle className="fixed top-6 right-6" />
        <div className="mx-auto w-full max-w-md">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] mb-3">
            Buka kunci ruang Anda
          </h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">
            Kunci ruang-ruang Anda disimpan di server dalam bentuk terbungkus. Untuk membukanya di
            perangkat ini, masukkan kata sandi akun. Kata sandinya diturunkan di perangkat dan tidak
            dikirim ke server.
          </p>
          <div className="doppelrand">
            <div className="shell">
              <div className="core">
                {status === "memuat" ? (
                  <p className="text-gray-700 dark:text-gray-300 text-sm" role="status">
                    Memeriksa kunci akun...
                  </p>
                ) : (
                  <form onSubmit={bukaKunci} className="space-y-4">
                    {!identitas && (
                      <div>
                        <label htmlFor="unlock-identity" className="block text-sm text-gray-800 dark:text-gray-200 mb-2">
                          Email atau Username
                        </label>
                        <input
                          id="unlock-identity"
                          className="input-glass"
                          placeholder="admin@email.com"
                          value={identitas}
                          onChange={(e) => setIdentitas(e.target.value)}
                          required
                        />
                      </div>
                    )}
                    <div>
                      <label htmlFor="unlock-password" className="block text-sm text-gray-800 dark:text-gray-200 mb-2">
                        Kata sandi akun
                      </label>
                      <input
                        id="unlock-password"
                        type="password"
                        className="input-glass"
                        value={sandi}
                        onChange={(e) => setSandi(e.target.value)}
                        required
                      />
                    </div>
                    {unlockError && (
                      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300" role="alert">
                        {unlockError}
                      </div>
                    )}
                    <button type="submit" className="btn-emerald w-full justify-center">
                      Buka kunci
                    </button>
                  </form>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button onClick={handleLogout} className="btn-glass text-sm">
                    Keluar
                  </button>
                  <Link href="/" className="inline-link text-sm">
                    Beranda
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Panel kode pemulihan hanya relevan kalau ada ruang yang belum dibungkus kode itu.
  const needKodePanel = perluKode && !kodeAda;

  return (
    <main className="page-shell min-h-[100dvh] py-12">
      <div className="w-full">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-12">
          <div>
            <Link href="/" className="inline-link text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-sm mb-2">
              &larr; Beranda
            </Link>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Dashboard</h1>
            <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">Kelola ruang diskusi Anda</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button onClick={() => setShowCreate(!showCreate)}
              className="btn-glass text-sm">
              {showCreate ? "Batal" : "+ Ruang Baru"}
            </button>
            <button onClick={handleLogout}
              className="min-h-11 px-3 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
              Keluar
            </button>
          </div>
        </div>

        {/* Hanya muncul kalau memang ada ruang yang belum terlindungi kode pemulihan */}
        {needKodePanel && (
          <div className="mb-10 max-w-3xl rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4">
            <h2 className="font-display text-lg font-semibold mb-2 text-amber-900 dark:text-amber-200">
              Kode pemulihan belum dipakai di browser ini
            </h2>
            <p className="text-sm text-amber-900 dark:text-amber-200 mb-3">
              Ruang yang dibuat sekarang hanya bisa dibuka dengan kata sandi akun. Kalau kode pemulihan
              dimasukkan di sini, kunci ruang ikut dibungkus dengan kode itu, sehingga lupa kata sandi
              masih bisa dipulihkan tanpa kehilangan riwayat.
            </p>
            <form onSubmit={pakaiKode} className="space-y-3">
              <label htmlFor="kode-pemulihan" className="block text-sm text-amber-900 dark:text-amber-200">
                Kode pemulihan
              </label>
              <input
                id="kode-pemulihan"
                className="input-glass"
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                value={kodeInput}
                onChange={(e) => setKodeInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <label className="flex items-start gap-3 text-sm text-amber-900 dark:text-amber-200">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5"
                  checked={kodeDiingat}
                  onChange={(e) => setKodeDiingat(e.target.checked)}
                />
                <span>
                  Simpan kode ini di browser ini. Lebih praktis, tetapi siapa pun yang memakai perangkat
                  ini bisa ikut membuka ruang tanpa tahu kata sandi Anda.
                </span>
              </label>
              {kodeError && (
                <p className="text-sm text-red-800 dark:text-red-300" role="alert">{kodeError}</p>
              )}
              <button type="submit" className="btn-glass text-sm">Pakai kode pemulihan</button>
            </form>
          </div>
        )}

        {/* Create Room Form */}
        {showCreate && (
          <div className="mb-10 max-w-3xl">
            <div className="doppelrand">
              <div className="shell">
                <div className="core">
                  <h2 className="font-display text-xl font-semibold mb-5">Buat Ruang Baru</h2>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                      <label htmlFor="room-name" className="block text-sm text-gray-800 dark:text-gray-200 mb-2">Nama Room *</label>
                      <input
                        id="room-name"
                        className="input-glass" placeholder="Contoh: Diskusi Tim Produk"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="room-slug" className="block text-sm text-gray-800 dark:text-gray-200 mb-2">
                        Slug (opsional, dibuat otomatis jika kosong)
                      </label>
                      <input
                        id="room-slug"
                        className="input-glass" placeholder="tim-produk"
                        value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="room-password" className="block text-sm text-gray-800 dark:text-gray-200 mb-2">
                        Password Room (opsional)
                      </label>
                      <input
                        id="room-password"
                        type="password" className="input-glass" placeholder="Kata sandi untuk peserta"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                    </div>

                    {error && (
                      <div className="text-red-700 dark:text-red-300 text-xs bg-red-50 dark:bg-red-950/40 rounded-xl px-4 py-3 ring-1 ring-red-200 dark:ring-red-800">
                        {error}
                      </div>
                    )}

                    <button type="submit" className="btn-emerald text-xs">
                      Buat Room
                      <span className="icon-pill">
                        <PlusIcon />
                      </span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Kunci tautan ruang baru: satu-satunya salinan yang ada, jadi diperlihatkan di sini */}
        {created && (
          <div className="mb-10 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4" role="status">
            <h2 className="font-display text-lg font-semibold mb-2 text-amber-900 dark:text-amber-200">
              {created.activated ? "Enkripsi ruang ini aktif" : "Ruang dibuat. Simpan tautan ini sekarang."}
            </h2>
            <p className="text-sm text-amber-900 dark:text-amber-200 mb-3">
              Tautan ini memuat kunci enkripsi ruang. Tanpa tautan ini isi pesan tidak bisa dibuka lagi,
              termasuk oleh Anda, karena kuncinya tidak disimpan di server.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded-lg bg-white dark:bg-gray-900 px-3 py-2 text-xs text-gray-800 dark:text-gray-200 ring-1 ring-amber-300 dark:ring-amber-700">
                {created.link}
              </code>
              <button
                onClick={() => writeClipboard(created.link, `created-${created.slug}`)}
                className={`btn-copy ${copied === `created-${created.slug}` ? "copied" : ""}`}
              >
                {copied === `created-${created.slug}` ? "Tersalin" : "Salin tautan"}
              </button>
              <button onClick={() => setCreated(null)} className="btn-copy">
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* Room List */}
        {rooms.length === 0 ? (
          <div className="text-center py-20">
            {loadError ? (
              <div className="mx-auto max-w-md" role="alert">
                <p className="text-gray-800 dark:text-gray-200">{loadError}</p>
                <button onClick={fetchRooms} className="btn-glass mt-4">Coba lagi</button>
              </div>
            ) : (
              <>
                <p className="text-gray-800 dark:text-gray-200 text-base">Belum ada ruang diskusi.</p>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">Buat ruang untuk mulai mengundang peserta.</p>
                <button onClick={() => setShowCreate(true)} className="btn-emerald mt-5">Buat ruang</button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3 2xl:grid 2xl:grid-cols-2 2xl:gap-3 2xl:space-y-0">
            {rooms.map((room) => (
              <div key={room.id} className="doppelrand">
                <div className="shell">
                  <div className="core flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm truncate">{room.name}</h3>
                        {room.protected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icon-accent shrink-0"
                            role="img" aria-label="Room terproteksi kata sandi">
                            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-700 dark:text-gray-300">
                        <span>/{room.slug}</span>
                        <span className="hidden sm:inline">&middot;</span>
                        <span>{room.messageCount} pesan</span>
                        <span className="hidden sm:inline">&middot;</span>
                        <span>{new Date(room.createdAt).toLocaleDateString("id-ID")}</span>
                      </div>
                      {!roomKeys[room.slug] && (
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                          Kunci enkripsi ruang ini tidak ada di browser ini. Ruang yang dibuat sebelum
                          enkripsi aktif perlu diaktifkan dulu sebelum bisa dibagikan.
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {roomKeys[room.slug] ? (
                        <>
                          <button
                            onClick={() => copyLink(room.slug)}
                            aria-label={copied === room.slug ? "Tautan disalin" : "Salin tautan ruang"}
                            className={`btn-copy ${copied === room.slug ? "copied" : ""}`}
                          >
                            {copied === room.slug ? (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span className="hidden sm:inline ml-0.5">Tersalin</span></>
                            ) : (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span className="hidden sm:inline ml-0.5">Salin</span></>
                            )}
                          </button>
                          <Link
                            href={`/room/${room.slug}#k=${roomKeys[room.slug]}`}
                            className="min-h-11 inline-flex items-center rounded-lg border border-gray-400 dark:border-gray-600
                                       px-3 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            Buka
                          </Link>
                        </>
                      ) : (
                        <button
                          onClick={() => activateEncryption(room.slug)}
                          className="min-h-11 rounded-lg border border-amber-700 dark:border-amber-400 px-3 text-sm text-amber-900 dark:text-amber-200
                                     hover:bg-amber-100 dark:hover:bg-amber-900/40"
                        >
                          Aktifkan enkripsi
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(room.id)}
                        disabled={deleting === room.id}
                        className="min-h-11 min-w-11 rounded-lg border border-red-700 dark:border-red-400 px-3 text-sm text-red-800 dark:text-red-300
                                   hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {deleting === room.id ? "Menghapus..." : "Hapus"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icon-accent">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
