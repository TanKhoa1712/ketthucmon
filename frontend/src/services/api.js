const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function apiRequest(path, { method = "GET", body, token, signal } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || "Không thể hoàn tất yêu cầu");
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function layTrangThaiBackend() {
  return apiRequest("/api/health");
}
