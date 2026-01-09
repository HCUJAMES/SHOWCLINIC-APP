import { dbRun, dbGet } from "../db/database.js";

const limpiarDatosPacientes = async () => {
  console.log("⚠️  INICIANDO LIMPIEZA DE DATOS DE PACIENTES...\n");

  try {
    // Obtener conteo antes de borrar
    const countPacientes = await dbGet("SELECT COUNT(*) as count FROM patients");
    const countTratamientos = await dbGet("SELECT COUNT(*) as count FROM tratamientos_realizados");
    const countOfertas = await dbGet("SELECT COUNT(*) as count FROM patient_ofertas");
    const countPresupuestos = await dbGet("SELECT COUNT(*) as count FROM presupuestos_asignados");
    const countPaquetes = await dbGet("SELECT COUNT(*) as count FROM paquetes_pacientes");
    const countDeudas = await dbGet("SELECT COUNT(*) as count FROM deudas_tratamientos");
    const countFinanzas = await dbGet("SELECT COUNT(*) as count FROM finanzas");
    const countObservaciones = await dbGet("SELECT COUNT(*) as count FROM patient_observaciones");

    console.log("📊 Datos a eliminar:");
    console.log(`   - Pacientes: ${countPacientes?.count || 0}`);
    console.log(`   - Tratamientos realizados: ${countTratamientos?.count || 0}`);
    console.log(`   - Ofertas/Presupuestos: ${countOfertas?.count || 0}`);
    console.log(`   - Presupuestos asignados: ${countPresupuestos?.count || 0}`);
    console.log(`   - Paquetes asignados: ${countPaquetes?.count || 0}`);
    console.log(`   - Deudas: ${countDeudas?.count || 0}`);
    console.log(`   - Finanzas: ${countFinanzas?.count || 0}`);
    console.log(`   - Observaciones: ${countObservaciones?.count || 0}`);
    console.log("");

    // Borrar en orden para respetar foreign keys
    console.log("🗑️  Borrando deudas_pagos...");
    await dbRun("DELETE FROM deudas_pagos");

    console.log("🗑️  Borrando deudas_tratamientos...");
    await dbRun("DELETE FROM deudas_tratamientos");

    console.log("🗑️  Borrando presupuestos_sesiones...");
    await dbRun("DELETE FROM presupuestos_sesiones");

    console.log("🗑️  Borrando presupuestos_asignados...");
    await dbRun("DELETE FROM presupuestos_asignados");

    console.log("🗑️  Borrando paquetes_sesiones...");
    await dbRun("DELETE FROM paquetes_sesiones");

    console.log("🗑️  Borrando paquetes_pacientes...");
    await dbRun("DELETE FROM paquetes_pacientes");

    console.log("🗑️  Borrando tratamientos_realizados...");
    await dbRun("DELETE FROM tratamientos_realizados");

    console.log("🗑️  Borrando patient_ofertas...");
    await dbRun("DELETE FROM patient_ofertas");

    console.log("🗑️  Borrando patient_observaciones...");
    await dbRun("DELETE FROM patient_observaciones");

    console.log("🗑️  Borrando finanzas...");
    await dbRun("DELETE FROM finanzas");

    console.log("🗑️  Borrando patients...");
    await dbRun("DELETE FROM patients");

    // Resetear autoincrement
    console.log("\n🔄 Reseteando contadores de ID...");
    await dbRun("DELETE FROM sqlite_sequence WHERE name='patients'");
    await dbRun("DELETE FROM sqlite_sequence WHERE name='tratamientos_realizados'");
    await dbRun("DELETE FROM sqlite_sequence WHERE name='patient_ofertas'");
    await dbRun("DELETE FROM sqlite_sequence WHERE name='presupuestos_asignados'");
    await dbRun("DELETE FROM sqlite_sequence WHERE name='paquetes_pacientes'");
    await dbRun("DELETE FROM sqlite_sequence WHERE name='deudas_tratamientos'");
    await dbRun("DELETE FROM sqlite_sequence WHERE name='finanzas'");
    await dbRun("DELETE FROM sqlite_sequence WHERE name='patient_observaciones'");

    console.log("\n✅ LIMPIEZA COMPLETADA EXITOSAMENTE");
    console.log("   Todos los datos de pacientes han sido eliminados.");

  } catch (error) {
    console.error("❌ Error durante la limpieza:", error.message);
  }

  process.exit(0);
};

limpiarDatosPacientes();
