import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import { consumirStockFEFO } from "../services/inventoryOps.js";
import db, { dbAll, dbRun, dbGet } from "../db/database.js";
import { authMiddleware, requireDoctor, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Middlewares específicos de tratamientos
const requireTreatmentBaseCreate = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "doctor" && role !== "asistente" && role !== "master") {
    return res.status(403).json({ message: "No tienes permisos para crear tratamientos" });
  }
  next();
};

const requireTratamientoRealizadoWrite = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "doctor" && role !== "asistente" && role !== "master") {
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
  const { nombre, descripcion, precio } = req.body;
  if (!nombre) {
    return res.status(400).json({ message: "Falta nombre" });
  }
  const precioNum = precio == null || precio === "" ? null : parseFloat(precio);
  if (precioNum != null && (isNaN(precioNum) || precioNum < 0)) {
    return res.status(400).json({ message: "Precio inválido" });
  }

  db.run(
    `INSERT INTO tratamientos (nombre, descripcion, precio) VALUES (?, ?, ?)`,
    [nombre, descripcion || "", precioNum],
    function (err) {
      if (err)
        return res.status(500).json({ message: "Error al crear tratamiento" });
      res.json({ id: this.lastID, nombre, descripcion: descripcion || "", precio: precioNum });
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
router.post("/recetas/:tratamiento_id", requireRole("doctor", "master"), async (req, res) => {
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
router.delete("/recetas/:tratamiento_id/:variante_id", requireRole("doctor", "master"), async (req, res) => {
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
router.put("/recetas/:tratamiento_id/:variante_id", requireRole("doctor", "master"), async (req, res) => {
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
  const { nombre, descripcion, precio } = req.body || {};

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

  try {
    const result = await dbRun(
      `UPDATE tratamientos SET nombre = ?, descripcion = ?, precio = ? WHERE id = ?`,
      [nombreStr, descripcionStr, precioNum, idNum]
    );

    if ((result?.changes || 0) === 0) {
      return res.status(404).json({ message: "Tratamiento no encontrado" });
    }

    res.json({ id: idNum, nombre: nombreStr, descripcion: descripcionStr, precio: precioNum });
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
    for (const b of productosData) {
      if (!b.tratamiento_id) continue; // sin tratamiento asociado, usa flujo clásico

      const recetas = await dbAll(
        `SELECT * FROM recetas_tratamiento WHERE tratamiento_id = ?`,
        [b.tratamiento_id]
      );

      if (!recetas || recetas.length === 0) continue; // tratamiento sin receta, flujo clásico

      const factorCantidad =
        parseFloat(b.dosis_unidades) > 0
          ? parseFloat(b.dosis_unidades)
          : parseFloat(b.cantidad) > 0
            ? parseFloat(b.cantidad)
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
        parseFloat(b.dosis_unidades) > 0
          ? parseFloat(b.dosis_unidades)
          : parseFloat(b.cantidad) > 0
            ? parseFloat(b.cantidad)
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
      const precioUnitario = parseFloat(b.precio) || 0;
      const cantidadMl = parseFloat(b.cantidad) || 1;
      const totalDelFrontend = parseFloat(b.total) || 0;
      
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
      let usoReceta = false;
      if (b.tratamiento_id) {
        const recetas = await dbAll(
          `SELECT * FROM recetas_tratamiento WHERE tratamiento_id = ?`,
          [b.tratamiento_id]
        );

        if (recetas && recetas.length > 0) {
          usoReceta = true;

          // Usar cantidad (ml) directamente
          const cantidadParaStock = parseFloat(b.cantidad) || 1;

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

      // Consumir por producto seleccionado (variante_id) SOLO si no se usó receta.
      // Esto evita descuento doble cuando hay receta Y variante seleccionada.
      const varianteIdElegida = b.variante_id ? Number(b.variante_id) : null;
      const cantidadElegida = parseFloat(b.cantidad) || 0;

      if (!usoReceta && varianteIdElegida && cantidadElegida > 0) {
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
      } else if (!usoReceta && !varianteIdElegida) {
        // Compatibilidad con inventario clásico solo si no hay receta y no se eligió variante.
        await dbRun(
          `UPDATE inventario SET stock = stock - ? WHERE producto = ?`,
          [b.cantidad, b.producto]
        );
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
   📋 HISTORIAL CLÍNICO
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
           pagoMetodo = ?, tipoAtencion = ?, fecha = ?
       WHERE id = ?`,
      [especialistaStr, sesionNum, precioNum, descuentoNum, pagoMetodoStr, tipoAtencionStr, fechaStr, tratamientoId]
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
    res.status(500).json({ message: "Error al editar tratamiento" });
  }
});

export default router;
