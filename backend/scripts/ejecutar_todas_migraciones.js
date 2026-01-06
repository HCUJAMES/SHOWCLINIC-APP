import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Script maestro que ejecuta todas las migraciones en orden
 * Útil para configurar una nueva instalación o actualizar producción
 */

const migraciones = [
  {
    nombre: "Inventario",
    archivo: "migrar_inventario_produccion.js",
    descripcion: "Agrega productos de ácido hialurónico y toxinas",
  },
  // Agrega más migraciones aquí en el futuro
  // {
  //   nombre: "Tratamientos Base",
  //   archivo: "migrar_tratamientos_base.js",
  //   descripcion: "Agrega tratamientos base nuevos",
  // },
];

async function ejecutarMigraciones() {
  console.log("=" .repeat(60));
  console.log("🚀 EJECUTANDO TODAS LAS MIGRACIONES");
  console.log("=" .repeat(60));
  console.log();

  let exitosas = 0;
  let fallidas = 0;

  for (const migracion of migraciones) {
    console.log(`📦 Migración: ${migracion.nombre}`);
    console.log(`   ${migracion.descripcion}`);
    console.log();

    try {
      const scriptPath = path.join(__dirname, migracion.archivo);
      execSync(`node "${scriptPath}"`, { stdio: "inherit" });
      exitosas++;
      console.log();
    } catch (err) {
      console.error(`❌ Error en migración: ${migracion.nombre}`);
      console.error(err.message);
      fallidas++;
      console.log();
    }
  }

  console.log("=" .repeat(60));
  console.log("📊 RESUMEN DE MIGRACIONES");
  console.log("=" .repeat(60));
  console.log(`✅ Exitosas: ${exitosas}`);
  console.log(`❌ Fallidas: ${fallidas}`);
  console.log(`📝 Total: ${migraciones.length}`);
  console.log("=" .repeat(60));

  if (fallidas > 0) {
    console.log();
    console.log("⚠️  Algunas migraciones fallaron. Revisa los errores arriba.");
    process.exit(1);
  } else {
    console.log();
    console.log("🎉 ¡Todas las migraciones se ejecutaron correctamente!");
    process.exit(0);
  }
}

ejecutarMigraciones();
