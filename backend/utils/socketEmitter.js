/**
 * Helper to emit Socket.IO events from route handlers.
 * Usage: emitChange(req, "event-name", { optional: "data" })
 */
export function emitChange(req, event, data = {}) {
  const io = req.app.get("io");
  if (io) {
    io.emit(event, { ...data, timestamp: Date.now() });
  }
}

// Map route prefixes to socket event names
const ROUTE_EVENT_MAP = {
  "/api/pacientes": "pacientes:updated",
  "/api/paquetes": "paquetes:updated",
  "/api/finanzas": "finanzas:updated",
  "/api/tratamientos": "tratamientos:updated",
  "/api/inventario": "inventario:updated",
  "/api/deudas": "deudas:updated",
  "/api/especialistas": "especialistas:updated",
  "/api/gestion-clinica": "gestion:updated",
  "/api/stats": "stats:updated",
};

/**
 * Middleware that auto-emits socket events after successful write ops.
 * Attach BEFORE route handlers: app.use(autoEmitMiddleware);
 */
export function autoEmitMiddleware(req, res, next) {
  if (req.method === "GET" || req.method === "OPTIONS" || req.method === "HEAD") {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const result = originalJson(body);

    // Only emit on success (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const io = req.app.get("io");
      if (io) {
        for (const [prefix, event] of Object.entries(ROUTE_EVENT_MAP)) {
          if (req.originalUrl.startsWith(prefix)) {
            io.emit(event, { timestamp: Date.now() });
            break;
          }
        }
      }
    }

    return result;
  };

  next();
}
