import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

// Single shared socket instance (singleton)
let socket = null;

function getSocket() {
  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });
  }
  return socket;
}

/**
 * Hook to listen for real-time data change events and trigger refetches.
 *
 * @param {string|string[]} events - Event name(s) to listen to, e.g. "pacientes:updated"
 * @param {Function} callback - Function to call when event fires (typically a refetch)
 * @param {boolean} [enabled=true] - Whether to listen (useful for conditional pages)
 *
 * Event names emitted by backend:
 *   "pacientes:updated"    - patient data, ofertas, treatments
 *   "paquetes:updated"     - presupuestos asignados, sessions
 *   "finanzas:updated"     - financial records, payments
 *   "tratamientos:updated" - treatment catalog
 *   "inventario:updated"   - inventory/stock
 *   "deudas:updated"       - debts/payments
 *   "especialistas:updated"
 *   "gestion:updated"
 *   "stats:updated"
 */
export default function useSocket(events, callback, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const s = getSocket();
    const eventList = Array.isArray(events) ? events : [events];

    const handler = () => {
      callbackRef.current();
    };

    eventList.forEach((ev) => s.on(ev, handler));

    return () => {
      eventList.forEach((ev) => s.off(ev, handler));
    };
  }, [events, enabled]);
}

export { getSocket };
