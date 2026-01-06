import { dbRun, dbGet, dbAll } from "../db/database.js";

/**
 * Script de migración inteligente para inventario
 * - Solo agrega productos que NO existen
 * - No toca productos existentes
 * - No afecta stock actual
 */

const productos = [
  { marca: "Juvederm", laboratorio: "Allergan", variante: "Volift" },
  { marca: "Opera", laboratorio: "Ksurgery Laboratories", variante: "Opera" },
  { marca: "Perfectha", laboratorio: "Sinclair", variante: "Derm" },
  { marca: "Saypha-Croma", laboratorio: "Croma-Pharma", variante: "Volumen Plus" },
  { marca: "Juvederm", laboratorio: "Allergan", variante: "Volbella" },
  { marca: "Saypha-Croma", laboratorio: "Croma-Pharma", variante: "Volumen" },
  { marca: "Jalupro", laboratorio: "Professional Derma", variante: "Superhydro" },
  { marca: "Jalupro", laboratorio: "Professional Derma", variante: "Clasic" },
  { marca: "Jalupro", laboratorio: "Professional Derma", variante: "HWN" },
  { marca: "Allergan", laboratorio: "Allergan", variante: "Harmonyca" },
  { marca: "Saypha-Croma", laboratorio: "Croma-Pharma", variante: "Saypha-Croma" },
  { marca: "Jalupro", laboratorio: "Professional Derma", variante: "Young Eyes" },
  { marca: "Youthheal Skinbooster", laboratorio: "Youthheal", variante: "Exosomas" },
  { marca: "PBSerum Medical", laboratorio: "PBSerum", variante: "HA1.5 Medium Enzimas" },
  { marca: "Allergan", laboratorio: "Allergan", variante: "Toxina Botulinica" },
];

async function migrarInventario() {
  console.log("🔄 Iniciando migración de inventario...\n");

  let agregados = 0;
  let existentes = 0;

  for (const prod of productos) {
    try {
      // 1. Buscar o crear producto base (marca)
      let productoBase = await dbGet(
        `SELECT * FROM productos_base WHERE LOWER(nombre) = LOWER(?)`,
        [prod.marca]
      );

      if (!productoBase) {
        const result = await dbRun(
          `INSERT INTO productos_base (nombre, categoria, descripcion) VALUES (?, ?, ?)`,
          [prod.marca, "Ácido Hialurónico", `Productos ${prod.marca}`]
        );
        productoBase = { id: result.lastID, nombre: prod.marca };
        console.log(`  ✅ Producto base creado: ${prod.marca}`);
      }

      // 2. Verificar si la variante YA existe
      let variante = await dbGet(
        `SELECT * FROM variantes WHERE producto_base_id = ? AND LOWER(nombre) = LOWER(?)`,
        [productoBase.id, prod.variante]
      );

      if (variante) {
        console.log(`  ⏭️  Ya existe: ${prod.marca} - ${prod.variante}`);
        existentes++;
        continue;
      }

      // 3. Crear variante (solo si NO existe)
      const result = await dbRun(
        `INSERT INTO variantes 
         (producto_base_id, nombre, laboratorio, unidad_base, contenido_por_presentacion, es_medico) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [productoBase.id, prod.variante, prod.laboratorio, "ml", 1, 1]
      );
      variante = { id: result.lastID, nombre: prod.variante };
      console.log(`  ✅ Variante creada: ${prod.variante} (${prod.laboratorio})`);

      // 4. Agregar stock inicial (20 unidades) solo para productos nuevos
      const fechaVencimiento = new Date();
      fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 2);
      const fechaVenc = fechaVencimiento.toISOString().split("T")[0];

      await dbRun(
        `INSERT INTO stock_lotes 
         (variante_id, lote, fecha_vencimiento, ubicacion, cantidad_unidades, creado_en) 
         VALUES (?, ?, ?, ?, ?, datetime('now', '-5 hours'))`,
        [variante.id, `LOTE-${Date.now()}`, fechaVenc, "Almacén principal", 20]
      );
      console.log(`  📦 Stock agregado: 20 unidades\n`);
      agregados++;

    } catch (err) {
      console.error(`  ❌ Error con ${prod.marca} ${prod.variante}:`, err.message);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Migración completada`);
  console.log(`   - Productos nuevos agregados: ${agregados}`);
  console.log(`   - Productos ya existentes: ${existentes}`);
  console.log("=".repeat(50));
}

migrarInventario()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Error fatal:", err);
    process.exit(1);
  });
