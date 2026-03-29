import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.DEV ? "" : import.meta.env.VITE_API_BASE_URL || "";
const QUERY_IMAGE_STORAGE_KEY = "tcg_demo_query_image";

function App() {
  const [inputMode, setInputMode] = useState("file");
  const [file, setFile] = useState(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
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

  function clearStoredQueryImage() {
    localStorage.removeItem(QUERY_IMAGE_STORAGE_KEY);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read image content"));
      reader.readAsDataURL(blob);
    });
  }

  function getFileNameFromUrl(url) {
    try {
      const u = new URL(url);
      const lastPart = u.pathname.split("/").filter(Boolean).pop() || "";
      if (lastPart.includes(".")) {
        return lastPart;
      }
    } catch {
      // ignore and use fallback
    }
    return `query-${Date.now()}.jpg`;
  }

  async function downloadUrlImageToLocalStorage(rawUrl) {
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new Error("Invalid image URL");
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Only http/https image URLs are supported");
    }

    const resp = await fetch(parsedUrl.toString());
    if (!resp.ok) {
      throw new Error(`Cannot download image. HTTP ${resp.status}`);
    }

    const blob = await resp.blob();
    if (!blob.type.startsWith("image/")) {
      throw new Error("The URL does not point to a valid image");
    }

    // Remove previously stored query image before saving the new one.
    clearStoredQueryImage();
    try {
      const dataUrl = await blobToDataUrl(blob);
      localStorage.setItem(
        QUERY_IMAGE_STORAGE_KEY,
        JSON.stringify({
          source: parsedUrl.toString(),
          type: blob.type,
          size: blob.size,
          dataUrl,
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Continue even if localStorage quota is exceeded.
    }

    const fileName = getFileNameFromUrl(parsedUrl.toString());
    return new File([blob], fileName, { type: blob.type });
  }

  async function onSearch(e) {
    e.preventDefault();
    setError("");
    setResults([]);

    if (!backendReady) {
      setError("Backend is not ready yet. Please wait for model/index loading to finish.");
      return;
    }

    setLoading(true);
    try {
      let queryFile = file;
      if (inputMode === "file") {
        if (!queryFile) {
          throw new Error("No image selected.");
        }
        clearStoredQueryImage();
      } else {
        if (!imageUrlInput.trim()) {
          throw new Error("Please enter an image URL.");
        }
        queryFile = await downloadUrlImageToLocalStorage(imageUrlInput.trim());
        setFile(queryFile);
      }

      const form = new FormData();
      form.append("image", queryFile);
      form.append("topK", String(topK));

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
        <div className="modeRow">
          <label>
            <input
              type="radio"
              name="inputMode"
              value="file"
              checked={inputMode === "file"}
              onChange={() => {
                setInputMode("file");
                setImageUrlInput("");
              }}
            />
            Upload file
          </label>
          <label>
            <input
              type="radio"
              name="inputMode"
              value="url"
              checked={inputMode === "url"}
              onChange={() => setInputMode("url")}
            />
            Image URL
          </label>
        </div>

        {inputMode === "file" ? (
          <label className="field">
            <span>Select image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                clearStoredQueryImage();
              }}
            />
          </label>
        ) : (
          <label className="field">
            <span>Image URL</span>
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
            />
            <small className="hint">
              The app downloads this URL in the browser, stores it in localStorage, then sends it to backend.
            </small>
          </label>
        )}

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
                  <th>Shop link</th>
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
                          Buy
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

