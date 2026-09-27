import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main>
      <header className="page-shell flex min-h-20 items-center justify-between">
        <Link href="/" className="inline-link font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Diskusi Anonimous
        </Link>
        <nav aria-label="Navigasi utama" className="flex items-center gap-2 sm:gap-4">
          <Link href="/dashboard" className="inline-link px-3 text-sm text-gray-800 dark:text-gray-200 hover:text-accent-dark dark:hover:text-indigo-300">
            Kelola ruang
          </Link>
          <ThemeToggle />
          <Link href="/login" className="btn-glass">Masuk</Link>
        </nav>
      </header>

      <section className="page-shell flex min-h-[70vh] flex-col justify-center py-20">
        <p className="eyebrow mb-5">Ruang diskusi privat</p>
        <h1 className="max-w-[20ch] font-display text-[clamp(3rem,4vw+1.5rem,6.5rem)] font-semibold leading-[1.06] tracking-tight">
          Bicara tanpa membuat akun peserta.
        </h1>
        <p className="mt-6 max-w-[58ch] text-[clamp(1.0625rem,0.25vw+1rem,1.375rem)] leading-relaxed text-gray-700 dark:text-gray-300">
          Anda membuat satu ruang obrolan, lalu membagikan tautan ruang itu. Siapa pun yang menerima tautan bisa ikut menulis dengan nama panggilan pilihannya sendiri, tanpa mendaftar akun dan tanpa memasang aplikasi.
        </p>
        <p className="mt-4 max-w-[58ch] leading-relaxed text-gray-700 dark:text-gray-300">
          Biasanya dipakai untuk meminta pendapat jujur dari tim atau klien, terutama soal yang orang enggan katakan dengan nama terbuka.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/dashboard" className="btn-emerald">Kelola ruang diskusi</Link>
          <Link href="/register" className="btn-glass">Buat akun admin</Link>
        </div>
      </section>

      <section className="page-shell pb-24">
        <div className="mb-8">
          <p className="eyebrow mb-3">Cara kerja ruang</p>
          <h2 className="max-w-[24ch] font-display text-[clamp(1.75rem,1.2vw+1.2rem,2.75rem)] font-semibold leading-tight">
            Anda yang membuat ruangnya, peserta cukup membuka tautan.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2 2xl:grid-cols-3">
          <article className="border-t-2 border-accent dark:border-indigo-400 py-6 md:row-span-2">
            <h3 className="mb-3 font-display text-2xl font-semibold">Nama dan alamat IP tidak dicatat</h3>
            <p className="max-w-xl leading-relaxed text-gray-700 dark:text-gray-300">
              Nama yang tampil di ruang ini hanya nama panggilan yang dipilih peserta, bukan nama asli atau email. Alamat IP juga tidak ikut tercatat. Alamat IP itu nomor pengenal sambungan internet Anda, dan nomor tersebut tidak sampai ke aplikasi ini. Isi pesan dienkripsi di perangkat peserta sebelum dikirim, jadi yang tersimpan di server hanya bentuk terenkripsinya.
            </p>
          </article>
          <article className="border-t border-gray-400 dark:border-gray-600 py-6">
            <h3 className="mb-2 font-display text-xl font-semibold">Ruang bisa dikunci dengan kata sandi</h3>
            <p className="leading-relaxed text-gray-700 dark:text-gray-300">
              Kalau diskusinya perlu terbatas, pasang kata sandi saat membuat ruang. Hanya orang yang punya tautannya sekaligus tahu sandinya yang bisa masuk.
            </p>
          </article>
          <article className="border-t border-gray-400 dark:border-gray-600 py-6">
            <h3 className="mb-2 font-display text-xl font-semibold">Pesan baru langsung muncul</h3>
            <p className="leading-relaxed text-gray-700 dark:text-gray-300">
              Balasan tampil sendiri di layar, tidak perlu menekan tombol apa pun. Semua orang yang sedang berada di ruang itu melihat pesan yang sama.
            </p>
          </article>
          <article className="border-t border-gray-400 dark:border-gray-600 py-6 md:col-span-2">
            <h3 className="mb-2 font-display text-xl font-semibold">Ruang bisa dihapus setelah selesai</h3>
            <p className="max-w-2xl leading-relaxed text-gray-700 dark:text-gray-300">
              Dari halaman kelola, Anda bisa menghapus ruang yang sudah tidak dipakai. Pesan yang tersimpan di dalamnya ikut terhapus.
            </p>
          </article>
        </div>
      </section>

      <footer className="border-t border-gray-300 dark:border-gray-700 py-8">
        <div className="page-shell flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
          <span>Diskusi Anonimous</span>
          <span>Ruang diskusi tanpa akun peserta</span>
        </div>
      </footer>
    </main>
  );
}
