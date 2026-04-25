import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

// Lazy load todas las páginas para que solo se carguen cuando se visitan
const Login = React.lazy(() => import("./pages/Login"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const PacientesMenu = React.lazy(() => import("./pages/PacientesMenu"));
const RegistrarPaciente = React.lazy(() => import("./pages/RegistrarPaciente"));
const BuscarPaciente = React.lazy(() => import("./pages/BuscarPaciente"));
const PacientesConDeudas = React.lazy(() => import("./pages/PacientesConDeudas"));
const TratamientosMenu = React.lazy(() => import("./pages/tratamientos/TratamientosMenu"));
const CrearTratamiento = React.lazy(() => import("./pages/tratamientos/CrearTratamiento"));
const ComenzarTratamiento = React.lazy(() => import("./pages/tratamientos/ComenzarTratamiento"));
const Inventario = React.lazy(() => import("./pages/inventario/Inventario"));
const HistorialClinico = React.lazy(() => import("./pages/HistorialClinico"));
const Finanzas = React.lazy(() => import("./pages/Finanzas"));
const FotosPaciente = React.lazy(() => import("./pages/FotosPaciente"));
const Especialistas = React.lazy(() => import("./pages/Especialistas"));
const Estadisticas = React.lazy(() => import("./pages/Estadisticas"));
const Gestion = React.lazy(() => import("./pages/Gestion"));
const Paquetes = React.lazy(() => import("./pages/Paquetes"));
const GestionClinica = React.lazy(() => import("./pages/GestionPersonalCards"));
const ProductosAplicados = React.lazy(() => import("./pages/ProductosAplicados"));
const GestionUsuariosPage = React.lazy(() => import("./pages/GestionUsuariosPage"));

// Spinner de carga mientras se descarga el chunk de la página
const PageLoader = () => (
  <div style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "linear-gradient(rgba(255,255,255,0.9), rgba(232,211,57,0.3))",
  }}>
    <div style={{
      width: 48,
      height: 48,
      border: "4px solid #e0c97a",
      borderTop: "4px solid #a36920",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/fotos-paciente"
          element={
            <ProtectedRoute>
              <FotosPaciente />
            </ProtectedRoute>
          }
        />

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
            <ProtectedRoute>
              <Paquetes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/gestion-clinica"
          element={
            <ProtectedRoute>
              <GestionClinica />
            </ProtectedRoute>
          }
        />
        <Route
          path="/productos-aplicados"
          element={
            <ProtectedRoute allowedRoles={["master"]}>
              <ProductosAplicados />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestion-usuarios"
          element={
            <ProtectedRoute allowedRoles={["master"]}>
              <GestionUsuariosPage />
            </ProtectedRoute>
          }
        />

      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;


