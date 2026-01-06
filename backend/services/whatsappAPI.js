import axios from "axios";
import { dbGet } from "../db/database.js";

/**
 * Servicio para interactuar con WhatsApp Business API de Meta
 */

/**
 * Enviar mensaje de texto a WhatsApp
 */
export async function enviarMensajeWhatsApp(telefono, mensaje) {
  try {
    // Obtener configuración
    const phoneNumberId = await dbGet(
      `SELECT valor FROM whatsapp_config WHERE clave = 'phone_number_id'`
    );
    const accessToken = await dbGet(
      `SELECT valor FROM whatsapp_config WHERE clave = 'access_token'`
    );

    if (!phoneNumberId?.valor || !accessToken?.valor) {
      console.error("❌ Configuración de WhatsApp incompleta");
      return { success: false, error: "Configuración incompleta" };
    }

    const url = `https://graph.facebook.com/v18.0/${phoneNumberId.valor}/messages`;

    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: telefono,
      type: "text",
      text: {
        preview_url: false,
        body: mensaje,
      },
    };

    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${accessToken.valor}`,
        "Content-Type": "application/json",
      },
    });

    console.log(`✅ Mensaje enviado a ${telefono}`);
    return {
      success: true,
      messageId: response.data.messages[0].id,
    };
  } catch (error) {
    console.error("❌ Error enviando mensaje WhatsApp:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

/**
 * Enviar mensaje con plantilla (template)
 */
export async function enviarPlantillaWhatsApp(telefono, nombrePlantilla, parametros = []) {
  try {
    const phoneNumberId = await dbGet(
      `SELECT valor FROM whatsapp_config WHERE clave = 'phone_number_id'`
    );
    const accessToken = await dbGet(
      `SELECT valor FROM whatsapp_config WHERE clave = 'access_token'`
    );

    if (!phoneNumberId?.valor || !accessToken?.valor) {
      return { success: false, error: "Configuración incompleta" };
    }

    const url = `https://graph.facebook.com/v18.0/${phoneNumberId.valor}/messages`;

    const data = {
      messaging_product: "whatsapp",
      to: telefono,
      type: "template",
      template: {
        name: nombrePlantilla,
        language: {
          code: "es",
        },
        components: parametros.length > 0 ? [
          {
            type: "body",
            parameters: parametros.map(param => ({
              type: "text",
              text: param,
            })),
          },
        ] : [],
      },
    };

    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${accessToken.valor}`,
        "Content-Type": "application/json",
      },
    });

    return {
      success: true,
      messageId: response.data.messages[0].id,
    };
  } catch (error) {
    console.error("❌ Error enviando plantilla:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

/**
 * Marcar mensaje como leído
 */
export async function marcarComoLeido(mensajeId) {
  try {
    const phoneNumberId = await dbGet(
      `SELECT valor FROM whatsapp_config WHERE clave = 'phone_number_id'`
    );
    const accessToken = await dbGet(
      `SELECT valor FROM whatsapp_config WHERE clave = 'access_token'`
    );

    if (!phoneNumberId?.valor || !accessToken?.valor) {
      return { success: false };
    }

    const url = `https://graph.facebook.com/v18.0/${phoneNumberId.valor}/messages`;

    const data = {
      messaging_product: "whatsapp",
      status: "read",
      message_id: mensajeId,
    };

    await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${accessToken.valor}`,
        "Content-Type": "application/json",
      },
    });

    return { success: true };
  } catch (error) {
    console.error("❌ Error marcando como leído:", error.message);
    return { success: false };
  }
}

/**
 * Verificar estado del número de WhatsApp
 */
export async function verificarEstadoNumero() {
  try {
    const phoneNumberId = await dbGet(
      `SELECT valor FROM whatsapp_config WHERE clave = 'phone_number_id'`
    );
    const accessToken = await dbGet(
      `SELECT valor FROM whatsapp_config WHERE clave = 'access_token'`
    );

    if (!phoneNumberId?.valor || !accessToken?.valor) {
      return { success: false, error: "Configuración incompleta" };
    }

    const url = `https://graph.facebook.com/v18.0/${phoneNumberId.valor}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken.valor}`,
      },
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error("❌ Error verificando número:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
