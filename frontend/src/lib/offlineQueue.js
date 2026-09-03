/**
 * Cola de sincronización offline para logs de hábitos.
 *
 * Cuando el usuario marca un hábito sin conexión:
 *   1. La acción se guarda en IndexedDB (enqueueLog).
 *   2. Al recuperar la conexión, syncOfflineQueue() envía todas las
 *      acciones pendientes al backend.
 *
 * También maneja eliminaciones pendientes (deleteLog).
 */

import { get, set } from 'idb-keyval';
import api from '../api/client';

const QUEUE_KEY = 'rutina_pending_logs_queue';

/**
 * Agrega una acción de log a la cola local.
 * @param {{ type: 'upsert'|'delete', payload: object }} action
 */
export async function enqueueLog(action) {
  const queue = (await get(QUEUE_KEY)) || [];
  // Deduplicar: si ya hay una acción para el mismo habit_id + date, la reemplaza
  if (action.type === 'upsert') {
    const idx = queue.findIndex(
      (a) =>
        a.type === 'upsert' &&
        a.payload.habit_id === action.payload.habit_id &&
        a.payload.date === action.payload.date
    );
    if (idx !== -1) {
      queue[idx] = action;
    } else {
      queue.push(action);
    }
  } else {
    queue.push(action);
  }
  await set(QUEUE_KEY, queue);
}

/**
 * Devuelve la cantidad de acciones pendientes en la cola.
 */
export async function getPendingCount() {
  const queue = (await get(QUEUE_KEY)) || [];
  return queue.length;
}

/**
 * Envía todas las acciones pendientes al servidor.
 * Las que fallen por red se mantienen en la cola.
 * Las que fallen por error de servidor (4xx) se descartan para no bloquear.
 */
export async function syncOfflineQueue() {
  const queue = (await get(QUEUE_KEY)) || [];
  if (queue.length === 0) return;

  const remaining = [];

  for (const action of queue) {
    try {
      if (action.type === 'upsert') {
        await api.post('/logs', action.payload);
      } else if (action.type === 'delete') {
        await api.delete(`/logs/${action.payload.log_id}`);
      }
      // Éxito → no se conserva en remaining
    } catch (err) {
      const isNetworkError =
        !err.response || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED';
      if (isNetworkError) {
        // Sigue sin red → conservar para el siguiente intento
        remaining.push(action);
      }
      // Error 4xx/5xx → descartar (dato inválido o conflicto, no reintentable)
    }
  }

  await set(QUEUE_KEY, remaining);
  return remaining.length; // cuántas siguen pendientes
}

// Sincronizar automáticamente al recuperar la conexión
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOfflineQueue();
  });
}
