# Artifacts Folder

This folder contains prebuilt data for image similarity search (image embeddings + vector index).

## Files

- `faiss_hnsw_idmap.index`
  - FAISS index (HNSW + ID map) used for fast nearest-neighbor search.
  - Main file used by the backend for top-k retrieval.

- `metadata.jsonl`
  - Per-product metadata (`productId`, `name`, `number`, `rarity`, `groupId`, `url`, `imageUrl`, etc.).
  - Used to map search results to display information in the UI.
  - Example line:

```json
{"productId":15026,"name":"Afflict","cleanName":"Afflict","imageUrl":"https://tcgplayer-cdn.tcgplayer.com/product/15026_200w.jpg","categoryId":1,"groupId":1,"url":"https://www.tcgplayer.com/product/15026/magic-10th-edition-afflict","number":"125","rarity":"C","status":"ok","error":null,"imagePath":"/kaggle/input/datasets/tmluan/images-raw-data/images/0001 - Magic_ The Gathering/000001 - 10th Edition (10E)/15026.jpg"}
```

- `build_config.json`
  - Artifact build configuration (`model`, `pretrained`, `dim`, `ntotal`, `images_dir`).
  - Backend/worker can read this file to load the correct embedding model config.
  - Example:

```json
{
  "model": "ViT-B-32",
  "pretrained": "openai",
  "dim": 512,
  "ntotal": 453732,
  "images_dir": "/kaggle/input/datasets/tmluan/images-raw-data/images"
}
```

- `embeddings.npy`
  - Normalized embedding matrix for all images (NumPy array).
  - Useful for analysis/debugging or rebuilding the index.

- `product_ids.npy`
  - Product IDs aligned by row with `embeddings.npy`.
  - Used for vector-to-product mapping in offline workflows.

## Minimum Files Required For Demo Search

Required:
- `faiss_hnsw_idmap.index`
- `metadata.jsonl`

Recommended:
- `build_config.json` (auto-load correct `model`/`pretrained`)

