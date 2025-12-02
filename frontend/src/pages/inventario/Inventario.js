import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { API_BASE, DOCS_BASE } from "../../config/api";

export default function Inventario() {
  const colorPrincipal = "#a36920ff";
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState({
    producto: "",
    marca: "",
    sku: "",
    proveedor: "",
    contenido: "",
    precio: "",
    stock: "",
    fechaVencimiento: "",
  });
  const [editando, setEditando] = useState(null);
  const role = localStorage.getItem("role"); // 🔒 Rol actual (doctor / admin)

  // ✅ Obtener productos
  const obtenerProductos = () => {
    fetch(`${API_BASE}/api/inventario/listar`)
      .then((r) => r.json())
      .then(setProductos)
      .catch(console.error);
  };

  useEffect(() => {
    obtenerProductos();
  }, []);

  // ✅ Guardar producto
  const guardarProducto = async () => {
    const metodo = editando ? "PUT" : "POST";
    const url = editando
      ? `${API_BASE}/api/inventario/editar/${editando}`
      : `${API_BASE}/api/inventario/crear`;

    const data = { ...form, actualizado_por: role };

    const res = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      alert(editando ? "✅ Producto actualizado" : "✅ Producto registrado");
      setForm({
        producto: "",
        marca: "",
        sku: "",
        proveedor: "",
        contenido: "",
        precio: "",
        stock: "",
        fechaVencimiento: "",
      });
      setEditando(null);
      obtenerProductos();
    } else {
      alert("❌ Error al guardar producto");
    }
  };

  // ✅ Eliminar producto
  const eliminarProducto = async (id) => {
    if (!window.confirm("¿Eliminar producto?")) return;
    const res = await fetch(`${API_BASE}/api/inventario/eliminar/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      alert("🗑️ Producto eliminado");
      obtenerProductos();
    }
  };

  // ✅ Editar producto
  const editarProducto = (p) => {
    setEditando(p.id);
    setForm(p);
  };

  // ✅ Subir documento PDF
  const subirPDF = async (id, file) => {
    if (!file) return alert("Seleccione un archivo PDF antes de subir.");

    const data = new FormData();
    data.append("documento", file);

    try {
      const res = await fetch(`${API_BASE}/api/inventario/subir-pdf/${id}`, {
        method: "POST",
        body: data,
      });
      if (res.ok) {
        alert("📄 Documento PDF subido correctamente");
        obtenerProductos();
      } else {
        alert("❌ Error al subir documento PDF");
      }
    } catch (err) {
      console.error("❌ Error al subir PDF:", err);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage: "url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        p: 4,
      }}
    >
      <Paper
        sx={{
          p: 4,
          borderRadius: 4,
          backgroundColor: "rgba(255,255,255,0.95)",
          width: "95%",
          maxWidth: 1100,
        }}
      >
        <Typography
          variant="h5"
          sx={{ color: colorPrincipal, fontWeight: "bold", mb: 3 }}
          align="center"
        >
          Inventario de Productos
        </Typography>

        {/* 🔒 Solo DOCTOR puede crear/editar productos */}
        {role === "doctor" && (
          <>
            <Grid container spacing={2}>
              {Object.keys(form).map((campo) => (
                <Grid item xs={12} md={4} key={campo}>
                  <TextField
                    label={campo.charAt(0).toUpperCase() + campo.slice(1)}
                    name={campo}
                    type={
                      campo === "precio"
                        ? "number"
                        : campo === "stock"
                        ? "number"
                        : campo === "fechaVencimiento"
                        ? "date"
                        : "text"
                    }
                    fullWidth
                    value={form[campo]}
                    onChange={(e) =>
                      setForm({ ...form, [e.target.name]: e.target.value })
                    }
                    InputLabelProps={
                      campo === "fechaVencimiento" ? { shrink: true } : {}
                    }
                  />
                </Grid>
              ))}
            </Grid>

            <Button
              variant="contained"
              sx={{
                mt: 3,
                backgroundColor: colorPrincipal,
                "&:hover": { backgroundColor: "#8a541a" },
              }}
              onClick={guardarProducto}
              fullWidth
            >
              {editando ? "Actualizar Producto" : "Guardar Producto"}
            </Button>
          </>
        )}

        {/* 🧾 Tabla de productos */}
        <Typography
          variant="h6"
          sx={{ color: colorPrincipal, mt: 5 }}
          align="center"
        >
          Lista de Productos
        </Typography>

        <Table sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell>Marca</TableCell>
              <TableCell>Contenido</TableCell>
              <TableCell>Proveedor</TableCell>
              <TableCell>Precio (S/)</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell>Vence</TableCell>
              <TableCell>PDF</TableCell>
              {role === "doctor" && <TableCell>Acciones</TableCell>}
            </TableRow>
          </TableHead>

          <TableBody>
            {productos.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.producto}</TableCell>
                <TableCell>{p.marca}</TableCell>
                <TableCell>{p.contenido}</TableCell>
                <TableCell>{p.proveedor}</TableCell>
                <TableCell>{p.precio}</TableCell>
                <TableCell>{p.stock}</TableCell>
                <TableCell>{p.fechaVencimiento}</TableCell>

                {/* 📎 PDF del producto */}
                <TableCell>
                  {p.documentos && p.documentos.length > 0 ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      {p.documentos.map((doc, idx) => (
                        <Box
                          key={`${doc.archivo}-${idx}`}
                          sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                        >
                          <Tooltip
                            title={`Ver guía (${doc.uploaded_at?.split(" ")[0] || ""})`}
                          >
                            <a
                              href={`${DOCS_BASE}/${doc.archivo}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <PictureAsPdfIcon
                                sx={{ color: "#a36920", fontSize: 28 }}
                              />
                            </a>
                          </Tooltip>
                          <Typography variant="caption" color="textSecondary">
                            {doc.uploaded_at?.split(" ")[0] || "Guía"}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography color="textSecondary">—</Typography>
                  )}

                  {role === "doctor" && (
                    <label
                      style={{
                        display: "inline-block",
                        color: "#a36920",
                        cursor: "pointer",
                        fontWeight: "bold",
                        marginTop: 4,
                      }}
                    >
                      📎 Subir PDF
                      <input
                        type="file"
                        accept="application/pdf"
                        style={{ display: "none" }}
                        onChange={(e) => subirPDF(p.id, e.target.files[0])}
                      />
                    </label>
                  )}
                </TableCell>

                {/* ✏️ Acciones */}
                {role === "doctor" && (
                  <TableCell>
                    <IconButton color="primary" onClick={() => editarProducto(p)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => eliminarProducto(p.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
