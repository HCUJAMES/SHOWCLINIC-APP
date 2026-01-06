# 📱 Configuración de WhatsApp + IA

## 🎯 ¿Qué hemos preparado?

Mientras esperas las credenciales del doctor, hemos creado:

### ✅ Base de Datos
- 6 tablas nuevas para WhatsApp
- Sistema de conversaciones
- Sistema de leads calificados
- Estadísticas automáticas
- Configuración centralizada

### ✅ Backend
- Webhook para recibir mensajes de WhatsApp
- Integración con OpenAI GPT-4
- Sistema de calificación automática de leads
- API REST para el frontend
- Servicios de WhatsApp y IA

### ✅ Archivos Creados
```
backend/
├── db/
│   └── whatsapp-schema.sql          # Estructura de base de datos
├── routes/
│   └── whatsappRoutes.js            # Rutas API de WhatsApp
├── services/
│   ├── whatsappAI.js                # Servicio de IA (OpenAI)
│   └── whatsappAPI.js               # Servicio de WhatsApp API
└── scripts/
    └── inicializar_whatsapp.js      # Script de inicialización
```

---

## 📋 PASOS PARA CONFIGURAR (Cuando tengas las credenciales)

### **Paso 1: Inicializar Base de Datos**

En la computadora de la clínica:

```powershell
cd C:\showclinic-crm\backend
node scripts\inicializar_whatsapp.js
```

Esto creará todas las tablas necesarias.

---

### **Paso 2: Instalar Dependencias**

```powershell
cd C:\showclinic-crm\backend
npm install openai axios
```

---

### **Paso 3: Configurar Credenciales**

Tienes 2 opciones:

#### **Opción A: Desde el Frontend (Recomendado)**
1. Iniciar el servidor backend
2. Ir a la nueva sección "WhatsApp" en el CRM
3. Ir a "Configuración"
4. Llenar los campos:
   - Phone Number ID (de Meta)
   - Access Token (de Meta)
   - OpenAI API Key

#### **Opción B: Directamente en la Base de Datos**
```sql
UPDATE whatsapp_config SET valor = 'TU_PHONE_NUMBER_ID' WHERE clave = 'phone_number_id';
UPDATE whatsapp_config SET valor = 'TU_ACCESS_TOKEN' WHERE clave = 'access_token';
UPDATE whatsapp_config SET valor = 'sk-proj-...' WHERE clave = 'openai_api_key';
```

---

### **Paso 4: Configurar Información de la Clínica**

Agregar estos valores en la tabla `whatsapp_config`:

```sql
INSERT INTO whatsapp_config (clave, valor) VALUES
  ('nombre_clinica', 'ShowClinic'),
  ('direccion', 'Av. Ejemplo 123, Lima'),
  ('horarios', 'Lunes a Viernes 9:00 AM - 7:00 PM'),
  ('telefono', '+51 987 654 321'),
  ('tratamientos', 'Relleno de labios, Botox, Bioestimuladores'),
  ('precios', 'Desde S/ 300 hasta S/ 2,500'),
  ('consulta', 'Primera consulta gratuita'),
  ('promociones', '20% descuento en primera sesión');
```

---

### **Paso 5: Configurar Webhook en Meta**

1. Ir a Meta for Developers
2. Seleccionar tu app
3. Ir a WhatsApp → Configuration
4. En "Webhook", agregar:
   - **Callback URL:** `https://TU_DOMINIO/api/whatsapp/webhook`
   - **Verify Token:** `showclinic_webhook_2026`
5. Suscribirse a: `messages`

**IMPORTANTE:** Necesitas que tu servidor sea accesible desde internet.

Opciones:
- **Producción:** Dominio propio con SSL
- **Desarrollo:** ngrok (temporal)

---

### **Paso 6: Probar el Sistema**

1. Enviar mensaje de WhatsApp al número configurado
2. Verificar que llegue al webhook
3. La IA debe responder automáticamente
4. Ver la conversación en el CRM

---

## 🔧 CONFIGURACIÓN AVANZADA

### **Horarios de Atención**

```sql
UPDATE whatsapp_config SET valor = '09:00' WHERE clave = 'horario_atencion_inicio';
UPDATE whatsapp_config SET valor = '19:00' WHERE clave = 'horario_atencion_fin';
```

### **Mensaje Fuera de Horario**

```sql
UPDATE whatsapp_config SET valor = 'Gracias por contactarnos. Te responderemos en horario de atención.' WHERE clave = 'mensaje_fuera_horario';
```

### **Cambiar Modelo de IA**

```sql
-- GPT-4 Turbo (recomendado, más caro)
UPDATE whatsapp_config SET valor = 'gpt-4-turbo-preview' WHERE clave = 'openai_model';

-- GPT-3.5 Turbo (más barato, menos preciso)
UPDATE whatsapp_config SET valor = 'gpt-3.5-turbo' WHERE clave = 'openai_model';
```

---

## 📊 FUNCIONALIDADES IMPLEMENTADAS

### **1. Respuestas Automáticas**
- ✅ La IA responde automáticamente 24/7
- ✅ Usa información de la clínica
- ✅ Tono profesional y amigable
- ✅ Respuestas en español

### **2. Calificación de Leads**
- ✅ **Frío:** Solo pregunta información
- ✅ **Tibio:** Muestra interés, pregunta precios
- ✅ **Caliente:** Quiere agendar, urgencia alta

### **3. Gestión de Conversaciones**
- ✅ Historial completo de mensajes
- ✅ Modo automático/manual
- ✅ Transferir a humano
- ✅ Notas internas

### **4. Estadísticas**
- ✅ Conversaciones por día
- ✅ Leads generados
- ✅ Tasa de conversión
- ✅ Tiempo de respuesta

---

## 🎯 PRÓXIMOS PASOS

### **Cuando tengas las credenciales:**

1. ☐ Ejecutar `inicializar_whatsapp.js`
2. ☐ Instalar dependencias (`openai`, `axios`)
3. ☐ Configurar credenciales en la BD
4. ☐ Agregar información de la clínica
5. ☐ Configurar webhook en Meta
6. ☐ Hacer servidor accesible desde internet
7. ☐ Probar enviando un mensaje
8. ☐ Verificar respuesta automática

### **Frontend (Pendiente):**
- Panel de conversaciones
- Vista de leads
- Configuración visual
- Estadísticas

---

## ⚠️ IMPORTANTE

### **Servidor Accesible desde Internet**

Para que Meta pueda enviar mensajes al webhook, tu servidor debe ser accesible desde internet.

**Opciones:**

1. **Producción (Recomendado):**
   - Dominio propio (ejemplo: `api.showclinic.pe`)
   - Certificado SSL (HTTPS obligatorio)
   - Puerto 443 abierto

2. **Desarrollo (Temporal):**
   - ngrok: `ngrok http 4000`
   - Te da una URL temporal: `https://abc123.ngrok.io`
   - Usar esa URL en el webhook de Meta

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### **Webhook no recibe mensajes**
- Verificar que el servidor esté corriendo
- Verificar que sea accesible desde internet
- Revisar logs del servidor
- Verificar token de verificación

### **IA no responde**
- Verificar OpenAI API Key
- Verificar saldo en OpenAI
- Revisar logs de errores
- Verificar que `modo_automatico` esté en `1`

### **Mensajes no se envían**
- Verificar Phone Number ID
- Verificar Access Token
- Verificar que el número esté verificado en Meta
- Revisar límites de mensajes

---

## 📞 CONTACTO

Si tienes problemas, revisa los logs del servidor:
```powershell
# Ver logs en tiempo real
cd C:\showclinic-crm\backend
node index.js
```

Los errores aparecerán con el prefijo `❌`

---

**Última actualización:** Enero 2026
