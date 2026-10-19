import { useCallback, useState } from "react";

/**
 * Recuerda qué tarjetas están minimizadas (presupuestos, seguimientos…).
 *
 * Se guarda en el navegador por tipo de tarjeta, así al volver a abrir el
 * historial de un paciente sus presupuestos siguen como se dejaron. Es solo
 * una preferencia de vista: no toca ningún dato del paciente.
 *
 *   const [minimizados, alternar, fijarVarios] = useMinimizados("hc-min-ofertas");
 *   minimizados[id]            → true si está minimizada
 *   alternar(id)               → minimiza / expande una
 *   fijarVarios([ids], true)   → minimiza (o expande con false) varias a la vez
 */
export default function useMinimizados(clave) {
  const [minimizados, setMinimizados] = useState(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(clave) || "{}");
      return guardado && typeof guardado === "object" ? guardado : {};
    } catch {
      return {};
    }
  });

  const guardar = useCallback((siguiente) => {
    // Solo se guardan los minimizados, para que no crezca sin fin
    const limpio = Object.fromEntries(Object.entries(siguiente).filter(([, v]) => v));
    try { localStorage.setItem(clave, JSON.stringify(limpio)); } catch { /* modo privado */ }
    return limpio;
  }, [clave]);

  const alternar = useCallback((id) => {
    setMinimizados((prev) => guardar({ ...prev, [id]: !prev[id] }));
  }, [guardar]);

  const fijarVarios = useCallback((ids, valor) => {
    setMinimizados((prev) => {
      const siguiente = { ...prev };
      ids.forEach((id) => { siguiente[id] = valor; });
      return guardar(siguiente);
    });
  }, [guardar]);

  return [minimizados, alternar, fijarVarios];
}
