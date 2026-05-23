import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import { consumirStockFEFO } from "../services/inventoryOps.js";
import db, { dbAll, dbRun, dbGet } from "../db/database.js";
import { authMiddleware, requireDoctor, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Helper: parsear número que puede tener coma como separador decimal
const parseNum = (val) => {
  if (val == null || val === "") return 0;
  const str = String(val).replace(",", ".");
  return parseFloat(str) || 0;
};

// Middlewares específicos de tratamientos
const requireTreatmentBaseCreate = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "doctor" && role !== "asistente" && role !== "admin" && role !== "master") {
    return res.status(403).json({ message: "No tienes permisos para crear tratamientos" });
  }
  next();
};

const requireTratamientoRealizadoWrite = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "doctor" && role !== "asistente" && role !== "admin" && role !== "master") {
    return res.status(403).json({ message: "No tienes permisos para registrar tratamientos" });
  }
  next();
};

router.use(authMiddleware);

/* ==============================
   📁 CONFIGURAR SUBIDA DE FOTOS
============================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/* ==============================
   💊 CRUD TRATAMIENTOS BASE
============================== */

// ✅ Crear tratamiento
router.post("/crear", requireTreatmentBaseCreate, (req, res) => {
  const { nombre, descripcion, precio, procedimiento } = req.body;
  if (!nombre) {
    return res.status(400).json({ message: "Falta nombre" });
  }
  const precioNum = precio == null || precio === "" ? null : parseFloat(precio);
  if (precioNum != null && (isNaN(precioNum) || precioNum < 0)) {
    return res.status(400).json({ message: "Precio inválido" });
  }

  const procValid = ["Armonización", "Cosmiatría Facial", "Cosmiatría Corporal"];
  const procStr = procedimiento && procValid.includes(procedimiento) ? procedimiento : null;

  db.run(
    `INSERT INTO tratamientos (nombre, descripcion, precio, procedimiento) VALUES (?, ?, ?, ?)`,
    [nombre, descripcion || "", precioNum, procStr],
    function (err) {
      if (err)
        return res.status(500).json({ message: "Error al crear tratamiento" });
      res.json({ id: this.lastID, nombre, descripcion: descripcion || "", precio: precioNum, procedimiento: procStr });
    }
  );
});

// ✅ Listar tratamientos
router.get("/listar", (req, res) => {
  db.all("SELECT * FROM tratamientos ORDER BY id DESC", [], (err, rows) => {
    if (err)
      return res.status(500).json({ message: "Error al listar tratamientos" });
    res.json(rows);
  });
});

// ✅ Conteo de uso por tratamiento (para ordenar por más usados)
router.get("/uso-conteo", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT tratamiento_id, COUNT(*) AS uso
      FROM (
        SELECT tratamiento_id FROM tratamientos_realizados WHERE tratamiento_id IS NOT NULL
        UNION ALL
        SELECT tratamiento_id FROM presupuestos_sesiones WHERE tratamiento_id IS NOT NULL
      )
      GROUP BY tratamiento_id
      ORDER BY uso DESC
    `);
    res.json(rows || []);
  } catch (err) {
    console.error("Error al obtener conteo de uso:", err.message);
    res.json([]);
  }
});

router.delete("/eliminar/:id", requireDoctor, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun(`DELETE FROM tratamientos WHERE id = ?`, [id]);
    res.json({ message: "✅ Tratamiento eliminado" });
  } catch (err) {
    console.error("❌ Error al eliminar tratamiento:", err.message);
    res.status(500).json({ message: "Error al eliminar tratamiento" });
  }
});

// ========== RUTAS DE RECETAS (deben ir ANTES de /:id) ==========

// Obtener receta de un tratamiento (si existe)
router.get("/recetas/:tratamiento_id", async (req, res) => {
  try {
    const { tratamiento_id } = req.params;
    const id = Number(tratamiento_id);
    if (!id) {
      return res.status(400).json({ message: "tratamiento_id inválido" });
    }

    const rows = await dbAll(
      `
        SELECT
          rt.id,
          rt.tratamiento_id,
          rt.variante_id,
          rt.cantidad_unidades,
          v.nombre AS variante_nombre,
          v.precio_unitario,
          v.unidad_base,
          v.contenido_por_presentacion,
          pb.nombre AS producto_base_nombre
        FROM recetas_tratamiento rt
        LEFT JOIN variantes v ON v.id = rt.variante_id
        LEFT JOIN productos_base pb ON pb.id = v.producto_base_id
        WHERE rt.tratamiento_id = ?
        ORDER BY rt.id ASC
      `,
      [id]
    );

    res.json(rows || []);
  } catch (err) {
    console.error("Error al obtener receta del tratamiento:", err);
    res.status(500).json({ message: "Error al obtener receta del tratamiento" });
  }
});

// Agregar producto a la receta de un tratamiento
router.post("/recetas/:tratamiento_id", requireRole("doctor", "master", "doctora"), async (req, res) => {
  try {
    const { tratamiento_id } = req.params;
    const { variante_id, cantidad_unidades, unidad_mostrada, obligatorio } = req.body;

    if (!variante_id) {
      return res.status(400).json({ message: "variante_id es requerido" });
    }

    const existe = await dbAll(
      `SELECT id FROM recetas_tratamiento WHERE tratamiento_id = ? AND variante_id = ?`,
      [tratamiento_id, variante_id]
    );

    if (existe && existe.length > 0) {
      return res.status(400).json({ message: "Este producto ya está en la receta del tratamiento" });
    }

    const result = await dbRun(
      `INSERT INTO recetas_tratamiento (tratamiento_id, variante_id, cantidad_unidades, unidad_mostrada, obligatorio)
       VALUES (?, ?, ?, ?, ?)`,
      [
        tratamiento_id,
        variante_id,
        cantidad_unidades || 1,
        unidad_mostrada || null,
        obligatorio !== undefined ? (obligatorio ? 1 : 0) : 1
      ]
    );

    res.json({ id: result.lastID, message: "Producto agregado a la receta" });
  } catch (err) {
    console.error("Error al agregar producto a receta:", err);
    res.status(500).json({ message: "Error al agregar producto a la receta" });
  }
});

// Eliminar producto de la receta de un tratamiento
router.delete("/recetas/:tratamiento_id/:variante_id", requireRole("doctor", "master", "doctora"), async (req, res) => {
  try {
    const { tratamiento_id, variante_id } = req.params;

    await dbRun(
      `DELETE FROM recetas_tratamiento WHERE tratamiento_id = ? AND variante_id = ?`,
      [tratamiento_id, variante_id]
    );

    res.json({ message: "Producto eliminado de la receta" });
  } catch (err) {
    console.error("Error al eliminar producto de receta:", err);
    res.status(500).json({ message: "Error al eliminar producto de la receta" });
  }
});

// Actualizar cantidad de producto en receta
router.put("/recetas/:tratamiento_id/:variante_id", requireRole("doctor", "master", "doctora"), async (req, res) => {
  try {
    const { tratamiento_id, variante_id } = req.params;
    const { cantidad_unidades, unidad_mostrada, obligatorio } = req.body;

    await dbRun(
      `UPDATE recetas_tratamiento 
       SET cantidad_unidades = COALESCE(?, cantidad_unidades),
           unidad_mostrada = COALESCE(?, unidad_mostrada),
           obligatorio = COALESCE(?, obligatorio)
       WHERE tratamiento_id = ? AND variante_id = ?`,
      [
        cantidad_unidades,
        unidad_mostrada,
        obligatorio !== undefined ? (obligatorio ? 1 : 0) : null,
        tratamiento_id,
        variante_id
      ]
    );

    res.json({ message: "Receta actualizada" });
  } catch (err) {
    console.error("Error al actualizar receta:", err);
    res.status(500).json({ message: "Error al actualizar receta" });
  }
});

// ========== FIN RUTAS DE RECETAS ==========

router.put("/:id", requireDoctor, async (req, res) => {
  const { id } = req.params;
  const idNum = Number(id);
  const { nombre, descripcion, precio, procedimiento } = req.body || {};

  if (!Number.isFinite(idNum) || idNum <= 0) {
    return res.status(400).json({ message: "ID inválido" });
  }

  const nombreStr = typeof nombre === "string" ? nombre.trim() : "";
  if (!nombreStr) {
    return res.status(400).json({ message: "Falta nombre" });
  }

  const precioNum = precio == null || precio === "" ? null : parseFloat(precio);
  if (precioNum != null && (isNaN(precioNum) || precioNum < 0)) {
    return res.status(400).json({ message: "Precio inválido" });
  }

  const descripcionStr = typeof descripcion === "string" ? descripcion : "";

  const procValid = ["Armonización", "Cosmiatría Facial", "Cosmiatría Corporal"];
  const procStr = procedimiento && procValid.includes(procedimiento) ? procedimiento : null;

  try {
    const result = await dbRun(
      `UPDATE tratamientos SET nombre = ?, descripcion = ?, precio = ?, procedimiento = ? WHERE id = ?`,
      [nombreStr, descripcionStr, precioNum, procStr, idNum]
    );

    if ((result?.changes || 0) === 0) {
      return res.status(404).json({ message: "Tratamiento no encontrado" });
    }

    res.json({ id: idNum, nombre: nombreStr, descripcion: descripcionStr, precio: precioNum, procedimiento: procStr });
  } catch (err) {
    console.error("❌ Error al editar tratamiento:", err.message);
    res.status(500).json({ message: "Error al editar tratamiento" });
  }
});

router.post("/reset", requireDoctor, async (req, res) => {
  const lista = [
    { nombre: "Modulación 1/3 superior", precio: 1200 },
    { nombre: "Modulación Maseteros", precio: 1500 },
    { nombre: "Modulación Peribucal", precio: 1200 },
    { nombre: "Modulación Nefertiti", precio: 1200 },
    { nombre: "Rinomodelación", precio: 1200 },
    { nombre: "Proyección de Mentón", precio: 1200 },
    { nombre: "Marcación Mandibular", precio: 1200 },
    { nombre: "Diseño de Labios", precio: 1200 },
    { nombre: "Proyección de Pómulos", precio: 1200 },
    { nombre: "Lifting de Surcos Nasogenianos", precio: 1200 },
    { nombre: "Bioestimuladores de Colágeno", precio: 2700 },
    { nombre: "Rejuvenecimiento Periocular", precio: 1500 },
    { nombre: "Revitalización Facial Integral", precio: 1500 },
    { nombre: "Bioestimulación intensiva a ti-edad", precio: 1500 },
    { nombre: "Lifting Bioestructural avanzado", precio: 1500 },
    { nombre: "Lipomapada Enzimática", precio: 1800 },
    { nombre: "Reducción corporal enzimática", precio: 1800 },
    { nombre: "Regeneración celular Facial", precio: 1800 },
    { nombre: "Hifu Facial", precio: 700 },
    { nombre: "Hifu Corporal", precio: 700 },
    { nombre: "Peeling Hollywood", precio: 500 },
  ];

  try {
    await dbRun("BEGIN TRANSACTION");
    await dbRun("DELETE FROM tratamientos");
    await dbRun("DELETE FROM sqlite_sequence WHERE name = 'tratamientos'");
    for (const t of lista) {
      await dbRun(
        `INSERT INTO tratamientos (nombre, descripcion, precio) VALUES (?, ?, ?)`,
        [t.nombre, "", t.precio]
      );
    }
    await dbRun("COMMIT");
    res.json({ message: "✅ Tratamientos reseteados", count: lista.length });
  } catch (err) {
    try {
      await dbRun("ROLLBACK");
    } catch (_) {}
    console.error("❌ Error reseteando tratamientos:", err.message);
    res.status(500).json({ message: "Error al resetear tratamientos" });
  }
});

/* ==============================
   📦 PRODUCTOS Y MARCAS
============================== */

router.get("/productos", (req, res) => {
  db.all("SELECT * FROM inventario ORDER BY producto ASC", [], (err, rows) => {
    if (err)
      return res.status(500).json({ message: "Error al obtener productos" });
    res.json(rows);
  });
});

router.get("/marcas", (req, res) => {
  db.all(
    "SELECT DISTINCT marca FROM inventario WHERE marca IS NOT NULL AND marca != '' ORDER BY marca ASC",
    [],
    (err, rows) => {
      if (err)
        return res.status(500).json({ message: "Error al obtener marcas" });
      res.json(rows);
    }
  );
});

/* ==============================
   💉 REGISTRO DE TRATAMIENTOS REALIZADOS
   - Soporta recetas_tratamiento + variantes + stock_lotes (FEFO, cantidades decimales)
   - Mantiene compatibilidad con inventario clásico cuando no hay receta
============================== */

router.post("/realizado", requireTratamientoRealizadoWrite, upload.array("fotos", 6), async (req, res) => {
  try {
    const { paciente_id, productos, pagoMetodo, sesion, especialista, tipoAtencion, sinPago } = req.body;
    const productosData = JSON.parse(productos);
    
    // Si sinPago es true, no se registra en finanzas (pagos se manejan desde historial)
    const esSinPago = sinPago === "true" || sinPago === true;

    if (!productosData || productosData.length === 0) {
      return res.status(400).json({ message: "No se enviaron tratamientos" });
    }

    const fechaLocal = new Date()
      .toLocaleString("sv-SE", { timeZone: "America/Lima" })
      .replace("T", " ")
      .slice(0, 19);

    // 1) VALIDAR STOCK PARA TODOS LOS TRATAMIENTOS QUE TENGAN RECETA
    //    Si el doctor eligió una variante específica, se salta la validación por receta
    //    y se valida solo la variante elegida en el paso 1.b
    //    En Retoque sin producto seleccionado, se salta la validación de receta
    const esRetoque = tipoAtencion === "Retoque";
    for (const b of productosData) {
      if (!b.tratamiento_id) continue; // sin tratamiento asociado, usa flujo clásico
      if (b.variante_id) continue; // variante elegida manualmente → validar en paso 1.b
      if (esRetoque) continue; // en retoque sin producto, no validar receta

      const recetas = await dbAll(
        `SELECT * FROM recetas_tratamiento WHERE tratamiento_id = ?`,
        [b.tratamiento_id]
      );

      if (!recetas || recetas.length === 0) continue; // tratamiento sin receta, flujo clásico

      const factorCantidad =
        parseNum(b.dosis_unidades) > 0
          ? parseNum(b.dosis_unidades)
          : parseNum(b.cantidad) > 0
            ? parseNum(b.cantidad)
            : 1;

      for (const receta of recetas) {
        const cantidadNecesaria = receta.cantidad_unidades * factorCantidad; // siempre en unidades base

        const lotes = await dbAll(
          `
            SELECT *
            FROM stock_lotes
            WHERE variante_id = ? AND cantidad_unidades > 0
              AND (estado IS NULL OR estado = 'Disponible')
            ORDER BY (fecha_vencimiento IS NULL) ASC, fecha_vencimiento ASC, id ASC
          `,
          [receta.variante_id]
        );

        const disponibleTotal = lotes.reduce((sum, l) => {
          const dispo = (l.cantidad_unidades || 0) - (l.cantidad_reservada_unidades || 0);
          return sum + Math.max(0, dispo);
        }, 0);

        if (disponibleTotal < cantidadNecesaria) {
          const varianteRows = await dbAll(
            `SELECT nombre FROM variantes WHERE id = ?`,
            [receta.variante_id]
          );
          const nombreVariante = varianteRows[0]?.nombre || "variante";
          return res.status(400).json({
            message: `Stock insuficiente para ${nombreVariante}. Necesario: ${cantidadNecesaria}, disponible: ${disponibleTotal}`,
          });
        }
      }
    }

    // 1.b) VALIDAR STOCK PARA LOS BLOQUES CON VARIANTE SELECCIONADA (siempre que se quiera consumir por producto elegido)
    for (const b of productosData) {
      const varianteId = b.variante_id ? Number(b.variante_id) : null;
      if (!varianteId) continue;

      const cantidadNecesaria =
        parseNum(b.dosis_unidades) > 0
          ? parseNum(b.dosis_unidades)
          : parseNum(b.cantidad) > 0
            ? parseNum(b.cantidad)
            : 0;
      if (!(cantidadNecesaria > 0)) continue;

      const lotes = await dbAll(
        `
          SELECT *
          FROM stock_lotes
          WHERE variante_id = ? AND cantidad_unidades > 0
            AND (estado IS NULL OR estado = 'Disponible')
          ORDER BY (fecha_vencimiento IS NULL) ASC, fecha_vencimiento ASC, id ASC
        `,
        [varianteId]
      );

      const disponibleTotal = lotes.reduce((sum, l) => {
        const dispo = (l.cantidad_unidades || 0) - (l.cantidad_reservada_unidades || 0);
        return sum + Math.max(0, dispo);
      }, 0);

      if (disponibleTotal < cantidadNecesaria) {
        const varianteRows = await dbAll(
          `SELECT nombre FROM variantes WHERE id = ?`,
          [varianteId]
        );
        const nombreVariante = varianteRows[0]?.nombre || "variante";
        return res.status(400).json({
          message: `Stock insuficiente para ${nombreVariante}. Necesario: ${cantidadNecesaria}, disponible: ${disponibleTotal}`,
        });
      }
    }

    // 2) REGISTRAR TRATAMIENTOS Y DESCONTAR STOCK (RECETAS + FEFO)
    for (const b of productosData) {
      const descuentoPct = parseFloat(b.descuento) || 0;

      const tratamientoId = b.tratamiento_id ? Number(b.tratamiento_id) : null;

      const recetaDetallada = tratamientoId
        ? await dbAll(
            `
              SELECT
                rt.variante_id,
                rt.cantidad_unidades,
                v.precio_unitario
              FROM recetas_tratamiento rt
              LEFT JOIN variantes v ON v.id = rt.variante_id
              WHERE rt.tratamiento_id = ?
            `,
            [tratamientoId]
          )
        : [];

      // Usar el total calculado por el frontend (precio * cantidad - descuento)
      const precioUnitario = parseNum(b.precio);
      const cantidadMl = parseNum(b.cantidad) || 1;
      const totalDelFrontend = parseNum(b.total);
      
      // Si el frontend envía total, usarlo; sino calcular
      let subtotal = totalDelFrontend > 0 ? totalDelFrontend : precioUnitario * cantidadMl;
      
      // Si aún no hay subtotal, intentar obtener precio de la variante
      if (!(subtotal > 0) && b.variante_id) {
        const v = await dbGet(`SELECT precio_cliente, precio_unitario FROM variantes WHERE id = ?`, [b.variante_id]);
        const precioVariante = parseFloat(v?.precio_cliente) || parseFloat(v?.precio_unitario) || 0;
        subtotal = precioVariante * cantidadMl;
      }

      // Permitir precio 0 si viene de un paquete o si es sin pago
      if (!(subtotal > 0) && !b.sesion_paquete_id && !esSinPago) {
        return res.status(400).json({ message: "No se pudo calcular el precio del tratamiento. Establece un precio o selecciona un producto." });
      }

      // El descuento ya está aplicado en el total del frontend, pero por si acaso
      const totalFinal = subtotal;
      const cantidadParaPrecio = cantidadMl;

      // Obtener información completa del producto/variante para guardar
      let nombreProducto = b.producto || "Producto";
      let varianteNombre = null;
      
      if (b.variante_id) {
        const varianteInfo = await dbGet(
          `SELECT v.nombre as variante_nombre, pb.nombre as producto_base_nombre
           FROM variantes v
           LEFT JOIN productos_base pb ON v.producto_base_id = pb.id
           WHERE v.id = ?`,
          [b.variante_id]
        );
        
        if (varianteInfo) {
          nombreProducto = varianteInfo.producto_base_nombre || nombreProducto;
          varianteNombre = varianteInfo.variante_nombre;
        }
      }

      // Registrar tratamiento realizado
      const insertTratamiento = await dbRun(
        `
          INSERT INTO tratamientos_realizados
          (paciente_id, tratamiento_id, productos, cantidad_total, precio_total, descuento, pagoMetodo, especialista, sesion, tipoAtencion, fecha)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          paciente_id,
          b.tratamiento_id || null,
          JSON.stringify([
            {
              nombre: nombreProducto,
              variante_nombre: varianteNombre,
              producto: b.producto,
              cantidad: cantidadParaPrecio,
              precio: precioUnitario,
              variante_id: b.variante_id || null,
            },
          ]),
          cantidadParaPrecio,
          totalFinal,
          b.descuento || 0,
          pagoMetodo,
          especialista || "No especificado",
          sesion || 1,
          tipoAtencion || "Tratamiento",
          fechaLocal,
        ]
      );

      const tratamientoRealizadoId = insertTratamiento.lastID;
      console.log(
        `✅ Tratamiento registrado correctamente (ID ${tratamientoRealizadoId})`
      );

      // Obtener nombre del paciente para descripción
      const pacienteInfo = await dbGet(`SELECT nombre, apellido FROM patients WHERE id = ?`, [paciente_id]);
      const nombrePaciente = pacienteInfo ? `${pacienteInfo.nombre} ${pacienteInfo.apellido || ''}`.trim() : `Paciente #${paciente_id}`;
      const nombreTratamiento = b.producto || 'Tratamiento';

      // Solo procesar pagos si NO es sinPago
      if (!esSinPago) {
        const pagoEnPartes =
          b.pago_en_partes === true ||
          b.pago_en_partes === 1 ||
          String(b.pago_en_partes || "").toLowerCase() === "true";
        if (pagoEnPartes) {
          const adelanto = parseFloat(b.monto_adelanto);
          if (!(adelanto > 0)) {
            return res.status(400).json({ message: "Monto de adelanto inválido" });
          }

          if (!(totalFinal > 0)) {
            return res.status(400).json({ message: "Monto total inválido" });
          }

          if (adelanto >= totalFinal) {
            return res.status(400).json({ message: "El adelanto debe ser menor al total" });
          }

          const saldo = totalFinal - adelanto;

          const deudaInsert = await dbRun(
            `
              INSERT INTO deudas_tratamientos
              (paciente_id, tratamiento_realizado_id, tratamiento_id, monto_total, monto_adelanto, monto_saldo, estado, creado_en)
              VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?)
            `,
            [
              paciente_id,
              tratamientoRealizadoId,
              b.tratamiento_id || null,
              totalFinal,
              adelanto,
              saldo,
              fechaLocal,
            ]
          );

          const deudaId = deudaInsert?.lastID;
          if (deudaId) {
            await dbRun(
              `
                INSERT INTO deudas_pagos (deuda_id, numero, monto, metodo, creado_en)
                VALUES (?, 1, ?, ?, ?)
              `,
              [deudaId, adelanto, pagoMetodo || "Desconocido", fechaLocal]
            );
          }

          // 💰 Registrar adelanto en finanzas
          await dbRun(
            `INSERT INTO finanzas (tipo, categoria, monto, descripcion, fecha, metodo_pago, paciente_id, referencia_id, referencia_tipo, creado_en)
             VALUES ('ingreso', 'tratamiento', ?, ?, ?, ?, ?, ?, 'tratamiento_realizado', ?)`,
            [
              adelanto,
              `Adelanto - ${nombreTratamiento} - ${nombrePaciente}`,
              fechaLocal.split(' ')[0],
              pagoMetodo || 'efectivo',
              paciente_id,
              tratamientoRealizadoId,
              fechaLocal
            ]
          );
        } else if (totalFinal > 0) {
          // 💰 Registrar pago completo en finanzas (solo si no es pago en partes y hay monto)
          await dbRun(
            `INSERT INTO finanzas (tipo, categoria, monto, descripcion, fecha, metodo_pago, paciente_id, referencia_id, referencia_tipo, creado_en)
             VALUES ('ingreso', 'tratamiento', ?, ?, ?, ?, ?, ?, 'tratamiento_realizado', ?)`,
            [
              totalFinal,
              `${nombreTratamiento} - ${nombrePaciente}`,
              fechaLocal.split(' ')[0],
              pagoMetodo || 'efectivo',
              paciente_id,
              tratamientoRealizadoId,
              fechaLocal
            ]
          );
        }
      }

      // Intentar usar receta_tratamiento si existe
      // Si el doctor eligió una variante específica, se salta la receta y se usa el flujo directo
      // En Retoque sin producto seleccionado, no descontar stock por receta
      let usoReceta = false;
      const varianteElegidaDirecta = b.variante_id ? Number(b.variante_id) : null;
      if (b.tratamiento_id && !varianteElegidaDirecta && !esRetoque) {
        const recetas = await dbAll(
          `SELECT * FROM recetas_tratamiento WHERE tratamiento_id = ?`,
          [b.tratamiento_id]
        );

        if (recetas && recetas.length > 0) {
          usoReceta = true;

          // Usar cantidad (ml) directamente
          const cantidadParaStock = parseNum(b.cantidad) || 1;

          // Por cada ingrediente de la receta, aplicar FEFO y descontar lotes
          for (const receta of recetas) {
            const cantidadNecesaria = receta.cantidad_unidades * cantidadParaStock;

            // Crear cabecera de movimiento por cada ingrediente (mantiene trazabilidad clara)
            const movimiento = await dbRun(
              `
                INSERT INTO movimientos_inventario
                (tipo, motivo, referencia_tipo, referencia_id, usuario)
                VALUES ('salida', 'tratamiento', 'tratamientos_realizados', ?, ?)
              `,
              [tratamientoRealizadoId, especialista || "No especificado"]
            );

            const result = await consumirStockFEFO({
              dbAll,
              dbRun,
              movimientoId: movimiento.lastID,
              varianteId: receta.variante_id,
              cantidad: cantidadNecesaria,
              stockLoteId: null,
            });

            if (!result.ok) {
              return res.status(result.status).json({ message: result.message });
            }
          }
        }
      }

      // Validación de códigos de producto contra códigos de barras en inventario
      const varianteIdElegida = b.variante_id ? Number(b.variante_id) : null;
      const cantidadElegida =
        parseNum(b.dosis_unidades) > 0
          ? parseNum(b.dosis_unidades)
          : parseNum(b.cantidad) || 0;

      if (varianteIdElegida) {
        // Si se seleccionó un producto, DEBE tener códigos válidos
        const codigos = b.codigos || [];
        if (!codigos || codigos.length === 0) {
          return res.status(400).json({ 
            message: `Debes ingresar al menos un código del producto para validar el inventario.` 
          });
        }

        // Validar cada código y verificar que hay suficientes unidades
        for (const codigoItem of codigos) {
          const codigoIngresado = (codigoItem.codigo || "").trim();
          const unidadesUsadas = parseNum(codigoItem.unidades_usadas) || 0;

          if (!codigoIngresado) {
            return res.status(400).json({ 
              message: `Todos los códigos deben tener un valor.` 
            });
          }

          // Verificar que el código ingresado coincida con algún código disponible de esta variante
          const codigoValido = await dbGet(
            `SELECT bu.id, bu.barcode, bu.lote_id, bu.unidades_totales, bu.unidades_restantes, bu.status
             FROM barcode_units bu
             LEFT JOIN stock_lotes sl ON sl.id = bu.lote_id
             WHERE sl.variante_id = ?
               AND bu.barcode = ?
               AND (bu.status = 'active' OR bu.unidades_restantes > 0)
             LIMIT 1`,
            [varianteIdElegida, codigoIngresado]
          );

          if (!codigoValido) {
            return res.status(400).json({ 
              message: `Código incorrecto o agotado: ${codigoIngresado}. No coincide con ningún código disponible de este producto.` 
            });
          }

          // Verificar que hay suficientes unidades restantes en este código
          const unidadesRestantes = parseFloat(codigoValido.unidades_restantes) || 0;
          if (unidadesUsadas > 0 && unidadesRestantes > 0 && unidadesUsadas > unidadesRestantes) {
            return res.status(400).json({ 
              message: `El código ${codigoIngresado} solo tiene ${unidadesRestantes} unidades restantes. Necesitas ${unidadesUsadas}.` 
            });
          }
        }

        // Códigos validados - proceder con descuento de stock usando FEFO
        if (!usoReceta && cantidadElegida > 0) {
          const movimiento = await dbRun(
            `
              INSERT INTO movimientos_inventario
              (tipo, motivo, referencia_tipo, referencia_id, usuario)
              VALUES ('salida', 'tratamiento', 'tratamientos_realizados', ?, ?)
            `,
            [tratamientoRealizadoId, especialista || "No especificado"]
          );

          const result = await consumirStockFEFO({
            dbAll,
            dbRun,
            movimientoId: movimiento.lastID,
            varianteId: varianteIdElegida,
            cantidad: cantidadElegida,
            stockLoteId: null,
          });

          if (!result.ok) {
            return res.status(result.status).json({ message: result.message });
          }
        }

        // Actualizar unidades restantes del código de barras
        const nuevasRestantes = Math.max(0, unidadesRestantes - (cantidadElegida || 0));
        if (nuevasRestantes <= 0) {
          // Agotado: marcar como escaneado/usado
          await dbRun(
            `UPDATE barcode_units 
             SET status = 'scanned', scanned_at = datetime('now', '-5 hours'), treatment_id = ?, unidades_restantes = 0
             WHERE id = ?`,
            [tratamientoRealizadoId, codigoValido.id]
          );
        } else {
          // Aún tiene unidades: mantener activo con las restantes actualizadas
          await dbRun(
            `UPDATE barcode_units 
             SET unidades_restantes = ?, treatment_id = ?
             WHERE id = ?`,
            [nuevasRestantes, tratamientoRealizadoId, codigoValido.id]
          );
        }
      } else if (!usoReceta && !varianteIdElegida) {
        // Compatibilidad con inventario clásico solo si no hay receta y no se eligió variante.
        await dbRun(
          `UPDATE inventario SET stock = stock - ? WHERE producto = ?`,
          [b.cantidad, b.producto]
        );
      }
    }

    // 3) MARCAR AUTOMÁTICAMENTE LAS SESIONES DE PAQUETES/PRESUPUESTOS COMO COMPLETADAS
    console.log("🔍 Buscando sesiones de paquetes/presupuestos para marcar como completadas...");
    
    // Resolver especialista_id a partir del nombre
    let especialistaIdResuelto = null;
    if (especialista && especialista !== 'No especificado') {
      const espRow = await dbGet(
        `SELECT id FROM especialistas WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))`,
        [especialista]
      );
      if (espRow) especialistaIdResuelto = espRow.id;
    }

    for (const b of productosData) {
      const tratamientoId = b.tratamiento_id;
      if (!tratamientoId) continue;

      // Buscar sesiones pendientes de paquetes para este paciente y tratamiento
      const sesionesPaquete = await dbAll(
        `SELECT ps.id, ps.paquete_paciente_id
         FROM paquetes_sesiones ps
         LEFT JOIN paquetes_pacientes pp ON ps.paquete_paciente_id = pp.id
         WHERE pp.paciente_id = ?
           AND ps.tratamiento_id = ?
           AND ps.estado = 'pendiente'
         ORDER BY ps.sesion_numero ASC
         LIMIT 1`,
        [paciente_id, tratamientoId]
      );

      if (sesionesPaquete.length > 0) {
        const sesionPaquete = sesionesPaquete[0];
        console.log(`✅ Marcando sesión de paquete ${sesionPaquete.id} como completada`);
        
        await dbRun(
          `UPDATE paquetes_sesiones 
           SET estado = 'completada', 
               fecha_realizada = datetime('now', 'localtime'),
               especialista = ?,
               especialista_id = ?,
               notas = ?
           WHERE id = ?`,
          [especialista || "No especificado", especialistaIdResuelto, `Sesión ${sesion || 1}`, sesionPaquete.id]
        );

        // Verificar si todas las sesiones del paquete están completadas
        const paquetePaciente = await dbGet(
          `SELECT pp.*, 
            (SELECT COUNT(*) FROM paquetes_sesiones ps WHERE ps.paquete_paciente_id = pp.id AND ps.estado = 'completada') as completadas,
            (SELECT COUNT(*) FROM paquetes_sesiones ps WHERE ps.paquete_paciente_id = pp.id) as total
           FROM paquetes_pacientes pp
           WHERE pp.id = ?`,
          [sesionPaquete.paquete_paciente_id]
        );

        if (paquetePaciente && paquetePaciente.completadas >= paquetePaciente.total) {
          console.log(`✅ Todas las sesiones del paquete ${sesionPaquete.paquete_paciente_id} completadas. Marcando paquete como completado.`);
          await dbRun(
            `UPDATE paquetes_pacientes 
             SET estado = 'completado', 
                 fecha_fin = datetime('now', 'localtime')
             WHERE id = ?`,
            [sesionPaquete.paquete_paciente_id]
          );
        }
      }

      // Buscar sesiones pendientes de presupuestos
      const sesionesPresupuesto = await dbAll(
        `SELECT prs.id, prs.presupuesto_asignado_id
         FROM presupuestos_sesiones prs
         LEFT JOIN presupuestos_asignados pa ON prs.presupuesto_asignado_id = pa.id
         WHERE pa.paciente_id = ?
           AND prs.tratamiento_id = ?
           AND prs.estado = 'pendiente'
         ORDER BY prs.sesion_numero ASC
         LIMIT 1`,
        [paciente_id, tratamientoId]
      );

      if (sesionesPresupuesto.length > 0) {
        const sesionPresupuesto = sesionesPresupuesto[0];
        console.log(`✅ Marcando sesión de presupuesto ${sesionPresupuesto.id} como completada`);
        
        await dbRun(
          `UPDATE presupuestos_sesiones 
           SET estado = 'completada', 
               fecha_realizada = datetime('now', 'localtime'),
               especialista = ?,
               especialista_id = ?,
               notas = ?
           WHERE id = ?`,
          [especialista || "No especificado", especialistaIdResuelto, `Sesión ${sesion || 1}`, sesionPresupuesto.id]
        );

        // Verificar si todas las sesiones del presupuesto están completadas
        const presupuestoAsignado = await dbGet(
          `SELECT pa.*, 
            (SELECT COUNT(*) FROM presupuestos_sesiones ps WHERE ps.presupuesto_asignado_id = pa.id AND ps.estado = 'completada') as completadas,
            (SELECT COUNT(*) FROM presupuestos_sesiones ps WHERE ps.presupuesto_asignado_id = pa.id) as total
           FROM presupuestos_asignados pa
           WHERE pa.id = ?`,
          [sesionPresupuesto.presupuesto_asignado_id]
        );

        if (presupuestoAsignado && presupuestoAsignado.completadas >= presupuestoAsignado.total) {
          console.log(`✅ Todas las sesiones del presupuesto ${sesionPresupuesto.presupuesto_asignado_id} completadas. Marcando presupuesto como completado.`);
          await dbRun(
            `UPDATE presupuestos_asignados 
             SET estado = 'completado'
             WHERE id = ?`,
            [sesionPresupuesto.presupuesto_asignado_id]
          );
        }
      }
    }

    res.json({ message: "✅ Tratamientos registrados correctamente" });
  } catch (error) {
    console.error("Error general en /realizado:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

/* ==============================
   📸 SUBIR FOTOS DEL TRATAMIENTO
============================== */

router.post(
  "/subir-fotos/:id",
  requireTratamientoRealizadoWrite,
  upload.fields([
    { name: "fotos", maxCount: 3 },
  ]),
  (req, res) => {
    const { id } = req.params;
    const archivos = req.files?.fotos || [];

    if (!archivos.length) {
      return res.status(400).json({ message: "No se han subido imágenes" });
    }

    if (archivos.length > 3) {
      return res.status(400).json({ message: "Solo puedes subir hasta 3 fotos por tratamiento" });
    }

    const camposFotos = ["foto_antes1", "foto_antes2", "foto_antes3"];
    const fotos = camposFotos.map((_, idx) => archivos[idx]?.filename || null);

    db.run(
      `UPDATE tratamientos_realizados
       SET foto_antes1 = ?, foto_antes2 = ?, foto_antes3 = ?,
           foto_despues1 = NULL, foto_despues2 = NULL, foto_despues3 = NULL,
           foto_izquierda = NULL, foto_frontal = NULL, foto_derecha = NULL,
           foto_extra1 = NULL, foto_extra2 = NULL, foto_extra3 = NULL
       WHERE id = ?`,
      [...fotos, id],
      function (err) {
        if (err) {
          console.error("❌ Error al guardar fotos:", err.message);
          return res.status(500).json({ message: "Error al guardar fotos" });
        }
        res.json({ message: "✅ Fotos guardadas correctamente" });
      }
    );
  }
);

/* ==============================
   � IMÁGENES DE PROTOCOLOS (tratamientos base)
============================== */

// Configurar almacenamiento para imágenes de protocolos
const storageTratamientos = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads/tratamientos";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `trat_${req.params.tratamientoId}_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const uploadTratamientoImg = multer({ storage: storageTratamientos });

// Subir imágenes a un tratamiento (máximo 6)
router.post(
  "/protocolo/:tratamientoId/imagenes",
  requireTreatmentBaseCreate,
  uploadTratamientoImg.array("imagenes", 6),
  async (req, res) => {
    const { tratamientoId } = req.params;
    const archivos = req.files || [];

    if (!archivos.length) {
      return res.status(400).json({ message: "No se han subido imágenes" });
    }

    // Verificar cuántas imágenes ya tiene
    const existentes = await dbAll(
      `SELECT COUNT(*) as count FROM tratamiento_imagenes WHERE tratamiento_id = ?`,
      [tratamientoId]
    );
    const actuales = existentes[0]?.count || 0;

    if (actuales + archivos.length > 6) {
      return res.status(400).json({
        message: `Solo puedes tener hasta 6 imágenes. Actualmente tienes ${actuales}.`,
      });
    }

    try {
      for (let i = 0; i < archivos.length; i++) {
        const url = `/uploads/tratamientos/${archivos[i].filename}`;
        await dbRun(
          `INSERT INTO tratamiento_imagenes (tratamiento_id, imagen_url, orden) VALUES (?, ?, ?)`,
          [tratamientoId, url, actuales + i]
        );
      }
      res.json({ message: `${archivos.length} imagen(es) subida(s) correctamente` });
    } catch (err) {
      console.error("❌ Error al guardar imágenes de tratamiento:", err.message);
      res.status(500).json({ message: "Error al guardar imágenes" });
    }
  }
);

// Obtener imágenes de un tratamiento
router.get("/protocolo/:tratamientoId/imagenes", async (req, res) => {
  const { tratamientoId } = req.params;
  try {
    const imagenes = await dbAll(
      `SELECT * FROM tratamiento_imagenes WHERE tratamiento_id = ? ORDER BY orden ASC`,
      [tratamientoId]
    );
    res.json(imagenes);
  } catch (err) {
    console.error("❌ Error al obtener imágenes:", err.message);
    res.status(500).json({ message: "Error al obtener imágenes" });
  }
});

// Eliminar una imagen de un tratamiento
router.delete("/protocolo/imagen/:imagenId", requireTreatmentBaseCreate, async (req, res) => {
  const { imagenId } = req.params;
  try {
    const imagen = await dbGet(
      `SELECT * FROM tratamiento_imagenes WHERE id = ?`,
      [imagenId]
    );
    if (!imagen) {
      return res.status(404).json({ message: "Imagen no encontrada" });
    }

    // Eliminar archivo físico
    const filePath = path.join(".", imagen.imagen_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await dbRun(`DELETE FROM tratamiento_imagenes WHERE id = ?`, [imagenId]);
    res.json({ message: "Imagen eliminada correctamente" });
  } catch (err) {
    console.error("❌ Error al eliminar imagen:", err.message);
    res.status(500).json({ message: "Error al eliminar imagen" });
  }
});

/* ==============================
   �📋 HISTORIAL CLÍNICO
============================== */

router.get("/historial/:paciente_id", (req, res) => {
  const { paciente_id } = req.params;
  const { tratamientoId, fechaDesde, fechaHasta } = req.query;

  const tratamientoIdNum = tratamientoId ? Number(tratamientoId) : null;
  const where = [];
  const params = [paciente_id];

  if (tratamientoIdNum) {
    where.push("tr.tratamiento_id = ?");
    params.push(tratamientoIdNum);
  }

  const fechaDesdeStr = typeof fechaDesde === "string" ? fechaDesde.trim() : "";
  const fechaHastaStr = typeof fechaHasta === "string" ? fechaHasta.trim() : "";
  if (fechaDesdeStr) {
    where.push("tr.fecha >= ?");
    params.push(`${fechaDesdeStr} 00:00:00`);
  }
  if (fechaHastaStr) {
    where.push("tr.fecha <= ?");
    params.push(`${fechaHastaStr} 23:59:59`);
  }

  const whereExtra = where.length ? `AND ${where.join(" AND ")}` : "";
  db.all(
    `
    SELECT tr.*, t.nombre AS nombreTratamiento
    FROM tratamientos_realizados tr
    LEFT JOIN tratamientos t ON t.id = tr.tratamiento_id
    WHERE tr.paciente_id = ?
    ${whereExtra}
    ORDER BY tr.fecha DESC
  `,
    params,
    (err, rows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Error al obtener historial clínico" });
      res.json(rows);
    }
  );
});

/* ==============================
   🗑️ CANCELAR TRATAMIENTO REALIZADO
============================== */
router.delete("/realizado/:id", requireTratamientoRealizadoWrite, async (req, res) => {
  const { id } = req.params;
  const tratamientoId = Number(id);

  if (!Number.isFinite(tratamientoId) || tratamientoId <= 0) {
    return res.status(400).json({ message: "ID de tratamiento inválido" });
  }

  try {
    // Verificar que el tratamiento existe
    const tratamiento = await dbGet(
      `SELECT * FROM tratamientos_realizados WHERE id = ?`,
      [tratamientoId]
    );

    if (!tratamiento) {
      return res.status(404).json({ message: "Tratamiento no encontrado" });
    }

    // Verificar si tiene deuda asociada
    const deuda = await dbGet(
      `SELECT * FROM deudas_tratamientos WHERE tratamiento_realizado_id = ?`,
      [tratamientoId]
    );

    if (deuda && deuda.estado === 'pendiente') {
      return res.status(400).json({ 
        message: "No se puede cancelar un tratamiento con deuda pendiente. Cancela la deuda primero." 
      });
    }

    // Eliminar el tratamiento
    await dbRun(`DELETE FROM tratamientos_realizados WHERE id = ?`, [tratamientoId]);

    res.json({ message: "✅ Tratamiento cancelado correctamente" });
  } catch (err) {
    console.error("❌ Error al cancelar tratamiento:", err.message);
    res.status(500).json({ message: "Error al cancelar tratamiento" });
  }
});

/* ==============================
   ✏️ EDITAR TRATAMIENTO REALIZADO
============================== */
router.put("/realizado/:id", requireTratamientoRealizadoWrite, async (req, res) => {
  const { id } = req.params;
  const tratamientoId = Number(id);

  if (!Number.isFinite(tratamientoId) || tratamientoId <= 0) {
    return res.status(400).json({ message: "ID de tratamiento inválido" });
  }

  const {
    especialista,
    sesion,
    precio_total,
    descuento,
    pagoMetodo,
    tipoAtencion,
    fecha,
    cantidad_total,
    producto_usado,
  } = req.body;

  try {
    // Verificar que el tratamiento existe
    const tratamiento = await dbGet(
      `SELECT * FROM tratamientos_realizados WHERE id = ?`,
      [tratamientoId]
    );

    if (!tratamiento) {
      return res.status(404).json({ message: "Tratamiento no encontrado" });
    }

    // Validaciones
    const especialistaStr = typeof especialista === "string" ? especialista.trim() : tratamiento.especialista;
    const sesionNum = sesion != null ? Number(sesion) : tratamiento.sesion;
    const precioNum = precio_total != null ? Number(precio_total) : tratamiento.precio_total;
    const descuentoNum = descuento != null ? Number(descuento) : tratamiento.descuento;
    const pagoMetodoStr = typeof pagoMetodo === "string" ? pagoMetodo.trim() : tratamiento.pagoMetodo;
    const tipoAtencionStr = typeof tipoAtencion === "string" ? tipoAtencion.trim() : tratamiento.tipoAtencion;
    const cantidadStr = cantidad_total != null && String(cantidad_total).trim() !== "" ? String(cantidad_total).trim() : tratamiento.cantidad_total;
    
    // Actualizar productos si se proporciona producto_usado
    let productosJSON = tratamiento.productos;
    if (producto_usado !== undefined && producto_usado !== null) {
      const productoStr = typeof producto_usado === "string" ? producto_usado.trim() : "";
      if (productoStr) {
        // Crear o actualizar el array de productos
        productosJSON = JSON.stringify([{
          nombre: productoStr,
          producto: productoStr,
          cantidad: cantidadStr || ""
        }]);
      }
    }
    
    // Validar y formatear fecha (zona horaria Perú GMT-5)
    let fechaStr = tratamiento.fecha;
    if (fecha && typeof fecha === "string") {
      // Si viene solo la fecha (YYYY-MM-DD), agregar hora actual de Perú
      if (fecha.length === 10) {
        const ahora = new Date();
        // Ajustar a hora de Perú (GMT-5)
        const horasPeru = ahora.getUTCHours() - 5;
        ahora.setUTCHours(horasPeru);
        const hora = ahora.toTimeString().split(' ')[0];
        fechaStr = `${fecha} ${hora}`;
      } else {
        fechaStr = fecha;
      }
    }

    if (!Number.isFinite(sesionNum) || sesionNum < 1) {
      return res.status(400).json({ message: "Sesión inválida" });
    }

    if (!Number.isFinite(precioNum) || precioNum < 0) {
      return res.status(400).json({ message: "Precio inválido" });
    }

    if (!Number.isFinite(descuentoNum) || descuentoNum < 0 || descuentoNum > 100) {
      return res.status(400).json({ message: "Descuento inválido (0-100)" });
    }

    // Actualizar el tratamiento
    await dbRun(
      `UPDATE tratamientos_realizados 
       SET especialista = ?, sesion = ?, precio_total = ?, descuento = ?, 
           pagoMetodo = ?, tipoAtencion = ?, fecha = ?,
           cantidad_total = ?, productos = ?
       WHERE id = ?`,
      [especialistaStr, sesionNum, precioNum, descuentoNum, pagoMetodoStr, tipoAtencionStr, fechaStr, cantidadStr, productosJSON, tratamientoId]
    );

    // Si hay deuda asociada, actualizar el monto total
    const deuda = await dbGet(
      `SELECT * FROM deudas_tratamientos WHERE tratamiento_realizado_id = ?`,
      [tratamientoId]
    );

    if (deuda) {
      const montoAdelanto = Number(deuda.monto_adelanto) || 0;
      const nuevoSaldo = Math.max(0, precioNum - montoAdelanto);
      
      await dbRun(
        `UPDATE deudas_tratamientos 
         SET monto_total = ?, monto_saldo = ?
         WHERE tratamiento_realizado_id = ?`,
        [precioNum, nuevoSaldo, tratamientoId]
      );
    }

    res.json({ message: "✅ Tratamiento actualizado correctamente" });
  } catch (err) {
    console.error("❌ Error al editar tratamiento:", err.message);
    console.error("Stack trace:", err.stack);
    res.status(500).json({ message: "Error al editar tratamiento: " + err.message });
  }
});

/* ==============================
   🔍 TRATAMIENTOS HUÉRFANOS (SIN PACIENTE)
   Solo accesible por rol master
============================== */

router.get("/huerfanos", requireRole("master"), async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT 
        tr.id,
        tr.paciente_id,
        tr.tratamiento_id,
        tr.productos,
        tr.cantidad_total,
        tr.precio_total,
        tr.descuento,
        tr.pagoMetodo,
        tr.sesion,
        tr.tipoAtencion,
        tr.especialista,
        tr.fecha,
        t.nombre AS tratamiento_nombre,
        p.nombre AS paciente_nombre,
        p.apellido AS paciente_apellido
      FROM tratamientos_realizados tr
      LEFT JOIN tratamientos t ON t.id = tr.tratamiento_id
      LEFT JOIN patients p ON p.id = tr.paciente_id
      WHERE tr.paciente_id IS NULL 
         OR tr.paciente_id = 0
         OR p.id IS NULL
      ORDER BY tr.fecha DESC
    `);

    const resultado = rows.map((r) => {
      let productosInfo = [];
      try {
        productosInfo = JSON.parse(r.productos || "[]");
      } catch (_) {}

      return {
        id: r.id,
        paciente_id: r.paciente_id,
        tratamiento_id: r.tratamiento_id,
        tratamiento_nombre: r.tratamiento_nombre || "Sin tratamiento",
        productos: productosInfo,
        cantidad_total: r.cantidad_total,
        precio_total: r.precio_total,
        descuento: r.descuento,
        pagoMetodo: r.pagoMetodo,
        sesion: r.sesion,
        tipoAtencion: r.tipoAtencion,
        especialista: r.especialista,
        fecha: r.fecha,
        paciente_nombre: r.paciente_nombre
          ? `${r.paciente_nombre} ${r.paciente_apellido || ""}`.trim()
          : null,
      };
    });

    res.json(resultado);
  } catch (err) {
    console.error("❌ Error al buscar tratamientos huérfanos:", err.message);
    res.status(500).json({ message: "Error al buscar tratamientos huérfanos" });
  }
});

router.delete("/huerfanos/:id", requireRole("master"), async (req, res) => {
  const { id } = req.params;
  try {
    const tratamiento = await dbGet(
      `SELECT tr.*, p.id AS paciente_existe
       FROM tratamientos_realizados tr
       LEFT JOIN patients p ON p.id = tr.paciente_id
       WHERE tr.id = ?`,
      [id]
    );

    if (!tratamiento) {
      return res.status(404).json({ message: "Tratamiento no encontrado" });
    }

    const esHuerfano =
      tratamiento.paciente_id == null ||
      tratamiento.paciente_id === 0 ||
      tratamiento.paciente_existe == null;

    if (!esHuerfano) {
      return res.status(400).json({
        message: "Este tratamiento tiene un paciente asignado válido. No se puede eliminar desde aquí.",
      });
    }

    // Devolver productos al inventario
    let productosDevueltos = [];
    if (tratamiento.productos) {
      try {
        const productos = JSON.parse(tratamiento.productos);
        for (const prod of productos) {
          const productoId = prod.producto_id || prod.id;
          const cantidad = prod.cantidad || 1;
          
          if (productoId && cantidad > 0) {
            // Obtener el lote más antiguo para devolver (FEFO)
            const lote = await dbGet(
              `SELECT id FROM lotes WHERE producto_id = ? AND cantidad > 0 ORDER BY fecha_vencimiento ASC LIMIT 1`,
              [productoId]
            );
            
            if (lote) {
              await dbRun(
                `UPDATE lotes SET cantidad = cantidad + ? WHERE id = ?`,
                [cantidad, lote.id]
              );
              productosDevueltos.push({ producto_id: productoId, cantidad, lote_id: lote.id });
            }
          }
        }
      } catch (parseErr) {
        console.error("Error al parsear productos:", parseErr);
      }
    }

    await dbRun(`DELETE FROM deudas_pagos WHERE deuda_id IN (SELECT id FROM deudas_tratamientos WHERE tratamiento_realizado_id = ?)`, [id]);
    await dbRun(`DELETE FROM deudas_tratamientos WHERE tratamiento_realizado_id = ?`, [id]);
    await dbRun(`DELETE FROM finanzas WHERE referencia_id = ? AND referencia_tipo = 'tratamiento_realizado'`, [id]);
    await dbRun(`DELETE FROM tratamientos_realizados WHERE id = ?`, [id]);

    res.json({ 
      message: "✅ Tratamiento huérfano eliminado correctamente", 
      productosDevueltos: productosDevueltos.length 
    });
  } catch (err) {
    console.error("❌ Error al eliminar tratamiento huérfano:", err.message);
    res.status(500).json({ message: "Error al eliminar tratamiento huérfano" });
  }
});

router.delete("/huerfanos", requireRole("master"), async (req, res) => {
  try {
    const huerfanos = await dbAll(`
      SELECT tr.id, tr.productos
      FROM tratamientos_realizados tr
      LEFT JOIN patients p ON p.id = tr.paciente_id
      WHERE tr.paciente_id IS NULL 
         OR tr.paciente_id = 0
         OR p.id IS NULL
    `);

    if (huerfanos.length === 0) {
      return res.json({ message: "No hay tratamientos huérfanos para eliminar", eliminados: 0 });
    }

    // Devolver productos al inventario para cada tratamiento
    let totalProductosDevueltos = 0;
    for (const huerfano of huerfanos) {
      if (huerfano.productos) {
        try {
          const productos = JSON.parse(huerfano.productos);
          for (const prod of productos) {
            const productoId = prod.producto_id || prod.id;
            const cantidad = prod.cantidad || 1;
            
            if (productoId && cantidad > 0) {
              const lote = await dbGet(
                `SELECT id FROM lotes WHERE producto_id = ? AND cantidad > 0 ORDER BY fecha_vencimiento ASC LIMIT 1`,
                [productoId]
              );
              
              if (lote) {
                await dbRun(
                  `UPDATE lotes SET cantidad = cantidad + ? WHERE id = ?`,
                  [cantidad, lote.id]
                );
                totalProductosDevueltos++;
              }
            }
          }
        } catch (parseErr) {
          console.error("Error al parsear productos:", parseErr);
        }
      }
    }

    const ids = huerfanos.map((h) => h.id);
    const placeholders = ids.map(() => "?").join(",");

    await dbRun(`DELETE FROM deudas_pagos WHERE deuda_id IN (SELECT id FROM deudas_tratamientos WHERE tratamiento_realizado_id IN (${placeholders}))`, ids);
    await dbRun(`DELETE FROM deudas_tratamientos WHERE tratamiento_realizado_id IN (${placeholders})`, ids);
    await dbRun(`DELETE FROM finanzas WHERE referencia_id IN (${placeholders}) AND referencia_tipo = 'tratamiento_realizado'`, ids);
    await dbRun(`DELETE FROM tratamientos_realizados WHERE id IN (${placeholders})`, ids);

    res.json({ 
      message: `✅ ${ids.length} tratamiento(s) huérfano(s) eliminado(s). ${totalProductosDevueltos} producto(s) devuelto(s) al inventario.`, 
      eliminados: ids.length,
      productosDevueltos: totalProductosDevueltos
    });
  } catch (err) {
    console.error("❌ Error al eliminar tratamientos huérfanos:", err.message);
    res.status(500).json({ message: "Error al eliminar tratamientos huérfanos" });
  }
});

/* ==============================
   📊 PRODUCTOS APLICADOS A PACIENTES
   Endpoint para el módulo de reportes de productos aplicados
============================== */
router.get("/productos-aplicados", authMiddleware, requireRole(["master"]), async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    let whereClause = "WHERE tr.paciente_id IS NOT NULL";
    const params = [];

    if (fechaInicio && fechaFin) {
      whereClause += " AND DATE(tr.fecha) BETWEEN ? AND ?";
      params.push(fechaInicio, fechaFin);
    }

    const tratamientos = await dbAll(
      `
      SELECT 
        tr.id,
        tr.fecha,
        tr.paciente_id,
        tr.tratamiento_id,
        tr.productos,
        tr.cantidad_total,
        tr.especialista,
        tr.sesion,
        tr.tipoAtencion,
        t.nombre AS tratamiento_nombre,
        p.nombre AS paciente_nombre,
        p.apellido AS paciente_apellido
      FROM tratamientos_realizados tr
      LEFT JOIN tratamientos t ON t.id = tr.tratamiento_id
      LEFT JOIN patients p ON p.id = tr.paciente_id
      ${whereClause}
      ORDER BY tr.fecha DESC, tr.id DESC
      `,
      params
    );

    // Parse productos JSON y crear texto legible
    const tratamientosConProductos = tratamientos.map((t) => {
      let productosTexto = "-";
      try {
        if (t.productos) {
          const productosArray = typeof t.productos === "string" ? JSON.parse(t.productos) : t.productos;
          if (Array.isArray(productosArray) && productosArray.length > 0) {
            productosTexto = productosArray
              .map((prod) => {
                const nombre = prod.nombre || prod.producto || "";
                const variante = prod.variante_nombre || "";
                const cantidad = prod.cantidad || "";
                return `${nombre} ${variante} ${cantidad ? `(${cantidad})` : ""}`.trim();
              })
              .join(", ");
          }
        }
      } catch (e) {
        console.error("Error parseando productos:", e);
      }

      return {
        ...t,
        productos_texto: productosTexto,
      };
    });

    res.json(tratamientosConProductos);
  } catch (error) {
    console.error("❌ Error al obtener productos aplicados:", error);
    res.status(500).json({ message: "Error al obtener productos aplicados" });
  }
});

/* ==============================
   📊 CALENDAR LAYOUT (posiciones de nodos y conexiones)
============================== */

// GET: obtener layout guardado para un presupuesto
router.get("/calendar-layout/:presupuestoId", async (req, res) => {
  const { presupuestoId } = req.params;
  try {
    const row = await dbGet(
      `SELECT * FROM calendar_layout WHERE presupuesto_id = ?`,
      [presupuestoId]
    );
    if (!row) {
      return res.json(null);
    }
    const nodeData = JSON.parse(row.node_positions_json || "{}");
    // Support both legacy flat format and new nested format
    const isNewFormat = nodeData._matrixPositions || nodeData._specialistNames;
    res.json({
      presupuesto_id: row.presupuesto_id,
      nodePositions: isNewFormat ? (nodeData.nodePositions || {}) : nodeData,
      connectionOrder: JSON.parse(row.connection_order_json || "[]"),
      numWeeks: row.num_weeks || 4,
      matrixPositions: nodeData._matrixPositions || null,
      specialistNames: nodeData._specialistNames || null,
    });
  } catch (err) {
    console.error("❌ Error al obtener calendar layout:", err.message);
    res.status(500).json({ message: "Error al obtener layout del calendario" });
  }
});

// POST: guardar/actualizar layout de un presupuesto
router.post("/calendar-layout/:presupuestoId", async (req, res) => {
  const { presupuestoId } = req.params;
  const { nodePositions, connectionOrder, numWeeks, matrixPositions, specialistNames } = req.body;
  try {
    // Merge matrix data into node_positions_json for backward compat
    let nodeData;
    if (matrixPositions || specialistNames) {
      // New format: store everything in a nested object
      const existing = await dbGet(`SELECT node_positions_json FROM calendar_layout WHERE presupuesto_id = ?`, [presupuestoId]);
      const prev = existing ? JSON.parse(existing.node_positions_json || "{}") : {};
      nodeData = {
        ...prev,
        nodePositions: nodePositions || prev.nodePositions || {},
      };
      if (matrixPositions) nodeData._matrixPositions = matrixPositions;
      if (specialistNames) nodeData._specialistNames = specialistNames;
    } else {
      nodeData = nodePositions || {};
    }

    const existingRow = await dbGet(
      `SELECT id FROM calendar_layout WHERE presupuesto_id = ?`,
      [presupuestoId]
    );
    if (existingRow) {
      await dbRun(
        `UPDATE calendar_layout SET node_positions_json = ?, connection_order_json = ?, num_weeks = ?, actualizado_en = CURRENT_TIMESTAMP WHERE presupuesto_id = ?`,
        [JSON.stringify(nodeData), JSON.stringify(connectionOrder || []), numWeeks || 4, presupuestoId]
      );
    } else {
      await dbRun(
        `INSERT INTO calendar_layout (presupuesto_id, node_positions_json, connection_order_json, num_weeks) VALUES (?, ?, ?, ?)`,
        [presupuestoId, JSON.stringify(nodeData), JSON.stringify(connectionOrder || []), numWeeks || 4]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error al guardar calendar layout:", err.message);
    res.status(500).json({ message: "Error al guardar layout del calendario" });
  }
});

export default router;
