"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="doppelrand">
            <div className="shell">
              <div className="core">
                <h1 className="font-display text-xl font-semibold mb-2">Cek Email Anda</h1>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                  Jika akun dengan email <strong className="text-gray-900 dark:text-gray-100">{email}</strong> terdaftar, kami telah mengirim link reset kata sandi.
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-xs mt-4">Link berlaku 15 menit. Cek folder spam jika tidak muncul.</p>
                <Link href="/login" className="btn-glass w-full justify-center mt-6 text-xs">
                  Kembali ke Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4">
      <Link href="/login" className="inline-link fixed top-6 left-6 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-xs transition-colors">
        &larr; Login
      </Link>
      <ThemeToggle className="fixed top-6 right-6" />

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Lupa Kata Sandi</h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm mt-2">
            Masukkan email Anda untuk menerima link reset
          </p>
        </div>

        <div className="doppelrand">
          <div className="shell">
            <div className="core">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="forgot-email" className="mb-2 block text-sm text-gray-800 dark:text-gray-200">Email</label>
                  <input
                    id="forgot-email"
                    type="email" className="input-glass"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300" role="alert">
                    {error}
                  </div>
                )}

                <button
                  type="submit" disabled={loading}
                  className="w-full btn-emerald justify-center"
                >
                  {loading ? "Mengirim..." : "Kirim Link Reset"}
                  <span className="icon-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17L17 7M17 7H7m10 0v10" />
                    </svg>
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
