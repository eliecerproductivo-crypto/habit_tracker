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

MODELS = ["gemini-3.8-flash", "gemini-3.5-flash"]
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# Timeout por modelo: los modelos primarios con alta demanda fallan rápido,
# los fallbacks tienen más tiempo para responder.
_MODEL_TIMEOUT = {
    "gemini-3.8-flash": 8,   # si tarda más de 5s en alta demanda, no vale la pena esperar
    "gemini-3.5-flash": 28,
}
MAX_RETRIES = 2
RETRY_DELAY = 1


def _call_gemini(api_key: str, messages: list[dict], max_tokens: int = 500, model_name: str = "gemini-3.8-flash", timeout: int = 20) -> str:
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
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            result = json.loads(resp.read())
            return result["candidates"][0]["content"]["parts"][0]["text"].strip()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        e.response_body = body
        logger.error("Gemini HTTP %s on model %s — body: %s", e.code, model_name, body)
        raise


def _call_with_fallback(messages: list[dict], max_tokens: int = 500) -> Optional[str]:
    """
    Intenta con cada modelo en orden (3.8 → 3.5 → fallback).
    Si un modelo reporta high demand o 503/429, se descarta GLOBALMENTE para
    todas las keys — no tiene sentido reintentar el mismo modelo sobrecargado
    con otra key. Cambia al siguiente modelo inmediatamente.
    Si la key es inválida (401/403), descarta esa key y prueba las restantes.
    """
    api_keys = _load_api_keys()
    if not api_keys:
        logger.warning("No GEMINI_API_KEY or OPENAI_API_KEY configured in environment")
        return None

    exhausted_models: set[str] = set()   # modelos descartados globalmente

    for model_name in MODELS:
        if model_name in exhausted_models:
            continue

        for key_index, api_key in enumerate(api_keys):
            logger.info("Trying model %s with key #%d (starts: %s...)", model_name, key_index + 1, api_key[:8])

            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    model_timeout = _MODEL_TIMEOUT.get(model_name, 20)
                    logger.info("Gemini call attempt %d/%d — model %s key #%d timeout %ds", attempt, MAX_RETRIES, model_name, key_index + 1, model_timeout)
                    result = _call_gemini(api_key, messages, max_tokens, model_name=model_name, timeout=model_timeout)
                    logger.info("Gemini call succeeded — model %s key #%d attempt %d", model_name, key_index + 1, attempt)
                    return result

                except urllib.error.HTTPError as e:
                    body = getattr(e, "response_body", "")

                    # Key inválida → saltar a la siguiente key, pero seguir con este modelo
                    if e.code in (401, 403) or "API_KEY_INVALID" in body:
                        logger.warning("Key #%d rejected (HTTP %s), trying next key", key_index + 1, e.code)
                        break  # sale del loop de attempts → próxima key

                    # Modelo sobrecargado o no disponible → descartarlo para todas las keys
                    if e.code in (503, 429, 404) or "high demand" in body.lower() or "service_unavailable" in body.lower():
                        logger.warning(
                            "Model %s unavailable (HTTP %s) — marking as exhausted globally, falling back to next model",
                            model_name, e.code,
                        )
                        exhausted_models.add(model_name)
                        break  # sale de attempts Y de keys (el for-key se rompe abajo)

                    # Error genérico → reintentar
                    logger.warning("Model %s key #%d attempt %d/%d failed: HTTP %s", model_name, key_index + 1, attempt, MAX_RETRIES, e.code)
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)

                except Exception as e:
                    logger.warning("Model %s key #%d attempt %d/%d exception: %s", model_name, key_index + 1, attempt, MAX_RETRIES, e)
                    if "timed out" in str(e).lower():
                        logger.warning("Model %s timed out — marking as exhausted globally", model_name)
                        exhausted_models.add(model_name)
                        break
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)

            # Si el modelo fue marcado como agotado, salir también del loop de keys
            if model_name in exhausted_models:
                break

    logger.error("All Gemini models exhausted: %s", exhausted_models)
    return None


def extract_insights(conversation: list[dict], existing_insights: dict) -> Optional[dict]:
    """
    Analiza una conversación con el coach y extrae datos personales del usuario.
    Recibe los insights ya guardados y devuelve un dict ACTUALIZADO (merge inteligente,
    sin duplicados). Retorna None si la IA falla.

    Categorías:
      - desires:     cosas que quiere comprar, obtener o experimentar
      - goals:       metas y objetivos personales o profesionales
      - worries:     preocupaciones, miedos o fuentes de estrés
      - facts:       datos concretos sobre su vida (familia, trabajo, ciudad, edad, etc.)
      - preferences: cómo aprende, trabaja, se siente mejor, horarios, etc.)
    """
    existing_json = json.dumps(existing_insights, ensure_ascii=False)

    # Formatear la conversación para el prompt
    convo_lines = []
    for m in conversation:
        role_label = "Usuario" if m["role"] == "user" else "Coach"
        convo_lines.append(f"{role_label}: {m['content']}")
    convo_text = "\n".join(convo_lines)

    messages = [
        {
            "role": "system",
            "content": (
                "Eres un extractor de información personal. Tu tarea es analizar una conversación "
                "entre un usuario y su coach de hábitos, y actualizar un perfil de conocimiento sobre el usuario.\n\n"
                "CATEGORÍAS a extraer (solo si hay evidencia clara en la conversación):\n"
                "  - desires: cosas que quiere comprar, obtener o experimentar (ej: 'quiere un monitor ultrawide')\n"
                "  - goals: metas y objetivos personales o profesionales (ej: 'quiere cambiar de trabajo en 2025')\n"
                "  - worries: preocupaciones, miedos o fuentes de estrés (ej: 'le preocupa no dormir bien')\n"
                "  - facts: datos concretos de su vida (ej: 'trabaja desde casa', 'tiene dos hijos', '28 años')\n"
                "  - preferences: cómo aprende, trabaja o se siente mejor (ej: 'le cuesta madrugar')\n\n"
                "REGLAS ESTRICTAS:\n"
                "1. Devuelve ÚNICAMENTE un JSON válido con esas 5 claves. Sin texto extra, sin markdown.\n"
                "2. Cada valor es una lista de strings en español, concisos y en tercera persona.\n"
                "3. Mergea con los insights existentes: conserva todo lo anterior y agrega solo lo NUEVO.\n"
                "4. Elimina duplicados exactos o semánticamente equivalentes.\n"
                "5. Si la conversación no aporta nada nuevo, devuelve los insights existentes sin cambios.\n"
                "6. NO inventes ni inferas nada que el usuario no haya dicho explícitamente.\n\n"
                f"INSIGHTS EXISTENTES:\n{existing_json}"
            ),
        },
        {
            "role": "user",
            "content": f"CONVERSACIÓN:\n{convo_text}",
        },
    ]

    raw = _call_with_fallback(messages, max_tokens=600)
    if not raw:
        return None

    # Limpiar posible markdown que Gemini a veces agrega igual
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.split("```")[1]
        if clean.startswith("json"):
            clean = clean[4:]
        clean = clean.strip()

    try:
        result = json.loads(clean)
        # Garantizar que todas las claves existan aunque la IA omita alguna
        for key in ("desires", "goals", "worries", "facts", "preferences"):
            if key not in result or not isinstance(result[key], list):
                result[key] = existing_insights.get(key, [])
        return result
    except json.JSONDecodeError:
        logger.error("extract_insights: JSON inválido recibido: %s", clean[:200])
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
    user_insights: dict | None = None,
) -> Optional[str]:
    """
    Responde al usuario usando perfil personal, hábitos, estadísticas,
    sesiones de enfoque (timer), notas recientes, notas de hábitos y resúmenes del diario como contexto.
    """
    # ── Perfil ────────────────────────────────────────────────────────────────
    bio_block = f"\n\nQUIÉN SOY (perfil del usuario):\n{bio_summary}" if bio_summary else ""

    # ── Insights acumulados del coach ─────────────────────────────────────────
    insights_block = ""
    if user_insights:
        lines = []
        labels = {
            "desires":     "Deseos/compras",
            "goals":       "Metas y objetivos",
            "worries":     "Preocupaciones",
            "facts":       "Datos personales",
            "preferences": "Preferencias",
        }
        for key, label in labels.items():
            items = user_insights.get(key, [])
            if items:
                lines.append(f"  {label}: {'; '.join(items)}")
        if lines:
            insights_block = "\n\nLO QUE SÉ DE TI (insights acumulados):\n" + "\n".join(lines)

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
        f"{insights_block}"
        f"{habits_block}"
        f"{timer_block}"
        f"{stats_block}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)  # el frontend ya limita a los últimos N mensajes
    messages.append({"role": "user", "content": user_message})

    return _call_with_fallback(messages, max_tokens=400)
