const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Errors thrown here carry `status` so callers can tell an expired session
// (401) apart from a room that does not exist (404) and from the server being
// unreachable (status 0).
async function request(path, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    const error = new Error("Tidak bisa terhubung ke server. Periksa koneksi Anda.");
    error.status = 0;
    throw error;
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    // A proxy in front of the API answers 502/503/504 when the backend is down,
    // and the body is then HTML rather than our JSON error shape.
    const message =
      data.error ||
      (res.status >= 500
        ? "Server sedang bermasalah. Coba lagi sebentar lagi."
        : `Permintaan gagal (${res.status})`);
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  // Auth
  kdfParams: (login) => request("/api/v1/auth/kdf-params", { method: "POST", body: JSON.stringify({ login }) }),
  register: (body) => request("/api/v1/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/api/v1/auth/login", { method: "POST", body: JSON.stringify(body) }),
  // Mengangkat akun lama ke enkripsi akun, sekali saja, memakai token sesi yang baru diperoleh.
  kdfUpgrade: (body) => request("/api/v1/auth/kdf-upgrade", { method: "POST", body: JSON.stringify(body) }),
  // Memastikan turunan kata sandi cocok dengan akun yang sedang masuk, tanpa mengirim kata sandi.
  verifyVerifier: (body) => request("/api/v1/auth/verify-verifier", { method: "POST", body: JSON.stringify(body) }),
  recoveryBlobs: (body) => request("/api/v1/auth/recovery-blobs", { method: "POST", body: JSON.stringify(body) }),
  forgotPassword: (body) => request("/api/v1/auth/forgot-password", { method: "POST", body: JSON.stringify(body) }),
  resetPassword: (body) => request("/api/v1/auth/reset-password", { method: "POST", body: JSON.stringify(body) }),
  resendVerification: (body) =>
    request("/api/v1/auth/resend-verification", { method: "POST", body: JSON.stringify(body) }),
  verifyEmail: (token) => request(`/api/v1/auth/verify?token=${encodeURIComponent(token)}`),

  // Kunci ruang yang tersimpan di akun, dalam bentuk terbungkus
  getKeys: () => request("/api/v1/keys"),
  putKey: (slug, body) => request(`/api/v1/keys/${encodeURIComponent(slug)}`, { method: "PUT", body: JSON.stringify(body) }),

  // Admin Rooms
  getRooms: () => request("/api/v1/rooms"),
  createRoom: (body) => request("/api/v1/rooms", { method: "POST", body: JSON.stringify(body) }),
  deleteRoom: (id) => request(`/api/v1/rooms/${id}`, { method: "DELETE" }),

  // Public
  getRoomInfo: (slug) => request(`/api/v1/rooms/public/${slug}`),
  verifyPassword: (slug, password) =>
    request(`/api/v1/rooms/public/${slug}/verify`, { method: "POST", body: JSON.stringify({ password }) }),
  // Protected rooms need the proof handed out by verifyPassword
  getMessages: (slug, roomToken) =>
    request(`/api/v1/rooms/public/${slug}/messages`, roomToken ? { headers: { "X-Room-Token": roomToken } } : {}),
};
