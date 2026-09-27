import "./globals.css";
import { SocketProvider } from "@/lib/socket";

export const metadata = {
  title: "Diskusi Anonimous | Ruang Diskusi Privat",
  description:
    "Buat ruang diskusi privat dan bagikan tautannya. Peserta dapat bergabung tanpa membuat akun.",
};

// Runs before the first paint so a dark-mode visitor never sees a light flash.
const themeBootScript = `try{var s=localStorage.getItem("theme");var d=s?s==="dark":matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the boot script adds `class` to <html> before React hydrates.
    <html lang="id" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <SocketProvider>
          <div className="relative z-10">{children}</div>
        </SocketProvider>
      </body>
    </html>
  );
}
