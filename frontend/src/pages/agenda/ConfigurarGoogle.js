/**
 * Conexión con el Google Calendar de la clínica (solo master y doctor).
 * Guía paso a paso: crear la cuenta de servicio, compartir el calendario con
 * ella y pegar aquí la llave + el ID del calendario. Antes de guardar, el
 * servidor prueba que todo funcione.
 */
import React, { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Link,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { CheckCircle, ContentCopy, UploadFile } from "../../iconos";
import { BRAND } from "../../brand";
import agendaApi, { mensajeError } from "./api";

const CALENDARIO_CLINICA = "showclinicyanahuara@gmail.com";

function Paso({ n, titulo, children, listo }) {
  return (
    <Box sx={{ display: "flex", gap: 2, py: 1.5 }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          fontWeight: 700,
          bgcolor: listo ? BRAND.exito : "rgba(163,105,32,0.12)",
          color: listo ? "#fff" : BRAND.oro,
        }}
      >
        {listo ? <CheckCircle sx={{ fontSize: 18 }} /> : n}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14.5, mb: 0.5 }}>{titulo}</Typography>
        <Box sx={{ fontSize: 13.5, color: BRAND.textoSuave, lineHeight: 1.6 }}>{children}</Box>
      </Box>
    </Box>
  );
}

export default function ConfigurarGoogle({ estado, onConectado, onDesconectado }) {
  const archivoRef = useRef(null);
  const [credenciales, setCredenciales] = useState(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  // La clínica usa el calendario principal de su cuenta de Google: su ID es el mismo correo.
  const [calendarId, setCalendarId] = useState(estado?.calendarId || CALENDARIO_CLINICA);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [confirmarDesconexion, setConfirmarDesconexion] = useState(false);

  const correoServicio = credenciales?.client_email || estado?.cuentaServicio || "";
  const yaConectado = Boolean(estado?.configurado);

  const leerArchivo = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    if (archivo.size > 100 * 1024) {
      setError("Ese archivo es demasiado grande para ser una llave de Google. Elige el archivo .json descargado.");
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const json = JSON.parse(String(lector.result));
        if (json.type !== "service_account" || !json.client_email || !json.private_key) {
          setError('Ese archivo no es la llave de una "cuenta de servicio". Revisa el paso 2.');
          return;
        }
        setCredenciales(json);
        setNombreArchivo(archivo.name);
      } catch {
        setError("El archivo no es un JSON válido. Elige el archivo .json descargado de Google Cloud.");
      }
    };
    lector.onerror = () => setError("No se pudo leer el archivo.");
    lector.readAsText(archivo);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(correoServicio);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  const conectar = async () => {
    if (!credenciales && !yaConectado) {
      setError("Primero sube el archivo de la llave (paso 2).");
      return;
    }
    if (!calendarId.trim()) {
      setError("Escribe el ID del calendario (paso 4).");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const r = await agendaApi.conectar({ credenciales: credenciales || undefined, calendarId: calendarId.trim() });
      onConectado?.(r);
    } catch (err) {
      setError(mensajeError(err, "No se pudo conectar con Google Calendar."));
    } finally {
      setGuardando(false);
    }
  };

  const desconectar = async () => {
    if (!confirmarDesconexion) {
      setConfirmarDesconexion(true);
      return;
    }
    setGuardando(true);
    try {
      await agendaApi.desconectar();
      onDesconectado?.();
    } catch (err) {
      setError(mensajeError(err, "No se pudo desconectar."));
    } finally {
      setGuardando(false);
      setConfirmarDesconexion(false);
    }
  };

  return (
    <Box>
      {yaConectado && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Conectado a <b>{estado.calendarNombre || estado.calendarId}</b>. Puedes cambiar la llave o el calendario aquí abajo.
        </Alert>
      )}

      <Paso n={1} titulo="Crea un proyecto en Google Cloud y activa la API">
        Entra a{" "}
        <Link href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">
          console.cloud.google.com
        </Link>{" "}
        con la cuenta de Google de la clínica (<b>{CALENDARIO_CLINICA}</b>), crea un proyecto (por ejemplo “ShowClinic”) y en{" "}
        <Link href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer">
          Biblioteca → Google Calendar API
        </Link>{" "}
        presiona <b>Habilitar</b>. Es gratis.
      </Paso>

      <Paso n={2} titulo="Crea una cuenta de servicio y descarga su llave" listo={Boolean(credenciales)}>
        En{" "}
        <Link href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer">
          IAM → Cuentas de servicio
        </Link>{" "}
        crea una cuenta (nombre: “agenda-showclinic”, sin roles). Ábrela → pestaña <b>Claves</b> → <b>Agregar clave</b> →{" "}
        <b>JSON</b>. Se descargará un archivo .json: súbelo aquí.
        <Box sx={{ mt: 1.25, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <input ref={archivoRef} type="file" accept=".json,application/json" hidden onChange={leerArchivo} />
          <Button variant="outlined" size="small" startIcon={<UploadFile />} onClick={() => archivoRef.current?.click()}>
            {credenciales ? "Cambiar archivo" : yaConectado ? "Subir una llave nueva" : "Subir archivo .json"}
          </Button>
          {nombreArchivo && <Typography sx={{ fontSize: 13, color: BRAND.exito, fontWeight: 600 }}>{nombreArchivo}</Typography>}
        </Box>
      </Paso>

      <Paso n={3} titulo="Comparte el calendario de la clínica con la cuenta de servicio">
        En Google Calendar (en la computadora): en el calendario de la clínica → <b>⋮ Configuración y uso compartido</b> →{" "}
        <b>Compartir con personas específicas</b> → <b>Agregar personas</b>, pega este correo y elige el permiso{" "}
        <b>“Hacer cambios en eventos”</b>.
        {correoServicio ? (
          <Box
            sx={{
              mt: 1.25,
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 1,
              pl: 1.5,
              borderRadius: 1.5,
              bgcolor: "#fff",
              border: `1px solid ${BRAND.borde}`,
              maxWidth: 560,
            }}
          >
            <Typography sx={{ fontSize: 13, fontFamily: "monospace", flex: 1, wordBreak: "break-all", color: BRAND.texto }}>
              {correoServicio}
            </Typography>
            <Tooltip title={copiado ? "¡Copiado!" : "Copiar"}>
              <IconButton size="small" onClick={copiar} aria-label="Copiar correo">
                {copiado ? <CheckCircle fontSize="small" sx={{ color: BRAND.exito }} /> : <ContentCopy fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Typography sx={{ mt: 1, fontSize: 12.5, color: BRAND.textoTenue }}>
            (El correo aparecerá aquí cuando subas el archivo del paso 2.)
          </Typography>
        )}
      </Paso>

      <Paso n={4} titulo="Escribe el ID del calendario">
        En esa misma pantalla de configuración, baja hasta <b>Integrar el calendario → ID del calendario</b>. Si es el calendario
        principal de la cuenta, el ID es el mismo correo Gmail de la clínica (ya está escrito abajo).
        <TextField
          fullWidth
          size="small"
          value={calendarId}
          onChange={(e) => setCalendarId(e.target.value)}
          placeholder="clinica@gmail.com  o  xxxx@group.calendar.google.com"
          sx={{ mt: 1.25, maxWidth: 560, bgcolor: "#fff" }}
        />
      </Paso>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 1.5, mt: 2, flexWrap: "wrap", alignItems: "center" }}>
        <Button
          variant="contained"
          onClick={conectar}
          disabled={guardando}
          startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {guardando ? "Probando conexión…" : yaConectado ? "Guardar y probar" : "Conectar y probar"}
        </Button>
        {yaConectado && (
          <Button color="error" onClick={desconectar} disabled={guardando} variant={confirmarDesconexion ? "contained" : "text"}>
            {confirmarDesconexion ? "Sí, desconectar" : "Desconectar Google Calendar"}
          </Button>
        )}
        {confirmarDesconexion && (
          <Typography sx={{ fontSize: 12.5, color: BRAND.textoSuave }}>
            Las citas no se borran de Google; solo dejarán de verse en ShowClinic.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
