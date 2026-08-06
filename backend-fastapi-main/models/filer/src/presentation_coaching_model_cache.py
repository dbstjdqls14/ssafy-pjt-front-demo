from pathlib import Path


def local_model_path(model_id: str) -> Path | None:
    direct_path = Path(model_id)
    if direct_path.is_dir():
        return direct_path
    cache_root = Path.home() / ".cache" / "huggingface" / "hub" / f"models--{model_id.replace('/', '--')}" / "snapshots"
    if not cache_root.is_dir():
        return None
    snapshots = sorted(
        (path for path in cache_root.iterdir() if path.is_dir()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return next((path for path in snapshots if _has_model_files(path)), None)


def _has_model_files(snapshot: Path) -> bool:
    has_config = (snapshot / "config.json").is_file()
    has_weights = any(snapshot.glob("*.safetensors")) or any(
        (snapshot / filename).is_file()
        for filename in ("model.bin", "pytorch_model.bin")
    )
    return has_config and has_weights
