"""
Helpers para el sistema de quincenas (períodos de 15 días fijos por mes).

Quincena A: días 1–15 del mes.
Quincena B: días 16–último del mes.

Clave de quincena: "YYYY-MMA" o "YYYY-MMB"
Ejemplos: "2026-10A", "2026-10B"
"""
import calendar
from datetime import date, timedelta


def quincena_key(d: date) -> str:
    """Devuelve la clave de quincena para la fecha dada."""
    half = "A" if d.day <= 15 else "B"
    return f"{d.year}-{d.month:02d}{half}"


def quincena_start(d: date) -> date:
    """Primer día de la quincena que contiene d."""
    if d.day <= 15:
        return date(d.year, d.month, 1)
    return date(d.year, d.month, 16)


def quincena_end(d: date) -> date:
    """Último día de la quincena que contiene d."""
    if d.day <= 15:
        return date(d.year, d.month, 15)
    last = calendar.monthrange(d.year, d.month)[1]
    return date(d.year, d.month, last)


def quincena_first_half_end(d: date) -> date:
    """
    Último día de la 'primera mitad' de la quincena (primeros 7 días del período),
    usado para evaluar si el usuario ganó el segundo comodín de hábito.

    Quincena A (1–15): primera mitad = días 1–7.
    Quincena B (16–fin): primera mitad = días 16–22.
    """
    start = quincena_start(d)
    return start + timedelta(days=6)  # 7 días: start … start+6
