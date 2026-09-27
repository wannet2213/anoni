"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { simpanIdentitas, simpanKodePemulihan, simpanMasterKey } from "@/lib/account";
import {
  buatSalt,
  kodePemulihanBaru,
  turunkanMasterKey,
  verifierDariMasterKey,
  verifierPemulihanDariKode,
} from "@/lib/accountCrypto";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerify, setNeedsVerify] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [kodeBaru, setKodeBaru] = useState("");
  const [kodeDiingat, setKodeDiingat] = useState(false);
  const [tersalin, setTersalin] = useState(false);

  async function salinKode() {
    try {
      await navigator.clipboard.writeText(kodeBaru);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      setTersalin(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNeedsVerify("");
    setLoading(true);
    try {
      const params = await api.kdfParams(form.login);

      if (params.mode === "lama") {
        // Akun lama: kata sandi dikirim sekali untuk masuk, lalu akun langsung diangkat
        // ke enkripsi akun sehingga login berikutnya tidak lagi mengirim kata sandi.
        const data = await api.login({ login: form.login, password: form.password });
        localStorage.setItem("token", data.token);
        simpanIdentitas(form.login);

        if (data.needsKdfUpgrade) {
          const kode = kodePemulihanBaru();
          const salt = await buatSalt();
          const master = await turunkanMasterKey(form.password, salt, params.kdfIterations);
          await api.kdfUpgrade({
            authVerifier: await verifierDariMasterKey(master),
            recoveryVerifier: await verifierPemulihanDariKode(kode),
            kdfSalt: salt,
            kdfIterations: params.kdfIterations,
          });
          simpanMasterKey(master);
          simpanKodePemulihan(kode, { diBrowser: kodeDiingat });
          setKodeBaru(kode);
          return;
        }
        router.push("/dashboard");
        return;
      }

      // Jalur normal: kata sandi diturunkan di perangkat, yang dikirim hanya turunannya.
      const master = await turunkanMasterKey(form.password, params.kdfSalt, params.kdfIterations);
      const data = await api.login({
        login: form.login,
        authVerifier: await verifierDariMasterKey(master),
      });
      localStorage.setItem("token", data.token);
      simpanMasterKey(master);
      simpanIdentitas(form.login);
      router.push("/dashboard");
    } catch (err) {
      // 403 on /login means the account exists but the email is not verified yet.
      if (err.status === 403) {
        setNeedsVerify(form.login);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setResendMsg("");
    try {
      await api.resendVerification({ email: needsVerify });
      setResendMsg("Email verifikasi telah dikirim ulang. Cek inbox Anda.");
    } catch (err) {
      setResendMsg(err.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4">
      <Link
        href="/"
        className="inline-link fixed top-6 left-6 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
      >
        &larr; Beranda
      </Link>
      <ThemeToggle className="fixed top-6 right-6" />

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] mb-2">
            Admin Login
          </h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            Masuk untuk mengelola ruang diskusi Anda
          </p>
        </div>

        {needsVerify ? (
          <div className="doppelrand">
            <div className="shell">
              <div className="core text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    className="icon-warn" aria-hidden="true">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="font-display text-xl font-semibold mb-2">Email Belum Terverifikasi</h2>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-2">
                  Cek inbox <strong className="text-gray-700 dark:text-gray-300">{needsVerify}</strong> untuk link verifikasi.
                </p>
                {resendMsg && (
                  <p className="text-green-800 dark:text-green-300 text-sm mb-4" role="status">{resendMsg}</p>
                )}
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleResend}
                    disabled={resending}
                    className="btn-glass text-sm"
                  >
                    {resending ? "Mengirim..." : "Kirim Ulang Email"}
                  </button>
                  <button
                    onClick={() => setNeedsVerify("")}
                    className="inline-link text-sm"
                  >
                    Coba login lain
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : kodeBaru ? (
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] mb-3">
              Simpan kode pemulihan Anda
            </h1>
            <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">
              Ini ditampilkan sekali saja. Kalau Anda lupa kata sandi, kode inilah yang membuka kembali
              kunci ruang-ruang Anda. Tanpa kode ini, lupa kata sandi berarti riwayat ruang tidak bisa
              dibuka lagi, termasuk oleh kami.
            </p>
            <div className="doppelrand">
              <div className="shell">
                <div className="core">
                  <code className="block break-all rounded-lg bg-white dark:bg-gray-900 px-3 py-3 text-sm text-gray-800 dark:text-gray-200 ring-1 ring-gray-300 dark:ring-gray-600">
                    {kodeBaru}
                  </code>
                  <button onClick={salinKode} className="btn-glass mt-3">
                    {tersalin ? "Tersalin" : "Salin kode"}
                  </button>

                  <label className="mt-4 flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5"
                      checked={kodeDiingat}
                      onChange={(e) => {
                        setKodeDiingat(e.target.checked);
                        simpanKodePemulihan(kodeBaru, { diBrowser: e.target.checked });
                      }}
                    />
                    <span>
                      Simpan kode ini di browser ini juga. Lebih mudah, tetapi siapa pun yang memakai
                      perangkat ini bisa ikut membuka ruang tanpa perlu tahu kata sandi Anda.
                    </span>
                  </label>

                  <button onClick={() => router.push("/dashboard")} className="btn-emerald mt-5">
                    Saya sudah menyimpan, lanjut
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="doppelrand">
            <div className="shell">
              <div className="core">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="login-identity" className="mb-2 block text-sm text-gray-800 dark:text-gray-200">
                      Email atau Username
                    </label>
                    <input
                      id="login-identity"
                      type="text"
                      className="input-glass"
                      placeholder="admin@email.com"
                      value={form.login}
                      onChange={(e) => setForm({ ...form, login: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="login-password" className="mb-2 block text-sm text-gray-800 dark:text-gray-200">
                      Password
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      className="input-glass"
                      placeholder="••••••••"
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-emerald justify-center"
                  >
                    {loading ? "Memproses..." : "Masuk"}
                    <span className="icon-pill">
                      <ArrowIcon />
                    </span>
                  </button>
                </form>

                <p className="text-center text-gray-700 dark:text-gray-300 text-xs mt-4">
                  <Link href="/forgot-password" className="inline-link text-sm underline">
                    Lupa kata sandi?
                  </Link>
                </p>
                <p className="text-center text-gray-700 dark:text-gray-300 text-xs mt-2">
                  Belum punya akun?{" "}
                  <Link href="/register" className="inline-link text-sm font-medium text-accent-dark dark:text-indigo-300 underline ml-1">
                    Daftar
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

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M17 7H7m10 0v10" />
    </svg>
  );
}
