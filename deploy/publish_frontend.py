import gzip
from pathlib import Path


def publish(source, destination):
    if not (source / "index.html").is_file() or not (source / "assets").is_dir():
        raise SystemExit("Build the frontend before publishing")
    for file in sorted(source.rglob("*"), key=lambda item: item.name == "index.html"):
        if not file.is_file() or file.is_symlink():
            continue
        target = destination / file.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        data = file.read_bytes()
        if file.suffix in {".js", ".css", ".json", ".svg", ".html"}:
            compressed = gzip.compress(data, compresslevel=6, mtime=0)
            temporary = target.with_name(target.name + ".gz.tmp")
            temporary.write_bytes(compressed)
            temporary.replace(target.with_name(target.name + ".gz"))
        temporary = target.with_name(target.name + ".tmp")
        temporary.write_bytes(data)
        temporary.replace(target)


if __name__ == "__main__":
    directory = Path(__file__).resolve().parent
    publish(directory.parent / "dist", directory / "frontend")
