/**
 * Conexión con el Google Calendar de la clínica (solo master y doctor).
 *
 * - Sin conectar: guía para "Iniciar sesión con Google" (recomendado) o, como
 *   alternativa, conectar una cuenta de servicio.
 * - Conectado: tabla de calendarios para elegir cuáles se ven, a qué
 *   especialista pertenece cada uno, el predeterminado y (si hiciera falta)
 *   corregir un color.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Radio,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { CheckCircle, ContentCopy, UploadFile, Refresh } from "../../iconos";
import { BRAND } from "../../brand";
import agendaApi, { mensajeError } from "./api";
import { COLORES_CALENDARIO } from "./colores";

const CUENTA_CLINICA = "showclinicyanahuara@gmail.com";

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

function Copiable({ texto }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <Box
      sx={{
        mt: 1,
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 1,
        pl: 1.5,
        borderRadius: 1.5,
        bgcolor: "#fff",
        border: `1px solid ${BRAND.borde}`,
        maxWidth: 600,
      }}
    >
      <Typography sx={{ fontSize: 13, fontFamily: "monospace", flex: 1, wordBreak: "break-all", color: BRAND.texto }}>
        {texto}
      </Typography>
      <Tooltip title={copiado ? "¡Copiado!" : "Copiar"}>
        <IconButton size="small" onClick={copiar} aria-label="Copiar">
          {copiado ? <CheckCircle fontSize="small" sx={{ color: BRAND.exito }} /> : <ContentCopy fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

/** Lee un archivo .json elegido por el usuario. */
const useArchivoJson = (validar) => {
  const ref = useRef(null);
  const [json, setJson] = useState(null);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const alElegir = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    if (archivo.size > 100 * 1024) {
      setError("Ese archivo es demasiado grande. Elige el archivo .json descargado de Google Cloud.");
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const datos = JSON.parse(String(lector.result));
        const problema = validar(datos);
        if (problema) {
          setError(problema);
          return;
        }
        setJson(datos);
        setNombre(archivo.name);
      } catch {
        setError("El archivo no es un JSON válido. Elige el archivo .json descargado de Google Cloud.");
      }
    };
    lector.onerror = () => setError("No se pudo leer el archivo.");
    lector.readAsText(archivo);
  };
  const input = <input ref={ref} type="file" accept=".json,application/json" hidden onChange={alElegir} />;
  return { json, nombre, error, setError, abrir: () => ref.current?.click(), input };
};

/* ───────────── Iniciar sesión con Google ───────────── */

function ConexionGoogle({ estado, reconectar = false }) {
  const archivo = useArchivoJson((d) => {
    if (d?.installed) return 'Ese cliente es de tipo "Aplicación de escritorio". Crea uno de tipo "Aplicación web" (paso 3).';
    const c = d?.web || d;
    if (!c?.client_id || !c?.client_secret) return 'Ese archivo no es un "ID de cliente de OAuth". Revisa el paso 3.';
    return null;
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const enServidor = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  const redirectUri = estado?.redirectUri || "http://localhost:4000/api/calendario/oauth/callback";

  const iniciar = async () => {
    if (!archivo.json && !reconectar) {
      setError("Primero sube el archivo del paso 3.");
      return;
    }
    setCargando(true);
    setError("");
    try {
      const { url } = await agendaApi.iniciarGoogle({
        cliente: archivo.json || undefined,
        volverA: window.location.origin,
      });
      window.location.href = url; // vamos a Google; al terminar vuelve sola a la Agenda
    } catch (err) {
      setError(mensajeError(err, "No se pudo iniciar sesión con Google."));
      setCargando(false);
    }
  };

  const boton = (
    <Button
      variant="contained"
      onClick={iniciar}
      disabled={cargando}
      startIcon={cargando ? <CircularProgress size={16} color="inherit" /> : <GoogleG />}
      sx={{ bgcolor: "#fff", color: "#3c4043", border: "1px solid #dadce0", "&:hover": { bgcolor: "#f8f9fa" } }}
    >
      {cargando ? "Abriendo Google…" : reconectar ? "Volver a iniciar sesión con Google" : "Iniciar sesión con Google"}
    </Button>
  );

  if (reconectar) {
    return (
      <Box>
        {!enServidor && <AvisoServidor />}
        {boton}
        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {!enServidor && <AvisoServidor />}

      <Paso n={1} titulo="Crea un proyecto en Google Cloud y activa la API">
        Entra a{" "}
        <Link href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">
          console.cloud.google.com
        </Link>{" "}
        con <b>{CUENTA_CLINICA}</b>, crea un proyecto (“ShowClinic”) y en{" "}
        <Link href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer">
          Google Calendar API
        </Link>{" "}
        presiona <b>Habilitar</b>. Es gratis.
      </Paso>

      <Paso n={2} titulo="Configura la pantalla de consentimiento y publícala">
        En{" "}
        <Link href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer">
          Pantalla de consentimiento de OAuth
        </Link>
        : tipo <b>Externo</b>, nombre <b>ShowClinic</b>, tu correo de soporte → Guardar. Luego en <b>Público</b> presiona{" "}
        <b>Publicar app</b> (“En producción”). <i>Si queda “En prueba”, Google desconecta el calendario cada 7 días.</i>
      </Paso>

      <Paso n={3} titulo="Crea el ID de cliente y súbelo aquí" listo={Boolean(archivo.json)}>
        En{" "}
        <Link href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
          Credenciales
        </Link>{" "}
        → <b>Crear credenciales</b> → <b>ID de cliente de OAuth</b> → tipo <b>Aplicación web</b>. En{" "}
        <b>URI de redireccionamiento autorizados</b> agrega exactamente:
        <Copiable texto={redirectUri} />
        <Box sx={{ mt: 1 }}>
          Presiona <b>Crear</b> → <b>Descargar JSON</b> y súbelo:
        </Box>
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          {archivo.input}
          <Button variant="outlined" size="small" startIcon={<UploadFile />} onClick={archivo.abrir}>
            {archivo.json ? "Cambiar archivo" : "Subir archivo .json"}
          </Button>
          {archivo.nombre && <Typography sx={{ fontSize: 13, color: BRAND.exito, fontWeight: 600 }}>{archivo.nombre}</Typography>}
        </Box>
        {archivo.error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {archivo.error}
          </Alert>
        )}
      </Paso>

      <Paso n={4} titulo="Inicia sesión con la cuenta de la clínica">
        Elige <b>{CUENTA_CLINICA}</b> y acepta los permisos. Si Google muestra “Google no verificó esta app”, presiona{" "}
        <b>Configuración avanzada → Ir a ShowClinic</b> (es tu propia app).
        <Box sx={{ mt: 1.5 }}>{boton}</Box>
      </Paso>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

function AvisoServidor() {
  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      Haz este paso <b>en la computadora servidor</b> (donde está instalado ShowClinic), abriendo{" "}
      <b>http://localhost:4000/agenda</b> en su navegador. Google solo permite volver a esa dirección.
    </Alert>
  );
}

function GoogleG() {
  return (
    <Box component="svg" viewBox="0 0 48 48" sx={{ width: 18, height: 18 }} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.77.9 7.35 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Box>
  );
}

/* ───────────── Cuenta de servicio (alternativa) ───────────── */

function ConexionCuentaServicio({ estado, onConectado }) {
  const archivo = useArchivoJson((d) =>
    d?.type !== "service_account" || !d.client_email || !d.private_key
      ? 'Ese archivo no es la llave de una "cuenta de servicio".'
      : null
  );
  const [calendarId, setCalendarId] = useState(CUENTA_CLINICA);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const correo = archivo.json?.client_email || (estado?.modo === "service_account" ? estado.cuenta : "");

  const conectar = async () => {
    if (!archivo.json && estado?.modo !== "service_account") {
      setError("Primero sube el archivo de la llave.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const r = await agendaApi.conectar({ credenciales: archivo.json || undefined, calendarId: calendarId.trim() });
      onConectado?.(r);
    } catch (err) {
      setError(mensajeError(err, "No se pudo conectar con Google Calendar."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 1 }}>
        Con esta opción hay que compartir <b>cada calendario</b> con el correo del robot, y los colores pueden no coincidir con los
        de Google. Úsala solo si no puedes usar “Iniciar sesión con Google”.
      </Alert>
      <Paso n={1} titulo="Crea una cuenta de servicio y descarga su llave" listo={Boolean(archivo.json)}>
        En{" "}
        <Link href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer">
          IAM → Cuentas de servicio
        </Link>{" "}
        crea una cuenta, ábrela → <b>Claves</b> → <b>Agregar clave</b> → <b>JSON</b>, y súbela:
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          {archivo.input}
          <Button variant="outlined" size="small" startIcon={<UploadFile />} onClick={archivo.abrir}>
            {archivo.json ? "Cambiar archivo" : "Subir archivo .json"}
          </Button>
          {archivo.nombre && <Typography sx={{ fontSize: 13, color: BRAND.exito, fontWeight: 600 }}>{archivo.nombre}</Typography>}
        </Box>
        {archivo.error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {archivo.error}
          </Alert>
        )}
      </Paso>
      <Paso n={2} titulo="Comparte cada calendario con este correo (“Hacer cambios en eventos”)">
        {correo ? <Copiable texto={correo} /> : "(El correo aparece al subir el archivo.)"}
      </Paso>
      <Paso n={3} titulo="ID del primer calendario">
        <TextField
          fullWidth
          size="small"
          value={calendarId}
          onChange={(e) => setCalendarId(e.target.value)}
          sx={{ maxWidth: 560, bgcolor: "#fff" }}
        />
        <Box sx={{ mt: 1.5 }}>
          <Button
            variant="contained"
            onClick={conectar}
            disabled={guardando}
            startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {guardando ? "Probando conexión…" : "Conectar y probar"}
          </Button>
        </Box>
      </Paso>
      {error && <Alert severity="error">{error}</Alert>}
    </Box>
  );
}

/* ───────────── Ajustes de calendarios ───────────── */

function SelectorColor({ valor, colorGoogle, onCambiar }) {
  const [ancla, setAncla] = useState(null);
  return (
    <>
      <Tooltip title={valor ? "Color corregido a mano (clic para cambiar)" : "Color de Google (clic para corregir)"}>
        <Box
          role="button"
          tabIndex={0}
          onClick={(e) => setAncla(e.currentTarget)}
          onKeyDown={(e) => e.key === "Enter" && setAncla(e.currentTarget)}
          sx={{
            width: 22,
            height: 22,
            borderRadius: "6px",
            bgcolor: valor || colorGoogle,
            cursor: "pointer",
            boxShadow: valor ? `0 0 0 2px #fff, 0 0 0 3px ${BRAND.oro}` : "none",
          }}
        />
      </Tooltip>
      <Menu anchorEl={ancla} open={Boolean(ancla)} onClose={() => setAncla(null)}>
        <MenuItem
          onClick={() => {
            onCambiar(null);
            setAncla(null);
          }}
          sx={{ gap: 1, fontSize: 13 }}
        >
          <Box sx={{ width: 16, height: 16, borderRadius: "4px", bgcolor: colorGoogle }} />
          Usar el color de Google
        </MenuItem>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, 28px)", gap: 0.75, p: 1.5, pt: 0.5 }}>
          {COLORES_CALENDARIO.map((c) => (
            <Tooltip key={c.color} title={c.nombre}>
              <Box
                role="button"
                tabIndex={0}
                onClick={() => {
                  onCambiar(c.color);
                  setAncla(null);
                }}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  bgcolor: c.color,
                  cursor: "pointer",
                  boxShadow: (valor || colorGoogle) === c.color ? `0 0 0 2px #fff, 0 0 0 4px ${c.color}` : "none",
                }}
              />
            </Tooltip>
          ))}
        </Box>
      </Menu>
    </>
  );
}

function AjustesCalendarios({ estado, onGuardado }) {
  const [lista, setLista] = useState(null);
  const [predeterminado, setPredeterminado] = useState("");
  const [especialistas, setEspecialistas] = useState([]);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);
  const [nuevoId, setNuevoId] = useState("");
  const [agregando, setAgregando] = useState(false);

  const cargar = useCallback(async (forzar = true) => {
    setError("");
    try {
      const r = await agendaApi.calendarios({ todos: true, forzar });
      setLista(
        (r.calendarios || []).map((c) => ({
          ...c,
          colorManual: c.colorPropio ? c.color : null,
        }))
      );
      setPredeterminado(r.predeterminado || "");
      setCambios(false);
    } catch (err) {
      setError(mensajeError(err, "No se pudieron leer los calendarios de Google."));
      setLista([]);
    }
  }, []);

  useEffect(() => {
    cargar();
    agendaApi.especialistas().then(setEspecialistas).catch(() => setEspecialistas([]));
  }, [cargar]);

  const cambiar = (id, campos) => {
    setLista((prev) => prev.map((c) => (c.id === id ? { ...c, ...campos } : c)));
    setCambios(true);
  };

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      const preferencias = {};
      lista.forEach((c) => {
        preferencias[c.id] = {
          visible: c.visible,
          especialistaId: c.especialistaId || null,
          ...(c.colorManual ? { color: c.colorManual } : {}),
        };
      });
      const r = await agendaApi.guardarCalendarios({ preferencias, predeterminado: predeterminado || undefined });
      setLista(r.calendarios.map((c) => ({ ...c, colorManual: c.colorPropio ? c.color : null })));
      setCambios(false);
      onGuardado?.(r.calendarios);
    } catch (err) {
      setError(mensajeError(err, "No se pudieron guardar los cambios."));
    } finally {
      setGuardando(false);
    }
  };

  const agregar = async () => {
    if (!nuevoId.trim()) return;
    setAgregando(true);
    setError("");
    try {
      await agendaApi.agregarCalendario(nuevoId.trim());
      setNuevoId("");
      await cargar();
    } catch (err) {
      setError(mensajeError(err, "No se pudo agregar el calendario."));
    } finally {
      setAgregando(false);
    }
  };

  if (!lista) {
    return (
      <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
        <CircularProgress size={26} sx={{ color: BRAND.oro }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Calendarios de la cuenta</Typography>
        <Tooltip title="Volver a leer de Google (nombres y colores)">
          <IconButton size="small" onClick={() => cargar(true)} aria-label="Volver a leer calendarios">
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography sx={{ fontSize: 13, color: BRAND.textoSuave, mb: 1.5 }}>
        Los nombres y colores vienen de Google. Marca cuáles se muestran en ShowClinic y a qué especialista pertenece cada uno: al
        agendar con ese especialista, la cita se guarda en su calendario.
      </Typography>

      <Box sx={{ border: `1px solid ${BRAND.borde}`, borderRadius: 2, overflowX: "auto" }}>
        <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <Box component="thead" sx={{ bgcolor: BRAND.cremaClara }}>
            <Box component="tr">
              {["Mostrar", "Color", "Calendario", "Especialista", "Predet."].map((t) => (
                <Box
                  component="th"
                  key={t}
                  sx={{ textAlign: "left", fontSize: 11.5, fontWeight: 700, color: BRAND.textoSuave, letterSpacing: "0.05em", px: 1.25, py: 1, textTransform: "uppercase" }}
                >
                  {t}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {lista.map((c) => (
              <Box component="tr" key={c.id} sx={{ borderTop: `1px solid ${BRAND.borde}`, opacity: c.visible ? 1 : 0.6 }}>
                <Box component="td" sx={{ px: 0.5, width: 64 }}>
                  <Checkbox
                    checked={c.visible}
                    onChange={(e) => cambiar(c.id, { visible: e.target.checked })}
                    sx={{ color: c.colorManual || c.colorGoogle, "&.Mui-checked": { color: c.colorManual || c.colorGoogle } }}
                  />
                </Box>
                <Box component="td" sx={{ px: 1.25, width: 56 }}>
                  <SelectorColor
                    valor={c.colorManual}
                    colorGoogle={c.colorGoogle}
                    onCambiar={(color) => cambiar(c.id, { colorManual: color })}
                  />
                </Box>
                <Box component="td" sx={{ px: 1.25, py: 0.75 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{c.nombre}</Typography>
                  <Box sx={{ display: "flex", gap: 0.5, mt: 0.25, flexWrap: "wrap" }}>
                    {c.principal && <Chip size="small" label="Principal" sx={{ height: 18, fontSize: 10.5 }} />}
                    {!c.escribible && (
                      <Chip size="small" label="Solo lectura" sx={{ height: 18, fontSize: 10.5, bgcolor: "rgba(0,0,0,0.06)" }} />
                    )}
                  </Box>
                </Box>
                <Box component="td" sx={{ px: 1.25, minWidth: 200 }}>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={c.especialistaId ? String(c.especialistaId) : ""}
                    onChange={(e) => cambiar(c.id, { especialistaId: e.target.value ? Number(e.target.value) : null, especialistaAuto: false })}
                    helperText={c.especialistaAuto ? "Detectado por el nombre" : undefined}
                    FormHelperTextProps={{ sx: { mx: 0, fontSize: 11 } }}
                  >
                    <MenuItem value="">
                      <em>Ninguno</em>
                    </MenuItem>
                    {especialistas.map((e) => (
                      <MenuItem key={e.id} value={String(e.id)}>
                        {e.nombre}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
                <Box component="td" sx={{ px: 0.5, width: 64, textAlign: "center" }}>
                  <Tooltip title={c.escribible ? "Aquí se guardan las citas sin especialista" : "Es de solo lectura"}>
                    <span>
                      <Radio
                        checked={predeterminado === c.id}
                        disabled={!c.escribible}
                        onChange={() => {
                          setPredeterminado(c.id);
                          setCambios(true);
                        }}
                      />
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {estado?.modo === "service_account" && (
        <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="ID de otro calendario ya compartido"
            value={nuevoId}
            onChange={(e) => setNuevoId(e.target.value)}
            sx={{ flex: 1, minWidth: 260, bgcolor: "#fff" }}
          />
          <Button variant="outlined" onClick={agregar} disabled={agregando || !nuevoId.trim()}>
            {agregando ? "Agregando…" : "Agregar calendario"}
          </Button>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
        <Button
          variant="contained"
          onClick={guardar}
          disabled={guardando || !cambios}
          startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </Button>
      </Box>
    </Box>
  );
}

/* ───────────── Pantalla ───────────── */

export default function ConfigurarGoogle({ estado, onConectado, onDesconectado, onCalendariosGuardados }) {
  const [pestana, setPestana] = useState(0);
  const [confirmarDesconexion, setConfirmarDesconexion] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [error, setError] = useState("");

  const desconectar = async () => {
    if (!confirmarDesconexion) {
      setConfirmarDesconexion(true);
      return;
    }
    setDesconectando(true);
    try {
      await agendaApi.desconectar();
      onDesconectado?.();
    } catch (err) {
      setError(mensajeError(err, "No se pudo desconectar."));
    } finally {
      setDesconectando(false);
      setConfirmarDesconexion(false);
    }
  };

  if (!estado?.configurado) {
    return (
      <Box>
        <Tabs value={pestana} onChange={(_, v) => setPestana(v)} sx={{ mb: 1, borderBottom: `1px solid ${BRAND.borde}` }}>
          <Tab label="Iniciar sesión con Google (recomendado)" sx={{ textTransform: "none", fontWeight: 600 }} />
          <Tab label="Cuenta de servicio" sx={{ textTransform: "none", fontWeight: 600 }} />
        </Tabs>
        {pestana === 0 ? <ConexionGoogle estado={estado} /> : <ConexionCuentaServicio estado={estado} onConectado={onConectado} />}
      </Box>
    );
  }

  const oauth = estado.modo === "oauth";
  return (
    <Box>
      <Alert severity="success" sx={{ mb: 2 }}>
        Conectado {oauth ? "con la cuenta" : "con la cuenta de servicio"} <b>{estado.cuenta}</b>
        {estado.conectadoEn ? ` desde el ${estado.conectadoEn.replace("T", " a las ")}` : ""}.
      </Alert>

      <AjustesCalendarios estado={estado} onGuardado={onCalendariosGuardados} />

      <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${BRAND.borde}` }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>Conexión</Typography>
        {oauth ? (
          <>
            <Typography sx={{ fontSize: 13, color: BRAND.textoSuave, mb: 1.5 }}>
              Si Google pide volver a conectar (por ejemplo, si cambiaron la contraseña de la cuenta), usa este botón.
            </Typography>
            <ConexionGoogle estado={estado} reconectar />
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: 13, color: BRAND.textoSuave, mb: 1.5 }}>
              Estás usando una cuenta de servicio. Para ver <b>todos</b> los calendarios con sus colores exactos, cámbiate a
              “Iniciar sesión con Google”.
            </Typography>
            <ConexionGoogleDesdeCero estado={estado} />
          </>
        )}

        <Box sx={{ display: "flex", gap: 1.5, mt: 2.5, flexWrap: "wrap", alignItems: "center" }}>
          <Button color="error" onClick={desconectar} disabled={desconectando} variant={confirmarDesconexion ? "contained" : "text"}>
            {confirmarDesconexion ? "Sí, desconectar" : "Desconectar Google Calendar"}
          </Button>
          {confirmarDesconexion && (
            <Typography sx={{ fontSize: 12.5, color: BRAND.textoSuave }}>
              Las citas no se borran de Google; solo dejarán de verse en ShowClinic.
            </Typography>
          )}
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </Box>
    </Box>
  );
}

/** Pasar de cuenta de servicio a inicio de sesión con Google (muestra la guía completa al pedirla). */
function ConexionGoogleDesdeCero({ estado }) {
  const [abierta, setAbierta] = useState(false);
  if (!abierta) {
    return (
      <Button variant="outlined" onClick={() => setAbierta(true)}>
        Cambiar a “Iniciar sesión con Google”
      </Button>
    );
  }
  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: BRAND.cremaClara, border: `1px solid ${BRAND.borde}` }}>
      <ConexionGoogle estado={estado} />
    </Box>
  );
}
