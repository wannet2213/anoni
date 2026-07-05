"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function JoinRoomPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug;

  const [room, setRoom] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [nickname, setNickname] = useState(`Anonymous-${Math.floor(1000 + Math.random() * 9000)}`);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getRoomInfo(slug);
        setRoom(data.room);
      } catch {
        setNotFound(true);
      }
    }
    if (slug) load();
  }, [slug]);

  async function handleJoin(e) {
    e.preventDefault();
    setError("");

    if (room?.protected && !password.trim()) {
      setError("Room ini memerlukan kata sandi");
      return;
    }

    setJoining(true);
    try {
      if (room.protected) {
        await api.verifyPassword(slug, password);
      }
      // Store nickname in sessionStorage for the chat page
      sessionStorage.setItem(`nickname_${slug}`, nickname || `Anonymous-${Math.floor(1000 + Math.random() * 9000)}`);
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
        <div className="text-center">
          <h1 className="font-display text-5xl font-semibold mb-4">404</h1>
          <p className="text-white/30 text-sm mb-8">Room tidak ditemukan atau telah dihapus</p>
          <Link href="/" className="btn-glass text-xs">
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <div className="animate-shimmer text-white/20 text-sm">Memuat room...</div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4">
      <Link
        href="/"
        className="fixed top-6 left-6 text-white/30 hover:text-white/60 text-xs
                   transition-colors duration-300"
      >
        &larr; Beranda
      </Link>

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <span className="eyebrow mb-3">
            {room.protected ? "Room Terproteksi" : "Room Publik"}
          </span>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] mb-2">
            {room.name}
          </h1>
          <p className="text-white/30 text-sm">
            Bergabung secara anonim — tidak ada pendaftaran
          </p>
        </div>

        <div className="doppelrand">
          <div className="shell">
            <div className="core">
              <form onSubmit={handleJoin} className="space-y-5">
                <div>
                  <label className="block text-xs text-white/30 mb-2 ml-1">
                    Nickname (opsional)
                  </label>
                  <input
                    type="text" className="input-glass"
                    placeholder="Anonymous-XXXX"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={30}
                  />
                </div>

                {room.protected && (
                  <div>
                    <label className="block text-xs text-white/30 mb-2 ml-1">
                      Kata Sandi Room
                    </label>
                    <input
                      type="password" className="input-glass"
                      placeholder="Masukkan kata sandi"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                )}

                {error && (
                  <div className="text-red-400/80 text-xs bg-red-500/5 rounded-xl px-4 py-3 ring-1 ring-red-500/10">
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

              <p className="text-center text-white/15 text-[10px] mt-6 leading-relaxed">
                IP Anda tidak dicatat. Tidak ada cookie pelacakan.
                <br />
                Nickname hanya berlaku untuk sesi ini.
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
