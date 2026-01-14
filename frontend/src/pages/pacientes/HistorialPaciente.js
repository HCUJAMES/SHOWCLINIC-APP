import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { useParams } from "react-router-dom";
import axios from "axios";
import { generarPDFPaciente } from "../../utils/generarPDF";
import { calcularEdad } from "../../utils/dateUtils";

const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:4000`;

const HistorialPaciente = () => {
  const { id } = useParams();
  const [paciente, setPaciente] = useState(null);
  const [historial, setHistorial] = useState([]);

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/pacientes/${id}`, { headers: authHeaders })
      .then((res) => setPaciente(res.data));
    axios
      .get(`${API_BASE_URL}/api/pacientes/${id}/historial`, { headers: authHeaders })
      .then((res) => setHistorial(res.data));
  }, [id]);

  if (!paciente) return <p>Cargando datos del paciente...</p>;

  return (
    <div
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.88)), url('/images/showclinic-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        padding: "50px 20px",
      }}
    >
      <Container maxWidth="lg">
        <Paper
          sx={{
            p: 4,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderRadius: "15px",
            boxShadow: "0px 5px 20px rgba(0,0,0,0.1)",
          }}
        >
          <Typography variant="h5" align="center" sx={{ mb: 3, color: "#a36920", fontWeight: "bold" }}>
            🧑‍⚕️ Historial Clínico del Paciente
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography><strong>Nombre:</strong> {paciente.nombre} {paciente.apellido}</Typography>
              <Typography><strong>Documento:</strong> {paciente.tipoDocumento || 'DNI'}: {paciente.dni}</Typography>
              <Typography><strong>Edad:</strong> {calcularEdad(paciente.fechaNacimiento) || paciente.edad || 'N/A'} años</Typography>
              <Typography><strong>Sexo:</strong> {paciente.sexo}</Typography>
              <Typography><strong>Embarazada:</strong> {paciente.embarazada || "No especifica"}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography><strong>Teléfono:</strong> {paciente.celular}</Typography>
              <Typography><strong>Correo:</strong> {paciente.correo}</Typography>
              <Typography><strong>Dirección:</strong> {paciente.direccion}</Typography>
              <Typography><strong>Ciudad:</strong> {paciente.ciudadResidencia}</Typography>
              <Typography><strong>Número de hijos:</strong> {paciente.numeroHijos ?? "No registrado"}</Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ color: "#a36920", mb: 2 }}>
            🧴 Tratamientos Realizados
          </Typography>

          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Fecha</strong></TableCell>
                <TableCell><strong>Tratamiento</strong></TableCell>
                <TableCell><strong>Sesión</strong></TableCell>
                <TableCell><strong>Pago</strong></TableCell>
                <TableCell><strong>Total</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historial.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{h.fecha}</TableCell>
                  <TableCell>{h.tratamiento}</TableCell>
                  <TableCell>{h.sesion}</TableCell>
                  <TableCell>{h.pagoMetodo}</TableCell>
                  <TableCell>S/ {h.precio_total?.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Button
            variant="contained"
            sx={{
              backgroundColor: "#a36920",
              mt: 3,
              "&:hover": { backgroundColor: "#8b581b" },
            }}
            onClick={() => generarPDFPaciente(paciente, historial)}
          >
            📄 Exportar PDF
          </Button>
        </Paper>
      </Container>
    </div>
  );
};

export default HistorialPaciente;
    