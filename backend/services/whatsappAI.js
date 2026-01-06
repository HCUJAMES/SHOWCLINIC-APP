import { dbGet, dbAll } from "../db/database.js";
import OpenAI from "openai";

/**
 * Servicio de IA para procesar mensajes de WhatsApp
 * Usa OpenAI GPT-4 para generar respuestas inteligentes
 */

let openaiClient = null;

// Inicializar cliente de OpenAI
async function inicializarOpenAI() {
  if (openaiClient) return openaiClient;

  const config = await dbGet(
    `SELECT valor FROM whatsapp_config WHERE clave = 'openai_api_key'`
  );

  if (!config?.valor) {
    console.warn("⚠️ OpenAI API Key no configurada");
    return null;
  }

  openaiClient = new OpenAI({
    apiKey: config.valor,
  });

  return openaiClient;
}

/**
 * Procesar mensaje con IA
 */
export async function procesarMensajeConIA(conversacionId, telefono, mensaje) {
  try {
    const client = await inicializarOpenAI();
    if (!client) {
      return {
        mensaje: "Gracias por tu mensaje. Un asesor te contactará pronto.",
        calificacion: "frio",
      };
    }

    // Obtener historial de conversación
    const historial = await dbAll(
      `SELECT tipo, contenido, enviado_por 
       FROM whatsapp_mensajes 
       WHERE conversacion_id = ? 
       ORDER BY creado_en ASC 
       LIMIT 20`,
      [conversacionId]
    );

    // Obtener información de la clínica
    const infoClinica = await obtenerInfoClinica();

    // Construir prompt del sistema
    const systemPrompt = construirPromptSistema(infoClinica);

    // Construir mensajes para la IA
    const messages = [
      { role: "system", content: systemPrompt },
      ...historial.map((msg) => ({
        role: msg.tipo === "entrante" ? "user" : "assistant",
        content: msg.contenido,
      })),
      { role: "user", content: mensaje },
    ];

    // Llamar a OpenAI
    const modeloConfig = await dbGet(
      `SELECT valor FROM whatsapp_config WHERE clave = 'openai_model'`
    );
    const modelo = modeloConfig?.valor || "gpt-4-turbo-preview";

    const completion = await client.chat.completions.create({
      model: modelo,
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
      functions: [
        {
          name: "calificar_lead",
          description: "Califica el nivel de interés del lead basado en la conversación",
          parameters: {
            type: "object",
            properties: {
              calificacion: {
                type: "string",
                enum: ["frio", "tibio", "caliente"],
                description: "Nivel de interés: frio (solo pregunta), tibio (interesado), caliente (quiere agendar)",
              },
              tratamiento: {
                type: "string",
                description: "Tratamiento de interés mencionado",
              },
              urgencia: {
                type: "string",
                enum: ["baja", "media", "alta"],
                description: "Nivel de urgencia del paciente",
              },
              probabilidad: {
                type: "number",
                description: "Probabilidad de conversión (0-100)",
              },
              analisis: {
                type: "string",
                description: "Breve análisis del lead",
              },
            },
            required: ["calificacion"],
          },
        },
      ],
      function_call: "auto",
    });

    const respuestaIA = completion.choices[0].message;
    let calificacionLead = null;

    // Procesar function call si existe
    if (respuestaIA.function_call) {
      try {
        const args = JSON.parse(respuestaIA.function_call.arguments);
        calificacionLead = args;
      } catch (e) {
        console.error("Error parseando function call:", e);
      }
    }

    return {
      mensaje: respuestaIA.content || "Gracias por tu mensaje.",
      calificacion: calificacionLead?.calificacion,
      tratamiento: calificacionLead?.tratamiento,
      urgencia: calificacionLead?.urgencia,
      probabilidad: calificacionLead?.probabilidad,
      analisis: calificacionLead?.analisis,
    };
  } catch (error) {
    console.error("❌ Error en IA:", error);
    return {
      mensaje: "Gracias por tu mensaje. Un asesor te contactará pronto.",
      calificacion: "frio",
    };
  }
}

/**
 * Construir prompt del sistema
 */
function construirPromptSistema(info) {
  return `Eres un asistente virtual profesional de ${info.nombre_clinica || "una clínica de estética"}.

INFORMACIÓN DE LA CLÍNICA:
- Nombre: ${info.nombre_clinica || "ShowClinic"}
- Dirección: ${info.direccion || "Por definir"}
- Horarios: ${info.horarios || "Lunes a Viernes 9:00 AM - 7:00 PM"}
- Teléfono: ${info.telefono || "Por definir"}
- Tratamientos principales: ${info.tratamientos || "Rellenos faciales, toxina botulínica, bioestimuladores"}
- Rango de precios: ${info.precios || "Desde S/ 300"}
- Consulta: ${info.consulta || "Primera consulta gratuita"}
- Promociones: ${info.promociones || "Consultar promociones vigentes"}

TU OBJETIVO:
1. Responder de manera amigable, profesional y concisa
2. Proporcionar información sobre tratamientos y precios
3. Identificar el nivel de interés del paciente
4. Agendar citas cuando el paciente esté listo
5. Usar emojis moderadamente para ser más cercano

INSTRUCCIONES:
- Sé breve (máximo 3-4 líneas por respuesta)
- Si preguntan por precios específicos, da rangos aproximados
- Si quieren agendar, pregunta día y horario preferido
- Si no sabes algo, ofrece que un especialista los contacte
- Mantén un tono profesional pero amigable
- Usa "usted" o "tú" según el tono del paciente

CALIFICACIÓN DE LEADS:
- FRÍO: Solo pregunta información general, no muestra urgencia
- TIBIO: Pregunta precios, muestra interés, pero no agenda
- CALIENTE: Quiere agendar cita, muestra urgencia, pregunta disponibilidad

Cuando identifiques un lead CALIENTE, usa la función calificar_lead para notificarlo.`;
}

/**
 * Obtener información de la clínica desde la configuración
 */
async function obtenerInfoClinica() {
  const configs = await dbAll(`SELECT clave, valor FROM whatsapp_config`);
  const info = {};

  configs.forEach((config) => {
    info[config.clave] = config.valor;
  });

  return info;
}

/**
 * Generar resumen de conversación con IA
 */
export async function generarResumenConversacion(conversacionId) {
  try {
    const client = await inicializarOpenAI();
    if (!client) return "Resumen no disponible";

    const mensajes = await dbAll(
      `SELECT tipo, contenido FROM whatsapp_mensajes WHERE conversacion_id = ? ORDER BY creado_en ASC`,
      [conversacionId]
    );

    const conversacion = mensajes
      .map((m) => `${m.tipo === "entrante" ? "Paciente" : "Asistente"}: ${m.contenido}`)
      .join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content:
            "Genera un resumen breve (2-3 líneas) de esta conversación de WhatsApp, destacando: tratamiento de interés, nivel de interés, y próximos pasos.",
        },
        { role: "user", content: conversacion },
      ],
      temperature: 0.5,
      max_tokens: 150,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("❌ Error generando resumen:", error);
    return "Error generando resumen";
  }
}

/**
 * Analizar sentimiento del mensaje
 */
export async function analizarSentimiento(mensaje) {
  try {
    const client = await inicializarOpenAI();
    if (!client) return "neutral";

    const completion = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Analiza el sentimiento del mensaje y responde solo con: positivo, neutral, o negativo",
        },
        { role: "user", content: mensaje },
      ],
      temperature: 0.3,
      max_tokens: 10,
    });

    return completion.choices[0].message.content.toLowerCase().trim();
  } catch (error) {
    console.error("❌ Error analizando sentimiento:", error);
    return "neutral";
  }
}
