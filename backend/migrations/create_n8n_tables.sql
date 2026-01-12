-- Tabla para registrar interacciones de WhatsApp desde n8n
CREATE TABLE IF NOT EXISTS whatsapp_interacciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telefono TEXT NOT NULL,
  paciente_id INTEGER,
  mensaje TEXT NOT NULL,
  tipo TEXT DEFAULT 'entrante', -- 'entrante' o 'saliente'
  metadata TEXT, -- JSON con datos adicionales
  fecha TEXT NOT NULL,
  creado_en DATETIME DEFAULT (datetime('now', '-5 hours')),
  FOREIGN KEY (paciente_id) REFERENCES patients(id)
);

-- Tabla para recordatorios automáticos
CREATE TABLE IF NOT EXISTS whatsapp_recordatorios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL,
  tipo TEXT NOT NULL, -- 'cita', 'pago', 'seguimiento'
  fecha_envio TEXT NOT NULL,
  mensaje TEXT,
  telefono TEXT,
  estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'enviado', 'fallido'
  enviado_en DATETIME,
  creado_en DATETIME DEFAULT (datetime('now', '-5 hours')),
  FOREIGN KEY (paciente_id) REFERENCES patients(id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_whatsapp_interacciones_telefono ON whatsapp_interacciones(telefono);
CREATE INDEX IF NOT EXISTS idx_whatsapp_interacciones_paciente ON whatsapp_interacciones(paciente_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_recordatorios_estado ON whatsapp_recordatorios(estado);
CREATE INDEX IF NOT EXISTS idx_whatsapp_recordatorios_fecha ON whatsapp_recordatorios(fecha_envio);
