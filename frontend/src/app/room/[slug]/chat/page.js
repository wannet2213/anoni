"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSocket } from "@/lib/socket";

export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const socket = useSocket();
  const slug = params.slug;

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [nickname, setNickname] = useState("");
  const [connected, setConnected] = useState(false);
  const [roomDeleted, setRoomDeleted] = useState(false);
  const messagesEnd = useRef(null);

  // Load room info + messages
  useEffect(() => {
    async function load() {
      try {
        const roomData = await api.getRoomInfo(slug);
        setRoom(roomData.room);
        const msgData = await api.getMessages(slug);
        setMessages(msgData.messages);
      } catch {
        router.replace(`/room/${slug}`);
      }
    }
    if (slug) load();
  }, [slug, router]);

  // Get nickname from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(`nickname_${slug}`);
    setNickname(stored || `Anonymous-${Math.floor(1000 + Math.random() * 9000)}`);
  }, [slug]);

  // Socket.IO handlers
  useEffect(() => {
    if (!socket || !slug || !nickname) return;

    socket.emit("join_room", { slug, nickname }, (res) => {
      if (res?.error) {
        router.replace(`/room/${slug}`);
        return;
      }
      setConnected(true);
    });

    socket.on("new_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("user_joined", ({ nickname: nick }) => {
      setMessages((prev) => [
        ...prev,
        { id: `sys-${Date.now()}`, content: `${nick} bergabung`, nickname: "System", createdAt: new Date().toISOString(), system: true },
      ]);
    });

    socket.on("user_left", ({ nickname: nick }) => {
      setMessages((prev) => [
        ...prev,
        { id: `sys-${Date.now()}`, content: `${nick} meninggalkan room`, nickname: "System", createdAt: new Date().toISOString(), system: true },
      ]);
    });

    socket.on("room_deleted", () => {
      setRoomDeleted(true);
    });

    return () => {
      socket.emit("leave_room");
      socket.off("new_message");
      socket.off("user_joined");
      socket.off("user_left");
      socket.off("room_deleted");
    };
  }, [socket, slug, nickname, router]);

  // Auto-scroll
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > 1000) return;

    socket.emit("message", { content: trimmed }, (res) => {
      if (res?.error) return;
    });
    setInput("");
    // ponytail: local echo skipped — message comes back via new_message broadcast
  }

  if (roomDeleted) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold mb-4">Room Dihapus</h1>
          <p className="text-white/30 text-sm mb-8">
            Room ini telah dihapus oleh admin. Semua pesan telah hilang permanen.
          </p>
          <a href="/" className="btn-glass text-xs">
            Kembali ke Beranda
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col">
      {/* Chat Header */}
      <header className="sticky top-0 z-30 bg-void/80 backdrop-blur-2xl border-b border-glass-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <a href={`/room/${slug}`} className="text-white/30 hover:text-white/60 text-xs shrink-0">
              &larr;
            </a>
            <div className="min-w-0">
              <h1 className="font-medium text-sm truncate">
                {room?.name || slug}
              </h1>
              <p className="text-white/20 text-[10px]">
                {connected ? "Terhubung" : "Menghubungkan..."} &middot; {nickname}
              </p>
            </div>
          </div>
          {room?.protected && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818CF8"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.system ? "items-center" : msg.nickname === nickname ? "items-end" : "items-start"
              }`}
            >
              {msg.system ? (
                <span className="text-white/15 text-[11px] py-1">{msg.content}</span>
              ) : (
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.nickname === nickname
                      ? "bg-accent/15 rounded-br-md"
                      : "bg-glass-fill ring-1 ring-glass-border rounded-bl-md"
                  }`}
                >
                  <p className="text-[10px] text-white/30 font-medium mb-0.5">{msg.nickname}</p>
                  <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                  <p className="text-[9px] text-white/15 mt-1 text-right">
                    {new Date(msg.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEnd} />
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="sticky bottom-0 z-30 bg-void/80 backdrop-blur-2xl border-t border-glass-border p-4"
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <input
            type="text"
            className="flex-1 input-glass text-sm"
            placeholder="Tulis pesan..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            disabled={!connected}
          />
          <button
            type="submit"
            disabled={!input.trim() || !connected}
            className="shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center
                       text-black transition-all duration-300
                       hover:scale-105 active:scale-95
                       disabled:opacity-20 disabled:scale-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="text-white/10 text-[9px] text-center mt-2">{input.length}/1000</p>
      </form>
    </main>
  );
}
