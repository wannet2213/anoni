"use client";

import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";

export default function Home() {
  return (
    <main className="relative">
      {/* ── Floating Glass Nav Pill ── */}
      <nav
        className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-max px-5 py-3 rounded-full
                   bg-void-300/60 backdrop-blur-2xl ring-1 ring-glass-border
                   flex items-center gap-6"
      >
        <span className="text-white/80 text-sm font-medium tracking-tight">
          Diskusi Anonim<span className="text-white/30">ous</span>
        </span>
        <div className="w-px h-4 bg-glass-border" />
        <Link
          href="/dashboard"
          className="text-white/50 hover:text-white text-xs transition-colors duration-300"
        >
          Dashboard
        </Link>
        <Link
          href="/login"
          className="px-4 py-1.5 rounded-full bg-white/10 text-white text-xs font-medium
                     hover:bg-white/15 transition-all duration-300 active:scale-[0.97]"
        >
          Masuk
        </Link>
      </nav>

      {/* ── Hero Section ── */}
      <section className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-24">
        <ScrollReveal delay={0}>
          <span className="eyebrow mb-8">Private &bull; Anonymous &bull; Real-time</span>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-semibold text-center
                         leading-[1.05] tracking-[-0.03em] max-w-4xl">
            Diskusi rahasia
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent-light to-violet-400">
              tanpa jejak identitas
            </span>
          </h1>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <p className="mt-8 text-white/40 text-lg md:text-xl text-center max-w-xl leading-relaxed">
            Buat ruang diskusi, bagikan tautan. Peserta bergabung secara anonim
            — tanpa registrasi, tanpa pencatatan IP, tanpa rekam identitas.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={300}>
          <div className="mt-12 flex flex-wrap items-center gap-4 justify-center">
            <Link href="/dashboard" className="btn-emerald">
              Mulai Sekarang
              <span className="icon-pill">
                <ArrowIcon />
              </span>
            </Link>
            <Link href="/login" className="btn-glass">
              Admin Login
              <span className="icon-pill">
                <UserIcon />
              </span>
            </Link>
          </div>
        </ScrollReveal>
      </section>

      {/* ── Asymmetrical Bento Features ── */}
      <section className="max-w-6xl mx-auto px-4 pb-40">
        <ScrollReveal>
          <div className="text-center mb-20">
            <span className="eyebrow mb-4">Kenapa Anonimous?</span>
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-[-0.02em]">
              Privasi adalah <span className="text-accent">hak</span>
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-auto">
          {/* Card 1 - Main feature */}
          <ScrollReveal delay={0} className="md:col-span-7 md:row-span-2">
            <div className="doppelrand h-full">
              <div className="shell h-full">
                <div className="core h-full flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-accent-glow flex items-center justify-center mb-6">
                      <ShieldIcon />
                    </div>
                    <h3 className="font-display text-2xl font-semibold mb-3">Tanpa Log IP</h3>
                    <p className="text-white/35 text-sm leading-relaxed max-w-md">
                      Server dikonfigurasi untuk tidak mencatat alamat IP peserta.
                      Tidak ada metadata pengguna yang tersimpan — kamipun tidak tahu siapa peserta diskusi Anda.
                    </p>
                  </div>
                  <div className="mt-8 p-4 rounded-2xl bg-void/40 ring-1 ring-glass-border">
                    <code className="text-xs text-white/25 font-mono">
                      access_log /dev/stdout anon;  # no IP<br />
                      X-Forwarded-For "";           # strip header
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Card 2 */}
          <ScrollReveal delay={100} className="md:col-span-5">
            <div className="doppelrand h-full">
              <div className="shell h-full">
                <div className="core">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6">
                    <LockIcon />
                  </div>
                  <h3 className="font-display text-2xl font-semibold mb-3">Password Room</h3>
                  <p className="text-white/35 text-sm leading-relaxed">
                    Lindungi ruang diskusi Anda dengan kata sandi. Hanya yang memiliki kata sandi dapat bergabung.
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Card 3 */}
          <ScrollReveal delay={150} className="md:col-span-5">
            <div className="doppelrand h-full">
              <div className="shell h-full">
                <div className="core">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-6">
                    <BoltIcon />
                  </div>
                  <h3 className="font-display text-2xl font-semibold mb-3">Real-time Chat</h3>
                  <p className="text-white/35 text-sm leading-relaxed">
                    Pesan muncul seketika tanpa refresh. WebSocket latency di bawah 500ms, mendukung 100+ peserta per room.
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Card 4 */}
          <ScrollReveal delay={200} className="md:col-span-7">
            <div className="doppelrand h-full">
              <div className="shell h-full">
                <div className="core">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center mb-6">
                    <TrashIcon />
                  </div>
                  <h3 className="font-display text-2xl font-semibold mb-3">Hard Delete</h3>
                  <p className="text-white/35 text-sm leading-relaxed max-w-md">
                    Hapus room dan semua pesan akan hilang permanen dari database. Tidak ada jejak tersisa, tidak ada recovery.
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-40 px-4">
        <ScrollReveal>
          <div className="max-w-2xl mx-auto text-center">
            <span className="eyebrow mb-6">Siap memulai?</span>
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-[-0.02em] mb-6">
              Bebas berpendapat,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-violet-400">
                tanpa takut dikenali
              </span>
            </h2>
            <p className="text-white/30 text-lg mb-10 leading-relaxed">
              Daftar sebagai admin, buat room, dan bagikan tautan ke peserta.
              Semua dalam hitungan detik.
            </p>
            <Link href="/register" className="btn-emerald">
              Buat Akun Gratis
              <span className="icon-pill">
                <ArrowIcon />
              </span>
            </Link>
          </div>
        </ScrollReveal>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-glass-border py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-white/20 text-xs">Diskusi Anonimous — Private by Design</span>
          <span className="text-white/15 text-xs">No cookies. No trackers. No IP logs.</span>
        </div>
      </footer>
    </main>
  );
}

/* ── Inline SVG Icons (Phosphor-light style) ── */
function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M17 7H7m10 0v10" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818CF8"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2s7 4 7 10c0 6-7 10-7 10s-7-4-7-10c0-6 7-10 7-10z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34D399"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FB923C"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F472B6"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    </svg>
  );
}
