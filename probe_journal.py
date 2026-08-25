# Fix #9: journal.py - replace inline streak with start_date-aware version
path = r"app/routers/journal.py"
with open(path, "r", encoding="utf-8") as f:
    src = f.read()

idx = src.find("    # Racha actual (simplificada)")
end = src.find("\n\n    # Tasa de cumplimiento", idx)
old_streak = src[idx:end]
print("old streak block length:", len(old_streak))
print("found:", idx != -1, end != -1)
