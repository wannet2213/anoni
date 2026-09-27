"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useSocket } from "@/lib/socket";
import { decryptText, encryptText } from "@/lib/crypto";
import { isValidRoomKey, rememberRoomKey, storedRoomKey } from "@/lib/roomKey";
import KeyPrompt from "@/components/KeyPrompt";
import ThemeToggle from "@/components/ThemeToggle";

const NICKNAME_KEY = "nickname_";
const TOKEN_KEY = "roomToken_";
const MAX_MESSAGE_CHARS = 1000;

export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const socket = useSocket();
  const slug = params.slug;

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [view, setView] = useState([]);
  const [input, setInput] = useState("");
  const [nickname, setNickname] = useState("");
  const [roomKey, setRoomKey] = useState("");
  const [keyMissing, setKeyMissing] = useState(false);
  const [keyProblem, setKeyProblem] = useState("");
  const [connected, setConnected] = useState(false);
  const [joining, setJoining] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [roomDeleted, setRoomDeleted] = useState(false);
  const messagesEnd = useRef(null);

  // Kunci hanya ada di perangkat, tidak pernah dikirim ke server. Kunci yang kosong
  // atau terpotong diperlakukan sama: tanpa kunci yang sah, tidak ada yang bisa dibaca.
  useEffect(() => {
    const key = storedRoomKey(slug);
    if (isValidRoomKey(key)) {
      setRoomKey(key);
      setKeyMissing(false);
      return;
    }
    setRoomKey("");
    setKeyMissing(true);
    setKeyProblem(key ? "rusak" : "tidak-ada");
  }, [slug]);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const roomData = await api.getRoomInfo(slug);
      setRoom(roomData.room);
      const msgData = await api.getMessages(slug, sessionStorage.getItem(`${TOKEN_KEY}${slug}`));
      setMessages(msgData.messages);
    } catch (err) {
      // 404 and 403 mean the visitor should not be here at all; a network or
      // server failure is retryable.
      if (err.status === 404 || err.status === 403 || err.status === 401) {
        router.replace(`/room/${slug}`);
        return;
      }
      setLoadError(err.message);
    }
  }, [slug, router]);

  useEffect(() => {
    if (slug && roomKey) load();
  }, [slug, roomKey, load]);

  useEffect(() => {
    const stored = sessionStorage.getItem(`${NICKNAME_KEY}${slug}`);
    setNickname(stored || `Anonymous-${Math.floor(1000 + Math.random() * 9000)}`);
  }, [slug]);

  // Membuka pesan dilakukan di perangkat. Yang tidak bisa dibuka ditandai jujur,
  // bukan ditampilkan sebagai pesan kosong.
  useEffect(() => {
    if (!roomKey) return;
    let cancelled = false;
    (async () => {
      const rows = await Promise.all(
        messages.map(async (msg) => {
          if (msg.system) return { ...msg, nick: "", text: msg.content, state: "plain" };
          const [nick, body] = await Promise.all([
            decryptText(roomKey, msg.nickname),
            decryptText(roomKey, msg.content),
          ]);
          return {
            ...msg,
            nick: nick.ok ? nick.text : nick.legacy ? msg.nickname : "",
            text: body.ok || body.legacy ? body.text : "",
            state: body.ok ? "ok" : body.legacy ? "legacy" : "unreadable",
          };
        })
      );
      if (!cancelled) setView(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, roomKey]);

  useEffect(() => {
    if (!socket || !slug || !nickname || !roomKey) return;
    let cancelled = false;

    const roomToken = sessionStorage.getItem(`${TOKEN_KEY}${slug}`);
    const label = async (value) => {
      const res = await decryptText(roomKey, value);
      if (res.ok) return res.text;
      if (res.legacy) return value;
      return "Seseorang";
    };

    setJoining(true);
    (async () => {
      try {
        // Nickname juga dikirim terenkripsi supaya tidak hanya isi pesan yang terlindungi.
        const encryptedNickname = await encryptText(roomKey, nickname);
        if (cancelled) return;
        socket.emit("join_room", { slug, nickname: encryptedNickname, roomToken }, (res) => {
          setJoining(false);
          if (res?.error) {
            setLoadError(res.error);
            return;
          }
          setConnected(true);
        });
      } catch (err) {
        // Tanpa penanganan di sini, kegagalan enkripsi membuat halaman berhenti di
        // "Menyambung..." tanpa penjelasan.
        if (cancelled) return;
        setJoining(false);
        setKeyMissing(true);
        setKeyProblem("rusak");
        setLoadError(err.message || "Kunci ruang tidak bisa dipakai di perangkat ini.");
      }
    })();

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("new_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    const systemMessage = (content) => ({
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
      nickname: "System",
      createdAt: new Date().toISOString(),
      system: true,
    });

    socket.on("user_joined", async ({ nickname: nick }) => {
      const who = await label(nick);
      setMessages((prev) => [...prev, systemMessage(`${who} bergabung`)]);
    });

    socket.on("user_left", async ({ nickname: nick }) => {
      const who = await label(nick);
      setMessages((prev) => [...prev, systemMessage(`${who} meninggalkan room`)]);
    });

    socket.on("room_deleted", () => {
      setRoomDeleted(true);
    });

    return () => {
      cancelled = true;
      socket.emit("leave_room");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("new_message");
      socket.off("user_joined");
      socket.off("user_left");
      socket.off("room_deleted");
    };
  }, [socket, slug, nickname, roomKey]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [view]);

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_CHARS || !roomKey) return;

    setSendError("");
    setInput("");
    try {
      const content = await encryptText(roomKey, trimmed);
      socket.emit("message", { content }, (res) => {
        if (res?.error) {
          setSendError(res.error);
          setInput(trimmed);
        }
      });
    } catch (err) {
      setSendError(err.message);
      setInput(trimmed);
    }
  }

  if (keyMissing) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center px-4">
        <ThemeToggle className="fixed top-6 right-6" />
        <div className="w-full max-w-md">
          <h1 className="font-display text-2xl font-semibold mb-3">Kunci enkripsi tidak ada</h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
            {keyProblem === "rusak"
              ? "Kunci enkripsi di perangkat ini tidak lengkap atau rusak, jadi isi pesan tidak bisa dibaca dan pesan baru tidak bisa dikirim."
              : "Tautan yang Anda buka tidak memuat kunci enkripsi ruang ini. Isi pesan tidak bisa dibaca dan pesan baru tidak bisa dikirim dari sini. Minta tautan lengkapnya ke pembuat ruang."}
          </p>
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            Tempel kunci ruang kalau Anda menyimpannya. Kunci itu bagian setelah tanda # di tautan.
            <KeyPrompt
              description="Kunci ruang"
              onUse={(key) => {
                rememberRoomKey(slug, key);
                setRoomKey(key);
                setKeyMissing(false);
                setKeyProblem("");
                setLoadError("");
              }}
            />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={`/room/${slug}`} className="btn-glass text-sm">
              Kembali ke room
            </Link>
            <Link href="/" className="btn-glass text-sm">
              Beranda
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (roomDeleted) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center px-4">
        <ThemeToggle className="fixed top-6 right-6" />
        <div className="text-center max-w-sm">
          <h1 className="font-display text-3xl font-semibold mb-4">Room Dihapus</h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-8">
            Room ini telah dihapus oleh admin. Semua pesan telah hilang permanen.
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
          <h1 className="font-display text-2xl font-semibold mb-3">Chat tidak bisa dibuka</h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-8">{loadError}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={load} className="btn-emerald text-sm">Coba lagi</button>
            <Link href={`/room/${slug}`} className="btn-glass text-sm">Kembali ke room</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-30 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="max-w-3xl 2xl:max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/room/${slug}`}
              aria-label="Kembali ke halaman room"
              className="inline-link shrink-0 px-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="font-medium text-sm truncate">
                {room?.name || slug}
              </h1>
              <p className="text-gray-700 dark:text-gray-300 text-xs" role="status">
                {connected ? "Terhubung" : joining ? "Menyambung..." : "Terputus"} &middot; {nickname}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {room?.protected && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icon-accent"
                role="img" aria-label="Room terproteksi kata sandi">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6" aria-live="polite" aria-label="Pesan room">
        <div className="max-w-2xl 2xl:max-w-3xl mx-auto space-y-4">
          {view.length === 0 && !loadError && (
            <p className="text-center text-gray-700 dark:text-gray-300 text-sm py-8">
              Belum ada pesan. Kirim pesan pertama di room ini.
            </p>
          )}
          {view.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.system ? "items-center" : msg.nick === nickname ? "items-end" : "items-start"
              }`}
            >
              {msg.system ? (
                <span className="text-gray-600 dark:text-gray-400 text-xs py-1">{msg.text}</span>
              ) : (
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.nick === nickname
                      ? "bg-accent-glow dark:bg-indigo-900/60 rounded-br-md"
                      : "bg-gray-100 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600 rounded-bl-md"
                  }`}
                >
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-medium mb-0.5">{msg.nick}</p>
                  {msg.state === "unreadable" ? (
                    <p className="text-sm italic text-gray-700 dark:text-gray-300">
                      Pesan ini tidak bisa dibuka dengan kunci yang ada di perangkat ini.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                      {msg.state === "legacy" && (
                        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1">
                          ditulis sebelum enkripsi aktif
                        </p>
                      )}
                    </>
                  )}
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 text-right">
                    {new Date(msg.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEnd} />
        </div>
      </div>

      <form
        onSubmit={handleSend}
        className="sticky bottom-0 z-30 border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {!connected && !joining && (
          <p className="max-w-2xl 2xl:max-w-3xl mx-auto mb-2 text-xs text-red-800 dark:text-red-300" role="alert">
            Koneksi terputus. Pesan belum bisa dikirim.
          </p>
        )}
        {sendError && (
          <p className="max-w-2xl 2xl:max-w-3xl mx-auto mb-2 text-xs text-red-800 dark:text-red-300" role="alert">
            Pesan gagal terkirim: {sendError}
          </p>
        )}
        <div className="max-w-2xl 2xl:max-w-3xl mx-auto flex items-center gap-3">
          <label htmlFor="chat-input" className="sr-only">Tulis pesan</label>
          <input
            id="chat-input"
            type="text"
            className="flex-1 input-glass"
            placeholder="Tulis pesan..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={MAX_MESSAGE_CHARS}
            disabled={!connected}
          />
          <button
            type="submit"
            aria-label="Kirim pesan"
            disabled={!input.trim() || !connected}
            className="shrink-0 w-11 h-11 rounded-full bg-accent text-white flex items-center justify-center
                       hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="max-w-2xl 2xl:max-w-3xl mx-auto text-gray-600 dark:text-gray-400 text-xs text-center mt-2">
          {input.length}/{MAX_MESSAGE_CHARS} &middot; pesan dienkripsi di perangkat ini sebelum dikirim
        </p>
      </form>
    </main>
  );
}
