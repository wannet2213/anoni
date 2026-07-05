const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function request(path, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  // Auth
  register: (body) => request("/api/v1/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/api/v1/auth/login", { method: "POST", body: JSON.stringify(body) }),

  // Admin Rooms
  getRooms: () => request("/api/v1/rooms"),
  createRoom: (body) => request("/api/v1/rooms", { method: "POST", body: JSON.stringify(body) }),
  deleteRoom: (id) => request(`/api/v1/rooms/${id}`, { method: "DELETE" }),

  // Public
  getRoomInfo: (slug) => request(`/api/v1/rooms/public/${slug}`),
  verifyPassword: (slug, password) =>
    request(`/api/v1/rooms/public/${slug}/verify`, { method: "POST", body: JSON.stringify({ password }) }),
  getMessages: (slug) => request(`/api/v1/rooms/public/${slug}/messages`),
};
