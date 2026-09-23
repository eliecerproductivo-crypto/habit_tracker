#a
"""
Servicio de IA: resúmenes de diario y chat con contexto personal.
Usa Google Gemini API con fallback automático entre 2 keys y reintentos.
"""
import os
import time
import logging
import json
import urllib.request
import urllib.error
from typing import Optional

logger = logging.getLogger(__name__)

# Lee todas las keys disponibles: OPENAI_API_KEY, OPENAI_API_KEY_2, OPENAI_API_KEY_3, ...
# Para agregar más, solo añade OPENAI_API_KEY_N en las variables de entorno.
def _load_api_keys() -> list[str]:
    keys = []
    # Busca tanto GEMINI_API_KEY como OPENAI_API_KEY (y sus variantes numeradas)
    candidates = [
        "GEMINI_API_KEY", "OPENAI_API_KEY",
        "GEMINI_API_KEY_2", "OPENAI_API_KEY_2",
        "GEMINI_API_KEY_3", "OPENAI_API_KEY_3",
    ]
    seen = set()
    for env_var in candidates:
        val = os.getenv(env_var, "").strip()
        if val and val not in seen:
            keys.append(val)
            seen.add(val)

    # Buscar keys numeradas adicionales si existen (_4, _5, ...)
    for prefix in ("GEMINI_API_KEY_", "OPENAI_API_KEY_"):
        i = 4
        while True:
            val = os.getenv(f"{prefix}{i}", "").strip()
            if not val:
                break
            if val not in seen:
                keys.append(val)
                seen.add(val)
            i += 1
    return keys

MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest"]
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

MAX_RETRIES = 2
RETRY_DELAY = 1


def _call_gemini(api_key: str, messages: list[dict], max_tokens: int = 500, model_name: str = "gemini-3.8-flash") -> str:
    """
    Llama a la API de Gemini.
    Convierte el formato OpenAI-style (role/content) al formato Gemini (parts).
    """
    # Separar system prompt del resto
    system_text = None
    conversation = []
    for m in messages:
        if m["role"] == "system":
            system_text = m["content"]
        else:
            # Gemini usa "user" y "model" en vez de "user" y "assistant"
            role = "model" if m["role"] == "assistant" else "user"
            conversation.append({"role": role, "parts": [{"text": m["content"]}]})

    payload: dict = {
        "contents": conversation,
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": 0.7,
        },
    }
    if system_text:
        payload["systemInstruction"] = {"parts": [{"text": system_text}]}

    url = f"{GEMINI_BASE}/{model_name}:generateContent?key={api_key}"
    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            result = json.loads(resp.read())
            return result["candidates"][0]["content"]["parts"][0]["text"].strip()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        e.response_body = body
        logger.error("Gemini HTTP %s on model %s — body: %s", e.code, model_name, body)
        raise


def _call_with_fallback(messages: list[dict], max_tokens: int = 500) -> Optional[str]:
    """Intenta con cada key disponible y modelos en orden de prioridad (3.8 -> 3.5 -> 2.5).
    Si un modelo reporta alta demanda (503) o límite (429), salta inmediatamente
    al siguiente modelo de menor demanda sin reintentos innecesarios.
    """
    api_keys = _load_api_keys()
    if not api_keys:
        logger.warning("No GEMINI_API_KEY or OPENAI_API_KEY configured in environment")
        return None

    for key_index, api_key in enumerate(api_keys):
        logger.info("Trying key #%d (starts: %s...)", key_index + 1, api_key[:8])
        for model_name in MODELS:
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    logger.info("Gemini call attempt %d/%d with model %s and key #%d", attempt, MAX_RETRIES, model_name, key_index + 1)
                    result = _call_gemini(api_key, messages, max_tokens, model_name=model_name)
                    logger.info("Gemini call succeeded with model %s on attempt %d", model_name, attempt)
                    return result
                except urllib.error.HTTPError as e:
                    body = getattr(e, "response_body", "")
                    # Si la key es inválida, cambiar a la siguiente key
                    if e.code in (401, 403) or "API_KEY_INVALID" in body:
                        logger.warning("Key #%d rejected (HTTP %s), skipping to next key", key_index + 1, e.code)
                        break
                    # Si el modelo tiene alta demanda (503), saturación (429) o no disponible (404),
                    # pasar inmediatamente al siguiente modelo (ej. de 3.8 a 3.5)
                    if e.code in (503, 429, 404) or "high demand" in body.lower():
                        logger.warning("Model %s high demand/unavailable (HTTP %s), falling back to next model", model_name, e.code)
                        break
                    logger.warning("Model %s attempt %d/%d failed: %s", model_name, attempt, MAX_RETRIES, e)
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)
                except Exception as e:
                    logger.warning("Model %s attempt %d/%d failed (exception): %s", model_name, attempt, MAX_RETRIES, e)
                    # En timeouts de conexión de socket, saltar al siguiente modelo
                    if "timed out" in str(e).lower():
                        logger.warning("Model %s timed out, skipping to next model", model_name)
                        break
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)

    logger.error("All Gemini keys and models exhausted")
    return None


def summarize_bio(bio_text: str) -> Optional[str]:
    """
    Extrae un perfil de contexto comprimido de la bio del usuario.
    Elimina relleno y deja solo lo útil para la IA coach.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "Eres un extractor de contexto personal. Tu tarea es leer la autobiografía de un usuario y producir un perfil comprimido en español en tercera persona."
                "Extrae únicamente campos importantes: nombre, objetivos de vida, áreas de interés, valores, estilo de vida, etc."
                "Elimina todo lo que no sea relevante para un coach personal (no dejar data importante afuera)"
                "Sé concreto y neutro. No agregues opiniones ni consejos."
            ),
        },
        {"role": "user", "content": bio_text},
    ]
    return _call_with_fallback(messages, max_tokens=250)


def summarize_entries(entries_text: str) -> Optional[str]:
    """Resume una entrada de diario. Retorna el resumen o None si falla."""
    messages = [
        {
            "role": "system",
            "content": (
                "Resume esta entrada de diario en español lo más breve posible. "
                "Incluye solo: estado emocional, qué hizo o no hizo, y algún patrón notable. "
                "Elimina todo relleno. Cuantas menos palabras necesites para transmitir lo esencial, mejor."
            ),
        },
        {"role": "user", "content": entries_text},
    ]
    return _call_with_fallback(messages, max_tokens=120)


def chat_with_context(
    user_message: str,
    context_summaries: list[str],
    history: list[dict],
    habits_text: str = "",
    stats: dict | None = None,
    bio_summary: str | None = None,
    recent_notes: list[str] | None = None,
    habit_notes: list[str] | None = None,
    timer_summary: str | None = None,
) -> Optional[str]:
    """
    Responde al usuario usando perfil personal, hábitos, estadísticas,
    sesiones de enfoque (timer), notas recientes, notas de hábitos y resúmenes del diario como contexto.
    """
    # ── Perfil ────────────────────────────────────────────────────────────────
    bio_block = f"\n\nQUIÉN SOY (perfil del usuario):\n{bio_summary}" if bio_summary else ""

    # ── Hábitos ───────────────────────────────────────────────────────────────
    habits_block = f"\n\nHÁBITOS ACTIVOS:\n{habits_text}" if habits_text else ""

    # ── Tiempo de enfoque (Timer / Pomodoro) ───────────────────────────────────
    timer_block = f"\n\nTIEMPO DEDICADO Y ENFOQUE:\n{timer_summary}" if timer_summary else ""

    # ── Estadísticas ──────────────────────────────────────────────────────────
    stats_block = ""
    if stats:
        nota = stats.get("nota_temporal")
        nota_line = f"\n  ⚠ {nota}" if nota else ""
        dias_en_app = stats.get("dias_en_app")
        dias_line = f"\n  • Días en la app: {dias_en_app}" if dias_en_app is not None else ""
        stats_block = (
            f"\n\nESTADÍSTICAS:"
            f"{dias_line}\n"
            f"  • Racha actual: {stats.get('racha_actual', 0)} días\n"
            f"  • Mejor racha: {stats.get('mejor_racha', 0)} días\n"
            f"  • Cumplimiento esta semana: {stats.get('cumplimiento_semana', '0%')}\n"
            f"  • Hábitos activos: {stats.get('habitos_activos', 0)}\n"
            f"  • Total completados (histórico): {stats.get('total_completados_historico', 0)}"
            f"{nota_line}"
        )

    # ── Notas recientes del diario general en texto completo ──────────────────
    notes_block = ""
    if recent_notes:
        notes_text = "\n".join(recent_notes)
        notes_block = f"\n\nNOTAS RECIENTES DEL DIARIO GENERAL:\n{notes_text}"

    # ── Notas y estado de ánimo específicos de cada hábito ────────────────────
    habit_notes_block = ""
    if habit_notes:
        habit_notes_text = "\n".join(habit_notes)
        habit_notes_block = f"\n\nSENSACIONES Y NOTAS AL REGISTRAR HÁBITOS (últimos días):\n{habit_notes_text}"

    # ── Resúmenes históricos del diario ───────────────────────────────────────
    diary_block = (
        "\n\n".join(f"- {s}" for s in context_summaries)
        if context_summaries
        else "Sin resúmenes de diario aún."
    )

    system_prompt = (
        "Eres un coach personal de hábitos y productividad. "
        "Tu objetivo es ayudar al usuario a entender sus patrones, mejorar su rutina y superar bloqueos. "
        "Usa el contexto completo (perfil, hábitos, estadísticas, tiempo de enfoque, notas recientes, sensaciones de hábitos y diario) "
        "para dar respuestas personalizadas y concretas. "
        "Responde siempre en español, de forma empática pero directa. "
        "Sé conciso: cada palabra debe aportar valor. Elimina relleno, repeticiones y frases obvias. "
        "Si la respuesta puede ser corta sin perder sustancia, que sea corta. "
        "Si necesita más detalle, dalo, pero sin paja. "
        "Texto plano, sin markdown, sin asteriscos, sin almohadillas, sin viñetas. Párrafos normales. "
        "IMPORTANTE sobre las notas y diario: Son antecedentes de momentos específicos pasados. "
        "NO asumas que un malestar, desánimo o problema de días previos sigue activo hoy a menos que el usuario "
        "lo mencione directamente en su mensaje actual. Si el usuario saluda o pregunta algo nuevo, responde al presente "
        "sin revivir problemas pasados a menos que sean directamente relevantes a su pregunta. "
        "IMPORTANTE: si las estadísticas incluyen una nota temporal (usuario nuevo), "
        "NO uses el porcentaje de cumplimiento para hacer juicios negativos — "
        "es demasiado pronto para evaluar tendencias.\n\n"
        f"RESÚMENES DEL DIARIO (contexto histórico):\n{diary_block}"
        f"{notes_block}"
        f"{habit_notes_block}"
        f"{bio_block}"
        f"{habits_block}"
        f"{timer_block}"
        f"{stats_block}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history[-10:])
    messages.append({"role": "user", "content": user_message})

    return _call_with_fallback(messages, max_tokens=400)
