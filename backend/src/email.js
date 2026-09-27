const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "Anoni <noreply@rudip.my.id>";

function buildFrontendUrl(path, origin) {
  const url = new URL(origin || "");
  if (url.protocol !== "https:" || !url.hostname || url.origin !== origin) {
    throw new Error("Invalid trusted frontend origin");
  }
  return new URL(path, `${url.origin}/`);
}

async function sendVerificationEmail(to, token, origin) {
  const verifyUrl = buildFrontendUrl(`/verify?token=${encodeURIComponent(token)}`, origin);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject: "Verifikasi Email — Anoni",
      html: `<div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;background:#111;color:#eee;padding:32px;border-radius:16px;border:1px solid #262626">
  <h2 style="color:#818CF8;margin:0 0 8px">Verifikasi Akun</h2>
  <p style="color:#999;line-height:1.6;margin:0 0 24px">
    Klik tombol di bawah untuk mengaktifkan akun Anoni Anda. Link berlaku <strong>1 jam</strong>.
  </p>
  <a href="${verifyUrl}" style="display:inline-block;background:#818CF8;color:#000;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:999px;font-size:14px">
    Verifikasi Sekarang
  </a>
  <p style="color:#555;font-size:12px;margin:24px 0 0;line-height:1.4">
    Jika Anda tidak mendaftar di <strong>Anoni</strong>, abaikan email ini.<br>
    Jika tombol tidak berfungsi, salin link ini: <a style="color:#818CF8" href="${verifyUrl}">${verifyUrl}</a>
  </p>
</div>`,
    }),
  });

  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.message || "Failed to send email");
  }

  return res.json();
}

async function sendPasswordResetEmail(to, token, origin) {
  const resetUrl = buildFrontendUrl(`/reset-password?token=${encodeURIComponent(token)}`, origin);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject: "Reset Kata Sandi — Anoni",
      html: `<div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;background:#111;color:#eee;padding:32px;border-radius:16px;border:1px solid #262626">
  <h2 style="color:#818CF8;margin:0 0 8px">Reset Kata Sandi</h2>
  <p style="color:#999;line-height:1.6;margin:0 0 24px">
    Anda meminta reset kata sandi untuk akun Anoni. Klik tombol di bawah untuk membuat kata sandi baru. Link berlaku <strong>15 menit</strong>.
  </p>
  <a href="${resetUrl}" style="display:inline-block;background:#818CF8;color:#000;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:999px;font-size:14px">
    Reset Kata Sandi
  </a>
  <p style="color:#555;font-size:12px;margin:24px 0 0;line-height:1.4">
    Jika Anda tidak meminta reset kata sandi, abaikan email ini.<br>
    Jika tombol tidak berfungsi, salin link ini: <a style="color:#818CF8" href="${resetUrl}">${resetUrl}</a>
  </p>
</div>`,
    }),
  });

  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.message || "Failed to send email");
  }

  return res.json();
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, buildFrontendUrl };
