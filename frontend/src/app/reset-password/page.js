"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { bukaBungkusanKode, simpanIdentitas } from "@/lib/account";
import {
  ITERASI_BAWAAN,
  buatSalt,
  bungkusKunciRuang,
  kodeSah,
  turunkanMasterKey,
  verifierDariMasterKey,
  verifierPemulihanDariKode,
} from "@/lib/accountCrypto";
import ThemeToggle from "@/components/ThemeToggle";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [identitas, setIdentitas] = useState("");
  const [kode, setKode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [catatan, setCatatan] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setCatatan("");

    if (password.length < 6) {
      setError("Kata sandi minimal 6 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Kata sandi tidak cocok");
      return;
    }

    setLoading(true);
    try {
      const info = await api.kdfParams(identitas);

      if (info.mode !== "akun" || !info.hasRecovery) {
        // Akun lama: jalur lama masih berlaku sampai akun itu diangkat lewat halaman login.
        await api.resetPassword({ token, password });
        setDone(true);
        return;
      }

      if (!kodeSah(kode)) {
        setError("Kode pemulihan wajib diisi dan bentuknya 8 kelompok 4 karakter");
        return;
      }

      // 1. Ambil bungkusan kunci memakai kode pemulihan, lalu buka di perangkat.
      const { blobs } = await api.recoveryBlobs({
        login: identitas,
        recoveryVerifier: await verifierPemulihanDariKode(kode),
      });

      const kunciRuang = [];
      for (const b of blobs) {
        const kunci = await bukaBungkusanKode(b.slug, b.wrappedRecovery, kode);
        kunciRuang.push([b.slug, kunci]);
      }

      // 2. Turunkan kunci dari kata sandi baru, lalu bungkus ulang kunci ruang dengan itu.
      const salt = await buatSalt();
      const master = await turunkanMasterKey(password, salt, ITERASI_BAWAAN);
      const rewrapped = [];
      for (const [slug, kunci] of kunciRuang) {
        rewrapped.push({ slug, wrappedPassword: await bungkusKunciRuang(master, kunci) });
      }

      // 3. Kirim semuanya sekaligus: verifier baru, verifier pemulihan, dan bungkusan baru.
      await api.resetPassword({
        token,
        authVerifier: await verifierDariMasterKey(master),
        recoveryVerifier: await verifierPemulihanDariKode(kode),
        kdfSalt: salt,
        kdfIterations: ITERASI_BAWAAN,
        rewrapped,
      });

      simpanIdentitas(identitas);
      setCatatan(`${rewrapped.length} kunci ruang berhasil dibungkus ulang dengan kata sandi baru.`);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-4">
        <ThemeToggle className="fixed top-6 right-6" />
        <div className="text-center max-w-sm" role="alert">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] mb-4">Link Tidak Valid</h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">Token reset tidak ditemukan di URL.</p>
          <Link href="/forgot-password" className="btn-glass text-sm">Minta Link Baru</Link>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-4">
        <ThemeToggle className="fixed top-6 right-6" />
        <div className="w-full max-w-sm text-center">
          <div className="doppelrand">
            <div className="shell">
              <div className="core">

                <h1 className="font-display text-xl font-semibold mb-2">Kata Sandi Diperbarui</h1>
                <p className="text-gray-700 dark:text-gray-300 text-sm">Kata sandi Anda berhasil diubah. Silakan login.</p>
                {catatan && (
                  <p className="text-gray-700 dark:text-gray-300 text-sm mt-3">{catatan}</p>
                )}
                <Link href="/login" className="btn-emerald w-full justify-center mt-6">
                  Login Sekarang
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
          <span className="eyebrow mb-3">Reset Kata Sandi</span>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Buat Kata Sandi Baru</h1>
          <p className="text-gray-700 dark:text-gray-300 text-sm mt-2">Minimal 6 karakter</p>
        </div>

        <div className="doppelrand">
          <div className="shell">
            <div className="core">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="reset-identity" className="mb-2 block text-sm text-gray-800 dark:text-gray-200">
                    Email atau Username
                  </label>
                  <input
                    id="reset-identity"
                    className="input-glass"
                    placeholder="admin@email.com"
                    value={identitas}
                    onChange={(e) => setIdentitas(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="reset-kode" className="mb-2 block text-sm text-gray-800 dark:text-gray-200">
                    Kode pemulihan
                  </label>
                  <input
                    id="reset-kode"
                    className="input-glass"
                    placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                    value={kode}
                    onChange={(e) => setKode(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="mt-2 text-xs text-gray-700 dark:text-gray-300">
                    Kode yang ditampilkan sekali saat Anda mendaftar. Kode ini yang membuka kembali kunci
                    ruang-ruang Anda. Akun lama yang belum punya kode pemulihan boleh dikosongkan.
                  </p>
                </div>
                <div>
                  <label htmlFor="reset-password" className="mb-2 block text-sm text-gray-800 dark:text-gray-200">Kata Sandi Baru</label>
                  <input
                    id="reset-password"
                    type="password" className="input-glass"
                    placeholder="Minimal 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="reset-password-confirm" className="mb-2 block text-sm text-gray-800 dark:text-gray-200">Konfirmasi Kata Sandi</label>
                  <input
                    id="reset-password-confirm"
                    type="password" className="input-glass"
                    placeholder="Masukkan ulang kata sandi"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
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
                  {loading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-gray-700 dark:text-gray-300 text-sm" role="status">Memuat formulir...</div>
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
