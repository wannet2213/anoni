import "./globals.css";
import { SocketProvider } from "@/lib/socket";

export const metadata = {
  title: "Diskusi Anonimous — Private Discussion, Zero Identity",
  description:
    "Create confidential discussion rooms. Share a link. Participants join anonymously — no registration, no IP logging, no identity tracking.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&f[]=general-sans@400,500,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased min-h-screen">
        {/* Fixed orb background — Ethereal Glass */}
        <div className="bg-orbs" aria-hidden="true">
          <div
            className="bg-orb animate-orb-pulse"
            style={{
              width: "60vw",
              height: "60vw",
              background: "radial-gradient(circle, rgba(129,140,248,0.12) 0%, transparent 70%)",
              top: "-20%",
              left: "-10%",
            }}
          />
          <div
            className="bg-orb animate-orb-pulse"
            style={{
              width: "50vw",
              height: "50vw",
              background: "radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)",
              bottom: "-15%",
              right: "-10%",
              animationDelay: "4s",
            }}
          />
          <div
            className="bg-orb animate-orb-pulse"
            style={{
              width: "30vw",
              height: "30vw",
              background: "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              animationDelay: "2s",
            }}
          />
        </div>

        {/* Fixed noise grain overlay */}
        <div
          className="fixed inset-0 pointer-events-none z-[5] opacity-[0.025]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
          aria-hidden="true"
        />

        <SocketProvider>
          <div className="relative z-10">{children}</div>
        </SocketProvider>
      </body>
    </html>
  );
}
