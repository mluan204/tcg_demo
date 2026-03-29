const cors = require("cors");
const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const ARTIFACT_DIR =
  process.env.ARTIFACT_DIR || path.resolve(__dirname, "..", "..", "artifacts");
const PYTHON_BIN = process.env.PYTHON_BIN || "python";

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

const upload = multer({
  dest: path.join(os.tmpdir(), "tcg-demo-uploads"),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function parseTopK(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return 10;
  }
  return Math.min(n, 100);
}

const workerPath = path.join(__dirname, "search_worker.py");
const worker = spawn(PYTHON_BIN, [workerPath, "--artifacts", ARTIFACT_DIR], {
  stdio: ["pipe", "pipe", "pipe"],
});
let querySeq = 0;

let buffer = "";
let ready = false;
let workerError = null;
const pending = new Map();

worker.stdout.setEncoding("utf8");
worker.stdout.on("data", (chunk) => {
  buffer += chunk;
  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line.length > 0) {
      handleWorkerLine(line);
    }
    newlineIndex = buffer.indexOf("\n");
  }
});

worker.stderr.setEncoding("utf8");
worker.stderr.on("data", (chunk) => {
  const text = chunk.trim();
  if (text.length > 0) {
    console.error("[worker]", text);
  }
});

worker.on("error", (err) => {
  workerError = `Cannot start python worker: ${err.message}`;
});

worker.on("exit", (code) => {
  const msg = `Python worker exited with code ${code ?? "unknown"}`;
  workerError = msg;
  for (const [, task] of pending) {
    task.reject(new Error(msg));
  }
  pending.clear();
});

function handleWorkerLine(line) {
  let payload;
  try {
    payload = JSON.parse(line);
  } catch {
    return;
  }

  if (payload.type === "ready") {
    ready = true;
    workerError = null;
    console.log(`Worker ready. Loaded ${payload.metadata_rows} metadata rows`);
    return;
  }

  if (payload.type === "error" && !payload.id) {
    workerError = payload.message || "Worker initialization failed";
    return;
  }

  if (!payload.id || !pending.has(payload.id)) {
    return;
  }

  const task = pending.get(payload.id);
  pending.delete(payload.id);

  if (payload.type === "result") {
    task.resolve(payload.results || []);
    return;
  }

  task.reject(new Error(payload.message || "Worker request failed"));
}

function askWorker(imagePath, topK) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const line = JSON.stringify({ id, image_path: imagePath, top_k: topK });
    worker.stdin.write(`${line}\n`, (err) => {
      if (!err) {
        return;
      }
      pending.delete(id);
      reject(err);
    });
  });
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: ready && !workerError,
    ready,
    workerError,
    artifactDir: ARTIFACT_DIR,
  });
});

app.post("/api/search", upload.single("image"), async (req, res) => {
  const queryId = `q-${++querySeq}`;
  const startMs = Date.now();

  if (!req.file) {
    console.warn(`[search][${queryId}] Missing uploaded image file`);
    return res.status(400).json({ error: "Missing image file in 'image' field" });
  }

  const topK = parseTopK(req.body?.topK);
  console.log(
    `[search][${queryId}] Received query filename="${req.file.originalname}" size=${req.file.size}B topK=${topK}`
  );

  if (!ready || workerError) {
    fs.unlink(req.file.path, () => {});
    console.warn(
      `[search][${queryId}] Rejected because worker not ready: ${workerError || "not ready"}`
    );
    return res.status(503).json({
      error: workerError || "Worker is not ready yet. Check backend logs.",
    });
  }

  try {
    const results = await askWorker(req.file.path, topK);
    const elapsed = Date.now() - startMs;
    console.log(
      `[search][${queryId}] Success results=${results.length} elapsedMs=${elapsed}`
    );
    res.json({ topK, total: results.length, results });
  } catch (err) {
    const elapsed = Date.now() - startMs;
    console.error(
      `[search][${queryId}] Failed elapsedMs=${elapsed} error=${err.message || "Unknown error"}`
    );
    res.status(500).json({ error: err.message || "Image search request failed" });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Artifacts: ${ARTIFACT_DIR}`);
});

