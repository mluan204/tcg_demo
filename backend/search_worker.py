import argparse
import io
import json
import sys
from pathlib import Path

import faiss
import open_clip
import torch
from PIL import Image


def emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def load_metadata_map(path: Path) -> dict[int, dict]:
    result: dict[int, dict] = {}
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            pid = obj.get("productId")
            if isinstance(pid, int):
                result[pid] = obj
    return result


def resolve_model_config(artifact_dir: Path) -> tuple[str, str]:
    cfg_path = artifact_dir / "build_config.json"
    if cfg_path.is_file():
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        return cfg.get("model", "ViT-B-32"), cfg.get("pretrained", "openai")
    return "ViT-B-32", "openai"


def search_pil(
    model,
    preprocess,
    device: str,
    index,
    meta_by_id: dict[int, dict],
    image: Image.Image,
    k: int,
) -> list[dict]:
    t = preprocess(image.convert("RGB")).unsqueeze(0).to(device)
    feat = model.encode_image(t)
    feat = feat / feat.norm(dim=-1, keepdim=True)
    q = feat.detach().cpu().numpy().astype("float32").reshape(1, -1)

    distances, ids = index.search(q, k)
    pids = [int(x) for x in ids[0].tolist() if int(x) >= 0]

    rows: list[dict] = []
    for rank, (pid, dist) in enumerate(
        zip(pids, distances[0].tolist()[: len(pids)]), start=1
    ):
        info = meta_by_id.get(pid, {})
        rows.append(
            {
                "rank": rank,
                "distance": float(dist),
                "productId": pid,
                "name": info.get("name"),
                "number": info.get("number"),
                "rarity": info.get("rarity"),
                "groupId": info.get("groupId"),
                "url": info.get("url"),
                "imageUrl": info.get("imageUrl"),
            }
        )
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts", required=True, help="Artifacts directory path")
    args = parser.parse_args()

    artifact_dir = Path(args.artifacts)
    index_path = artifact_dir / "faiss_hnsw_idmap.index"
    metadata_path = artifact_dir / "metadata.jsonl"

    if not index_path.is_file():
        emit(
            {
                "type": "error",
                "message": f"Thiếu index: {index_path.resolve()}",
            }
        )
        return 1
    if not metadata_path.is_file():
        emit(
            {
                "type": "error",
                "message": f"Thiếu metadata: {metadata_path.resolve()}",
            }
        )
        return 1

    model_name, pretrained = resolve_model_config(artifact_dir)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch.set_grad_enabled(False)

    index = faiss.read_index(str(index_path))
    meta_by_id = load_metadata_map(metadata_path)

    model, _, preprocess = open_clip.create_model_and_transforms(
        model_name, pretrained=pretrained
    )
    model = model.to(device)
    model.eval()

    emit(
        {
            "type": "ready",
            "model": model_name,
            "pretrained": pretrained,
            "device": device,
            "index_ntotal": int(index.ntotal),
            "metadata_rows": len(meta_by_id),
        }
    )

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        req_id = None
        try:
            payload = json.loads(line)
            req_id = payload.get("id")
            image_path = payload.get("image_path")
            top_k = int(payload.get("top_k", 10))
            top_k = max(1, min(top_k, 100))

            if not req_id:
                raise ValueError("Thiếu id")
            if not image_path:
                raise ValueError("Thiếu image_path")

            raw = Path(image_path).read_bytes()
            image = Image.open(io.BytesIO(raw)).convert("RGB")
            results = search_pil(
                model=model,
                preprocess=preprocess,
                device=device,
                index=index,
                meta_by_id=meta_by_id,
                image=image,
                k=top_k,
            )
            emit({"type": "result", "id": req_id, "results": results})
        except Exception as e:
            emit(
                {
                    "type": "error",
                    "id": req_id,
                    "message": str(e),
                }
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

