import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PacientesMenu from "./pages/PacientesMenu";
import RegistrarPaciente from "./pages/RegistrarPaciente";
import BuscarPaciente from "./pages/BuscarPaciente";
import PacientesConDeudas from "./pages/PacientesConDeudas";
import TratamientosMenu from "./pages/tratamientos/TratamientosMenu";
import CrearTratamiento from "./pages/tratamientos/CrearTratamiento";
import ComenzarTratamiento from "./pages/tratamientos/ComenzarTratamiento";
import Inventario from "./pages/inventario/Inventario";
import HistorialClinico from "./pages/HistorialClinico";
import Finanzas from "./pages/Finanzas";
import FotosPaciente from "./pages/FotosPaciente";
import Especialistas from "./pages/Especialistas";
import Estadisticas from "./pages/Estadisticas";
import Gestion from "./pages/Gestion";
import Paquetes from "./pages/Paquetes";
import ProtectedRoute from "./components/ProtectedRoute";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/fotos-paciente" element={<FotosPaciente />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pacientes"
          element={
            <ProtectedRoute>
              <PacientesMenu />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pacientes/registrar"
          element={
            <ProtectedRoute>
              <RegistrarPaciente />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pacientes/buscar"
          element={
            <ProtectedRoute>
              <BuscarPaciente />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pacientes/deudas"
          element={
            <ProtectedRoute>
              <PacientesConDeudas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tratamientos"
          element={
            <ProtectedRoute>
              <TratamientosMenu />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tratamientos/crear"
          element={
            <ProtectedRoute>
              <CrearTratamiento />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tratamientos/comenzar"
          element={
            <ProtectedRoute>
              <ComenzarTratamiento />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventario"
          element={
            <ProtectedRoute>
              <Inventario />
            </ProtectedRoute>
          }
        />
        <Route
          path="/historial-clinico"
          element={
            <ProtectedRoute>
              <HistorialClinico />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finanzas"
          element={
            <ProtectedRoute>
              <Finanzas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/especialistas"
          element={
            <ProtectedRoute>
              <Especialistas />
            </ProtectedRoute>
          }
        />

        <Route
          path="/estadisticas"
          element={
            <ProtectedRoute>
              <Estadisticas />
            </ProtectedRoute>
          }
        />

        <Route
          path="/gestion"
          element={
            <ProtectedRoute>
              <Gestion />
            </ProtectedRoute>
          }
        />

        <Route
          path="/paquetes"
          element={
            <ProtectedRoute requiredRole="master">
              <Paquetes />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;


