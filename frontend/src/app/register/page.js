"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { simpanIdentitas, simpanKodePemulihan } from "@/lib/account";
import {
  ITERASI_BAWAAN,
  buatSalt,
  kodePemulihanBaru,
  turunkanMasterKey,
  verifierDariMasterKey,
  verifierPemulihanDariKode,
} from "@/lib/accountCrypto";
import ThemeToggle from "@/components/ThemeToggle";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [kode, setKode] = useState("");
  const [tersalin, setTersalin] = useState(false);

  async function salinKode() {
    try {
      await navigator.clipboard.writeText(kode);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      setTersalin(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (form.password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }
    setLoading(true);
    try {
      // Kata sandi diturunkan di perangkat. Server hanya menerima turunannya, sehingga
      // kata sandi tidak pernah tersimpan atau terlihat di sisi server.
      const salt = await buatSalt();
      const kodePemulihan = kodePemulihanBaru();
      const master = await turunkanMasterKey(form.password, salt, ITERASI_BAWAAN);

      const data = await api.register({
        email: form.email,
        username: form.username,
        authVerifier: await verifierDariMasterKey(master),
        recoveryVerifier: await verifierPemulihanDariKode(kodePemulihan),
        kdfSalt: salt,
        kdfIterations: ITERASI_BAWAAN,
      });

      setSuccess(data.message || "Akun dibuat. Cek email untuk verifikasi.");
      simpanIdentitas(form.email);
      simpanKodePemulihan(kodePemulihan);
      setKode(kodePemulihan);
      setForm({ email: "", username: "", password: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4">
      <Link href="/" className="inline-link fixed top-6 left-6 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-sm">
        &larr; Beranda
      </Link>
      <ThemeToggle className="fixed top-6 right-6" />

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] mb-2">
            Buat Akun Admin
          </h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            Daftar untuk mulai membuat ruang diskusi
          </p>
        </div>

        {success ? (
          <div className="doppelrand">
            <div className="shell">
              <div className="core text-center py-8">
                <h2 className="font-display text-xl font-semibold mb-2">Cek Email Anda</h2>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                  Link verifikasi telah dikirim. Klik link tersebut untuk mengaktifkan akun.
                </p>
                {kode && (
                  <div className="mt-6 text-left">
                    <h3 className="font-display text-lg font-semibold mb-2">Simpan kode pemulihan ini</h3>
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
                      Ditampilkan sekali saja. Kalau Anda lupa kata sandi, kode inilah yang membuka kembali
                      kunci ruang-ruang Anda. Tanpa kode ini, lupa kata sandi berarti riwayat ruang tidak
                      bisa dibuka lagi, termasuk oleh kami.
                    </p>
                    <code className="block break-all rounded-lg bg-white dark:bg-gray-900 px-3 py-3 text-sm text-gray-800 dark:text-gray-200 ring-1 ring-gray-300 dark:ring-gray-600">
                      {kode}
                    </code>
                    <button onClick={salinKode} className="btn-glass mt-3">
                      {tersalin ? "Tersalin" : "Salin kode"}
                    </button>
                  </div>
                )}
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-4">
                  Link berlaku 1 jam. Tidak menerima email?{" "}
                  <button onClick={() => setSuccess("")} className="inline-link text-accent dark:text-indigo-300 hover:text-accent-light dark:hover:text-indigo-300 underline">
                    Daftar ulang
                  </button>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="doppelrand">
            <div className="shell">
              <div className="core">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="register-email" className="mb-2 block text-sm text-gray-800 dark:text-gray-200">Email</label>
                    <input
                      id="register-email"
                      type="email"
                      className="input-glass"
                      placeholder="anda@email.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="register-username" className="mb-2 block text-sm text-gray-800 dark:text-gray-200">Username</label>
                    <input
                      id="register-username"
                      type="text"
                      className="input-glass"
                      placeholder="usernameanda"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="register-password" className="mb-2 block text-sm text-gray-800 dark:text-gray-200">Password</label>
                    <input
                      id="register-password"
                      type="password"
                      className="input-glass"
                      placeholder="Min. 6 karakter"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300" role="alert">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="w-full btn-emerald justify-center">
                    {loading ? "Mendaftarkan..." : "Daftar"}
                  </button>
                </form>

                <p className="text-center text-gray-700 dark:text-gray-300 text-sm mt-6">
                  Sudah punya akun?{" "}
                  <Link href="/login" className="inline-link text-accent dark:text-indigo-300 hover:text-accent-light dark:hover:text-indigo-300 underline">
                    Masuk
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
