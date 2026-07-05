"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useSocket } from "@/lib/socket";

export default function DashboardPage() {
  const router = useRouter();
  const socket = useSocket();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", password: "", slug: "" });
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);

  async function fetchRooms() {
    try {
      const data = await api.getRooms();
      setRooms(data.rooms);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRooms();
  }, []);

  // Listen for room_deleted events
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
    try {
      await api.createRoom({ name: form.name, password: form.password || undefined, slug: form.slug || undefined });
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
    localStorage.removeItem("token");
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <div className="animate-shimmer text-white/20 text-sm">Memuat dashboard...</div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <Link href="/" className="text-white/20 hover:text-white/40 text-xs transition-colors mb-2 block">
              &larr; Beranda
            </Link>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Dashboard</h1>
            <p className="text-white/25 text-sm mt-1">Kelola ruang diskusi Anda</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCreate(!showCreate)}
              className="btn-glass text-xs px-4 py-2">
              {showCreate ? "Batal" : "+ Ruang Baru"}
            </button>
            <button onClick={handleLogout}
              className="text-white/20 hover:text-white/40 text-xs transition-colors">
              Keluar
            </button>
          </div>
        </div>

        {/* Create Room Form */}
        {showCreate && (
          <div className="mb-10 animate-slide">
            <div className="doppelrand">
              <div className="shell">
                <div className="core">
                  <h2 className="font-display text-xl font-semibold mb-5">Buat Ruang Baru</h2>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                      <label className="block text-xs text-white/30 mb-2 ml-1">Nama Room *</label>
                      <input
                        className="input-glass" placeholder="Contoh: Diskusi Tim Produk"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/30 mb-2 ml-1">
                        Slug (opsional — otomatis jika kosong)
                      </label>
                      <input
                        className="input-glass" placeholder="tim-produk"
                        value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/30 mb-2 ml-1">
                        Password Room (opsional)
                      </label>
                      <input
                        type="password" className="input-glass" placeholder="Kata sandi untuk peserta"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                    </div>

                    {error && (
                      <div className="text-red-400/80 text-xs bg-red-500/5 rounded-xl px-4 py-3 ring-1 ring-red-500/10">
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

        {/* Room List */}
        {rooms.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/15 text-sm">Belum ada ruang diskusi. Buat yang pertama!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div key={room.id} className="doppelrand">
                <div className="shell">
                  <div className="core flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm truncate">{room.name}</h3>
                        {room.protected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818CF8"
                            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/20">
                        <span>/{room.slug}</span>
                        <span>{room.messageCount} pesan</span>
                        <span>{new Date(room.createdAt).toLocaleDateString("id-ID")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/room/${room.slug}`}
                        className="px-3 py-1.5 rounded-full bg-white/5 text-white/50 text-xs
                                   hover:bg-white/10 hover:text-white transition-all duration-300"
                      >
                        Buka
                      </Link>
                      <button
                        onClick={() => handleDelete(room.id)}
                        disabled={deleting === room.id}
                        className="px-3 py-1.5 rounded-full text-red-400/40 text-xs
                                   hover:bg-red-500/10 hover:text-red-400 transition-all duration-300
                                   disabled:opacity-30"
                      >
                        {deleting === room.id ? "..." : "Hapus"}
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
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
