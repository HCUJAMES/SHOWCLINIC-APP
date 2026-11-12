# 📅 Agenda conectada a Google Calendar

La **Agenda** de ShowClinic muestra **todos los calendarios** de la cuenta **showclinicyanahuara@gmail.com** (Dr. Erickson Espetia, Carla Vargas, Dra. Alicia Paez, Dra. Edith Carpio, etc.) juntos, **con los mismos colores que en Google**, y cruzados con los datos de cada paciente.

- Lo que se agenda en ShowClinic aparece **al instante** en Google Calendar (y en los celulares).
- Lo que se agenda directamente en Google aparece en ShowClinic (se actualiza solo cada minuto, o con el botón ⟳).
- Cada calendario está unido a su especialista: al agendar con la Dra. Paez, la cita se guarda en el calendario "Dra. Alicia Paez".
- Si en Google escriben el **nombre y apellido** o el **DNI** de la paciente en el título, el sistema la reconoce sola.

---

## Configuración (una sola vez, ~15 minutos)

> ⚠️ Hazlo **en la computadora servidor** (donde está instalado ShowClinic), abriendo **http://localhost:4000/agenda** en su navegador. Google solo permite volver a esa dirección después de iniciar sesión.

### 1. Crear el proyecto y activar la API
1. Entra a <https://console.cloud.google.com/> con **showclinicyanahuara@gmail.com**.
2. Selector de proyectos → **Proyecto nuevo** → nombre `ShowClinic` → **Crear**.
3. Entra a <https://console.cloud.google.com/apis/library/calendar-json.googleapis.com> y presiona **Habilitar**.

### 2. Pantalla de consentimiento (y publicarla)
1. Entra a <https://console.cloud.google.com/apis/credentials/consent>.
2. Tipo de usuario **Externo** → nombre de la app **ShowClinic**, correo de soporte y correo de contacto: showclinicyanahuara@gmail.com → **Guardar**.
3. En la sección **Público**, presiona **Publicar app** → confirmar. Debe decir **"En producción"**.

> ❗ Si se queda en "En prueba", Google desconecta el calendario **cada 7 días**.

### 3. Crear el "ID de cliente"
1. Entra a <https://console.cloud.google.com/apis/credentials> → **Crear credenciales** → **ID de cliente de OAuth**.
2. Tipo de aplicación: **Aplicación web**. Nombre: `ShowClinic`.
3. En **URI de redireccionamiento autorizados** → **Agregar URI** → pega exactamente:
   ```
   http://localhost:4000/api/calendario/oauth/callback
   ```
4. **Crear** → **Descargar JSON**.

### 4. Conectar en ShowClinic
1. En la computadora servidor abre **http://localhost:4000/agenda** con el usuario **master**.
2. Pestaña **Iniciar sesión con Google** → **Subir archivo .json** (el del paso 3).
3. Presiona **Iniciar sesión con Google**, elige **showclinicyanahuara@gmail.com** y acepta.
   - Si aparece *"Google no verificó esta app"*: **Configuración avanzada → Ir a ShowClinic (no seguro)**. Es normal: la app es tuya y solo la usa la clínica.
4. Vuelves a la Agenda con todos los calendarios y sus colores. ✅

### 5. Revisar los calendarios (⚙️ en la Agenda)
- **Mostrar**: por defecto se muestran los mismos que tienes marcados en Google. Puedes apagar los que no sean de citas (Cumpleaños, Marketing…).
- **Especialista**: el sistema une cada calendario con su especialista por el nombre ("Detectado por el nombre"). Revisa que estén bien y corrige los que falten (por ejemplo "YUNY APOYO COSMIATRIA" → Yunianly Rodriguez).
- **Predet.**: el calendario donde se guardan las citas que no tienen especialista.
- **Color**: viene de Google. Solo si alguno no coincide, haz clic en el cuadrito y elige el mismo color que tiene en Google.

Presiona **Guardar cambios**.

> Si ya tenías conectada la versión anterior (con la llave de "cuenta de servicio"), sigue funcionando. En ⚙️ aparece el botón **Cambiar a "Iniciar sesión con Google"** para ver todos los calendarios.

---

## Cómo se usa

| Acción | Cómo |
|---|---|
| Ver citas | Menú principal → **Agenda**. Vistas: Día, Semana, Mes y Lista |
| Ver u ocultar calendarios | Casillas de **Calendarios** a la izquierda (cada persona elige lo que ve) |
| Agendar | **Nueva cita** o clic en un espacio vacío. Al elegir especialista se elige su calendario |
| Agendar desde la ficha | **Historial clínico** → paciente → sección **Citas** → **Agendar cita** |
| Reprogramar | Arrastra la cita con el mouse, o ábrela → ✏️ |
| Pasar la cita a otra especialista | Ábrela → ✏️ → cambia el especialista o el calendario |

- Los calendarios **de solo lectura** (por ejemplo, uno personal compartido contigo) se ven, pero no se pueden editar desde ShowClinic.
- Si el especialista ya tiene otra cita a esa hora, el formulario lo avisa.
- El rol **doctora** ve la agenda pero no los teléfonos de las pacientes.
- Solo **master** y **doctor** pueden conectar Google o cambiar los ajustes de calendarios.

---

## Actualizar el servidor

No hay librerías nuevas ni migraciones manuales.

1. `git pull origin main`
2. `cd frontend` y luego `npm run build`
3. Reiniciar el backend

## Problemas frecuentes

| Mensaje | Solución |
|---|---|
| "Google no reconoce el URI de redirección" | En el ID de cliente (paso 3) el URI no es exactamente `http://localhost:4000/api/calendario/oauth/callback` |
| La página de Google no vuelve / "no se puede acceder a localhost" | Lo hiciste desde otra computadora: repítelo en la computadora servidor |
| "La sesión de Google se cerró o fue revocada" | Agenda → ⚙️ → **Volver a iniciar sesión con Google**. Revisa que la app esté **"En producción"** (paso 2) |
| "Google no entregó el permiso permanente" | Entra a <https://myaccount.google.com/permissions>, quita el acceso de ShowClinic y vuelve a iniciar sesión |
| "La Google Calendar API no está activada" | Repite el paso 1.3 y espera 2–3 minutos |
| Un calendario no aparece | Agenda → ⚙️ → botón ⟳ (volver a leer) y márcalo en **Mostrar** |
| Un color no coincide | Agenda → ⚙️ → clic en el cuadrito de color de ese calendario y elige el mismo de Google |
