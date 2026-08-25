path = r"frontend/src/hooks/useNotifications.js"
with open(path, "r", encoding="utf-8") as f:
    src = f.read()

# Fix import
src = src.replace(
    "import { parseDays, toMinutes } from \"../lib/schedule\";",
    "import { habitOccursOnDate, toLocalISODate, toMinutes } from \"../lib/schedule\";"
)

# Replace day variable with isoDate
src = src.replace(
    "      const now = new Date();\n      const day = now.getDay();",
    "      const now = new Date();\n      const isoDate = toLocalISODate(now);"
)

# Replace filter condition
src = src.replace(
    "        if (!parseDays(habit.days_of_week).includes(day)) return;",
    "        if (!habitOccursOnDate(habit, isoDate)) return;"
)

with open(path, "w", encoding="utf-8") as f:
    f.write(src)
print("done")
print("parseDays remaining:", src.count("parseDays"))
print("habitOccursOnDate:", src.count("habitOccursOnDate"))
