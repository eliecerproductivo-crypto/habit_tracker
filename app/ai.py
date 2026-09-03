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
from typing import Optional

logger = logging.getLogger(__name__)

# Lee todas las keys disponibles: OPENAI_API_KEY, OPENAI_API_KEY_2, OPENAI_API_KEY_3, ...
# Para agregar más, solo añade OPENAI_API_KEY_N en las variables de entorno.
def _load_api_keys() -> list[str]:
    keys = []
    # Key principal sin número
    k = os.getenv("OPENAI_API_KEY")
    if k:
        keys.append(k)
    # Keys numeradas a partir del 2 — busca hasta que no haya más
    i = 2
    while True:
        k = os.getenv(f"OPENAI_API_KEY_{i}")
        if not k:
            break
        keys.append(k)
        i += 1
    return keys

GEMINI_API_KEYS: list[str] = _load_api_keys()

MODEL = "gemini-3.1-flash-lite"        # modelo preview gratuito de Gemini 3.1
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

MAX_RETRIES = 3
RETRY_DELAY = 2


def _call_gemini(api_key: str, messages: list[dict], max_tokens: int = 500) -> str:
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

    url = f"{GEMINI_BASE}/{MODEL}:generateContent?key={api_key}"
    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
        return result["candidates"][0]["content"]["parts"][0]["text"].strip()


def _call_with_fallback(messages: list[dict], max_tokens: int = 500) -> Optional[str]:
    """Intenta con cada key disponible, con reintentos por key."""
    if not GEMINI_API_KEYS:
        logger.warning("No OPENAI_API_KEY (Gemini key) configured")
        return None

    for key_index, api_key in enumerate(GEMINI_API_KEYS):
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                logger.info("Gemini call attempt %d/%d with key #%d", attempt, MAX_RETRIES, key_index + 1)
                result = _call_gemini(api_key, messages, max_tokens)
                logger.info("Gemini call succeeded with key #%d on attempt %d", key_index + 1, attempt)
                return result
            except Exception as e:
                logger.warning("Key #%d attempt %d/%d failed: %s", key_index + 1, attempt, MAX_RETRIES, e)
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY)

    logger.error("All Gemini keys and retries exhausted")
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
                "Eres un extractor de contexto personal. Tu tarea es leer la autobiografía de un usuario "
                "y producir un perfil comprimido (máximo 150 palabras) en español en tercera persona. "
                "Extrae únicamente: nombre, objetivos de vida, áreas de interés, valores, estilo de vida. "
                "Elimina todo lo que no sea relevante para un coach personal. "
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
) -> Optional[str]:
    """
    Responde al usuario usando perfil personal, hábitos, estadísticas,
    notas recientes y resúmenes del diario como contexto.
    """
    # ── Perfil ────────────────────────────────────────────────────────────────
    bio_block = f"\n\nQUIÉN SOY (perfil del usuario):\n{bio_summary}" if bio_summary else ""

    # ── Hábitos ───────────────────────────────────────────────────────────────
    habits_block = f"\n\nHÁBITOS ACTIVOS:\n{habits_text}" if habits_text else ""

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

    # ── Notas recientes en texto completo (últimos 3 días) ────────────────────
    notes_block = ""
    if recent_notes:
        notes_text = "\n".join(recent_notes)
        notes_block = f"\n\nNOTAS RECIENTES DEL DIARIO (texto completo, últimos 3 días):\n{notes_text}"

    # ── Resúmenes históricos del diario ───────────────────────────────────────
    diary_block = (
        "\n\n".join(f"- {s}" for s in context_summaries)
        if context_summaries
        else "Sin resúmenes de diario aún."
    )

    system_prompt = (
        "Eres un coach personal de hábitos y productividad. "
        "Tu objetivo es ayudar al usuario a entender sus patrones, mejorar su rutina y superar bloqueos. "
        "Usa el contexto completo (perfil, hábitos, estadísticas, notas recientes y diario) "
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
        f"{bio_block}"
        f"{habits_block}"
        f"{stats_block}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history[-10:])
    messages.append({"role": "user", "content": user_message})

    return _call_with_fallback(messages, max_tokens=400)
