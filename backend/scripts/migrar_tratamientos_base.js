import { dbRun, dbGet, dbAll } from "../db/database.js";

/**
 * Script de migración inteligente para tratamientos base
 * - Solo agrega tratamientos que NO existen
 * - No toca tratamientos existentes
 * - Útil para agregar nuevos tratamientos desde desarrollo
 */

// Ejemplo de tratamientos a migrar
const tratamientos = [
  // Agrega aquí los tratamientos que quieras migrar
  // { nombre: "Diseño de labios", descripcion: "Relleno de labios con ácido hialurónico" },
];

async function migrarTratamientos() {
  console.log("🔄 Iniciando migración de tratamientos base...\n");

  if (tratamientos.length === 0) {
    console.log("⚠️  No hay tratamientos para migrar");
    console.log("💡 Edita este archivo y agrega tratamientos al array 'tratamientos'");
    return;
  }

  let agregados = 0;
  let existentes = 0;

  for (const trat of tratamientos) {
    try {
      // Verificar si el tratamiento YA existe
      const existe = await dbGet(
        `SELECT * FROM tratamientos WHERE LOWER(nombre) = LOWER(?)`,
        [trat.nombre]
      );

      if (existe) {
        console.log(`  ⏭️  Ya existe: ${trat.nombre}`);
        existentes++;
        continue;
      }

      // Crear tratamiento (solo si NO existe)
      await dbRun(
        `INSERT INTO tratamientos (nombre, descripcion) VALUES (?, ?)`,
        [trat.nombre, trat.descripcion || ""]
      );
      console.log(`  ✅ Tratamiento creado: ${trat.nombre}`);
      agregados++;

    } catch (err) {
      console.error(`  ❌ Error con ${trat.nombre}:`, err.message);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Migración completada`);
  console.log(`   - Tratamientos nuevos: ${agregados}`);
  console.log(`   - Tratamientos existentes: ${existentes}`);
  console.log("=".repeat(50));
}

migrarTratamientos()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Error fatal:", err);
    process.exit(1);
  });
