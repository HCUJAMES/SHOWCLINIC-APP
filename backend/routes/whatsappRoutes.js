import express from "express";
import { dbRun, dbGet, dbAll } from "../db/database.js";
import { procesarMensajeConIA } from "../services/whatsappAI.js";
import { enviarMensajeWhatsApp } from "../services/whatsappAPI.js";

const router = express.Router();

/* ==============================
   🔐 WEBHOOK VERIFICATION (Meta)
============================== */
router.get("/webhook", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // Obtener token de verificación de la BD
  const config = await dbGet(
    `SELECT valor FROM whatsapp_config WHERE clave = 'webhook_verify_token'`
  );
  const verifyToken = config?.valor || "showclinic_webhook_2026";

  if (mode === "subscribe" && token === verifyToken) {
    console.log("✅ Webhook verificado correctamente");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Verificación de webhook fallida");
    res.sendStatus(403);
  }
});

/* ==============================
   📨 RECIBIR MENSAJES DE WHATSAPP
============================== */
router.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    // Verificar que sea una notificación de WhatsApp
    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }

    // Procesar cada entrada
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === "messages") {
          const value = change.value;

          // Procesar mensajes entrantes
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              await procesarMensajeEntrante(message, value.metadata);
            }
          }

          // Procesar estados de mensajes (entregado, leído, etc.)
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              await actualizarEstadoMensaje(status);
            }
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error en webhook:", error);
    res.sendStatus(500);
  }
});

/* ==============================
   📥 PROCESAR MENSAJE ENTRANTE
============================== */
async function procesarMensajeEntrante(message, metadata) {
  try {
    const telefono = message.from;
    const contenido = message.text?.body || "";
    const mensajeId = message.id;
    const nombreContacto = metadata?.contacts?.[0]?.profile?.name || "";

    console.log(`📨 Mensaje de ${telefono}: ${contenido}`);

    // Buscar o crear conversación
    let conversacion = await dbGet(
      `SELECT * FROM whatsapp_conversaciones WHERE telefono = ? AND estado = 'activa'`,
      [telefono]
    );

    if (!conversacion) {
      const result = await dbRun(
        `INSERT INTO whatsapp_conversaciones 
         (telefono, nombre, estado, calificacion_lead, ultima_interaccion, modo) 
         VALUES (?, ?, 'activa', 'frio', datetime('now', '-5 hours'), 'automatico')`,
        [telefono, nombreContacto]
      );
      conversacion = { id: result.lastID, telefono, nombre: nombreContacto, modo: "automatico" };
    } else {
      // Actualizar última interacción
      await dbRun(
        `UPDATE whatsapp_conversaciones 
         SET ultima_interaccion = datetime('now', '-5 hours'), nombre = COALESCE(?, nombre)
         WHERE id = ?`,
        [nombreContacto, conversacion.id]
      );
    }

    // Guardar mensaje entrante
    await dbRun(
      `INSERT INTO whatsapp_mensajes 
       (conversacion_id, tipo, contenido, enviado_por, mensaje_whatsapp_id) 
       VALUES (?, 'entrante', ?, 'paciente', ?)`,
      [conversacion.id, contenido, mensajeId]
    );

    // Verificar si está en modo automático
    const config = await dbGet(
      `SELECT valor FROM whatsapp_config WHERE clave = 'modo_automatico'`
    );
    const modoAutomatico = config?.valor === "1";

    if (modoAutomatico && conversacion.modo === "automatico") {
      // Procesar con IA
      const respuesta = await procesarMensajeConIA(conversacion.id, telefono, contenido);

      if (respuesta) {
        // Enviar respuesta
        await enviarMensajeWhatsApp(telefono, respuesta.mensaje);

        // Guardar mensaje saliente
        await dbRun(
          `INSERT INTO whatsapp_mensajes 
           (conversacion_id, tipo, contenido, enviado_por) 
           VALUES (?, 'saliente', ?, 'ia')`,
          [conversacion.id, respuesta.mensaje]
        );

        // Actualizar calificación del lead si cambió
        if (respuesta.calificacion) {
          await dbRun(
            `UPDATE whatsapp_conversaciones 
             SET calificacion_lead = ? 
             WHERE id = ?`,
            [respuesta.calificacion, conversacion.id]
          );

          // Si es lead caliente, crear o actualizar en tabla de leads
          if (respuesta.calificacion === "caliente") {
            await crearOActualizarLead(conversacion.id, telefono, respuesta);
          }
        }
      }
    }

    // Actualizar estadísticas
    await actualizarEstadisticas("mensaje_recibido");
  } catch (error) {
    console.error("❌ Error procesando mensaje:", error);
  }
}

/* ==============================
   🔄 ACTUALIZAR ESTADO DE MENSAJE
============================== */
async function actualizarEstadoMensaje(status) {
  try {
    const mensajeId = status.id;
    const estado = status.status; // sent, delivered, read, failed

    await dbRun(
      `UPDATE whatsapp_mensajes 
       SET estado = ? 
       WHERE mensaje_whatsapp_id = ?`,
      [estado, mensajeId]
    );
  } catch (error) {
    console.error("❌ Error actualizando estado:", error);
  }
}

/* ==============================
   🎯 CREAR O ACTUALIZAR LEAD
============================== */
async function crearOActualizarLead(conversacionId, telefono, datosIA) {
  try {
    const leadExistente = await dbGet(
      `SELECT * FROM whatsapp_leads WHERE conversacion_id = ?`,
      [conversacionId]
    );

    if (leadExistente) {
      // Actualizar lead existente
      await dbRun(
        `UPDATE whatsapp_leads 
         SET calificacion = ?, 
             notas_ia = ?,
             tratamiento_interes = COALESCE(?, tratamiento_interes),
             probabilidad_conversion = COALESCE(?, probabilidad_conversion),
             actualizado_en = datetime('now', '-5 hours')
         WHERE id = ?`,
        [
          datosIA.calificacion,
          datosIA.analisis || "",
          datosIA.tratamiento,
          datosIA.probabilidad,
          leadExistente.id,
        ]
      );
    } else {
      // Crear nuevo lead
      const conversacion = await dbGet(
        `SELECT nombre FROM whatsapp_conversaciones WHERE id = ?`,
        [conversacionId]
      );

      await dbRun(
        `INSERT INTO whatsapp_leads 
         (conversacion_id, telefono, nombre, calificacion, tratamiento_interes, 
          probabilidad_conversion, notas_ia, urgencia) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conversacionId,
          telefono,
          conversacion?.nombre || "",
          datosIA.calificacion,
          datosIA.tratamiento || "",
          datosIA.probabilidad || 50,
          datosIA.analisis || "",
          datosIA.urgencia || "media",
        ]
      );

      // Actualizar estadísticas
      await actualizarEstadisticas("lead_generado");
      if (datosIA.calificacion === "caliente") {
        await actualizarEstadisticas("lead_caliente");
      }
    }
  } catch (error) {
    console.error("❌ Error creando/actualizando lead:", error);
  }
}

/* ==============================
   📊 ACTUALIZAR ESTADÍSTICAS
============================== */
async function actualizarEstadisticas(tipo) {
  try {
    const hoy = new Date().toISOString().split("T")[0];

    const estadistica = await dbGet(
      `SELECT * FROM whatsapp_estadisticas WHERE fecha = ?`,
      [hoy]
    );

    if (estadistica) {
      let campo = "";
      switch (tipo) {
        case "conversacion_nueva":
          campo = "conversaciones_nuevas";
          break;
        case "mensaje_enviado":
          campo = "mensajes_enviados";
          break;
        case "mensaje_recibido":
          campo = "mensajes_recibidos";
          break;
        case "lead_generado":
          campo = "leads_generados";
          break;
        case "lead_caliente":
          campo = "leads_calientes";
          break;
        case "conversion":
          campo = "conversiones";
          break;
      }

      if (campo) {
        await dbRun(
          `UPDATE whatsapp_estadisticas SET ${campo} = ${campo} + 1 WHERE fecha = ?`,
          [hoy]
        );
      }
    } else {
      await dbRun(
        `INSERT INTO whatsapp_estadisticas (fecha, ${tipo === "conversacion_nueva" ? "conversaciones_nuevas" : tipo === "mensaje_enviado" ? "mensajes_enviados" : tipo === "mensaje_recibido" ? "mensajes_recibidos" : tipo === "lead_generado" ? "leads_generados" : tipo === "lead_caliente" ? "leads_calientes" : "conversiones"}) 
         VALUES (?, 1)`,
        [hoy]
      );
    }
  } catch (error) {
    console.error("❌ Error actualizando estadísticas:", error);
  }
}

/* ==============================
   📋 OBTENER CONVERSACIONES
============================== */
router.get("/conversaciones", async (req, res) => {
  try {
    const { estado, calificacion, limite = 50 } = req.query;

    let query = `
      SELECT c.*, 
             (SELECT COUNT(*) FROM whatsapp_mensajes WHERE conversacion_id = c.id) as total_mensajes,
             (SELECT contenido FROM whatsapp_mensajes WHERE conversacion_id = c.id ORDER BY creado_en DESC LIMIT 1) as ultimo_mensaje
      FROM whatsapp_conversaciones c
      WHERE 1=1
    `;
    const params = [];

    if (estado) {
      query += ` AND c.estado = ?`;
      params.push(estado);
    }

    if (calificacion) {
      query += ` AND c.calificacion_lead = ?`;
      params.push(calificacion);
    }

    query += ` ORDER BY c.ultima_interaccion DESC LIMIT ?`;
    params.push(Number(limite));

    const conversaciones = await dbAll(query, params);
    res.json(conversaciones);
  } catch (error) {
    console.error("❌ Error obteniendo conversaciones:", error);
    res.status(500).json({ message: "Error al obtener conversaciones" });
  }
});

/* ==============================
   💬 OBTENER MENSAJES DE CONVERSACIÓN
============================== */
router.get("/conversaciones/:id/mensajes", async (req, res) => {
  try {
    const { id } = req.params;

    const mensajes = await dbAll(
      `SELECT * FROM whatsapp_mensajes WHERE conversacion_id = ? ORDER BY creado_en ASC`,
      [id]
    );

    res.json(mensajes);
  } catch (error) {
    console.error("❌ Error obteniendo mensajes:", error);
    res.status(500).json({ message: "Error al obtener mensajes" });
  }
});

/* ==============================
   📤 ENVIAR MENSAJE MANUAL
============================== */
router.post("/enviar", async (req, res) => {
  try {
    const { conversacion_id, telefono, mensaje, usuario } = req.body;

    if (!telefono || !mensaje) {
      return res.status(400).json({ message: "Teléfono y mensaje son requeridos" });
    }

    // Enviar mensaje
    const resultado = await enviarMensajeWhatsApp(telefono, mensaje);

    if (resultado.success) {
      // Guardar mensaje
      await dbRun(
        `INSERT INTO whatsapp_mensajes 
         (conversacion_id, tipo, contenido, enviado_por, mensaje_whatsapp_id) 
         VALUES (?, 'saliente', ?, ?, ?)`,
        [conversacion_id, mensaje, usuario || "usuario", resultado.messageId]
      );

      // Actualizar conversación
      await dbRun(
        `UPDATE whatsapp_conversaciones 
         SET ultima_interaccion = datetime('now', '-5 hours') 
         WHERE id = ?`,
        [conversacion_id]
      );

      res.json({ success: true, messageId: resultado.messageId });
    } else {
      res.status(500).json({ success: false, error: resultado.error });
    }
  } catch (error) {
    console.error("❌ Error enviando mensaje:", error);
    res.status(500).json({ message: "Error al enviar mensaje" });
  }
});

/* ==============================
   🎯 OBTENER LEADS
============================== */
router.get("/leads", async (req, res) => {
  try {
    const { calificacion, estado } = req.query;

    let query = `SELECT * FROM whatsapp_leads WHERE 1=1`;
    const params = [];

    if (calificacion) {
      query += ` AND calificacion = ?`;
      params.push(calificacion);
    }

    if (estado) {
      query += ` AND estado = ?`;
      params.push(estado);
    }

    query += ` ORDER BY creado_en DESC`;

    const leads = await dbAll(query, params);
    res.json(leads);
  } catch (error) {
    console.error("❌ Error obteniendo leads:", error);
    res.status(500).json({ message: "Error al obtener leads" });
  }
});

/* ==============================
   ⚙️ OBTENER/ACTUALIZAR CONFIGURACIÓN
============================== */
router.get("/config", async (req, res) => {
  try {
    const config = await dbAll(`SELECT * FROM whatsapp_config`);
    const configObj = {};
    config.forEach((item) => {
      configObj[item.clave] = item.valor;
    });
    res.json(configObj);
  } catch (error) {
    console.error("❌ Error obteniendo configuración:", error);
    res.status(500).json({ message: "Error al obtener configuración" });
  }
});

router.put("/config", async (req, res) => {
  try {
    const configuraciones = req.body;

    for (const [clave, valor] of Object.entries(configuraciones)) {
      await dbRun(
        `INSERT OR REPLACE INTO whatsapp_config (clave, valor, actualizado_en) 
         VALUES (?, ?, datetime('now', '-5 hours'))`,
        [clave, valor]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error actualizando configuración:", error);
    res.status(500).json({ message: "Error al actualizar configuración" });
  }
});

/* ==============================
   📊 OBTENER ESTADÍSTICAS
============================== */
router.get("/estadisticas", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const hoy = new Date().toISOString().split("T")[0];

    let query = `SELECT * FROM whatsapp_estadisticas WHERE fecha >= ? AND fecha <= ? ORDER BY fecha DESC`;
    const params = [desde || hoy, hasta || hoy];

    const estadisticas = await dbAll(query, params);
    res.json(estadisticas);
  } catch (error) {
    console.error("❌ Error obteniendo estadísticas:", error);
    res.status(500).json({ message: "Error al obtener estadísticas" });
  }
});

export default router;
