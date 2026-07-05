"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }
    setLoading(true);
    try {
      const data = await api.register(form);
      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] mb-2">
            Buat Akun Admin
          </h1>
          <p className="text-white/30 text-sm">
            Daftar untuk mulai membuat ruang diskusi
          </p>
        </div>

        <div className="doppelrand">
          <div className="shell">
            <div className="core">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs text-white/30 mb-2 ml-1">Email</label>
                  <input
                    type="email" className="input-glass" placeholder="anda@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/30 mb-2 ml-1">Username</label>
                  <input
                    type="text" className="input-glass" placeholder="usernameanda"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/30 mb-2 ml-1">Password</label>
                  <input
                    type="password" className="input-glass" placeholder="Min. 6 karakter"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </div>

                {error && (
                  <div className="text-red-400/80 text-xs bg-red-500/5 rounded-xl px-4 py-3 ring-1 ring-red-500/10">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full btn-emerald justify-center">
                  {loading ? "Mendaftarkan..." : "Daftar"}
                  <span className="icon-pill">
                    <ArrowIcon />
                  </span>
                </button>
              </form>

              <p className="text-center text-white/20 text-xs mt-6">
                Sudah punya akun?{" "}
                <Link href="/login" className="text-accent hover:text-accent-light transition-colors">
                  Masuk
                </Link>
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
