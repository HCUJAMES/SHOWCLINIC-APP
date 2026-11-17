/**
 * SALDO A FAVOR POR CONSULTAS PREPAGADAS
 * Ver services/consultas.js para la regla de negocio.
 */

import express from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import {
  ensureConsultasSchema,
  migrarConsultasHistoricas,
  consultasDisponibles,
  consultasDePaciente,
  saldoDisponible,
  aplicarConsultas,
  revertirConsulta,
  consultasDeEspecialistas,
  consultasSinEspecialista,
  asignarEspecialistaConsulta,
  camposConsultas,
  SIN_CONSULTAS,
} from "../services/consultas.js";

const router = express.Router();

const puedeVer = [authMiddleware, requireRole("doctor", "master", "asistente", "admin", "logistica", "doctora")];
const puedeAplicar = [authMiddleware, requireRole("doctor", "master", "asistente", "admin", "logistica", "doctora")];

// La migración corre una sola vez, al primer request
let migracionHecha = false;
async function asegurarDatos() {
  await ensureConsultasSchema();
  if (!migracionHecha) {
    migracionHecha = true;
    try {
      await migrarConsultasHistoricas();
    } catch (e) {
      migracionHecha = false;
      console.error("❌ Error migrando consultas históricas:", e.message);
    }
  }
}

/* Saldo a favor de un paciente (resumen + detalle disponible) */
router.get("/paciente/:paciente_id", puedeVer, async (req, res) => {
  try {
    await asegurarDatos();
    const { paciente_id } = req.params;
    const [resumen, disponibles, historial] = await Promise.all([
      saldoDisponible(paciente_id),
      consultasDisponibles(paciente_id),
      consultasDePaciente(paciente_id),
    ]);
    res.json({
      saldo_disponible: resumen.total,
      cantidad_disponible: resumen.cantidad,
      disponibles,
      historial,
    });
  } catch (err) {
    console.error("❌ Error obteniendo consultas del paciente:", err.message);
    res.status(500).json({ message: "Error al obtener el saldo de consultas" });
  }
});

/* Aplicar saldo a favor a un presupuesto */
router.post("/aplicar", puedeAplicar, async (req, res) => {
  try {
    await asegurarDatos();
    const { presupuesto_id, consulta_ids } = req.body;

    if (!presupuesto_id) {
      return res.status(400).json({ message: "presupuesto_id es requerido" });
    }

    const resultado = await aplicarConsultas({
      presupuesto_id,
      consulta_ids,
      usuario: req.user?.username,
    });

    res.json({
      message: `✅ Se descontaron S/ ${resultado.monto_aplicado.toFixed(2)} de consulta del presupuesto`,
      ...resultado,
    });
  } catch (err) {
    console.error("❌ Error aplicando consulta:", err.message);
    res.status(400).json({ message: err.message });
  }
});

/* Devolver un saldo aplicado al estado disponible */
router.post("/:consulta_id/revertir", puedeAplicar, async (req, res) => {
  try {
    await asegurarDatos();
    const resultado = await revertirConsulta({
      consulta_id: req.params.consulta_id,
      usuario: req.user?.username,
    });
    res.json({ message: "✅ Consulta devuelta a saldo disponible", ...resultado });
  } catch (err) {
    console.error("❌ Error revirtiendo consulta:", err.message);
    res.status(400).json({ message: err.message });
  }
});

/* Pacientes con saldo sin usar — para que no se olvide aplicarlo */
router.get("/pendientes", puedeVer, async (req, res) => {
  try {
    await asegurarDatos();
    const { dbAll } = await import("../db/database.js");
    const filas = await dbAll(`
      SELECT c.paciente_id,
             p.nombre, p.apellido, p.dni,
             COUNT(*) as consultas,
             COALESCE(SUM(c.monto), 0) as total,
             MIN(DATE(c.fecha)) as desde
      FROM consultas_paciente c
      JOIN patients p ON p.id = c.paciente_id
      WHERE c.estado = 'disponible'
      GROUP BY c.paciente_id
      ORDER BY total DESC
    `);
    res.json({
      total_pacientes: filas.length,
      total_monto: filas.reduce((a, f) => a + (Number(f.total) || 0), 0),
      pacientes: filas,
    });
  } catch (err) {
    console.error("❌ Error listando consultas pendientes:", err.message);
    res.status(500).json({ message: "Error al listar consultas pendientes" });
  }
});

/* Consultas que atendió una especialista en el periodo, con su estado de pago */
router.get("/especialista/:id", puedeVer, async (req, res) => {
  try {
    await asegurarDatos();
    const { fecha_inicio, fecha_fin } = req.query;
    const mapa = await consultasDeEspecialistas({ fecha_inicio, fecha_fin, especialista_id: req.params.id });
    const r = mapa.get(Number(req.params.id)) || SIN_CONSULTAS;
    res.json({ ...camposConsultas(r), tarifa: r.tarifa, consultas: r.consultas });
  } catch (err) {
    console.error("❌ Error listando consultas de especialista:", err.message);
    res.status(500).json({ message: "Error al obtener las consultas" });
  }
});

/* Consultas cobradas sin decir qué doctora atendió (para completarlas) */
router.get("/sin-especialista", puedeVer, async (req, res) => {
  try {
    await asegurarDatos();
    const { fecha_inicio, fecha_fin } = req.query;
    res.json(await consultasSinEspecialista({ fecha_inicio, fecha_fin }));
  } catch (err) {
    console.error("❌ Error listando consultas sin especialista:", err.message);
    res.status(500).json({ message: "Error al obtener las consultas" });
  }
});

/* Asignar / cambiar la doctora que atendió una consulta */
router.put("/:consulta_id/especialista", puedeAplicar, async (req, res) => {
  try {
    await asegurarDatos();
    const v = req.body?.especialista_id;
    const especialista_id = v === null || v === "" || v === undefined ? null : Number(v);
    if (especialista_id !== null && !Number.isInteger(especialista_id)) {
      return res.status(400).json({ message: "Especialista no válido" });
    }
    const r = await asignarEspecialistaConsulta({ consulta_id: req.params.consulta_id, especialista_id });
    res.json({ message: "✅ Consulta actualizada", ...r });
  } catch (err) {
    console.error("❌ Error asignando especialista a consulta:", err.message);
    res.status(400).json({ message: err.message });
  }
});

export default router;
