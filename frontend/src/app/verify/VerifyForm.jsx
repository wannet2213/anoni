"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

export default function VerifyForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [expired, setExpired] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resendEmail, setResendEmail] = useState("");

  const verify = useCallback(async () => {
    setStatus("loading");
    setExpired(false);
    setNetworkError(false);
    if (!token) {
      setStatus("error");
      setMessage("Token verifikasi tidak ditemukan di tautan.");
      return;
    }

    try {
      const data = await api.verifyEmail(token);
      setStatus("success");
      setMessage(data.message || "Email Anda berhasil diverifikasi.");
    } catch (err) {
      setStatus("error");
      setMessage(err.message);
      if (err.status === 410) setExpired(true);
      if (err.status === 0) setNetworkError(true);
    }
  }, [token]);

  useEffect(() => { verify(); }, [verify]);

  async function handleResend(e) {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResending(true);
    setResendMsg("");
    try {
      await api.resendVerification({ email: resendEmail });
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
        className="inline-link fixed top-6 left-6 text-xs transition-colors duration-300"
      >
        &larr; Beranda
      </Link>
      <ThemeToggle className="fixed top-6 right-6" />

      <div className="w-full max-w-sm">
        <div className="doppelrand">
          <div className="shell">
            <div className="core text-center py-8">
              {status === "loading" && (
                <div className="text-gray-700 dark:text-gray-300 text-sm" role="status">
                  Memverifikasi akun...
                </div>
              )}

              {status === "success" && (
                <>
                  <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icon-ok" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <h1 className="font-display text-xl font-semibold mb-2">Email Terverifikasi</h1>
                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">{message}</p>
                  <Link href="/login" className="btn-emerald text-xs px-6 py-2">
                    Login Sekarang
                  </Link>
                </>
              )}

              {status === "error" && (
                <>
                  <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icon-bad" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M15 9l-6 6M9 9l6 6" />
                    </svg>
                  </div>
                  <h1 className="font-display text-xl font-semibold mb-2">Verifikasi Gagal</h1>
                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">{message}</p>

                  {networkError ? (
                    <div className="space-y-3">
                      <button onClick={verify} className="btn-emerald text-sm w-full justify-center">
                        Coba lagi
                      </button>
                      <Link href="/" className="inline-link text-xs">
                        Kembali ke beranda
                      </Link>
                    </div>
                  ) : expired ? (
                    <div className="space-y-3">
                      {resendMsg ? (
                        <p className="text-green-800 dark:text-green-300 text-xs bg-green-50 dark:bg-green-950/40 rounded-xl px-4 py-3 ring-1 ring-green-200 dark:ring-green-800">
                          {resendMsg}
                        </p>
                      ) : (
                        <form onSubmit={handleResend} className="space-y-3">
                          <label htmlFor="resend-email" className="sr-only">Email akun</label>
                          <input
                            id="resend-email"
                            type="email"
                            className="input-glass text-center text-sm"
                            placeholder="Masukkan email Anda"
                            value={resendEmail}
                            onChange={(e) => setResendEmail(e.target.value)}
                            required
                          />
                          <button
                            type="submit"
                            disabled={resending}
                            className="btn-glass text-xs px-4 py-2 mx-auto"
                          >
                            {resending ? "Mengirim..." : "Kirim Ulang Verifikasi"}
                          </button>
                        </form>
                      )}
                      <Link href="/register" className="inline-link text-xs transition-colors">
                        Daftar ulang &rarr;
                      </Link>
                    </div>
                  ) : (
                    <Link href="/register" className="inline-link text-xs text-accent dark:text-indigo-300 transition-colors">
                      Daftar ulang &rarr;
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
