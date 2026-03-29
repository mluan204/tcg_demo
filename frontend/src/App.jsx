import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function App() {
  const [file, setFile] = useState(null);
  const [topK, setTopK] = useState(10);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const previewUrl = useMemo(() => {
    if (!file) return "";
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function onSearch(e) {
    e.preventDefault();
    setError("");
    setResults([]);

    if (!file) {
      setError("Bạn chưa chọn ảnh.");
      return;
    }

    const form = new FormData();
    form.append("image", file);
    form.append("topK", String(topK));

    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/search`, {
        method: "POST",
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || "Lỗi khi tìm kiếm");
      }
      setResults(data.results || []);
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>TCG Image Search Demo</h1>
      <p className="sub">Upload ảnh card và trả về kết quả top-k gần nhất từ FAISS index.</p>

      <form className="card" onSubmit={onSearch}>
        <label className="field">
          <span>Chọn ảnh</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        <label className="field">
          <span>Top K</span>
          <input
            type="number"
            min={1}
            max={100}
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value || 10))}
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Đang tìm..." : "Tìm kiếm"}
        </button>
      </form>

      {previewUrl && (
        <section className="card">
          <h2>Ảnh truy vấn</h2>
          <img src={previewUrl} alt="preview" className="preview" />
        </section>
      )}

      {error && <p className="error">{error}</p>}

      {results.length > 0 && (
        <section className="card">
          <h2>Kết quả</h2>
          <p className="hint">Distance càng nhỏ càng gần.</p>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Distance</th>
                  <th>Product ID</th>
                  <th>Name</th>
                  <th>Number</th>
                  <th>Rarity</th>
                  <th>Group ID</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={`${item.rank}-${item.productId}`}>
                    <td>{item.rank}</td>
                    <td>{Number(item.distance).toFixed(6)}</td>
                    <td>{item.productId}</td>
                    <td>{item.name || ""}</td>
                    <td>{item.number || ""}</td>
                    <td>{item.rarity || ""}</td>
                    <td>{item.groupId || ""}</td>
                    <td>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer">
                          mở link
                        </a>
                      ) : (
                        ""
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;

