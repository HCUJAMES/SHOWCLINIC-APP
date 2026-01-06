-- ============================================
-- TABLAS PARA WHATSAPP + IA
-- ============================================

-- Tabla de conversaciones de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_conversaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telefono TEXT NOT NULL,
  nombre TEXT,
  paciente_id INTEGER,
  estado TEXT NOT NULL DEFAULT 'activa', -- activa, cerrada, transferida
  calificacion_lead TEXT DEFAULT 'frio', -- frio, tibio, caliente
  ultima_interaccion TEXT,
  modo TEXT NOT NULL DEFAULT 'automatico', -- automatico, manual
  asignado_a TEXT,
  notas TEXT,
  creado_en TEXT DEFAULT (datetime('now', '-5 hours')),
  actualizado_en TEXT DEFAULT (datetime('now', '-5 hours')),
  FOREIGN KEY(paciente_id) REFERENCES patients(id)
);

-- Tabla de mensajes de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversacion_id INTEGER NOT NULL,
  tipo TEXT NOT NULL, -- entrante, saliente
  contenido TEXT NOT NULL,
  enviado_por TEXT DEFAULT 'ia', -- ia, usuario, paciente
  mensaje_whatsapp_id TEXT,
  estado TEXT DEFAULT 'enviado', -- enviado, entregado, leido, fallido
  metadata TEXT, -- JSON con info adicional
  creado_en TEXT DEFAULT (datetime('now', '-5 hours')),
  FOREIGN KEY(conversacion_id) REFERENCES whatsapp_conversaciones(id)
);

-- Tabla de leads calificados
CREATE TABLE IF NOT EXISTS whatsapp_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversacion_id INTEGER NOT NULL,
  telefono TEXT NOT NULL,
  nombre TEXT,
  tratamiento_interes TEXT,
  presupuesto_estimado REAL,
  calificacion TEXT NOT NULL, -- frio, tibio, caliente
  urgencia TEXT, -- baja, media, alta
  probabilidad_conversion INTEGER, -- 0-100
  notas_ia TEXT, -- Análisis de la IA
  estado TEXT DEFAULT 'nuevo', -- nuevo, contactado, agendado, convertido, perdido
  fecha_seguimiento TEXT,
  asignado_a TEXT,
  creado_en TEXT DEFAULT (datetime('now', '-5 hours')),
  actualizado_en TEXT DEFAULT (datetime('now', '-5 hours')),
  FOREIGN KEY(conversacion_id) REFERENCES whatsapp_conversaciones(id)
);

-- Tabla de configuración de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clave TEXT UNIQUE NOT NULL,
  valor TEXT,
  descripcion TEXT,
  actualizado_en TEXT DEFAULT (datetime('now', '-5 hours'))
);

-- Tabla de plantillas de respuesta
CREATE TABLE IF NOT EXISTS whatsapp_plantillas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  categoria TEXT, -- saludo, informacion, agendamiento, despedida
  contenido TEXT NOT NULL,
  activo INTEGER DEFAULT 1,
  creado_en TEXT DEFAULT (datetime('now', '-5 hours'))
);

-- Tabla de estadísticas
CREATE TABLE IF NOT EXISTS whatsapp_estadisticas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  conversaciones_nuevas INTEGER DEFAULT 0,
  mensajes_enviados INTEGER DEFAULT 0,
  mensajes_recibidos INTEGER DEFAULT 0,
  leads_generados INTEGER DEFAULT 0,
  leads_calientes INTEGER DEFAULT 0,
  conversiones INTEGER DEFAULT 0,
  tiempo_respuesta_promedio REAL, -- en segundos
  creado_en TEXT DEFAULT (datetime('now', '-5 hours'))
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_conversaciones_telefono ON whatsapp_conversaciones(telefono);
CREATE INDEX IF NOT EXISTS idx_conversaciones_estado ON whatsapp_conversaciones(estado);
CREATE INDEX IF NOT EXISTS idx_conversaciones_calificacion ON whatsapp_conversaciones(calificacion_lead);
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion ON whatsapp_mensajes(conversacion_id);
CREATE INDEX IF NOT EXISTS idx_leads_calificacion ON whatsapp_leads(calificacion);
CREATE INDEX IF NOT EXISTS idx_leads_estado ON whatsapp_leads(estado);

-- Insertar configuración inicial
INSERT OR IGNORE INTO whatsapp_config (clave, valor, descripcion) VALUES
  ('phone_number_id', '', 'ID del número de WhatsApp Business'),
  ('access_token', '', 'Token de acceso de Meta'),
  ('webhook_verify_token', 'showclinic_webhook_2026', 'Token de verificación del webhook'),
  ('openai_api_key', '', 'API Key de OpenAI'),
  ('openai_model', 'gpt-4-turbo-preview', 'Modelo de OpenAI a usar'),
  ('modo_automatico', '1', 'Activar respuestas automáticas (1=sí, 0=no)'),
  ('horario_atencion_inicio', '09:00', 'Hora de inicio de atención'),
  ('horario_atencion_fin', '19:00', 'Hora de fin de atención'),
  ('mensaje_fuera_horario', 'Gracias por contactarnos. Nuestro horario de atención es de lunes a viernes de 9:00 AM a 7:00 PM. Te responderemos a la brevedad.', 'Mensaje automático fuera de horario');

-- Insertar plantillas iniciales
INSERT OR IGNORE INTO whatsapp_plantillas (nombre, categoria, contenido) VALUES
  ('saludo_inicial', 'saludo', '¡Hola! 👋 Gracias por contactar a {nombre_clinica}. Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?'),
  ('info_tratamientos', 'informacion', 'Ofrecemos diversos tratamientos de estética facial. ¿Te interesa alguno en particular? Puedo darte información sobre precios y disponibilidad.'),
  ('agendar_cita', 'agendamiento', 'Perfecto, me gustaría agendarte una consulta. ¿Qué día y horario te viene mejor?'),
  ('despedida', 'despedida', 'Gracias por contactarnos. Si tienes más preguntas, no dudes en escribirnos. ¡Que tengas un excelente día! 😊');
