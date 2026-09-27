"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { buildRoomLink, isValidRoomKey, keyFromHash, rememberRoomKey, storedRoomKey } from "@/lib/roomKey";
import KeyPrompt from "@/components/KeyPrompt";
import ThemeToggle from "@/components/ThemeToggle";

export default function JoinRoomPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug;

  const [room, setRoom] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [nickname, setNickname] = useState(`Anonymous-${Math.floor(1000 + Math.random() * 9000)}`);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [roomKey, setRoomKey] = useState("");
  const [keyProblem, setKeyProblem] = useState("");

  // Kunci dibawa di fragmen tautan (`#k=...`). Fragmen tidak dikirim ke server, jadi
  // kunci tetap hanya ada di perangkat. Fragmen yang hilang atau terpotong dikenali
  // sebagai masalah, bukan dicoba sebagai kunci yang sah.
  useEffect(() => {
    const fromHash = keyFromHash(window.location.hash);
    if (isValidRoomKey(fromHash)) {
      rememberRoomKey(slug, fromHash);
      setRoomKey(fromHash);
      setKeyProblem("");
      return;
    }
    const stored = storedRoomKey(slug);
    if (isValidRoomKey(stored)) {
      setRoomKey(stored);
      setKeyProblem("");
      return;
    }
    setRoomKey("");
    setKeyProblem(fromHash ? "rusak" : "tidak-ada");
  }, [slug]);

  async function handleCopyLink() {
    const url = buildRoomLink(window.location.origin, slug, roomKey);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const load = useCallback(async () => {
    setLoadError("");
    setNotFound(false);
    try {
      const data = await api.getRoomInfo(slug);
      setRoom(data.room);
    } catch (err) {
      // Only a real 404 means the room is gone; anything else is a load failure
      // the visitor can retry.
      if (err.status === 404) setNotFound(true);
      else setLoadError(err.message);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) load();
  }, [slug, load]);

  async function handleJoin(e) {
    e.preventDefault();
    setError("");

    if (!roomKey) {
      setError("Tautan ini tidak memuat kunci enkripsi. Minta tautan lengkapnya ke pembuat ruang.");
      return;
    }

    if (room?.protected && !password.trim()) {
      setError("Room ini memerlukan kata sandi");
      return;
    }

    setJoining(true);
    try {
      if (room.protected) {
        const { roomToken } = await api.verifyPassword(slug, password);
        if (roomToken) sessionStorage.setItem(`roomToken_${slug}`, roomToken);
      } else {
        sessionStorage.removeItem(`roomToken_${slug}`);
      }
      sessionStorage.setItem(
        `nickname_${slug}`,
        nickname || `Anonymous-${Math.floor(1000 + Math.random() * 9000)}`
      );
      router.push(`/room/${slug}/chat`);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  }

  if (notFound) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center px-4">
        <ThemeToggle className="fixed top-6 right-6" />
        <div className="text-center">
          <h1 className="font-display text-4xl font-semibold mb-4">Room tidak ditemukan</h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-8">
            Tautan ini tidak mengarah ke room aktif. Minta tautan baru ke admin room.
          </p>
          <Link href="/" className="btn-glass text-sm">
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center px-4">
        <ThemeToggle className="fixed top-6 right-6" />
        <div className="text-center max-w-sm" role="alert">
          <h1 className="font-display text-2xl font-semibold mb-3">Room tidak bisa dimuat</h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-8">{loadError}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={load} className="btn-emerald text-sm">
              Coba lagi
            </button>
            <Link href="/" className="btn-glass text-sm">
              Beranda
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-4">
        <div className="text-gray-700 dark:text-gray-300 text-sm" role="status">Memuat room...</div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4">
      <Link href="/" className="inline-link fixed top-6 left-6 text-sm">
        &larr; Beranda
      </Link>
      <ThemeToggle className="fixed top-6 right-6" />

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <span className="eyebrow mb-3">
            {room.protected ? "Room Terproteksi" : "Room Publik"}
          </span>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] mb-2">
            {room.name}
          </h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
            Bergabung tanpa membuat akun
          </p>
          <button
            onClick={handleCopyLink}
            className={`btn-copy ${copied ? "copied" : ""}`}
          >
            {copied ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Link disalin</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Salin link</>
            )}
          </button>
        </div>

        {!roomKey && (
          <div className="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200" role="alert">
            {keyProblem === "rusak"
              ? "Kunci enkripsi di tautan ini tidak lengkap, jadi isi pesan tidak bisa dibaca. Tautan sering terpotong saat disalin lewat aplikasi pesan."
              : "Tautan ini tidak memuat kunci enkripsi, jadi isi pesan tidak bisa dibaca di perangkat ini. Minta tautan lengkap kepada pembuat ruang. Kunci tidak bisa dipulihkan dari sisi server."}
            <KeyPrompt
              onUse={(key) => {
                rememberRoomKey(slug, key);
                setRoomKey(key);
                setKeyProblem("");
              }}
            />
          </div>
        )}

        <div className="doppelrand">
          <div className="shell">
            <div className="core">
              <form onSubmit={handleJoin} className="space-y-5">
                <div>
                  <label htmlFor="join-nickname" className="block text-sm text-gray-800 dark:text-gray-200 mb-2">
                    Nickname (opsional)
                  </label>
                  <input
                    id="join-nickname"
                    type="text" className="input-glass"
                    placeholder="Anonymous-XXXX"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={30}
                  />
                </div>

                {room.protected && (
                  <div>
                    <label htmlFor="join-password" className="block text-sm text-gray-800 dark:text-gray-200 mb-2">
                      Kata Sandi Room
                    </label>
                    <input
                      id="join-password"
                      type="password" className="input-glass"
                      placeholder="Masukkan kata sandi"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                )}

                {error && (
                  <div className="text-red-800 dark:text-red-300 text-sm bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-3 ring-1 ring-red-200 dark:ring-red-800" role="alert">
                    {error}
                  </div>
                )}

                <button
                  type="submit" disabled={joining}
                  className="w-full btn-emerald justify-center"
                >
                  {joining ? "Bergabung..." : "Gabung Room"}
                  <span className="icon-pill">
                    <ArrowIcon />
                  </span>
                </button>
              </form>

              <p className="text-center text-gray-700 dark:text-gray-300 text-xs mt-6 leading-relaxed">
                IP Anda tidak dicatat. Tidak ada cookie pelacakan.
                <br />
                Nickname hanya berlaku untuk sesi ini.
                <br />
                Pesan dienkripsi di perangkat Anda. Kunci enkripsi tidak dikirim ke server.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M17 7H7m10 0v10" />
    </svg>
  );
}
