import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, Box, Typography, IconButton, Tooltip, CircularProgress, Button,
} from "@mui/material";
import {
  CloseRounded,
  AddPhotoAlternateRounded,
  DeleteOutlineRounded,
  PhotoLibraryRounded,
  ScienceRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Galería ampliada de un tratamiento, con dos colecciones:
 *   · Casos clínicos → fotos de antes/después de pacientes
 *   · Productos      → fotos del producto que se aplica
 *
 * Cada pestaña tiene su propio botón discreto para añadir fotos y permite
 * borrarlas. Ambas comparten el visor grande con navegación.
 */

const ORO = "#A36920";
const ORO_OSCURO = "#8A5A1A";
const CAFE = "#3E2723";

const MotionBox = motion(Box);

const PESTANAS = [
  { id: "caso", texto: "Casos clínicos", Icono: PhotoLibraryRounded, vacio: "Aún no hay fotos de antes y después" },
  { id: "producto", texto: "Productos", Icono: ScienceRounded, vacio: "Aún no hay fotos del producto" },
];

export default function GaleriaTratamiento({
  abierto,
  tratamiento,          // { id, nombre }
  apiBase,
  puedeEditar = true,
  onCerrar,
  onCambio,             // avisa al padre para refrescar sus miniaturas
}) {
  const [pestana, setPestana] = useState("caso");
  const [imagenes, setImagenes] = useState({ caso: [], producto: [] });
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [activa, setActiva] = useState(0);
  const [aviso, setAviso] = useState(null);
  const inputRef = useRef(null);

  const tratamientoId = tratamiento?.id;

  const cargar = useCallback(async () => {
    if (!tratamientoId) return;
    setCargando(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiBase}/api/tratamientos/protocolo/${tratamientoId}/imagenes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.ok ? await res.json() : [];
      const lista = Array.isArray(data) ? data : [];
      setImagenes({
        caso: lista.filter((i) => (i.categoria || "caso") === "caso"),
        producto: lista.filter((i) => i.categoria === "producto"),
      });
    } catch {
      setImagenes({ caso: [], producto: [] });
    } finally {
      setCargando(false);
    }
  }, [apiBase, tratamientoId]);

  useEffect(() => {
    if (abierto) { setPestana("caso"); setActiva(0); setAviso(null); cargar(); }
  }, [abierto, cargar]);

  useEffect(() => { setActiva(0); }, [pestana]);

  const actuales = imagenes[pestana] || [];
  const meta = PESTANAS.find((p) => p.id === pestana);

  const subir = async (archivos) => {
    if (!archivos?.length || !tratamientoId) return;
    setSubiendo(true);
    setAviso(null);
    try {
      const token = localStorage.getItem("token");
      const form = new FormData();
      Array.from(archivos).slice(0, 6).forEach((f) => form.append("imagenes", f));
      form.append("categoria", pestana);

      const res = await fetch(`${apiBase}/api/tratamientos/protocolo/${tratamientoId}/imagenes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAviso(data.message || "No se pudo subir la imagen");
      } else {
        await cargar();
        if (onCambio) onCambio();
      }
    } catch {
      setAviso("No se pudo subir la imagen");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const borrar = async (img) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${apiBase}/api/tratamientos/protocolo/imagen/${img.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await cargar();
      setActiva(0);
      if (onCambio) onCambio();
    } catch {
      setAviso("No se pudo eliminar la imagen");
    }
  };

  const mover = (paso) => {
    if (actuales.length < 2) return;
    setActiva((i) => (i + paso + actuales.length) % actuales.length);
  };

  return (
    <Dialog
      open={!!abierto}
      onClose={onCerrar}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "20px", overflow: "hidden", background: "#FAF8F5",
          width: "min(1200px, 94vw)",   // se acerca al ancho de pantalla sin pegarse al borde
          height: "min(880px, 92vh)",
          maxWidth: "94vw",
          display: "flex", flexDirection: "column",
        },
      }}
    >
      {/* Cabecera */}
      <Box sx={{
        px: 2.5, pt: 2, pb: 0,
        background: `linear-gradient(135deg, ${ORO} 0%, ${ORO_OSCURO} 100%)`,
        color: "#fff",
      }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 20, lineHeight: 1.2 }} noWrap>
              {tratamiento?.nombre || "Tratamiento"}
            </Typography>
            <Typography sx={{ fontSize: 11.5, opacity: 0.9 }}>
              Galería del tratamiento
            </Typography>
          </Box>
          <IconButton onClick={onCerrar} sx={{ color: "#fff", "&:hover": { background: "rgba(255,255,255,0.16)" } }}>
            <CloseRounded />
          </IconButton>
        </Box>

        {/* Pestañas */}
        <Box sx={{ display: "flex", gap: 0.5, mt: 1 }}>
          {PESTANAS.map((p) => {
            const activaTab = pestana === p.id;
            const n = (imagenes[p.id] || []).length;
            return (
              <Box
                key={p.id}
                onClick={() => setPestana(p.id)}
                sx={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 0.6,
                  px: 2, py: 1, cursor: "pointer", position: "relative",
                  opacity: activaTab ? 1 : 0.72,
                  transition: "opacity .2s ease",
                  "&:hover": { opacity: 1 },
                }}
              >
                <p.Icono sx={{ fontSize: 16 }} />
                <Typography sx={{ fontSize: 13, fontWeight: activaTab ? 700 : 600 }}>{p.texto}</Typography>
                {n > 0 && (
                  <Box sx={{
                    minWidth: 17, height: 17, px: 0.4, borderRadius: "999px",
                    background: activaTab ? "#fff" : "rgba(255,255,255,0.28)",
                    color: activaTab ? ORO_OSCURO : "#fff",
                    fontSize: 10, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{n}</Box>
                )}
                {activaTab && (
                  <MotionBox
                    layoutId="galeriaTab"
                    sx={{ position: "absolute", left: 10, right: 10, bottom: 0, height: 3, borderRadius: "3px 3px 0 0", background: "#fff" }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Contenido */}
      <Box sx={{ p: 2.5, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {aviso && (
          <Box sx={{ mb: 1.5, px: 1.5, py: 1, borderRadius: "10px", background: "rgba(211,47,47,0.08)", border: "1px solid rgba(211,47,47,0.25)" }}>
            <Typography sx={{ fontSize: 12.5, color: "#B71C1C" }}>{aviso}</Typography>
          </Box>
        )}

        {cargando ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress size={30} sx={{ color: ORO }} />
          </Box>
        ) : actuales.length === 0 ? (
          /* Vacío */
          <Box sx={{ textAlign: "center", py: 7, px: 2 }}>
            <meta.Icono sx={{ fontSize: 46, color: "rgba(163,105,32,0.30)" }} />
            <Typography sx={{ mt: 1, fontSize: 14, fontWeight: 600, color: CAFE }}>{meta.vacio}</Typography>
            {puedeEditar && (
              <Button
                onClick={() => inputRef.current?.click()}
                disabled={subiendo}
                startIcon={<AddPhotoAlternateRounded sx={{ fontSize: 18 }} />}
                sx={{
                  mt: 2, textTransform: "none", fontWeight: 700, borderRadius: "12px",
                  color: "#fff", background: `linear-gradient(135deg, ${ORO}, ${ORO_OSCURO})`,
                  px: 2.4, py: 0.9,
                  "&:hover": { boxShadow: "0 6px 18px rgba(163,105,32,0.35)" },
                }}
              >
                {subiendo ? "Subiendo..." : "Agregar fotos"}
              </Button>
            )}
          </Box>
        ) : (
          <>
            {/* Visor */}
            <Box sx={{
              position: "relative", borderRadius: "16px", overflow: "hidden",
              background: "#201915", display: "flex", alignItems: "center", justifyContent: "center",
              flex: 1, minHeight: 0,
            }}>
              <AnimatePresence mode="wait">
                <motion.img
                  key={actuales[activa]?.id}
                  src={`${apiBase}${actuales[activa]?.imagen_url}`}
                  alt={tratamiento?.nombre}
                  initial={{ opacity: 0, scale: 1.015 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
                />
              </AnimatePresence>

              {actuales.length > 1 && (
                <>
                  {[
                    { Icono: ChevronLeftRounded, lado: { left: 10 }, paso: -1 },
                    { Icono: ChevronRightRounded, lado: { right: 10 }, paso: 1 },
                  ].map((n, i) => (
                    <IconButton
                      key={i}
                      onClick={() => mover(n.paso)}
                      sx={{
                        position: "absolute", ...n.lado, top: "50%", transform: "translateY(-50%)",
                        background: "rgba(0,0,0,0.35)", color: "#fff", backdropFilter: "blur(4px)",
                        "&:hover": { background: "rgba(0,0,0,0.55)" },
                      }}
                    >
                      <n.Icono />
                    </IconButton>
                  ))}
                  <Box sx={{
                    position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
                    px: 1.2, py: 0.3, borderRadius: "999px", background: "rgba(0,0,0,0.45)",
                  }}>
                    <Typography sx={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>
                      {activa + 1} / {actuales.length}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>

            {/* Miniaturas + acciones */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5, flexWrap: "wrap", flexShrink: 0 }}>
              {actuales.map((img, i) => (
                <Box
                  key={img.id}
                  onClick={() => setActiva(i)}
                  sx={{
                    position: "relative", width: 62, height: 62, borderRadius: "10px",
                    overflow: "hidden", cursor: "pointer", flexShrink: 0,
                    border: i === activa ? `2.5px solid ${ORO}` : "2.5px solid transparent",
                    opacity: i === activa ? 1 : 0.75,
                    transition: "opacity .18s ease, border-color .18s ease",
                    "&:hover": { opacity: 1, "& .quitar": { opacity: 1 } },
                  }}
                >
                  <img
                    src={`${apiBase}${img.imagen_url}`}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  {puedeEditar && (
                    <Tooltip title="Eliminar foto" arrow>
                      <IconButton
                        className="quitar"
                        size="small"
                        onClick={(e) => { e.stopPropagation(); borrar(img); }}
                        sx={{
                          position: "absolute", top: 2, right: 2, p: 0.2,
                          background: "rgba(0,0,0,0.55)", color: "#fff",
                          opacity: 0, transition: "opacity .18s ease",
                          "&:hover": { background: "#D32F2F" },
                        }}
                      >
                        <DeleteOutlineRounded sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              ))}

              {/* Botón sutil para añadir */}
              {puedeEditar && actuales.length < 6 && (
                <Tooltip title={`Agregar fotos a ${meta.texto.toLowerCase()}`} arrow>
                  <Box
                    onClick={() => !subiendo && inputRef.current?.click()}
                    sx={{
                      width: 62, height: 62, borderRadius: "10px", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "1.5px dashed rgba(163,105,32,0.45)", cursor: subiendo ? "default" : "pointer",
                      color: ORO, transition: "background .18s ease, border-color .18s ease",
                      "&:hover": { background: "rgba(163,105,32,0.08)", borderColor: ORO },
                    }}
                  >
                    {subiendo
                      ? <CircularProgress size={18} sx={{ color: ORO }} />
                      : <AddPhotoAlternateRounded sx={{ fontSize: 22 }} />}
                  </Box>
                </Tooltip>
              )}

              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 11, color: "#9C8B7D" }}>
                {actuales.length} de 6 fotos
              </Typography>
            </Box>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => subir(e.target.files)}
        />
      </Box>
    </Dialog>
  );
}
