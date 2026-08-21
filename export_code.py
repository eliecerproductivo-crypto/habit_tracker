"""
export_code.py — Extrae todo el código del proyecto en un solo archivo .txt
Excluye: .env, node_modules, __pycache__, dist, venv, .git, .db, y este mismo script.
El output también está en .gitignore.
"""

import os
from pathlib import Path

ROOT = Path(__file__).parent
OUTPUT = ROOT / "project_code.txt"

INCLUDE_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx",
    ".json", ".html", ".css", ".md", ".txt",
    ".toml", ".yaml", ".yml", ".sh",
}

EXCLUDE_DIRS = {
    "node_modules", "__pycache__", ".git", "dist",
    "venv", ".venv", ".vercel", ".vite", "build",
}

EXCLUDE_FILES = {
    ".env", ".env.local", ".env.production",
    "project_code.txt",  # el output mismo
    "export_code.py",    # este script
    "package-lock.json", # ruido innecesario
}


def should_exclude(path: Path) -> bool:
    # Excluir si alguna parte del path es un directorio excluido
    for part in path.parts:
        if part in EXCLUDE_DIRS:
            return True
    # Excluir por nombre de archivo
    if path.name in EXCLUDE_FILES:
        return True
    # Excluir archivos ocultos (empiezan con .)
    if path.name.startswith("."):
        return True
    return False


def collect_files() -> list[Path]:
    files = []
    for f in sorted(ROOT.rglob("*")):
        if not f.is_file():
            continue
        if should_exclude(f):
            continue
        if f.suffix.lower() not in INCLUDE_EXTENSIONS:
            continue
        files.append(f)
    return files


def main():
    files = collect_files()
    lines = []

    for f in files:
        relative = f.relative_to(ROOT)
        try:
            content = f.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            content = f"[Error leyendo archivo: {e}]"

        lines.append(f"=== {relative} ===")
        lines.append(content)
        lines.append("")

    output = "\n".join(lines)
    OUTPUT.write_text(output, encoding="utf-8")

    print(f"✓ {len(files)} archivos exportados → {OUTPUT.name}")


if __name__ == "__main__":
    main()
