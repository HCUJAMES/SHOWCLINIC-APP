import express from "express";
import { dbAll, dbGet, dbRun } from "../db/database.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Función para obtener fecha/hora de Perú (GMT-5)
const fechaLima = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).replace("T", " ").slice(0, 19);

// Middleware para verificar permisos
// Todos los roles pueden crear/editar/eliminar paquetes base
const requirePaquetesWrite = [authMiddleware, requireRole("doctor", "master", "asistente", "admin", "logistica", "doctora")];
// Todos pueden leer paquetes (para ver en historial, nueva sesión, etc.)
const requirePaquetesRead = [authMiddleware, requireRole("doctor", "master", "asistente", "admin", "logistica", "doctora")];
// Todos los roles pueden asignar paquetes a pacientes y gestionar sesiones
const requirePaquetesAsignar = [authMiddleware, requireRole("doctor", "master", "asistente", "admin", "logistica", "doctora")];

/* ==============================
   📋 LISTAR TODOS LOS PAQUETES
============================== */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const paquetes = await dbAll(
      `SELECT 
        p.*,
        t.nombre as tratamiento_nombre
       FROM paquetes_tratamientos p
       LEFT JOIN tratamientos t ON p.tratamiento_id = t.id
       ORDER BY p.creado_en DESC`
    );

    res.json(paquetes);
  } catch (err) {
    console.error("❌ Error al listar paquetes:", err.message);
    res.status(500).json({ message: "Error al listar paquetes" });
  }
});

/* ==============================
   📋 LISTAR PAQUETES ACTIVOS Y VIGENTES
============================== */
router.get("/activos", authMiddleware, async (req, res) => {
  try {
    const hoy = fechaLima().split(" ")[0];
    
    const paquetes = await dbAll(
      `SELECT 
        p.*,
        t.nombre as tratamiento_nombre
       FROM paquetes_tratamientos p
       LEFT JOIN tratamientos t ON p.tratamiento_id = t.id
       WHERE p.estado = 'activo'
       AND (p.vigencia_inicio IS NULL OR p.vigencia_inicio <= ?)
       AND (p.vigencia_fin IS NULL OR p.vigencia_fin >= ?)
       ORDER BY p.nombre ASC`,
      [hoy, hoy]
    );

    res.json(paquetes);
  } catch (err) {
    console.error("❌ Error al listar paquetes activos:", err.message);
    res.status(500).json({ message: "Error al listar paquetes activos" });
  }
});

/* ==============================
   🔍 OBTENER UN PAQUETE POR ID
============================== */
router.get("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const paquete = await dbGet(
      `SELECT 
        p.*,
        t.nombre as tratamiento_nombre
       FROM paquetes_tratamientos p
       LEFT JOIN tratamientos t ON p.tratamiento_id = t.id
       WHERE p.id = ?`,
      [id]
    );

    if (!paquete) {
      return res.status(404).json({ message: "Paquete no encontrado" });
    }

    // Parsear productos_json si existe
    if (paquete.productos_json) {
      try {
        paquete.productos = JSON.parse(paquete.productos_json);
      } catch (e) {
        paquete.productos = [];
      }
    }

    res.json(paquete);
  } catch (err) {
    console.error("❌ Error al obtener paquete:", err.message);
    res.status(500).json({ message: "Error al obtener paquete" });
  }
});

/* ==============================
   ➕ CREAR NUEVO PAQUETE
============================== */
router.post("/", requirePaquetesWrite, async (req, res) => {
  const {
    nombre,
    descripcion,
    tratamientos,
    productos,
    precio_regular,
    precio_paquete,
    sesiones,
    vigencia_inicio,
    vigencia_fin,
    imagen_promocional,
  } = req.body;

  // Validaciones
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ message: "El nombre es requerido" });
  }

  if (!precio_regular || precio_regular <= 0) {
    return res.status(400).json({ message: "El precio regular debe ser mayor a 0" });
  }

  if (!precio_paquete || precio_paquete <= 0) {
    return res.status(400).json({ message: "El precio del paquete debe ser mayor a 0" });
  }

  if (!sesiones || sesiones < 1) {
    return res.status(400).json({ message: "Las sesiones deben ser al menos 1" });
  }

  // Validar fechas de vigencia
  if (vigencia_inicio && vigencia_fin) {
    if (new Date(vigencia_inicio) > new Date(vigencia_fin)) {
      return res.status(400).json({ 
        message: "La fecha de inicio no puede ser posterior a la fecha de fin" 
      });
    }
  }

  try {
    // Calcular descuento porcentaje
    const descuento_porcentaje = ((precio_regular - precio_paquete) / precio_regular) * 100;

    // Convertir tratamientos y productos a JSON
    const tratamientos_json = tratamientos && tratamientos.length > 0 
      ? JSON.stringify(tratamientos) 
      : null;
    const productos_json = productos && productos.length > 0 
      ? JSON.stringify(productos) 
      : null;

    const ahora = fechaLima();
    const username = req.user?.username || "sistema";

    const result = await dbRun(
      `INSERT INTO paquetes_tratamientos (
        nombre, descripcion, tratamientos_json, productos_json,
        precio_regular, precio_paquete, descuento_porcentaje,
        sesiones, vigencia_inicio, vigencia_fin,
        imagen_promocional, estado, creado_en, creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', ?, ?)`,
      [
        nombre.trim(),
        descripcion?.trim() || null,
        tratamientos_json,
        productos_json,
        precio_regular,
        precio_paquete,
        descuento_porcentaje,
        sesiones,
        vigencia_inicio || null,
        vigencia_fin || null,
        imagen_promocional || null,
        ahora,
        username,
      ]
    );

    res.status(201).json({
      message: "✅ Paquete creado exitosamente",
      id: result.lastID,
    });
  } catch (err) {
    console.error("❌ Error al crear paquete:", err.message);
    res.status(500).json({ message: "Error al crear paquete" });
  }
});

/* ==============================
   ✏️ EDITAR PAQUETE
============================== */
router.put("/:id", requirePaquetesWrite, async (req, res) => {
  const { id } = req.params;
  const {
    nombre,
    descripcion,
    tratamientos,
    productos,
    precio_regular,
    precio_paquete,
    sesiones,
    vigencia_inicio,
    vigencia_fin,
    estado,
    imagen_promocional,
  } = req.body;

  try {
    // Verificar que el paquete existe
    const paquete = await dbGet(
      `SELECT * FROM paquetes_tratamientos WHERE id = ?`,
      [id]
    );

    if (!paquete) {
      return res.status(404).json({ message: "Paquete no encontrado" });
    }

    // Validaciones
    if (nombre && !nombre.trim()) {
      return res.status(400).json({ message: "El nombre no puede estar vacío" });
    }

    if (precio_regular && precio_regular <= 0) {
      return res.status(400).json({ message: "El precio regular debe ser mayor a 0" });
    }

    if (precio_paquete && precio_paquete <= 0) {
      return res.status(400).json({ message: "El precio del paquete debe ser mayor a 0" });
    }

    if (sesiones && sesiones < 1) {
      return res.status(400).json({ message: "Las sesiones deben ser al menos 1" });
    }

    // Validar fechas de vigencia
    const inicio = vigencia_inicio !== undefined ? vigencia_inicio : paquete.vigencia_inicio;
    const fin = vigencia_fin !== undefined ? vigencia_fin : paquete.vigencia_fin;
    
    if (inicio && fin) {
      if (new Date(inicio) > new Date(fin)) {
        return res.status(400).json({ 
          message: "La fecha de inicio no puede ser posterior a la fecha de fin" 
        });
      }
    }

    // Calcular nuevo descuento porcentaje
    const precioReg = precio_regular !== undefined ? precio_regular : paquete.precio_regular;
    const precioPaq = precio_paquete !== undefined ? precio_paquete : paquete.precio_paquete;
    const descuento_porcentaje = ((precioReg - precioPaq) / precioReg) * 100;

    // Convertir tratamientos y productos a JSON
    const tratamientos_json = tratamientos !== undefined
      ? (tratamientos && tratamientos.length > 0 ? JSON.stringify(tratamientos) : null)
      : paquete.tratamientos_json;
    const productos_json = productos !== undefined
      ? (productos && productos.length > 0 ? JSON.stringify(productos) : null)
      : paquete.productos_json;

    const ahora = fechaLima();

    await dbRun(
      `UPDATE paquetes_tratamientos SET
        nombre = ?,
        descripcion = ?,
        tratamientos_json = ?,
        productos_json = ?,
        precio_regular = ?,
        precio_paquete = ?,
        descuento_porcentaje = ?,
        sesiones = ?,
        vigencia_inicio = ?,
        vigencia_fin = ?,
        estado = ?,
        imagen_promocional = ?,
        actualizado_en = ?
       WHERE id = ?`,
      [
        nombre !== undefined ? nombre.trim() : paquete.nombre,
        descripcion !== undefined ? (descripcion?.trim() || null) : paquete.descripcion,
        tratamientos_json,
        productos_json,
        precioReg,
        precioPaq,
        descuento_porcentaje,
        sesiones !== undefined ? sesiones : paquete.sesiones,
        inicio,
        fin,
        estado !== undefined ? estado : paquete.estado,
        imagen_promocional !== undefined ? imagen_promocional : paquete.imagen_promocional,
        ahora,
        id,
      ]
    );

    res.json({ message: "✅ Paquete actualizado exitosamente" });
  } catch (err) {
    console.error("❌ Error al actualizar paquete:", err.message);
    res.status(500).json({ message: "Error al actualizar paquete" });
  }
});

/* ==============================
   🗑️ ELIMINAR PAQUETE
============================== */
router.delete("/:id", requirePaquetesWrite, async (req, res) => {
  const { id } = req.params;

  try {
    const paquete = await dbGet(
      `SELECT * FROM paquetes_tratamientos WHERE id = ?`,
      [id]
    );

    if (!paquete) {
      return res.status(404).json({ message: "Paquete no encontrado" });
    }

    await dbRun(`DELETE FROM paquetes_tratamientos WHERE id = ?`, [id]);

    res.json({ message: "✅ Paquete eliminado exitosamente" });
  } catch (err) {
    console.error("❌ Error al eliminar paquete:", err.message);
    res.status(500).json({ message: "Error al eliminar paquete" });
  }
});

/* ==============================
   🔄 CAMBIAR ESTADO DEL PAQUETE
============================== */
router.patch("/:id/estado", requirePaquetesWrite, async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!["activo", "inactivo"].includes(estado)) {
    return res.status(400).json({ 
      message: "Estado inválido. Debe ser 'activo' o 'inactivo'" 
    });
  }

  try {
    const paquete = await dbGet(
      `SELECT * FROM paquetes_tratamientos WHERE id = ?`,
      [id]
    );

    if (!paquete) {
      return res.status(404).json({ message: "Paquete no encontrado" });
    }

    const ahora = fechaLima();

    await dbRun(
      `UPDATE paquetes_tratamientos SET estado = ?, actualizado_en = ? WHERE id = ?`,
      [estado, ahora, id]
    );

    res.json({ 
      message: `✅ Paquete ${estado === 'activo' ? 'activado' : 'desactivado'} exitosamente` 
    });
  } catch (err) {
    console.error("❌ Error al cambiar estado del paquete:", err.message);
    res.status(500).json({ message: "Error al cambiar estado del paquete" });
  }
});

/* ==============================
   🎁 ASIGNAR PAQUETE A PACIENTE
============================== */
router.post("/asignar", requirePaquetesAsignar, async (req, res) => {
  const { paciente_id, paquete_id, notas } = req.body;

  if (!paciente_id || !paquete_id) {
    return res.status(400).json({ message: "paciente_id y paquete_id son requeridos" });
  }

  try {
    // Obtener el paquete
    const paquete = await dbGet(
      `SELECT * FROM paquetes_tratamientos WHERE id = ?`,
      [paquete_id]
    );

    if (!paquete) {
      return res.status(404).json({ message: "Paquete no encontrado" });
    }

    if (paquete.estado !== 'activo') {
      return res.status(400).json({ message: "El paquete no está activo" });
    }

    const ahora = fechaLima();
    const username = req.user?.username || "sistema";

    // Crear registro de paquete asignado
    const result = await dbRun(
      `INSERT INTO paquetes_pacientes (
        paciente_id, paquete_id, paquete_nombre, tratamientos_json,
        precio_total, estado, fecha_inicio, notas, imagen_promocional, creado_en, creado_por
      ) VALUES (?, ?, ?, ?, ?, 'activo', ?, ?, ?, ?, ?)`,
      [
        paciente_id,
        paquete_id,
        paquete.nombre,
        paquete.tratamientos_json,
        paquete.precio_paquete,
        ahora,
        notas || null,
        paquete.imagen_promocional || null,
        ahora,
        username
      ]
    );

    const paquetePacienteId = result.lastID;

    // Crear las sesiones individuales del paquete
    const tratamientos = paquete.tratamientos_json ? JSON.parse(paquete.tratamientos_json) : [];
    
    for (const t of tratamientos) {
      const sesiones = t.sesiones || 1;
      const precioSesion = (t.precio_unitario || 0) / sesiones;
      
      for (let i = 1; i <= sesiones; i++) {
        await dbRun(
          `INSERT INTO paquetes_sesiones (
            paquete_paciente_id, tratamiento_id, tratamiento_nombre,
            sesion_numero, precio_sesion, estado, creado_en
          ) VALUES (?, ?, ?, ?, ?, 'pendiente', ?)`,
          [
            paquetePacienteId,
            t.tratamiento_id,
            t.nombre,
            i,
            precioSesion,
            ahora
          ]
        );
      }
    }

    res.status(201).json({ 
      message: "✅ Paquete asignado exitosamente",
      paquete_paciente_id: paquetePacienteId
    });
  } catch (err) {
    console.error("❌ Error al asignar paquete:", err.message);
    res.status(500).json({ message: "Error al asignar paquete" });
  }
});

/* ==============================
   📋 PACIENTES CON PAQUETES ACTIVOS
============================== */
router.get("/pacientes-en-tratamiento", requirePaquetesRead, async (req, res) => {
  try {
    const pacientes = await dbAll(
      `SELECT DISTINCT 
        p.id, p.nombre, p.apellido, p.dni, p.celular,
        (SELECT COUNT(*) FROM paquetes_pacientes pp2 WHERE pp2.paciente_id = p.id AND pp2.estado = 'activo') as paquetes_activos,
        (SELECT COUNT(*) FROM paquetes_sesiones ps 
          JOIN paquetes_pacientes pp3 ON ps.paquete_paciente_id = pp3.id 
          WHERE pp3.paciente_id = p.id AND ps.estado = 'pendiente') as sesiones_pendientes
       FROM pacientes p
       INNER JOIN paquetes_pacientes pp ON pp.paciente_id = p.id
       WHERE pp.estado = 'activo'
       ORDER BY p.nombre ASC`
    );

    // Obtener paquetes de cada paciente
    for (const paciente of pacientes) {
      paciente.paquetes = await dbAll(
        `SELECT pp.*, 
          (SELECT COUNT(*) FROM paquetes_sesiones ps WHERE ps.paquete_paciente_id = pp.id AND ps.estado = 'completada') as sesiones_completadas,
          (SELECT COUNT(*) FROM paquetes_sesiones ps WHERE ps.paquete_paciente_id = pp.id) as sesiones_totales
         FROM paquetes_pacientes pp
         WHERE pp.paciente_id = ? AND pp.estado = 'activo'
         ORDER BY pp.creado_en DESC`,
        [paciente.id]
      );

      // Obtener sesiones de cada paquete
      for (const paquete of paciente.paquetes) {
        paquete.sesiones = await dbAll(
          `SELECT * FROM paquetes_sesiones WHERE paquete_paciente_id = ? ORDER BY tratamiento_nombre, sesion_numero`,
          [paquete.id]
        );
      }
    }

    res.json(pacientes);
  } catch (err) {
    console.error("❌ Error al obtener pacientes en tratamiento:", err.message);
    res.status(500).json({ message: "Error al obtener pacientes en tratamiento" });
  }
});

/* ==============================
   📋 OBTENER PAQUETES DE UN PACIENTE
============================== */
router.get("/paciente/:paciente_id", requirePaquetesRead, async (req, res) => {
  const { paciente_id } = req.params;

  try {
    const paquetes = await dbAll(
      `SELECT pp.*, 
        (SELECT COUNT(*) FROM paquetes_sesiones ps WHERE ps.paquete_paciente_id = pp.id AND ps.estado = 'completada') as sesiones_completadas,
        (SELECT COUNT(*) FROM paquetes_sesiones ps WHERE ps.paquete_paciente_id = pp.id) as sesiones_totales
       FROM paquetes_pacientes pp
       WHERE pp.paciente_id = ?
       ORDER BY pp.creado_en DESC`,
      [paciente_id]
    );

    // Obtener sesiones de cada paquete
    for (const paquete of paquetes) {
      paquete.sesiones = await dbAll(
        `SELECT * FROM paquetes_sesiones WHERE paquete_paciente_id = ? ORDER BY tratamiento_nombre, sesion_numero`,
        [paquete.id]
      );
    }

    res.json(paquetes);
  } catch (err) {
    console.error("❌ Error al obtener paquetes del paciente:", err.message);
    res.status(500).json({ message: "Error al obtener paquetes del paciente" });
  }
});

/* ==============================
   ✅ MARCAR SESIÓN COMO COMPLETADA
============================== */
router.patch("/sesion/:sesion_id/completar", requirePaquetesAsignar, async (req, res) => {
  const { sesion_id } = req.params;
  const { especialista_id, notas } = req.body;

  try {
    const sesion = await dbGet(
      `SELECT * FROM paquetes_sesiones WHERE id = ?`,
      [sesion_id]
    );

    if (!sesion) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }

    if (sesion.estado === 'completada') {
      return res.status(400).json({ message: "La sesión ya está completada" });
    }

    const ahora = fechaLima();

    await dbRun(
      `UPDATE paquetes_sesiones SET 
        estado = 'completada', 
        fecha_realizada = ?, 
        especialista_id = ?,
        notas = ?
       WHERE id = ?`,
      [ahora, especialista_id || null, notas || null, sesion_id]
    );

    // Verificar si todas las sesiones del paquete están completadas
    const paquetePaciente = await dbGet(
      `SELECT pp.*, 
        (SELECT COUNT(*) FROM paquetes_sesiones ps WHERE ps.paquete_paciente_id = pp.id AND ps.estado = 'completada') as completadas,
        (SELECT COUNT(*) FROM paquetes_sesiones ps WHERE ps.paquete_paciente_id = pp.id) as total
       FROM paquetes_pacientes pp
       WHERE pp.id = ?`,
      [sesion.paquete_paciente_id]
    );

    // Si todas las sesiones están completadas, marcar el paquete como completado
    // Nota: completadas ya incluye la sesión recién actualizada
    if (paquetePaciente && paquetePaciente.completadas >= paquetePaciente.total) {
      await dbRun(
        `UPDATE paquetes_pacientes SET estado = 'completado', fecha_fin = ? WHERE id = ?`,
        [ahora, sesion.paquete_paciente_id]
      );
    }

    res.json({ message: "✅ Sesión completada exitosamente" });
  } catch (err) {
    console.error("❌ Error al completar sesión:", err.message);
    res.status(500).json({ message: "Error al completar sesión" });
  }
});

/* ==============================
   ↩️ DESMARCAR SESIÓN (REVERTIR COMPLETADA)
============================== */
router.patch("/sesion/:sesion_id/desmarcar", requirePaquetesAsignar, async (req, res) => {
  const { sesion_id } = req.params;

  try {
    const sesion = await dbGet(
      `SELECT * FROM paquetes_sesiones WHERE id = ?`,
      [sesion_id]
    );

    if (!sesion) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }

    if (sesion.estado !== 'completada') {
      return res.status(400).json({ message: "La sesión no está completada" });
    }

    await dbRun(
      `UPDATE paquetes_sesiones SET 
        estado = 'pendiente', 
        fecha_realizada = NULL, 
        especialista = NULL,
        notas = NULL
       WHERE id = ?`,
      [sesion_id]
    );

    // Si el paquete estaba completado, volver a activo
    await dbRun(
      `UPDATE paquetes_pacientes SET estado = 'activo', fecha_fin = NULL WHERE id = ? AND estado = 'completado'`,
      [sesion.paquete_paciente_id]
    );

    res.json({ message: "✅ Sesión desmarcada exitosamente" });
  } catch (err) {
    console.error("❌ Error al desmarcar sesión:", err.message);
    res.status(500).json({ message: "Error al desmarcar sesión" });
  }
});

/* ==============================
   🗑️ ELIMINAR PAQUETE DE PACIENTE
============================== */
router.delete("/paciente/:paquete_paciente_id", requirePaquetesAsignar, async (req, res) => {
  const { paquete_paciente_id } = req.params;

  try {
    const paquete = await dbGet(
      `SELECT * FROM paquetes_pacientes WHERE id = ?`,
      [paquete_paciente_id]
    );

    if (!paquete) {
      return res.status(404).json({ message: "Paquete del paciente no encontrado" });
    }

    // Eliminar sesiones del paquete
    await dbRun(`DELETE FROM paquetes_sesiones WHERE paquete_paciente_id = ?`, [paquete_paciente_id]);
    
    // Eliminar el paquete asignado
    await dbRun(`DELETE FROM paquetes_pacientes WHERE id = ?`, [paquete_paciente_id]);

    res.json({ message: "✅ Paquete eliminado exitosamente" });
  } catch (err) {
    console.error("❌ Error al eliminar paquete:", err.message);
    res.status(500).json({ message: "Error al eliminar paquete" });
  }
});

/* ==============================
   ❌ CANCELAR PAQUETE DE PACIENTE
============================== */
router.patch("/paciente/:paquete_paciente_id/cancelar", requirePaquetesAsignar, async (req, res) => {
  const { paquete_paciente_id } = req.params;

  try {
    const paquete = await dbGet(
      `SELECT * FROM paquetes_pacientes WHERE id = ?`,
      [paquete_paciente_id]
    );

    if (!paquete) {
      return res.status(404).json({ message: "Paquete del paciente no encontrado" });
    }

    const ahora = fechaLima();

    await dbRun(
      `UPDATE paquetes_pacientes SET estado = 'cancelado', fecha_fin = ? WHERE id = ?`,
      [ahora, paquete_paciente_id]
    );

    res.json({ message: "✅ Paquete cancelado exitosamente" });
  } catch (err) {
    console.error("❌ Error al cancelar paquete:", err.message);
    res.status(500).json({ message: "Error al cancelar paquete" });
  }
});

/* ==============================
   💰 REGISTRAR PAGO DE PAQUETE (Total o Adelanto)
============================== */
router.post("/paquete-paciente/:paquete_paciente_id/pago", requirePaquetesAsignar, async (req, res) => {
  const { paquete_paciente_id } = req.params;
  const { monto, metodo_pago, tipo_pago } = req.body;
  // tipo_pago: 'total', 'adelanto', 'saldo'

  try {
    const paquete = await dbGet(
      `SELECT pp.*, p.nombre as paciente_nombre, p.apellido as paciente_apellido
       FROM paquetes_pacientes pp
       JOIN patients p ON pp.paciente_id = p.id
       WHERE pp.id = ?`,
      [paquete_paciente_id]
    );

    if (!paquete) {
      return res.status(404).json({ message: "Paquete asignado no encontrado" });
    }

    const ahora = fechaLima();
    const montoRecibido = parseFloat(monto) || 0;
    const precioTotal = parseFloat(paquete.precio_total) || 0;
    const montoYaPagado = parseFloat(paquete.monto_pagado) || 0;
    const adelantoAnterior = parseFloat(paquete.monto_adelanto) || 0;

    let nuevoMontoPagado = montoYaPagado + montoRecibido;
    let nuevoAdelanto = adelantoAnterior;
    let nuevoSaldo = precioTotal - nuevoMontoPagado;
    let estadoPago = 'pendiente_pago';
    let pagadoFlag = 0;

    if (tipo_pago === 'adelanto') {
      nuevoAdelanto = adelantoAnterior + montoRecibido;
      estadoPago = 'adelanto';
      pagadoFlag = 0;
    } else if (tipo_pago === 'saldo' || nuevoMontoPagado >= precioTotal) {
      estadoPago = 'pagado';
      pagadoFlag = 1;
      nuevoSaldo = 0;
    } else if (nuevoMontoPagado > 0) {
      estadoPago = 'adelanto';
      pagadoFlag = 0;
    }

    // Actualizar paquete
    await dbRun(
      `UPDATE paquetes_pacientes 
       SET pagado = ?, monto_pagado = ?, monto_adelanto = ?, saldo_pendiente = ?, 
           estado_pago = ?, fecha_pago = ?, metodo_pago = ?
       WHERE id = ?`,
      [pagadoFlag, nuevoMontoPagado, nuevoAdelanto, nuevoSaldo, estadoPago, ahora, metodo_pago || 'efectivo', paquete_paciente_id]
    );

    // Registrar en finanzas como ingreso - extraer nombres de tratamientos del paquete
    const tipoDesc = tipo_pago === 'adelanto' ? 'Adelanto' : tipo_pago === 'saldo' ? 'Saldo' : 'Pago';
    const nombrePaciente = `${paquete.paciente_nombre} ${paquete.paciente_apellido || ''}`.trim();
    
    // Obtener nombres de tratamientos del paquete
    let nombresTratamientos = paquete.paquete_nombre || 'Paquete';
    try {
      const tratamientosPaquete = paquete.tratamientos_json ? JSON.parse(paquete.tratamientos_json) : [];
      if (tratamientosPaquete.length > 0) {
        nombresTratamientos = tratamientosPaquete.map(t => t.nombre || t.tratamiento_nombre).join(', ');
      }
    } catch (e) {}
    
    await dbRun(
      `INSERT INTO finanzas (tipo, categoria, monto, descripcion, fecha, metodo_pago, paciente_id, referencia_id, referencia_tipo, creado_en)
       VALUES ('ingreso', 'paquete', ?, ?, ?, ?, ?, ?, 'paquete_paciente', ?)`,
      [
        montoRecibido,
        `${nombresTratamientos} - ${nombrePaciente}`,
        ahora.split(' ')[0],
        metodo_pago || 'efectivo',
        paquete.paciente_id,
        paquete_paciente_id,
        ahora
      ]
    );

    res.json({ 
      message: `✅ ${tipoDesc} registrado exitosamente`,
      monto_pagado: nuevoMontoPagado,
      saldo_pendiente: nuevoSaldo,
      estado_pago: estadoPago
    });
  } catch (err) {
    console.error("❌ Error al registrar pago de paquete:", err.message);
    res.status(500).json({ message: "Error al registrar pago" });
  }
});

/* ==============================
   💊 REGISTRAR PAGO DE CONSULTA
============================== */
router.post("/paquete-paciente/:paquete_paciente_id/consulta", requirePaquetesAsignar, async (req, res) => {
  const { paquete_paciente_id } = req.params;
  const { monto_consulta, metodo_pago } = req.body;

  if (!monto_consulta || monto_consulta <= 0) {
    return res.status(400).json({ message: "El monto de consulta debe ser mayor a 0" });
  }

  try {
    const paquete = await dbGet(
      `SELECT pp.*, p.nombre as paciente_nombre, p.apellido as paciente_apellido
       FROM paquetes_pacientes pp
       JOIN patients p ON pp.paciente_id = p.id
       WHERE pp.id = ?`,
      [paquete_paciente_id]
    );

    if (!paquete) {
      return res.status(404).json({ message: "Paquete asignado no encontrado" });
    }

    // Verificar si ya se pagó la consulta
    if (paquete.consulta_pagada === 1) {
      return res.status(400).json({ message: "La consulta ya fue pagada anteriormente" });
    }

    const ahora = fechaLima();
    const montoConsulta = parseFloat(monto_consulta);
    const precioTotal = parseFloat(paquete.precio_total) || 0;

    // Calcular nuevo precio total (precio original - monto de consulta)
    const nuevoPrecioTotal = precioTotal - montoConsulta;

    if (nuevoPrecioTotal < 0) {
      return res.status(400).json({ message: "El monto de consulta no puede ser mayor al precio del paquete" });
    }

    // Actualizar paquete con datos de consulta y nuevo precio total
    await dbRun(
      `UPDATE paquetes_pacientes 
       SET consulta_pagada = 1, 
           monto_consulta = ?, 
           metodo_pago_consulta = ?, 
           fecha_pago_consulta = ?,
           precio_total = ?,
           saldo_pendiente = ?
       WHERE id = ?`,
      [montoConsulta, metodo_pago || 'efectivo', ahora, nuevoPrecioTotal, nuevoPrecioTotal, paquete_paciente_id]
    );

    // Registrar en finanzas como ingreso por consulta
    const nombrePaciente = `${paquete.paciente_nombre} ${paquete.paciente_apellido || ''}`.trim();
    
    // Obtener nombres de tratamientos del paquete
    let nombresTratamientos = paquete.paquete_nombre || 'Paquete';
    try {
      const tratamientosPaquete = paquete.tratamientos_json ? JSON.parse(paquete.tratamientos_json) : [];
      if (tratamientosPaquete.length > 0) {
        nombresTratamientos = tratamientosPaquete.map(t => t.nombre || t.tratamiento_nombre).join(', ');
      }
    } catch (e) {}
    
    await dbRun(
      `INSERT INTO finanzas (tipo, categoria, monto, descripcion, fecha, metodo_pago, paciente_id, referencia_id, referencia_tipo, creado_en)
       VALUES ('ingreso', 'consulta', ?, ?, ?, ?, ?, ?, 'paquete_consulta', ?)`,
      [
        montoConsulta,
        `Consulta - ${nombresTratamientos} - ${nombrePaciente}`,
        ahora.split(' ')[0],
        metodo_pago || 'efectivo',
        paquete.paciente_id,
        paquete_paciente_id,
        ahora
      ]
    );

    res.json({ 
      message: `✅ Pago de consulta registrado exitosamente`,
      monto_consulta: montoConsulta,
      precio_total_anterior: precioTotal,
      precio_total_nuevo: nuevoPrecioTotal,
      descuento_aplicado: montoConsulta
    });
  } catch (err) {
    console.error("❌ Error al registrar pago de consulta:", err.message);
    res.status(500).json({ message: "Error al registrar pago de consulta" });
  }
});

/* ======================================================================
   📋 PRESUPUESTOS ASIGNADOS - Similar a paquetes pero para ofertas/presupuestos
====================================================================== */

/* ==============================
   🎁 ASIGNAR PRESUPUESTO A PACIENTE
============================== */
router.post("/presupuesto/asignar", requirePaquetesAsignar, async (req, res) => {
  const { paciente_id, oferta_id, notas } = req.body;

  if (!paciente_id || !oferta_id) {
    return res.status(400).json({ message: "paciente_id y oferta_id son requeridos" });
  }

  try {
    // Obtener la oferta/presupuesto (incluyendo descuento)
    const oferta = await dbGet(
      `SELECT * FROM patient_ofertas WHERE id = ?`,
      [oferta_id]
    );

    if (!oferta) {
      return res.status(404).json({ message: "Presupuesto no encontrado" });
    }

    // Obtener los items de la oferta desde el JSON guardado
    let items = [];
    try {
      items = oferta.items_json ? JSON.parse(oferta.items_json) : [];
    } catch (e) {
      items = [];
    }

    const ahora = fechaLima();
    const username = req.user?.username || "sistema";

    // Calcular precio total y obtener descuento
    const precioTotal = items.reduce((sum, it) => sum + Number(it.precio || 0), 0);
    const descuento = Number(oferta.descuento) || 0;

    // Crear registro de presupuesto asignado (incluyendo descuento)
    const result = await dbRun(
      `INSERT INTO presupuestos_asignados (
        paciente_id, oferta_id, tratamientos_json,
        precio_total, descuento, estado, fecha_inicio, notas, creado_en, creado_por
      ) VALUES (?, ?, ?, ?, ?, 'activo', ?, ?, ?, ?)`,
      [
        paciente_id,
        oferta_id,
        JSON.stringify(items),
        precioTotal,
        descuento,
        ahora,
        notas || null,
        ahora,
        username
      ]
    );

    const presupuestoAsignadoId = result.lastID;

    // Crear las sesiones individuales (N sesiones por tratamiento según lo configurado)
    for (const item of items) {
      const numSesiones = Number(item.sesiones) >= 1 ? Number(item.sesiones) : 1;
      const precioTotal = Number(item.precio) || 0;

      for (let s = 1; s <= numSesiones; s++) {
        await dbRun(
          `INSERT INTO presupuestos_sesiones (
            presupuesto_asignado_id, tratamiento_id, tratamiento_nombre,
            sesion_numero, precio_sesion, estado, creado_en
          ) VALUES (?, ?, ?, ?, ?, 'pendiente', ?)`,
          [
            presupuestoAsignadoId,
            item.tratamientoId || item.tratamiento_id || null,
            item.nombre,
            s,
            precioTotal,
            ahora
          ]
        );
      }
    }

    res.json({ 
      message: "✅ Presupuesto asignado exitosamente",
      presupuesto_asignado_id: presupuestoAsignadoId
    });
  } catch (err) {
    console.error("❌ Error al asignar presupuesto:", err.message);
    res.status(500).json({ message: "Error al asignar presupuesto" });
  }
});

/* ==============================
   📋 OBTENER PRESUPUESTOS ASIGNADOS DE UN PACIENTE
============================== */
router.get("/presupuestos/paciente/:paciente_id", requirePaquetesRead, async (req, res) => {
  const { paciente_id } = req.params;

  try {
    const presupuestos = await dbAll(
      `SELECT * FROM presupuestos_asignados WHERE paciente_id = ? ORDER BY creado_en DESC`,
      [paciente_id]
    );

    // Para cada presupuesto, obtener sus sesiones y calcular saldo correctamente
    for (const p of presupuestos) {
      const sesiones = await dbAll(
        `SELECT * FROM presupuestos_sesiones WHERE presupuesto_asignado_id = ? ORDER BY id ASC`,
        [p.id]
      );
      p.sesiones = sesiones;
      p.sesiones_totales = sesiones.length;
      p.sesiones_completadas = sesiones.filter(s => s.estado === 'completada').length;
      
      // Calcular saldo pendiente considerando el descuento
      const precioTotal = parseFloat(p.precio_total) || 0;
      const descuento = parseFloat(p.descuento) || 0;
      const montoPagado = parseFloat(p.monto_pagado) || 0;
      p.saldo_pendiente = (precioTotal - descuento) - montoPagado;
      if (p.saldo_pendiente < 0) p.saldo_pendiente = 0;
    }

    res.json(presupuestos);
  } catch (err) {
    console.error("❌ Error al obtener presupuestos del paciente:", err.message);
    res.status(500).json({ message: "Error al obtener presupuestos del paciente" });
  }
});

/* ==============================
   ✅ COMPLETAR SESIÓN DE PRESUPUESTO
============================== */
router.patch("/presupuesto/sesion/:sesion_id/completar", requirePaquetesAsignar, async (req, res) => {
  const { sesion_id } = req.params;
  const { especialista_id } = req.body;

  try {
    const sesion = await dbGet(
      `SELECT ps.*, pa.id as presupuesto_id, pa.paciente_id 
       FROM presupuestos_sesiones ps
       JOIN presupuestos_asignados pa ON ps.presupuesto_asignado_id = pa.id
       WHERE ps.id = ?`,
      [sesion_id]
    );

    if (!sesion) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }

    const ahora = fechaLima();

    await dbRun(
      `UPDATE presupuestos_sesiones SET estado = 'completada', fecha_realizada = ?, especialista_id = ? WHERE id = ?`,
      [ahora, especialista_id || null, sesion_id]
    );

    // Verificar si todas las sesiones están completadas
    const sesionesPendientes = await dbGet(
      `SELECT COUNT(*) as count FROM presupuestos_sesiones 
       WHERE presupuesto_asignado_id = ? AND estado = 'pendiente'`,
      [sesion.presupuesto_asignado_id]
    );

    if (sesionesPendientes.count === 0) {
      await dbRun(
        `UPDATE presupuestos_asignados SET estado = 'completado', fecha_fin = ? WHERE id = ?`,
        [ahora, sesion.presupuesto_asignado_id]
      );
    }

    res.json({ message: "✅ Sesión completada exitosamente" });
  } catch (err) {
    console.error("❌ Error al completar sesión:", err.message);
    res.status(500).json({ message: "Error al completar sesión" });
  }
});

/* ==============================
   ↩️ DESMARCAR SESIÓN DE PRESUPUESTO
============================== */
router.patch("/presupuesto/sesion/:sesion_id/desmarcar", requirePaquetesAsignar, async (req, res) => {
  const { sesion_id } = req.params;

  try {
    const sesion = await dbGet(
      `SELECT ps.*, pa.id as presupuesto_id
       FROM presupuestos_sesiones ps
       JOIN presupuestos_asignados pa ON ps.presupuesto_asignado_id = pa.id
       WHERE ps.id = ?`,
      [sesion_id]
    );

    if (!sesion) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }

    await dbRun(
      `UPDATE presupuestos_sesiones SET estado = 'pendiente', fecha_realizada = NULL, especialista = NULL WHERE id = ?`,
      [sesion_id]
    );

    // Reactivar el presupuesto si estaba completado
    await dbRun(
      `UPDATE presupuestos_asignados SET estado = 'activo', fecha_fin = NULL WHERE id = ? AND estado = 'completado'`,
      [sesion.presupuesto_asignado_id]
    );

    res.json({ message: "✅ Sesión desmarcada exitosamente" });
  } catch (err) {
    console.error("❌ Error al desmarcar sesión:", err.message);
    res.status(500).json({ message: "Error al desmarcar sesión" });
  }
});

/* ==============================
   🗑️ ELIMINAR PRESUPUESTO ASIGNADO
============================== */
router.delete("/presupuesto/paciente/:presupuesto_asignado_id", requirePaquetesAsignar, async (req, res) => {
  const { presupuesto_asignado_id } = req.params;

  try {
    const presupuesto = await dbGet(
      `SELECT * FROM presupuestos_asignados WHERE id = ?`,
      [presupuesto_asignado_id]
    );

    if (!presupuesto) {
      return res.status(404).json({ message: "Presupuesto asignado no encontrado" });
    }

    // Eliminar sesiones primero
    await dbRun(`DELETE FROM presupuestos_sesiones WHERE presupuesto_asignado_id = ?`, [presupuesto_asignado_id]);
    // Eliminar presupuesto asignado
    await dbRun(`DELETE FROM presupuestos_asignados WHERE id = ?`, [presupuesto_asignado_id]);

    res.json({ message: "✅ Presupuesto eliminado exitosamente" });
  } catch (err) {
    console.error("❌ Error al eliminar presupuesto:", err.message);
    res.status(500).json({ message: "Error al eliminar presupuesto" });
  }
});

/* ==============================
   💊 REGISTRAR PAGO DE CONSULTA EN PRESUPUESTO
============================== */
router.post("/presupuesto/:presupuesto_asignado_id/consulta", requirePaquetesAsignar, async (req, res) => {
  const { presupuesto_asignado_id } = req.params;
  const { monto_consulta, metodo_pago } = req.body;

  if (!monto_consulta || monto_consulta <= 0) {
    return res.status(400).json({ message: "El monto de consulta debe ser mayor a 0" });
  }

  try {
    const presupuesto = await dbGet(
      `SELECT pa.*, p.nombre as paciente_nombre, p.apellido as paciente_apellido
       FROM presupuestos_asignados pa
       JOIN patients p ON pa.paciente_id = p.id
       WHERE pa.id = ?`,
      [presupuesto_asignado_id]
    );

    if (!presupuesto) {
      return res.status(404).json({ message: "Presupuesto asignado no encontrado" });
    }

    // Verificar si ya se pagó la consulta
    if (presupuesto.consulta_pagada === 1) {
      return res.status(400).json({ message: "La consulta ya fue pagada anteriormente" });
    }

    const ahora = fechaLima();
    const montoConsulta = parseFloat(monto_consulta);
    const precioTotal = parseFloat(presupuesto.precio_total) || 0;
    const descuentoActual = parseFloat(presupuesto.descuento) || 0;

    // Calcular nuevo descuento (descuento anterior + monto de consulta)
    const nuevoDescuento = descuentoActual + montoConsulta;

    if (nuevoDescuento > precioTotal) {
      return res.status(400).json({ message: "El monto de consulta no puede ser mayor al precio del presupuesto" });
    }

    // Actualizar presupuesto con datos de consulta y nuevo descuento
    await dbRun(
      `UPDATE presupuestos_asignados 
       SET consulta_pagada = 1, 
           monto_consulta = ?, 
           metodo_pago_consulta = ?, 
           fecha_pago_consulta = ?,
           descuento = ?
       WHERE id = ?`,
      [montoConsulta, metodo_pago || 'efectivo', ahora, nuevoDescuento, presupuesto_asignado_id]
    );

    // Registrar en finanzas como ingreso por consulta
    const nombrePaciente = `${presupuesto.paciente_nombre} ${presupuesto.paciente_apellido || ''}`.trim();
    
    // Obtener nombres de tratamientos del presupuesto
    let nombresTratamientos = 'Presupuesto';
    try {
      const tratamientosPresupuesto = presupuesto.tratamientos_json ? JSON.parse(presupuesto.tratamientos_json) : [];
      if (tratamientosPresupuesto.length > 0) {
        nombresTratamientos = tratamientosPresupuesto.map(t => t.nombre || t.tratamiento).join(', ');
      }
    } catch (e) {}
    
    await dbRun(
      `INSERT INTO finanzas (tipo, categoria, monto, descripcion, fecha, metodo_pago, paciente_id, referencia_id, referencia_tipo, creado_en)
       VALUES ('ingreso', 'consulta', ?, ?, ?, ?, ?, ?, 'presupuesto_consulta', ?)`,
      [
        montoConsulta,
        `Consulta - ${nombresTratamientos} - ${nombrePaciente}`,
        ahora.split(' ')[0],
        metodo_pago || 'efectivo',
        presupuesto.paciente_id,
        presupuesto_asignado_id,
        ahora
      ]
    );

    res.json({ 
      message: `✅ Pago de consulta registrado exitosamente`,
      monto_consulta: montoConsulta,
      descuento_anterior: descuentoActual,
      descuento_nuevo: nuevoDescuento,
      descuento_aplicado: montoConsulta
    });
  } catch (err) {
    console.error("❌ Error al registrar pago de consulta en presupuesto:", err.message);
    res.status(500).json({ message: "Error al registrar pago de consulta" });
  }
});

/* ==============================
   💰 REGISTRAR PAGO DE PRESUPUESTO (Total o Adelanto)
============================== */
router.post("/presupuesto/:presupuesto_asignado_id/pago", requirePaquetesAsignar, async (req, res) => {
  const { presupuesto_asignado_id } = req.params;
  const { monto, metodo_pago, descripcion, tipo_pago } = req.body;
  // tipo_pago: 'total', 'adelanto', 'saldo'

  try {
    const presupuesto = await dbGet(
      `SELECT pa.*, p.nombre as paciente_nombre, p.dni as paciente_dni
       FROM presupuestos_asignados pa
       JOIN patients p ON pa.paciente_id = p.id
       WHERE pa.id = ?`,
      [presupuesto_asignado_id]
    );

    if (!presupuesto) {
      return res.status(404).json({ message: "Presupuesto asignado no encontrado" });
    }

    const ahora = fechaLima();
    const montoRecibido = parseFloat(monto) || 0;
    const precioTotal = parseFloat(presupuesto.precio_total) || 0;
    const descuento = parseFloat(presupuesto.descuento) || 0;
    const precioConDescuento = precioTotal - descuento; // Total real a pagar
    const montoYaPagado = parseFloat(presupuesto.monto_pagado) || 0;
    const adelantoAnterior = parseFloat(presupuesto.monto_adelanto) || 0;

    let nuevoMontoPagado = montoYaPagado + montoRecibido;
    let nuevoAdelanto = adelantoAnterior;
    let nuevoSaldo = precioConDescuento - nuevoMontoPagado; // Usar precio con descuento
    let estadoPago = 'pendiente_pago';
    let pagadoFlag = 0;

    if (tipo_pago === 'adelanto') {
      // Es un adelanto
      nuevoAdelanto = adelantoAnterior + montoRecibido;
      estadoPago = 'adelanto';
      pagadoFlag = 0;
    } else if (tipo_pago === 'saldo' || nuevoMontoPagado >= precioConDescuento) {
      // Pago del saldo restante o pago total (comparar con precio con descuento)
      estadoPago = 'pagado';
      pagadoFlag = 1;
      nuevoSaldo = 0;
    } else if (nuevoMontoPagado > 0) {
      // Pago parcial
      estadoPago = 'adelanto';
      pagadoFlag = 0;
    }

    // Actualizar presupuesto
    await dbRun(
      `UPDATE presupuestos_asignados 
       SET pagado = ?, monto_pagado = ?, monto_adelanto = ?, saldo_pendiente = ?, 
           estado_pago = ?, fecha_pago = ?, metodo_pago = ?
       WHERE id = ?`,
      [pagadoFlag, nuevoMontoPagado, nuevoAdelanto, nuevoSaldo, estadoPago, ahora, metodo_pago || 'efectivo', presupuesto_asignado_id]
    );

    // Registrar en finanzas como ingreso - extraer nombres de tratamientos
    const tipoDesc = tipo_pago === 'adelanto' ? 'Adelanto' : tipo_pago === 'saldo' ? 'Saldo' : 'Pago';
    let nombresTratamientos = '';
    try {
      const tratamientos = presupuesto.tratamientos_json ? JSON.parse(presupuesto.tratamientos_json) : [];
      nombresTratamientos = tratamientos.map(t => t.nombre).join(', ');
    } catch (e) {
      nombresTratamientos = 'Presupuesto';
    }
    
    await dbRun(
      `INSERT INTO finanzas (tipo, categoria, monto, descripcion, fecha, metodo_pago, paciente_id, referencia_id, referencia_tipo, creado_en)
       VALUES ('ingreso', 'presupuesto', ?, ?, ?, ?, ?, ?, 'presupuesto_asignado', ?)`,
      [
        montoRecibido,
        descripcion || `${nombresTratamientos} - ${presupuesto.paciente_nombre}`,
        ahora.split(' ')[0],
        metodo_pago || 'efectivo',
        presupuesto.paciente_id,
        presupuesto_asignado_id,
        ahora
      ]
    );

    res.json({ 
      message: `✅ ${tipoDesc} registrado exitosamente`,
      monto_pagado: nuevoMontoPagado,
      saldo_pendiente: nuevoSaldo,
      estado_pago: estadoPago
    });
  } catch (err) {
    console.error("❌ Error al registrar pago:", err.message);
    res.status(500).json({ message: "Error al registrar pago" });
  }
});

export default router;
