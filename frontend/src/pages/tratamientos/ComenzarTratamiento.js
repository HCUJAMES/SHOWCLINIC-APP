import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  MenuItem,
  Paper,
  InputLabel,
  Select,
  FormControl,
  Divider,
  Box,
} from "@mui/material";
import axios from "axios";
import { API_BASE } from "../../config/api";

const ComenzarTratamiento = () => {
  const [pacientes, setPacientes] = useState([]);
  const [tratamientos, setTratamientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [especialistas, setEspecialistas] = useState([]);

  const [tipoAtencion, setTipoAtencion] = useState("Tratamiento");
  const [paciente_id, setPaciente_id] = useState("");
  const [especialista, setEspecialista] = useState("");
  const [pagoMetodo, setPagoMetodo] = useState("Efectivo");
  const [sesion, setSesion] = useState(1);
  const [bloques, setBloques] = useState([
    { tratamiento_id: "", producto: "", marca: "", cantidad: 1, precio: 0, descuento: 0, total: 0 },
  ]);

  const [totalGeneral, setTotalGeneral] = useState(0);

  // ✅ Cargar datos iniciales
  useEffect(() => {
    axios.get(`${API_BASE}/api/pacientes/listar`).then((res) => setPacientes(res.data));
    axios.get(`${API_BASE}/api/tratamientos/listar`).then((res) => setTratamientos(res.data));
    axios.get(`${API_BASE}/api/tratamientos/productos`).then((res) => setProductos(res.data));
    axios.get(`${API_BASE}/api/tratamientos/marcas`).then((res) => setMarcas(res.data));
    axios.get(`${API_BASE}/api/especialistas/listar`).then((res) => setEspecialistas(res.data)); // Nuevo
  }, []);

  // ✅ Calcular total general
  useEffect(() => {
    const total = bloques.reduce((sum, b) => sum + b.total, 0);
    setTotalGeneral(total);
  }, [bloques]);

  // ✅ Actualizar bloque de tratamiento
  const actualizarBloque = (index, campo, valor) => {
    const nuevosBloques = [...bloques];
    nuevosBloques[index][campo] = valor;

    const prod = productos.find((p) => p.producto === nuevosBloques[index].producto);

    const precio = prod ? prod.precio : nuevosBloques[index].precio;
    const cantidad = parseFloat(nuevosBloques[index].cantidad) || 0;
    const descuento = parseFloat(nuevosBloques[index].descuento) || 0;

    const subtotal = precio * cantidad;
    const totalConDescuento = subtotal - subtotal * (descuento / 100);

    nuevosBloques[index].precio = precio;
    nuevosBloques[index].total = totalConDescuento;

    if (campo === "producto" && prod) nuevosBloques[index].marca = prod.marca;

    setBloques(nuevosBloques);
  };

  // ✅ Agregar nuevo tratamiento
  const agregarBloque = () => {
    setBloques([
      ...bloques,
      { tratamiento_id: "", producto: "", marca: "", cantidad: 1, precio: 0, descuento: 0, total: 0 },
    ]);
  };

  // ✅ Guardar tratamiento
  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = new FormData();
    data.append("tipoAtencion", tipoAtencion);
    data.append("paciente_id", paciente_id);
    data.append("especialista", especialista);
    data.append("pagoMetodo", pagoMetodo);
    data.append("sesion", sesion);
    data.append("productos", JSON.stringify(bloques));

    try {
      const res = await axios.post(`${API_BASE}/api/tratamientos/realizado`, data);
      alert(res.data.message || "✅ Tratamiento registrado correctamente");
      setPaciente_id("");
      setEspecialista("");
      setPagoMetodo("Efectivo");
      setSesion(1);
      setBloques([{ tratamiento_id: "", producto: "", marca: "", cantidad: 1, precio: 0, descuento: 0, total: 0 }]);
      setTotalGeneral(0);
    } catch (err) {
      console.error(err);
      alert("Error al registrar tratamiento");
    }
  };

  return (
    <div
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.85), rgba(232,211,57,0.85)), url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={6}
          sx={{
            p: 6,
            backgroundColor: "rgba(255,255,255,0.95)",
            borderRadius: "20px",
            boxShadow: "0px 10px 35px rgba(0,0,0,0.15)",
          }}
        >
          <Typography
            variant="h5"
            align="center"
            gutterBottom
            sx={{ color: "#a36920", fontWeight: "bold", mb: 5 }}
          >
            💆‍♀️ Comenzar Tratamiento
          </Typography>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={4}>
              {/* Tipo de atención */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Tipo de Atención</InputLabel>
                  <Select
                    value={tipoAtencion}
                    onChange={(e) => setTipoAtencion(e.target.value)}
                    sx={{ minHeight: "60px", backgroundColor: "#fff" }}
                  >
                    <MenuItem value="Tratamiento">Tratamiento</MenuItem>
                    <MenuItem value="Control">Control</MenuItem>
                    <MenuItem value="Retoque">Retoque</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Paciente */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Paciente</InputLabel>
                  <Select
                    value={paciente_id}
                    onChange={(e) => setPaciente_id(e.target.value)}
                    sx={{ minHeight: "60px", backgroundColor: "#fff" }}
                  >
                    {pacientes.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.nombre} {p.apellido}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* BLOQUES DE TRATAMIENTO */}
              {bloques.map((b, index) => (
                <Grid item xs={12} key={index}>
                  <Paper
                    elevation={3}
                    sx={{
                      p: 4,
                      borderRadius: "12px",
                      backgroundColor: "rgba(255,255,255,0.97)",
                      mb: 5,
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ color: "#a36920", fontWeight: "bold", mb: 3 }}>
                      💉 Tratamiento #{index + 1}
                    </Typography>

                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth>
                          <InputLabel>Tratamiento</InputLabel>
                          <Select
                            value={b.tratamiento_id}
                            onChange={(e) => actualizarBloque(index, "tratamiento_id", e.target.value)}
                            sx={{ backgroundColor: "#fff" }}
                          >
                            {tratamientos.map((t) => (
                              <MenuItem key={t.id} value={t.id}>
                                {t.nombre}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth>
                          <InputLabel>Producto</InputLabel>
                          <Select
                            value={b.producto}
                            onChange={(e) => actualizarBloque(index, "producto", e.target.value)}
                            sx={{ backgroundColor: "#fff" }}
                          >
                            {productos.map((prod) => (
                              <MenuItem key={prod.id} value={prod.producto}>
                                {prod.producto}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth>
                          <InputLabel>Marca</InputLabel>
                          <Select
                            value={b.marca}
                            onChange={(e) => actualizarBloque(index, "marca", e.target.value)}
                            sx={{ backgroundColor: "#fff" }}
                          >
                            {marcas.map((m, i) => (
                              <MenuItem key={i} value={m.marca}>
                                {m.marca}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <TextField
                          label="Cantidad"
                          type="number"
                          fullWidth
                          value={b.cantidad}
                          onChange={(e) => actualizarBloque(index, "cantidad", parseFloat(e.target.value))}
                        />
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <TextField
                          label="Precio Unitario (S/)"
                          value={b.precio}
                          fullWidth
                          InputProps={{ readOnly: true }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <TextField
                          label="Descuento (%)"
                          type="number"
                          fullWidth
                          value={b.descuento}
                          onChange={(e) => actualizarBloque(index, "descuento", parseFloat(e.target.value))}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <Box
                          sx={{
                            backgroundColor: "#fff6ea",
                            border: "1px solid #e0c39b",
                            borderRadius: "8px",
                            p: 1.5,
                            textAlign: "center",
                          }}
                        >
                          <Typography sx={{ color: "#a36920", fontWeight: "bold" }}>
                            💰 Total: S/ {b.total.toFixed(2)}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              ))}

              {/* Botón agregar tratamiento */}
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={agregarBloque}
                  sx={{
                    borderColor: "#a36920",
                    color: "#a36920",
                    fontWeight: "bold",
                    py: 1.2,
                    "&:hover": { backgroundColor: "#f6e3c5" },
                  }}
                >
                  + Agregar otro tratamiento
                </Button>
              </Grid>

              <Divider sx={{ width: "100%", my: 4 }} />

              {/* Datos finales */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Número de Sesión"
                  type="number"
                  fullWidth
                  value={sesion}
                  onChange={(e) => setSesion(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Especialista</InputLabel>
                  <Select
                    value={especialista}
                    onChange={(e) => setEspecialista(e.target.value)}
                    sx={{ backgroundColor: "#fff" }}
                  >
                    {especialistas.map((esp) => (
                      <MenuItem key={esp.id} value={esp.nombre}>
                        {esp.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Método de Pago</InputLabel>
                  <Select
                    value={pagoMetodo}
                    onChange={(e) => setPagoMetodo(e.target.value)}
                    sx={{ backgroundColor: "#fff" }}
                  >
                    <MenuItem value="Efectivo">Efectivo</MenuItem>
                    <MenuItem value="Tarjeta">Tarjeta</MenuItem>
                    <MenuItem value="Transferencia">Transferencia</MenuItem>
                    <MenuItem value="Yape">Yape</MenuItem>
                    <MenuItem value="Plin">Plin</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Total general */}
              <Grid item xs={12}>
                <Typography
                  variant="h6"
                  align="center"
                  sx={{
                    color: "#a36920",
                    fontWeight: "bold",
                    mt: 3,
                    mb: 3,
                    fontSize: "1.4rem",
                  }}
                >
                  TOTAL GENERAL: S/ {totalGeneral.toFixed(2)}
                </Typography>
              </Grid>

              {/* Guardar */}
              <Grid item xs={12}>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{
                    backgroundColor: "#a36920",
                    fontSize: "1.1rem",
                    fontWeight: "bold",
                    py: 1.5,
                    "&:hover": { backgroundColor: "#8b581b" },
                  }}
                >
                  GUARDAR SESIÓN
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Container>
    </div>
  );
};

export default ComenzarTratamiento;
