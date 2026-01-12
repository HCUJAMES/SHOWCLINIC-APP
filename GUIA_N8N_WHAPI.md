# 🚀 Guía de Integración: n8n + Whapi + ShowClinic CRM

## 📋 Índice
1. [Arquitectura del Sistema](#arquitectura)
2. [Instalación de n8n](#instalacion-n8n)
3. [Configuración de Whapi](#configuracion-whapi)
4. [Endpoints Disponibles](#endpoints)
5. [Ejemplos de Workflows](#workflows)
6. [Casos de Uso](#casos-de-uso)

---

## 🏗️ Arquitectura del Sistema {#arquitectura}

```
┌─────────────────────────────────────┐
│     SHOWCLINIC CRM                  │
│     http://localhost:4000           │
│                                     │
│  Endpoints disponibles:             │
│  - /api/n8n/paciente/buscar        │
│  - /api/n8n/paciente/:id/citas     │
│  - /api/n8n/paciente/:id/deudas    │
│  - /api/n8n/tratamientos           │
│  - /api/n8n/interaccion            │
│  - /api/n8n/recordatorio           │
└──────────────┬──────────────────────┘
               │
               │ API REST
               │
┌──────────────▼──────────────────────┐
│     n8n (Automatización)            │
│     http://localhost:5678           │
│                                     │
│  Workflows:                         │
│  1. Bot de WhatsApp con IA          │
│  2. Recordatorios de citas          │
│  3. Cobros automáticos              │
│  4. Seguimiento post-tratamiento    │
└──────────────┬──────────────────────┘
               │
               │ API
               │
┌──────────────▼──────────────────────┐
│     Whapi (WhatsApp)                │
│     https://gate.whapi.cloud        │
│                                     │
│  - Envío de mensajes                │
│  - Recepción de mensajes            │
│  - Webhooks en tiempo real          │
└──────────────┬──────────────────────┘
               │
               ▼
         📱 WhatsApp
```

---

## 📦 Instalación de n8n {#instalacion-n8n}

### Opción 1: Ejecutar con npx (Recomendado para pruebas)

```bash
# Abrir terminal en cualquier carpeta
npx n8n

# Se abrirá automáticamente en http://localhost:5678
```

### Opción 2: Instalación global

```bash
npm install -g n8n
n8n start
```

### Opción 3: Docker (Para producción)

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### Primera configuración:

1. Abre http://localhost:5678
2. Crea tu cuenta de n8n
3. Configura tu email y contraseña
4. ¡Listo! Ya puedes crear workflows

---

## 🔑 Configuración de Whapi {#configuracion-whapi}

### Paso 1: Crear cuenta en Whapi

1. Ve a https://whapi.cloud
2. Regístrate con tu email
3. Verifica tu cuenta

### Paso 2: Crear un canal de WhatsApp

1. En el dashboard, haz clic en "Create Channel"
2. Escanea el código QR con tu WhatsApp
3. Copia tu **API Token** (lo necesitarás en n8n)

### Paso 3: Configurar Webhook

En Whapi dashboard:
1. Ve a "Settings" > "Webhooks"
2. URL del webhook: `http://localhost:5678/webhook/whapi`
3. Eventos a escuchar:
   - `message.received`
   - `message.sent`
   - `message.status`

---

## 🔌 Endpoints Disponibles en tu CRM {#endpoints}

Tu CRM ahora tiene estos endpoints para que n8n pueda consultarlos:

### 1. Buscar Paciente por Teléfono
```
GET http://localhost:4000/api/n8n/paciente/buscar?telefono=987654321

Respuesta:
{
  "encontrado": true,
  "paciente": {
    "id": 1,
    "nombre_completo": "Juan Pérez",
    "nombre": "Juan",
    "apellido": "Pérez",
    "dni": "12345678",
    "telefono": "987654321",
    "email": "juan@email.com",
    "edad": 35,
    "sexo": "M"
  }
}
```

### 2. Obtener Citas del Paciente
```
GET http://localhost:4000/api/n8n/paciente/1/citas?proximas=true

Respuesta:
{
  "paciente_id": 1,
  "total_citas": 2,
  "citas": [
    {
      "id": 5,
      "fecha": "2026-01-15",
      "hora": "10:00",
      "estado": "confirmada",
      "tratamiento": "Botox",
      "especialista": "Dr. García"
    }
  ]
}
```

### 3. Obtener Deudas del Paciente
```
GET http://localhost:4000/api/n8n/paciente/1/deudas

Respuesta:
{
  "paciente_id": 1,
  "tiene_deudas": true,
  "total_deuda": "500.00",
  "cantidad_deudas": 1,
  "deudas": [
    {
      "id": 3,
      "tratamiento": "Botox",
      "saldo_pendiente": 500.00
    }
  ]
}
```

### 4. Obtener Tratamientos Disponibles
```
GET http://localhost:4000/api/n8n/tratamientos

Respuesta:
{
  "total": 15,
  "tratamientos": [
    {
      "id": 1,
      "nombre": "Botox",
      "descripcion": "Toxina botulínica",
      "precio": 800.00,
      "categoria": "facial"
    }
  ]
}
```

### 5. Registrar Interacción
```
POST http://localhost:4000/api/n8n/interaccion
Content-Type: application/json

{
  "telefono": "987654321",
  "paciente_id": 1,
  "mensaje": "Hola, quiero confirmar mi cita",
  "tipo": "entrante",
  "metadata": {
    "fuente": "whatsapp",
    "bot": true
  }
}
```

### 6. Crear Recordatorio
```
POST http://localhost:4000/api/n8n/recordatorio
Content-Type: application/json

{
  "paciente_id": 1,
  "tipo": "cita",
  "fecha_envio": "2026-01-14 09:00:00",
  "mensaje": "Recordatorio: Tienes cita mañana a las 10 AM",
  "telefono": "987654321"
}
```

---

## 🤖 Ejemplos de Workflows en n8n {#workflows}

### Workflow 1: Bot de WhatsApp con IA

**Flujo:**
1. **Webhook Trigger** (Whapi) → Recibe mensaje de WhatsApp
2. **HTTP Request** → Busca paciente en CRM por teléfono
3. **IF Node** → ¿Paciente existe?
   - **SÍ:** Obtiene sus citas y deudas
   - **NO:** Mensaje de bienvenida
4. **OpenAI Node** → Procesa mensaje con IA
5. **HTTP Request** → Envía respuesta por Whapi
6. **HTTP Request** → Registra interacción en CRM

**Configuración del nodo OpenAI:**
```
System Prompt:
Eres un asistente virtual de ShowClinic, una clínica de estética.
Tu trabajo es ayudar a los pacientes con:
- Confirmar citas
- Consultar tratamientos disponibles
- Recordar pagos pendientes
- Responder preguntas sobre procedimientos

Datos del paciente:
{{ $json.paciente }}

Citas próximas:
{{ $json.citas }}

Deudas pendientes:
{{ $json.deudas }}

Responde de manera amable, profesional y concisa.
```

### Workflow 2: Recordatorios Automáticos de Citas

**Flujo:**
1. **Schedule Trigger** → Cada día a las 9:00 AM
2. **HTTP Request** → Obtiene citas del día siguiente
3. **Loop Over Items** → Por cada cita:
   - **HTTP Request** → Obtiene datos del paciente
   - **HTTP Request** → Envía mensaje por Whapi
   - **HTTP Request** → Registra recordatorio en CRM

**Mensaje de recordatorio:**
```
Hola {{ $json.paciente.nombre }}! 👋

Te recordamos tu cita para mañana:
📅 Fecha: {{ $json.cita.fecha }}
🕐 Hora: {{ $json.cita.hora }}
💉 Tratamiento: {{ $json.cita.tratamiento }}
👨‍⚕️ Especialista: {{ $json.cita.especialista }}

Por favor confirma tu asistencia respondiendo SÍ.

ShowClinic - Tu belleza, nuestra pasión ✨
```

### Workflow 3: Cobros Automáticos

**Flujo:**
1. **Schedule Trigger** → Cada lunes a las 10:00 AM
2. **HTTP Request** → Obtiene pacientes con deudas
3. **Loop Over Items** → Por cada deuda:
   - **HTTP Request** → Envía mensaje de cobro por Whapi
   - **Wait** → Espera 1 hora
   - **HTTP Request** → Verifica si pagó

**Mensaje de cobro:**
```
Hola {{ $json.paciente.nombre }}! 💳

Tienes un saldo pendiente de S/ {{ $json.deuda.total }}.

Detalle:
{{ $json.deuda.tratamiento }} - S/ {{ $json.deuda.saldo }}

Puedes pagar por:
💰 Efectivo en clínica
💳 Transferencia: BCP 123-456-789
📱 Yape/Plin: 987654321

¿Necesitas ayuda? Responde este mensaje.
```

---

## 💡 Casos de Uso Prácticos {#casos-de-uso}

### Caso 1: Paciente pregunta por su cita

**Mensaje del paciente:**
```
"Hola, ¿cuándo es mi próxima cita?"
```

**Flujo automático:**
1. n8n recibe mensaje de Whapi
2. Busca paciente por teléfono en CRM
3. Obtiene sus citas próximas
4. OpenAI genera respuesta personalizada
5. Envía respuesta por WhatsApp
6. Registra conversación en CRM

**Respuesta del bot:**
```
Hola Juan! 👋

Tu próxima cita es:
📅 15 de enero, 2026
🕐 10:00 AM
💉 Botox facial
👨‍⚕️ Dr. García

¿Necesitas reagendar o tienes alguna duda?
```

### Caso 2: Recordatorio automático de pago

**Trigger:** Lunes 10:00 AM

**Acción automática:**
1. n8n consulta deudas pendientes en CRM
2. Filtra deudas mayores a 7 días
3. Envía mensaje personalizado por WhatsApp
4. Registra envío en CRM
5. Si responde, notifica al equipo

### Caso 3: Lead nuevo por WhatsApp

**Mensaje del lead:**
```
"Hola, quiero información sobre botox"
```

**Flujo automático:**
1. n8n detecta que no es paciente registrado
2. OpenAI identifica interés en tratamiento
3. Envía información sobre Botox
4. Pregunta datos de contacto
5. Crea registro en CRM como lead
6. Notifica al equipo de ventas

---

## 🔧 Configuración Paso a Paso

### Paso 1: Preparar tu CRM

```bash
# 1. Reiniciar backend para cargar nuevos endpoints
cd d:\showclinic-crm\backend
npm start

# Deberías ver:
# ✅ Servidor corriendo en puerto 4000
# ✅ Ruta /api/n8n registrada
```

### Paso 2: Instalar n8n

```bash
# En una nueva terminal
npx n8n

# Se abrirá http://localhost:5678
```

### Paso 3: Crear tu primer workflow

1. En n8n, clic en "New Workflow"
2. Agregar nodo "Webhook"
3. Copiar URL del webhook
4. Configurar en Whapi
5. Agregar nodo "HTTP Request" para consultar CRM
6. Agregar nodo "OpenAI" para IA
7. Agregar nodo "HTTP Request" para responder por Whapi
8. Conectar todos los nodos
9. Activar workflow

### Paso 4: Probar integración

1. Envía un mensaje de WhatsApp al número conectado
2. Verifica en n8n que el workflow se ejecutó
3. Revisa la respuesta en WhatsApp
4. Verifica en tu CRM que se registró la interacción

---

## 📊 Monitoreo y Logs

### En n8n:
- Ve a "Executions" para ver historial
- Revisa logs de cada nodo
- Identifica errores

### En tu CRM:
- Consulta `whatsapp_interacciones` para ver conversaciones
- Revisa `whatsapp_recordatorios` para ver envíos programados

---

## 🆘 Solución de Problemas

### Error: "Cannot connect to CRM"
```
Solución:
1. Verifica que el backend esté corriendo en puerto 4000
2. Prueba el endpoint manualmente:
   curl http://localhost:4000/api/n8n/estadisticas
```

### Error: "Whapi webhook not receiving"
```
Solución:
1. Verifica que n8n esté corriendo
2. Usa ngrok para exponer localhost:
   ngrok http 5678
3. Actualiza webhook URL en Whapi con URL de ngrok
```

### Error: "OpenAI API error"
```
Solución:
1. Verifica tu API key de OpenAI
2. Revisa que tengas créditos disponibles
3. Reduce el tamaño del prompt
```

---

## 💰 Costos Estimados

```
n8n (self-hosted):     $0/mes
Whapi Starter:         $29/mes
OpenAI API:            ~$5-10/mes (uso moderado)
Total:                 ~$35-40/mes
```

---

## 🎯 Próximos Pasos

1. ✅ Instalar n8n
2. ✅ Crear cuenta en Whapi
3. ✅ Crear primer workflow de prueba
4. ✅ Conectar con OpenAI
5. ✅ Probar con mensajes reales
6. ✅ Crear workflows de recordatorios
7. ✅ Implementar en producción

---

## 📞 Soporte

Si tienes dudas, puedes:
1. Revisar documentación de n8n: https://docs.n8n.io
2. Revisar documentación de Whapi: https://whapi.readme.io
3. Consultar con tu desarrollador

---

**¡Listo! Ahora tu CRM ShowClinic puede comunicarse con n8n y WhatsApp** 🎉
