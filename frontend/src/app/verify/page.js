"use client";

import { Suspense } from "react";
import VerifyForm from "./VerifyForm";

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <main className="min-h-[100dvh] flex items-center justify-center px-4">
        <div className="text-gray-700 dark:text-gray-300 text-sm" role="status">Memuat...</div>
      </main>
    }>
      <VerifyForm />
    </Suspense>
  );
}
