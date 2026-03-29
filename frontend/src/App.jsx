import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function App() {
  const [file, setFile] = useState(null);
  const [topK, setTopK] = useState(10);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendReady, setBackendReady] = useState(false);
  const [backendMsg, setBackendMsg] = useState("Connecting to backend...");

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

  useEffect(() => {
    let timerId;

    async function checkHealth() {
      try {
        const resp = await fetch(`${API_BASE}/api/health`);
        const data = await resp.json();
        const ok = Boolean(data?.ok);
        setBackendReady(ok);
        setBackendMsg(
          ok ? "Backend is ready." : data?.workerError || "Backend is initializing model/index..."
        );
      } catch {
        setBackendReady(false);
        setBackendMsg("Cannot connect to backend.");
      } finally {
        timerId = setTimeout(checkHealth, 2500);
      }
    }

    checkHealth();
    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, []);

  async function onSearch(e) {
    e.preventDefault();
    setError("");
    setResults([]);

    if (!file) {
      setError("No image selected.");
      return;
    }
    if (!backendReady) {
      setError("Backend is not ready yet. Please wait for model/index loading to finish.");
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
        throw new Error(data?.error || "Search request failed");
      }
      setResults(data.results || []);
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>TCG Image Search Demo</h1>
      <p className="sub">Upload a card image and get the top-k nearest results from the FAISS index.</p>
      <p className={backendReady ? "ok" : "hint"}>{backendMsg}</p>

      <form className="card" onSubmit={onSearch}>
        <label className="field">
          <span>Select image</span>
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

        <button type="submit" disabled={loading || !backendReady}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {previewUrl && (
        <section className="card">
          <h2>Query image</h2>
          <img src={previewUrl} alt="preview" className="preview" />
        </section>
      )}

      {error && <p className="error">{error}</p>}

      {results.length > 0 && (
        <section className="card">
          <h2>Results</h2>
          <p className="hint">Smaller distance means closer match.</p>
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
                          open link
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

