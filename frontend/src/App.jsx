
import { useState } from "react";
import { layTrangThaiBackend } from "./services/api";

function App() {
  const [ketQua, setKetQua] = useState(null);
  const [loi, setLoi] = useState("");
  const [dangKiemTra, setDangKiemTra] = useState(false);

  async function kiemTraBackend() {
    setDangKiemTra(true);
    setKetQua(null);
    setLoi("");

    try {
      const duLieu = await layTrangThaiBackend();
      setKetQua(duLieu);
    } catch (error) {
      setLoi("Không kết nối được Backend. Hãy kiểm tra máy chủ.");
      console.error(error);
    } finally {
      setDangKiemTra(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: "700px",
        margin: "60px auto",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
      }}
    >
      <h1>Website bán hàng</h1>
      <p>Kiểm tra kết nối giữa Frontend và Backend</p>

      <button
        onClick={kiemTraBackend}
        disabled={dangKiemTra}
        style={{
          padding: "12px 20px",
          cursor: "pointer",
          borderRadius: "8px",
          border: "none",
          background: "#2563eb",
          color: "white",
        }}
      >
        {dangKiemTra ? "Đang kiểm tra..." : "Kiểm tra Backend"}
      </button>

      {ketQua && (
        <section>
          <h2>Kết nối thành công!</h2>
          <pre>{JSON.stringify(ketQua, null, 2)}</pre>
        </section>
      )}

      {loi && <p style={{ color: "red" }}>{loi}</p>}
    </main>
  );
}

export default App;
