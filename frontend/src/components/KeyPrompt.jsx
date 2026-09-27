"use client";

import { useState } from "react";

import { isValidRoomKey } from "@/lib/roomKey";

// Jalan pemulihan saat kunci tidak ada di tautan atau kuncinya rusak, misalnya karena
// fragmen tautan terpotong ketika tautan disalin. Tanpa ini, halamannya jadi jalan buntu.
export default function KeyPrompt({ onUse, description }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const key = value.trim();
    if (!isValidRoomKey(key)) {
      setError("Kunci tidak dikenali. Bentuknya 43 karakter huruf dan angka, tanpa spasi.");
      return;
    }
    setError("");
    onUse(key);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <label htmlFor="room-key-input" className="block text-sm mb-2">
        {description || "Tempel kunci ruang kalau Anda menyimpannya"}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="room-key-input"
          type="text"
          className="input-glass flex-1 min-w-0"
          placeholder="43 karakter"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn-glass">
          Pakai kunci
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-800 dark:text-red-300" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
