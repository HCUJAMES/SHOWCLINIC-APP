import express from "express";
import { dbRun, dbGet, dbAll } from "../db/database.js";

const router = express.Router();

// Función para obtener fecha/hora de Perú (GMT-5)
const fechaLima = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).replace("T", " ").slice(0, 19);

/* ==============================
   🔍 BUSCAR PACIENTE POR TELÉFONO
   Para que n8n identifique al paciente
============================== */
router.get("/paciente/buscar", async (req, res) => {
  try {
    const { telefono } = req.query;

    if (!telefono) {
      return res.status(400).json({ message: "Teléfono es requerido" });
    }

    // Limpiar teléfono (quitar espacios, guiones, etc.)
    const telefonoLimpio = telefono.replace(/\D/g, "");

    const paciente = await dbGet(
      `SELECT id, nombre, apellido, dni, telefono, email, fecha_nacimiento, edad, sexo, ocupacion
       FROM patients 
       WHERE REPLACE(REPLACE(REPLACE(telefono, ' ', ''), '-', ''), '+', '') LIKE ?`,
      [`%${telefonoLimpio}%`]
    );

    if (paciente) {
      res.json({
        encontrado: true,
        paciente: {
          id: paciente.id,
          nombre_completo: `${paciente.nombre} ${paciente.apellido}`,
          nombre: paciente.nombre,
          apellido: paciente.apellido,
          dni: paciente.dni,
          telefono: paciente.telefono,
          email: paciente.email,
          edad: paciente.edad,
          sexo: paciente.sexo,
          ocupacion: paciente.ocupacion,
        },
      });
    } else {
      res.json({
        encontrado: false,
        mensaje: "Paciente no registrado en el sistema",
      });
    }
  } catch (error) {
    console.error("❌ Error buscando paciente:", error);
    res.status(500).json({ message: "Error al buscar paciente" });
  }
});

/* ==============================
   📅 OBTENER PRÓXIMAS CITAS DEL PACIENTE
   Para recordatorios automáticos
============================== */
router.get("/paciente/:id/citas", async (req, res) => {
  try {
    const { id } = req.params;
    const { proximas = "true" } = req.query;

    let query = `
      SELECT 
        c.id,
        c.fecha,
        c.hora,
        c.estado,
        c.notas,
        t.nombre as tratamiento,
        e.nombre as especialista
      FROM citas c
      LEFT JOIN tratamientos t ON t.id = c.tratamiento_id
      LEFT JOIN especialistas e ON e.id = c.especialista_id
      WHERE c.paciente_id = ?
    `;

    if (proximas === "true") {
      query += ` AND datetime(c.fecha || ' ' || c.hora) >= datetime('now', '-5 hours')`;
    }

    query += ` ORDER BY c.fecha ASC, c.hora ASC LIMIT 5`;

    const citas = await dbAll(query, [id]);

    res.json({
      paciente_id: id,
      total_citas: citas.length,
      citas: citas.map((c) => ({
        id: c.id,
        fecha: c.fecha,
        hora: c.hora,
        estado: c.estado,
        tratamiento: c.tratamiento || "No especificado",
        especialista: c.especialista || "No asignado",
        notas: c.notas,
      })),
    });
  } catch (error) {
    console.error("❌ Error obteniendo citas:", error);
    res.status(500).json({ message: "Error al obtener citas" });
  }
});

/* ==============================
   💰 OBTENER DEUDAS DEL PACIENTE
   Para recordatorios de pago
============================== */
router.get("/paciente/:id/deudas", async (req, res) => {
  try {
    const { id } = req.params;

    const deudas = await dbAll(
      `SELECT 
        d.id,
        d.monto_adelanto,
        d.monto_saldo,
        d.estado,
        t.nombre as tratamiento,
        tr.fecha as fecha_tratamiento,
        tr.precio_total
      FROM deudas_tratamientos d
      JOIN tratamientos_realizados tr ON tr.id = d.tratamiento_realizado_id
      JOIN tratamientos t ON t.id = tr.tratamiento_id
      WHERE tr.paciente_id = ? AND d.estado = 'pendiente'
      ORDER BY tr.fecha DESC`,
      [id]
    );

    const total_deuda = deudas.reduce((sum, d) => sum + (parseFloat(d.monto_saldo) || 0), 0);

    res.json({
      paciente_id: id,
      tiene_deudas: deudas.length > 0,
      total_deuda: total_deuda.toFixed(2),
      cantidad_deudas: deudas.length,
      deudas: deudas.map((d) => ({
        id: d.id,
        tratamiento: d.tratamiento,
        fecha_tratamiento: d.fecha_tratamiento,
        precio_total: d.precio_total,
        adelanto: d.monto_adelanto,
        saldo_pendiente: d.monto_saldo,
      })),
    });
  } catch (error) {
    console.error("❌ Error obteniendo deudas:", error);
    res.status(500).json({ message: "Error al obtener deudas" });
  }
});

/* ==============================
   📋 OBTENER TRATAMIENTOS DISPONIBLES
   Para que el bot pueda informar sobre servicios
============================== */
router.get("/tratamientos", async (req, res) => {
  try {
    const { categoria } = req.query;

    let query = `SELECT id, nombre, descripcion, precio, categoria FROM tratamientos WHERE 1=1`;
    const params = [];

    if (categoria) {
      query += ` AND categoria = ?`;
      params.push(categoria);
    }

    query += ` ORDER BY nombre ASC`;

    const tratamientos = await dbAll(query, params);

    res.json({
      total: tratamientos.length,
      tratamientos: tratamientos.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        descripcion: t.descripcion,
        precio: t.precio,
        categoria: t.categoria,
      })),
    });
  } catch (error) {
    console.error("❌ Error obteniendo tratamientos:", error);
    res.status(500).json({ message: "Error al obtener tratamientos" });
  }
});

/* ==============================
   📝 REGISTRAR INTERACCIÓN DE WHATSAPP
   Para guardar conversaciones en el CRM
============================== */
router.post("/interaccion", async (req, res) => {
  try {
    const { telefono, mensaje, tipo, paciente_id, metadata } = req.body;

    if (!telefono || !mensaje) {
      return res.status(400).json({ message: "Teléfono y mensaje son requeridos" });
    }

    await dbRun(
      `INSERT INTO whatsapp_interacciones 
       (telefono, paciente_id, mensaje, tipo, metadata, fecha) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [telefono, paciente_id || null, mensaje, tipo || "entrante", JSON.stringify(metadata || {}), fechaLima()]
    );

    res.json({ success: true, mensaje: "Interacción registrada" });
  } catch (error) {
    console.error("❌ Error registrando interacción:", error);
    res.status(500).json({ message: "Error al registrar interacción" });
  }
});

/* ==============================
   🔔 CREAR RECORDATORIO AUTOMÁTICO
   Para programar envíos desde n8n
============================== */
router.post("/recordatorio", async (req, res) => {
  try {
    const { paciente_id, tipo, fecha_envio, mensaje, telefono } = req.body;

    if (!paciente_id || !tipo || !fecha_envio) {
      return res.status(400).json({ message: "Datos incompletos" });
    }

    const result = await dbRun(
      `INSERT INTO whatsapp_recordatorios 
       (paciente_id, tipo, fecha_envio, mensaje, telefono, estado) 
       VALUES (?, ?, ?, ?, ?, 'pendiente')`,
      [paciente_id, tipo, fecha_envio, mensaje, telefono]
    );

    res.json({
      success: true,
      recordatorio_id: result.lastID,
      mensaje: "Recordatorio programado",
    });
  } catch (error) {
    console.error("❌ Error creando recordatorio:", error);
    res.status(500).json({ message: "Error al crear recordatorio" });
  }
});

/* ==============================
   📊 OBTENER ESTADÍSTICAS RÁPIDAS
   Para dashboard de n8n
============================== */
router.get("/estadisticas", async (req, res) => {
  try {
    const totalPacientes = await dbGet(`SELECT COUNT(*) as total FROM patients`);
    const citasHoy = await dbGet(
      `SELECT COUNT(*) as total FROM citas WHERE fecha = date('now', '-5 hours')`
    );
    const deudasPendientes = await dbGet(
      `SELECT COUNT(*) as total, SUM(monto_saldo) as monto_total 
       FROM deudas_tratamientos WHERE estado = 'pendiente'`
    );

    res.json({
      pacientes: {
        total: totalPacientes?.total || 0,
      },
      citas: {
        hoy: citasHoy?.total || 0,
      },
      deudas: {
        cantidad: deudasPendientes?.total || 0,
        monto_total: parseFloat(deudasPendientes?.monto_total || 0).toFixed(2),
      },
    });
  } catch (error) {
    console.error("❌ Error obteniendo estadísticas:", error);
    res.status(500).json({ message: "Error al obtener estadísticas" });
  }
});

/* ==============================
   🎯 WEBHOOK GENÉRICO PARA N8N
   Recibe cualquier evento desde n8n
============================== */
router.post("/webhook", async (req, res) => {
  try {
    const { evento, datos } = req.body;

    console.log(`📨 Webhook recibido de n8n: ${evento}`, datos);

    // Aquí puedes procesar diferentes tipos de eventos
    switch (evento) {
      case "mensaje_whatsapp":
        // Procesar mensaje de WhatsApp
        break;
      case "recordatorio_enviado":
        // Actualizar estado de recordatorio
        break;
      case "lead_nuevo":
        // Registrar nuevo lead
        break;
      default:
        console.log("Evento no reconocido:", evento);
    }

    res.json({ success: true, mensaje: "Webhook procesado" });
  } catch (error) {
    console.error("❌ Error en webhook:", error);
    res.status(500).json({ message: "Error procesando webhook" });
  }
});

export default router;
