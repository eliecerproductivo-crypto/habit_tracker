path = r"app/routers/journal.py"
with open(path, "r", encoding="utf-8") as f:
    src = f.read()

idx = src.find("    # Racha actual (simplificada)")
end = src.find("\n\n    # Tasa de cumplimiento", idx)

new_streak = """    # Racha actual - misma logica que stats.py:
    # caminar hacia atras, solo contar dias donde TODOS los habitos activos
    # (que existian ese dia) estan done o skipped.
    habits_by_wd_chat: dict = {}
    for h in habits:
        for wd_str in h.days_of_week.split(","):
            wd_str = wd_str.strip()
            if wd_str.isdigit():
                wd_int = int(wd_str)
                habits_by_wd_chat.setdefault(wd_int, []).append(h)

    streak = 0
    cursor_d = today
    for _ in range(365):
        wd = cursor_d.isoweekday() % 7
        all_sched = habits_by_wd_chat.get(wd, [])
        sched = [h for h in all_sched if not (h.start_date and cursor_d < h.start_date)]
        if not sched:
            cursor_d -= timedelta(days=1)
            continue
        day_logs_map = {lg.habit_id: lg.status for lg in all_logs if lg.date == cursor_d}
        if all(day_logs_map.get(h.id) in ("done", "skipped") for h in sched):
            streak += 1
            cursor_d -= timedelta(days=1)
        else:
            break"""

src = src[:idx] + new_streak + src[end:]

with open(path, "w", encoding="utf-8") as f:
    f.write(src)
print("done journal.py streak fix")
print("simplificada remaining:", src.count("simplificada"))
