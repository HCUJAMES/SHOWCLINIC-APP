# 📅 Agenda conectada a Google Calendar

La **Agenda** de ShowClinic muestra el mismo Google Calendar que el equipo ya usa en sus celulares (cuenta **showclinicyanahuara@gmail.com**), cruzado con los datos de cada paciente.

- Lo que se agenda en ShowClinic aparece **al instante** en Google Calendar (y en los celulares).
- Lo que se agenda directamente en Google aparece en ShowClinic (se actualiza solo cada minuto, o con el botón ⟳).
- Si en Google escriben el **nombre y apellido** o el **DNI** de la paciente en el título (ej. `María Pérez - Botox`), el sistema la reconoce sola.

> Nadie tiene que iniciar sesión con Google dentro de ShowClinic. La conexión se hace **una sola vez** y queda funcionando para todo el equipo.

---

## Configuración (una sola vez, ~10 minutos)

Hazlo en una computadora, con la sesión de Google de **showclinicyanahuara@gmail.com**.

### 1. Crear el proyecto y activar la API
1. Entra a <https://console.cloud.google.com/>.
2. Arriba, en el selector de proyectos → **Proyecto nuevo** → nombre: `ShowClinic` → **Crear**.
3. Entra a <https://console.cloud.google.com/apis/library/calendar-json.googleapis.com> (con el proyecto ShowClinic seleccionado) y presiona **Habilitar**.

Es gratis: Google no cobra por el uso que hace una clínica.

### 2. Crear la "cuenta de servicio" y descargar la llave
1. Entra a <https://console.cloud.google.com/iam-admin/serviceaccounts>.
2. **Crear cuenta de servicio** → nombre: `agenda-showclinic` → **Crear y continuar** → no asignes roles → **Listo**.
3. Abre la cuenta creada → pestaña **Claves** → **Agregar clave** → **Crear clave nueva** → **JSON** → **Crear**.
4. Se descarga un archivo `.json`. **Guárdalo en un lugar seguro**: es la llave de acceso al calendario.

> Si Google muestra el aviso *"La creación de claves de cuentas de servicio está inhabilitada"*, ve a **IAM → Políticas de la organización**, busca `iam.disableServiceAccountKeyCreation` y desactívala. En cuentas Gmail normales esto no suele aparecer.

### 3. Conectar en ShowClinic
1. En ShowClinic entra con el usuario **master** (o doctor) → **Agenda**.
2. Presiona **Subir archivo .json** y elige el archivo del paso 2.
3. Aparecerá un correo parecido a `agenda-showclinic@showclinic-xxxx.iam.gserviceaccount.com`. Cópialo con el botón 📋.

### 4. Compartir el calendario con ese correo
1. Abre <https://calendar.google.com> (en la computadora, no en el celular).
2. A la izquierda, en **Mis calendarios**, pasa el mouse sobre el calendario de la clínica → **⋮** → **Configuración y uso compartido**.
3. **Compartir con personas específicas o grupos** → **Agregar personas y grupos** → pega el correo del paso 3.
4. Permiso: **Hacer cambios en eventos** → **Enviar**.

### 5. Terminar
1. Vuelve a ShowClinic. El **ID del calendario** ya viene escrito (`showclinicyanahuara@gmail.com`).
   *Solo si usan un calendario secundario (no el principal), cópialo desde Google Calendar → Configuración → **Integrar el calendario → ID del calendario**.*
2. Presiona **Conectar y probar**. El sistema revisa que todo funcione antes de guardar y, si algo falta, dice exactamente qué corregir.

---

## Cómo se usa

| Acción | Cómo |
|---|---|
| Ver citas | Menú principal → **Agenda**. Vistas: Día, Semana, Mes y Lista |
| Agendar | Botón **Nueva cita**, o clic en un espacio vacío del calendario |
| Agendar desde la ficha | **Historial clínico** → paciente → sección **Citas** → **Agendar cita** |
| Reprogramar | Arrastra la cita con el mouse a otra hora o día, o ábrela → ✏️ |
| Ver a la paciente | Abre la cita → **Ver historial de la paciente** |
| Filtrar | Por especialista (panel izquierdo o botón de filtro) y con el buscador |

- Cada especialista tiene un color fijo (el mismo que se ve en Google). Se puede cambiar por cita.
- Si el especialista o la paciente ya tienen otra cita a esa hora, el formulario lo avisa.
- El rol **doctora** ve la agenda, pero no los teléfonos de las pacientes (igual que en el resto del sistema).
- Solo **master** y **doctor** pueden conectar o desconectar Google Calendar (botón ⚙️ en la Agenda).

---

## Actualizar el servidor

No hay librerías nuevas ni migraciones manuales: la tabla de configuración se crea sola.

1. `git pull`
2. Volver a compilar el frontend (`npm run build` dentro de `frontend`)
3. Reiniciar el backend

## Problemas frecuentes

| Mensaje | Solución |
|---|---|
| "No se pudo acceder al calendario…" | Falta el paso 4 o el correo pegado no es el de la cuenta de servicio |
| "El calendario está compartido solo para ver" | En el paso 4 elige **Hacer cambios en eventos** |
| "La Google Calendar API no está activada" | Repite el paso 1.3 y espera 2–3 minutos |
| "Google rechazó las credenciales" | Se borró la llave en Google Cloud: crea una nueva (paso 2.3) y súbela con ⚙️ |
| "No hay conexión con Google Calendar" | El servidor de la clínica no tiene internet |
