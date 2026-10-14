
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function layTrangThaiBackend() {
  const phanHoi = await fetch(`${API_URL}/api/health`);

  if (!phanHoi.ok) {
    throw new Error("Backend phản hồi không thành công");
  }

  return await phanHoi.json();
}
