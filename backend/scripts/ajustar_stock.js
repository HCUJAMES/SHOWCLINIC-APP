import { dbRun, dbGet, dbAll } from "../db/database.js";

async function ajustarStock() {
  console.log("🔧 Ajustando stock a 20 unidades por variante...\n");

  try {
    // Obtener todas las variantes
    const variantes = await dbAll(`SELECT * FROM variantes`);

    for (const variante of variantes) {
      // Eliminar todos los lotes de esta variante
      await dbRun(`DELETE FROM stock_lotes WHERE variante_id = ?`, [variante.id]);

      // Crear un solo lote con 20 unidades
      const fechaVencimiento = new Date();
      fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 2);
      const fechaVenc = fechaVencimiento.toISOString().split("T")[0];

      await dbRun(
        `INSERT INTO stock_lotes 
         (variante_id, lote, fecha_vencimiento, ubicacion, cantidad_unidades, creado_en) 
         VALUES (?, ?, ?, ?, ?, datetime('now', '-5 hours'))`,
        [variante.id, `LOTE-${variante.id}-2025`, fechaVenc, "Almacén principal", 20]
      );

      console.log(`✅ ${variante.nombre}: 20 unidades`);
    }

    console.log("\n✅ Stock ajustado correctamente!");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

ajustarStock().then(() => process.exit(0)).catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
