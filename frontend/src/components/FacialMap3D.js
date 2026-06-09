import React, { useRef, useState, useCallback, useEffect, useMemo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  IconButton,
  Tooltip as MuiTooltip,
  Checkbox,
} from "@mui/material";
import {
  Delete,
  Close,
  Save,
  Refresh,
  Add,
  Edit as EditIcon,
  Check,
} from "@mui/icons-material";

// =============================================
// PALETA DE COLORES PARA PROTOCOLOS
// =============================================
const COLOR_PALETTE = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B88B", "#ABEBC6",
  "#F1948A", "#85929E", "#D7BDE2", "#A9DFBF", "#FAD7A0",
];

// =============================================
// CONFIGURACIÓN DE CUADRÍCULA 3D
// =============================================
const GRID_CONFIG = {
  subdivisions: 50,  // Subdivisiones de la malla (más = más detalle)
};

// =============================================
// COMPONENTE DE CABEZA 3D CON WIREFRAME
// =============================================
function HeadModel({ markedPoints, onPointClick, showWireframe }) {
  const { scene } = useGLTF("/models/male_head.glb");
  const meshRef = useRef();
  const wireframeRef = useRef();
  
  // Configurar el modelo y wireframe
  useEffect(() => {
    console.log("📐 Configurando modelo GLB...");
    console.log("📊 Scene:", scene);
    console.log("📊 Scene children:", scene.children.length);
    
    // Función para buscar meshes de forma controlada (máximo 4 niveles)
    const findMeshes = (obj, level = 0, maxLevel = 4) => {
      const meshes = [];
      
      if (level > maxLevel) return meshes;
      
      if (obj.isMesh && obj.geometry) {
        const vertexCount = obj.geometry.attributes.position?.count || 0;
        console.log(`${'  '.repeat(level)}📦 Mesh nivel ${level}: "${obj.name}", vértices: ${vertexCount}, tipo: ${obj.type}`);
        meshes.push({ mesh: obj, vertexCount, level });
      }
      
      if (obj.children && obj.children.length > 0) {
        console.log(`${'  '.repeat(level)}📁 Grupo nivel ${level}: "${obj.name}", hijos: ${obj.children.length}`);
        obj.children.forEach(child => {
          meshes.push(...findMeshes(child, level + 1, maxLevel));
        });
      }
      
      return meshes;
    };
    
    const meshes = findMeshes(scene);
    console.log(`✅ Total meshes encontrados: ${meshes.length}`);
    
    if (meshes.length === 0) {
      console.error("❌ No se encontraron meshes en el modelo");
      return;
    }
    
    // Encontrar el mesh principal (el que tiene más vértices)
    // Si no hay meshes con más de 1000 vértices, tomar el que tenga más
    let mainMesh = meshes
      .filter(m => m.vertexCount > 1000)
      .sort((a, b) => b.vertexCount - a.vertexCount)[0];
    
    if (!mainMesh) {
      console.warn("⚠️ No hay meshes con >1000 vértices, usando el más grande disponible");
      mainMesh = meshes.sort((a, b) => b.vertexCount - a.vertexCount)[0];
    }
    
    if (mainMesh) {
      console.log(`🎯 Mesh principal seleccionado: "${mainMesh.mesh.name}", vértices: ${mainMesh.vertexCount}, nivel: ${mainMesh.level}`);
      meshRef.current = mainMesh.mesh;
      
      // Material simple para el modelo
      mainMesh.mesh.material = new THREE.MeshPhysicalMaterial({
        color: "#F5D6C3",
        roughness: 0.7,
        clearcoat: 0.1,
        metalness: 0.02,
      });
      
      // Crear wireframe overlay SOLO para el mesh principal
      const wireframeGeo = mainMesh.mesh.geometry.clone();
      const wireframeMat = new THREE.MeshBasicMaterial({
        color: "#000000",
        wireframe: true,
        opacity: 0.25,
        transparent: true,
      });
      
      const wireframeMesh = new THREE.Mesh(wireframeGeo, wireframeMat);
      wireframeMesh.scale.set(1.001, 1.001, 1.001);
      wireframeMesh.visible = showWireframe;
      mainMesh.mesh.add(wireframeMesh);
      wireframeRef.current = wireframeMesh;
      
      console.log("✅ Wireframe creado y configurado");
    } else {
      console.error("❌ No se pudo seleccionar mesh principal");
    }
  }, [scene]);
  
  // Actualizar visibilidad del wireframe
  useEffect(() => {
    if (wireframeRef.current) {
      wireframeRef.current.visible = showWireframe;
    }
  }, [showWireframe]);
  
  // Click en el modelo
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    const point = e.point;
    const pointId = `${point.x.toFixed(3)}_${point.y.toFixed(3)}_${point.z.toFixed(3)}`;
    console.log("🎯 Click en punto:", pointId);
    onPointClick(pointId, point);
  }, [onPointClick]);
  
  return (
    <>
      <primitive 
        object={scene} 
        scale={0.55}
        position={[0, -0.2, 0]}
        onClick={handleClick}
      />
      
      {/* Point markers with glow */}
      {Object.entries(markedPoints).map(([pointId, data]) => (
        <group key={pointId} position={[data.position.x, data.position.y, data.position.z]}>
          {/* Main point */}
          <mesh>
            <sphereGeometry args={[0.015, 16, 16]} />
            <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1.2} />
          </mesh>
          {/* Glow effect */}
          <mesh>
            <sphereGeometry args={[0.025, 16, 16]} />
            <meshBasicMaterial color={data.color} transparent opacity={0.3} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// =============================================
// ESCENA 3D SIMPLE
// =============================================
function FacialScene({ markedPoints, onPointClick, showWireframe, controlsRef }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 3]} intensity={0.9} />
      <directionalLight position={[-2, -1, -3]} intensity={0.4} color="#E0D8FF" />
      <hemisphereLight args={["#ffffff", "#8d8d8d", 0.25]} />
      
      <HeadModel
        markedPoints={markedPoints}
        onPointClick={onPointClick}
        showWireframe={showWireframe}
      />
      
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        minDistance={2.5}
        maxDistance={6}
        target={[0, 0.4, 0]}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  );
}

// =============================================
// COMPONENTE PRINCIPAL EXPORTADO
// =============================================
export default function FacialMap3D({
  paciente,
  registros,
  onGuardar,
  onActualizar,
  onEliminar,
  guardando,
  viewOnly = false,
}) {
  // Estado: puntos marcados { pointId: { color, position, treatmentId } }
  const [markedPoints, setMarkedPoints] = useState({});
  // Tratamientos desde la API
  const [tratamientos, setTratamientos] = useState([]);
  const [loadingTratamientos, setLoadingTratamientos] = useState(true);
  // Tratamientos seleccionados (con checkbox)
  const [selectedTreatments, setSelectedTreatments] = useState([]);
  // Mapa de tratamiento a color
  const [treatmentColors, setTreatmentColors] = useState({});
  // Título del mapa
  const [mapTitle, setMapTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  // Modo borrador y wireframe
  const [eraserMode, setEraserMode] = useState(false);
  const [showWireframe, setShowWireframe] = useState(false);
  
  // Ref para controlar OrbitControls
  const controlsRef = useRef();

  // Cargar tratamientos desde la API
  useEffect(() => {
    const fetchTratamientos = async () => {
      try {
        console.log("🔄 Cargando tratamientos desde API...");
        
        // Obtener token de autenticación
        const token = localStorage.getItem("token");
        const headers = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        const response = await fetch("/api/tratamientos/listar", { headers });
        console.log("📡 Response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("✅ Tratamientos recibidos:", data);
        console.log("📊 Tipo de datos:", typeof data);
        console.log("📊 Es array?:", Array.isArray(data));
        console.log("📊 Cantidad:", Array.isArray(data) ? data.length : "N/A");
        
        if (Array.isArray(data)) {
          setTratamientos(data);
          // Asignar colores automáticamente a cada tratamiento
          const colors = {};
          data.forEach((treatment, index) => {
            colors[treatment.id] = COLOR_PALETTE[index % COLOR_PALETTE.length];
          });
          setTreatmentColors(colors);
          console.log("✅ Tratamientos cargados:", data.length);
          console.log("🎨 Colores asignados:", colors);
        } else {
          console.error("❌ Los datos no son un array:", data);
          setTratamientos([]);
        }
      } catch (error) {
        console.error("❌ Error al cargar tratamientos:", error);
        console.error("❌ Error details:", error.message);
        setTratamientos([]);
      } finally {
        setLoadingTratamientos(false);
      }
    };
    fetchTratamientos();
  }, []);

  // Toggle tratamiento seleccionado
  const toggleTreatment = (treatmentId) => {
    setSelectedTreatments(prev => {
      if (prev.includes(treatmentId)) {
        return prev.filter(id => id !== treatmentId);
      } else {
        return [...prev, treatmentId];
      }
    });
  };

  // Obtener el tratamiento activo actual (el último seleccionado)
  const activeTreatmentId = selectedTreatments[selectedTreatments.length - 1] || null;
  const activeColor = activeTreatmentId ? treatmentColors[activeTreatmentId] : null;

  // Click en punto: aplicar o quitar marcador
  const handlePointClick = useCallback((pointId, position) => {
    if (eraserMode) {
      // Modo borrador: buscar y eliminar el punto más cercano
      setMarkedPoints(prev => {
        const newPoints = { ...prev };
        let closestPointId = null;
        let minDist = Infinity;
        
        // Buscar el punto más cercano al click
        Object.entries(newPoints).forEach(([pid, data]) => {
          const dist = Math.sqrt(
            Math.pow(data.position.x - position.x, 2) +
            Math.pow(data.position.y - position.y, 2) +
            Math.pow(data.position.z - position.z, 2)
          );
          if (dist < minDist && dist < 0.05) { // Threshold de 0.05
            minDist = dist;
            closestPointId = pid;
          }
        });
        
        if (closestPointId) {
          delete newPoints[closestPointId];
          console.log("🗑️ Punto eliminado:", closestPointId);
        }
        
        return newPoints;
      });
    } else {
      // Modo normal: agregar punto
      if (!activeTreatmentId) {
        console.warn("⚠️ Selecciona al menos un tratamiento");
        return;
      }
      
      setMarkedPoints(prev => {
        const newPoints = { ...prev };
        if (newPoints[pointId]) {
          // Si ya existe, eliminarlo
          delete newPoints[pointId];
        } else {
          // Agregar nuevo punto
          newPoints[pointId] = {
            color: activeColor,
            position: position,
            treatmentId: activeTreatmentId,
          };
        }
        return newPoints;
      });
    }
  }, [activeColor, activeTreatmentId, eraserMode]);

  // Guardar mapa
  const handleSave = () => {
    const payload = {
      zonas_json: markedPoints,
      notas_json: {
        selectedTreatments,
        treatmentColors,
        mapTitle,
      },
      nombre: mapTitle || "Mapa sin título",
    };
    if (editingId) {
      onActualizar(editingId, payload);
      setEditingId(null);
    } else {
      onGuardar(payload);
    }
  };

  // Cargar mapa
  const handleLoad = (record) => {
    setMarkedPoints(record.zonas_json || {});
    const notas = record.notas_json || {};
    setSelectedTreatments(notas.selectedTreatments || []);
    if (notas.treatmentColors) {
      setTreatmentColors(notas.treatmentColors);
    }
    setMapTitle(notas.mapTitle || record.nombre || "");
    setEditingId(record.id);
  };

  // Limpiar todo
  const clearAll = () => {
    setMarkedPoints({});
    setSelectedTreatments([]);
    setMapTitle("");
    setEditingId(null);
  };
  
  // Funciones para controlar la cámara
  const handleRotate = () => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = !controlsRef.current.autoRotate;
      controlsRef.current.autoRotateSpeed = 2.0;
    }
  };
  
  const handleFrontView = () => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      camera.position.set(0, 0.5, 2.5);
      controlsRef.current.target.set(0, 0.4, 0);
      controlsRef.current.update();
    }
  };
  
  const handleProfileView = () => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      camera.position.set(2.5, 0.5, 0);
      controlsRef.current.target.set(0, 0.4, 0);
      controlsRef.current.update();
    }
  };

  // Agrupar puntos por tratamiento
  const pointsByTreatment = {};
  Object.entries(markedPoints).forEach(([pointId, data]) => {
    const treatmentId = data.treatmentId;
    if (!pointsByTreatment[treatmentId]) pointsByTreatment[treatmentId] = [];
    pointsByTreatment[treatmentId].push(pointId);
  });

  const usedTreatments = Object.keys(pointsByTreatment).map(id => parseInt(id));

  // Si es viewOnly, solo mostrar el Canvas 3D
  if (viewOnly) {
    return (
      <Box sx={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
        <Canvas
          camera={{ position: [0, 0.4, 2.2], fov: 40 }}
          style={{ width: "100%", height: "100%" }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[0, 5, 5]} intensity={0.9} />
          <directionalLight position={[0, 3, -5]} intensity={0.5} />
          <Suspense fallback={null}>
            <HeadModel
              markedPoints={markedPoints}
              onPointClick={() => {}}
              showWireframe={showWireframe}
            />
          </Suspense>
          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.05}
            minDistance={1.8}
            maxDistance={3.5}
            target={[0, 0.4, 0]}
            enableRotate={false}
            enablePan={false}
          />
        </Canvas>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#0D0D0D", overflow: "hidden" }}>

      {/* ===== TOPBAR PREMIUM ===== */}
      <Box sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 3,
        py: 1.5,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        backgroundColor: "rgba(13,13,13,0.95)",
        backdropFilter: "blur(10px)",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "rgba(200,169,110,0.15)",
            border: "2px solid rgba(200,169,110,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "rgba(200,169,110,1)",
          }}>
            {paciente?.nombre?.charAt(0)}{paciente?.apellido?.charAt(0)}
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.9)", lineHeight: 1.2 }}>
              {paciente?.nombre} {paciente?.apellido}
            </Typography>
            <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>
              Paciente #{paciente?.id || "---"}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            sx={{
              textTransform: "none",
              fontSize: "0.7rem",
              borderColor: "rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.6)",
              px: 2,
              py: 0.5,
              "&:hover": {
                borderColor: "rgba(200,169,110,0.5)",
                backgroundColor: "rgba(200,169,110,0.05)",
              },
            }}
          >
            Exportar PDF
          </Button>
          <Button
            variant="outlined"
            size="small"
            sx={{
              textTransform: "none",
              fontSize: "0.7rem",
              borderColor: "rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.6)",
              px: 2,
              py: 0.5,
              "&:hover": {
                borderColor: "rgba(200,169,110,0.5)",
                backgroundColor: "rgba(200,169,110,0.05)",
              },
            }}
          >
            Comparar
          </Button>
        </Box>
      </Box>

      {/* ===== MAIN CONTENT ===== */}
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ===== PANEL IZQUIERDO - 220px TRANSPARENTE ===== */}
        <Box
          sx={{
            width: 220,
            minWidth: 220,
            backgroundColor: "transparent",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            px: 2,
            py: 2,
          }}
        >
        {/* Color Activo Section */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", mb: 1.5, textTransform: "uppercase", letterSpacing: 1 }}>
            Color Activo
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {COLOR_PALETTE.slice(0, 8).map((color) => {
              const isActive = activeColor === color;
              return (
                <Box
                  key={color}
                  onClick={() => {
                    const treatmentId = Object.keys(treatmentColors).find(id => treatmentColors[id] === color);
                    if (treatmentId && !selectedTreatments.includes(parseInt(treatmentId))) {
                      toggleTreatment(parseInt(treatmentId));
                    }
                  }}
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: color,
                    cursor: "pointer",
                    border: isActive ? "2px solid white" : "2px solid transparent",
                    boxShadow: isActive ? `0 0 12px ${color}` : "none",
                    transition: "all 0.2s",
                    "&:hover": { transform: "scale(1.15)" },
                  }}
                />
              );
            })}
          </Box>
        </Box>

        {/* Tratamientos Section */}
        <Box sx={{ mb: 3, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", mb: 1.5, textTransform: "uppercase", letterSpacing: 1 }}>
            Tratamientos
          </Typography>
          
          {loadingTratamientos ? (
            <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", textAlign: "center", py: 2 }}>
              Cargando...
            </Typography>
          ) : !Array.isArray(tratamientos) || tratamientos.length === 0 ? (
            <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", textAlign: "center", py: 2 }}>
              No hay tratamientos
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8, overflow: "auto", flex: 1 }}>
              {Array.isArray(tratamientos) && tratamientos.map((treatment) => {
                const isSelected = selectedTreatments.includes(treatment.id);
                const color = treatmentColors[treatment.id] || "#ccc";
                const pointCount = pointsByTreatment[treatment.id]?.length || 0;
                
                return (
                  <Box
                    key={treatment.id}
                    onClick={() => toggleTreatment(treatment.id)}
                    sx={{
                      p: 1.2,
                      borderRadius: 1.5,
                      backgroundColor: isSelected ? "rgba(255,255,255,0.05)" : "transparent",
                      border: "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      "&:hover": {
                        backgroundColor: "rgba(255,255,255,0.08)",
                        borderColor: "rgba(200,169,110,0.3)",
                      },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor: color,
                          boxShadow: isSelected ? `0 0 8px ${color}` : "none",
                        }}
                      />
                      <Typography sx={{ 
                        fontSize: "0.7rem", 
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
                        flex: 1,
                      }}>
                        {treatment.nombre}
                      </Typography>
                      {pointCount > 0 && (
                        <Box sx={{
                          px: 0.8,
                          py: 0.2,
                          borderRadius: 1,
                          backgroundColor: "rgba(200,169,110,0.15)",
                          border: "1px solid rgba(200,169,110,0.3)",
                        }}>
                          <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "rgba(200,169,110,1)" }}>
                            {pointCount}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
              <Box
                onClick={() => {}}
                sx={{
                  p: 1.2,
                  borderRadius: 1.5,
                  border: "1px dashed rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "center",
                  "&:hover": {
                    borderColor: "rgba(200,169,110,0.5)",
                    backgroundColor: "rgba(200,169,110,0.05)",
                  },
                }}
              >
                <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>
                  + Nuevo tratamiento
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Herramientas Section */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", mb: 1.5, textTransform: "uppercase", letterSpacing: 1 }}>
            Herramientas
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
            <MuiTooltip title="Marcar" arrow>
              <IconButton
                onClick={() => setEraserMode(false)}
                sx={{
                  flex: 1,
                  py: 1,
                  backgroundColor: !eraserMode ? "rgba(200,169,110,0.15)" : "transparent",
                  color: !eraserMode ? "rgba(200,169,110,1)" : "rgba(255,255,255,0.4)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 1.5,
                  "&:hover": {
                    backgroundColor: "rgba(200,169,110,0.1)",
                    borderColor: "rgba(200,169,110,0.3)",
                  },
                }}
              >
                <Add sx={{ fontSize: "1.2rem" }} />
              </IconButton>
            </MuiTooltip>
            <MuiTooltip title="Borrar" arrow>
              <IconButton
                onClick={() => setEraserMode(true)}
                sx={{
                  flex: 1,
                  py: 1,
                  backgroundColor: eraserMode ? "rgba(244,67,54,0.15)" : "transparent",
                  color: eraserMode ? "rgba(244,67,54,1)" : "rgba(255,255,255,0.4)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 1.5,
                  "&:hover": {
                    backgroundColor: "rgba(244,67,54,0.1)",
                    borderColor: "rgba(244,67,54,0.3)",
                  },
                }}
              >
                <Delete sx={{ fontSize: "1.2rem" }} />
              </IconButton>
            </MuiTooltip>
            <MuiTooltip title="Nota" arrow>
              <IconButton
                sx={{
                  flex: 1,
                  py: 1,
                  backgroundColor: "transparent",
                  color: "rgba(255,255,255,0.4)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 1.5,
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderColor: "rgba(255,255,255,0.15)",
                  },
                }}
              >
                <EditIcon sx={{ fontSize: "1.2rem" }} />
              </IconButton>
            </MuiTooltip>
          </Box>
          <MuiTooltip title={showWireframe ? "Ocultar Malla" : "Mostrar Malla"} arrow>
            <Button
              onClick={() => setShowWireframe(!showWireframe)}
              variant="outlined"
              size="small"
              sx={{
                width: "100%",
                py: 0.8,
                textTransform: "none",
                fontSize: "0.7rem",
                backgroundColor: showWireframe ? "rgba(200,169,110,0.15)" : "transparent",
                color: showWireframe ? "rgba(200,169,110,1)" : "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 1.5,
                "&:hover": {
                  backgroundColor: showWireframe ? "rgba(200,169,110,0.2)" : "rgba(255,255,255,0.05)",
                  borderColor: "rgba(200,169,110,0.3)",
                },
              }}
            >
              {showWireframe ? "Ocultar Malla" : "Mostrar Malla"}
            </Button>
          </MuiTooltip>
        </Box>
      </Box>


      {/* ===== VISOR 3D CENTRAL ===== */}
      <Box sx={{ 
        flex: 1, 
        position: "relative", 
        background: "radial-gradient(circle at center, rgba(200,169,110,0.03) 0%, rgba(13,13,13,1) 100%)",
      }}>
        <Canvas
          camera={{ position: [0, 0.5, 2.5], fov: 45 }}
          style={{ width: "100%", height: "100%" }}
          gl={{ antialias: true }}
        >
          <Suspense fallback={
            <mesh>
              <boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshStandardMaterial color="#a36920" />
            </mesh>
          }>
            <FacialScene
              markedPoints={markedPoints}
              onPointClick={handlePointClick}
              showWireframe={showWireframe}
              controlsRef={controlsRef}
            />
          </Suspense>
        </Canvas>
        
        {/* Hint superior */}
        <Box sx={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
        }}>
          <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.15)", fontWeight: 600, letterSpacing: 2, textAlign: "center" }}>
            ARRASTRA PARA ROTAR - SCROLL PARA ZOOM
          </Typography>
        </Box>
        
        {/* Toolbar flotante inferior */}
        <Box sx={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 1,
          backgroundColor: "rgba(13,13,13,0.8)",
          backdropFilter: "blur(10px)",
          px: 2,
          py: 1,
          borderRadius: 3,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <MuiTooltip title="Rotar" arrow>
            <IconButton onClick={handleRotate} size="small" sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "rgba(200,169,110,1)" } }}>
              <Refresh sx={{ fontSize: "1rem" }} />
            </IconButton>
          </MuiTooltip>
          <MuiTooltip title="Vista Frontal" arrow>
            <IconButton onClick={handleFrontView} size="small" sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "rgba(200,169,110,1)" } }}>
              <Typography sx={{ fontSize: "0.7rem" }}>●</Typography>
            </IconButton>
          </MuiTooltip>
          <MuiTooltip title="Vista Perfil" arrow>
            <IconButton onClick={handleProfileView} size="small" sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "rgba(200,169,110,1)" } }}>
              <Typography sx={{ fontSize: "0.7rem" }}>◐</Typography>
            </IconButton>
          </MuiTooltip>
          <MuiTooltip title={showWireframe ? "Ocultar Wireframe" : "Mostrar Wireframe"} arrow>
            <IconButton 
              size="small" 
              onClick={() => setShowWireframe(!showWireframe)}
              sx={{ 
                color: showWireframe ? "rgba(200,169,110,1)" : "rgba(255,255,255,0.5)", 
                "&:hover": { color: "rgba(200,169,110,1)" } 
              }}
            >
              <Typography sx={{ fontSize: "0.7rem" }}>▦</Typography>
            </IconButton>
          </MuiTooltip>
          <MuiTooltip title="Zoom" arrow>
            <IconButton size="small" sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "rgba(200,169,110,1)" } }}>
              <Typography sx={{ fontSize: "0.7rem" }}>+</Typography>
            </IconButton>
          </MuiTooltip>
        </Box>
        
      </Box>

      {/* ===== PANEL DERECHO - 200px ===== */}
      <Box
        sx={{
          width: 200,
          minWidth: 200,
          backgroundColor: "transparent",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          px: 2,
          py: 2,
        }}
      >
        {/* Puntos Marcados */}
        <Box sx={{ mb: 3, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", mb: 1.5, textTransform: "uppercase", letterSpacing: 1 }}>
            Puntos Marcados ({Object.keys(markedPoints).length})
          </Typography>
          <Box sx={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 0.8 }}>
            {usedTreatments.length === 0 ? (
              <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", textAlign: "center", py: 4 }}>
                Sin puntos
              </Typography>
            ) : (
              usedTreatments.map((treatmentId) => {
                const treatment = tratamientos.find(t => t.id === treatmentId);
                const color = treatmentColors[treatmentId] || "#ccc";
                const points = pointsByTreatment[treatmentId] || [];
                
                return points.map((pointId, idx) => (
                  <Box
                    key={pointId}
                    sx={{
                      p: 1,
                      borderRadius: 1.5,
                      backgroundColor: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.2 }}>
                        Zona #{idx + 1}
                      </Typography>
                      <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>
                        {treatment?.nombre}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setMarkedPoints(prev => {
                          const n = { ...prev };
                          delete n[pointId];
                          return n;
                        });
                      }}
                      sx={{ p: 0.3, color: "rgba(255,255,255,0.3)", "&:hover": { color: "rgba(244,67,54,0.8)" } }}
                    >
                      <Close sx={{ fontSize: "0.8rem" }} />
                    </IconButton>
                  </Box>
                ));
              })
            )}
          </Box>
        </Box>

        {/* Historial */}
        <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.06)", pt: 2 }}>
          <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", mb: 1.5, textTransform: "uppercase", letterSpacing: 1 }}>
            Historial
          </Typography>
          <Box sx={{ maxHeight: 200, overflow: "auto", display: "flex", flexDirection: "column", gap: 0.8 }}>
            {(!registros || registros.length === 0) ? (
              <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", textAlign: "center", py: 2 }}>
                Sin sesiones
              </Typography>
            ) : (
              registros.map((reg) => {
                const regPoints = Object.keys(reg.zonas_json || {});
                const regColors = [...new Set(regPoints.map(pid => reg.zonas_json[pid]?.color).filter(Boolean))];
                
                return (
                  <Box
                    key={reg.id}
                    onClick={() => handleLoad(reg)}
                    sx={{
                      p: 1,
                      borderRadius: 1.5,
                      backgroundColor: editingId === reg.id ? "rgba(200,169,110,0.1)" : "rgba(255,255,255,0.03)",
                      border: editingId === reg.id ? "1px solid rgba(200,169,110,0.3)" : "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      "&:hover": { backgroundColor: "rgba(255,255,255,0.08)" },
                    }}
                  >
                    <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.7)", mb: 0.5, lineHeight: 1.2 }}>
                      {reg.nombre || "Sesión"}
                    </Typography>
                    <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", mb: 0.8 }}>
                      {reg.creado_en?.split(" ")[0]}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.5)" }}>
                        {regPoints.length}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.3 }}>
                        {regColors.slice(0, 5).map((c, i) => (
                          <Box key={i} sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: c }} />
                        ))}
                      </Box>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>
      </Box>

      {/* ===== BOTTOM BAR ===== */}
      <Box sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 3,
        py: 1.5,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        backgroundColor: "rgba(13,13,13,0.95)",
        backdropFilter: "blur(10px)",
      }}>
        {/* Indicador de tratamiento activo */}
        <Box sx={{
          px: 2,
          py: 0.8,
          borderRadius: 3,
          backgroundColor: activeTreatmentId ? "rgba(200,169,110,0.15)" : "rgba(255,255,255,0.05)",
          border: "1px solid rgba(200,169,110,0.3)",
          boxShadow: activeTreatmentId ? "0 0 20px rgba(200,169,110,0.2)" : "none",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}>
          {activeTreatmentId && (
            <>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: activeColor, boxShadow: `0 0 10px ${activeColor}` }} />
              <Typography sx={{ fontSize: "0.7rem", color: "rgba(200,169,110,1)", fontWeight: 600 }}>
                {tratamientos.find(t => t.id === activeTreatmentId)?.nombre || "Tratamiento"}
              </Typography>
            </>
          )}
          {!activeTreatmentId && (
            <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
              Selecciona un tratamiento
            </Typography>
          )}
        </Box>

        {/* Botones */}
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={clearAll}
            size="small"
            sx={{
              textTransform: "none",
              fontSize: "0.7rem",
              borderColor: "rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.6)",
              px: 2,
              py: 0.6,
              "&:hover": {
                borderColor: "rgba(244,67,54,0.5)",
                backgroundColor: "rgba(244,67,54,0.05)",
                color: "rgba(244,67,54,1)",
              },
            }}
          >
            Limpiar
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={guardando || Object.keys(markedPoints).length === 0}
            size="small"
            sx={{
              textTransform: "none",
              fontSize: "0.7rem",
              backgroundColor: "rgba(200,169,110,1)",
              color: "#0D0D0D",
              px: 3,
              py: 0.6,
              fontWeight: 700,
              boxShadow: "0 0 20px rgba(200,169,110,0.3)",
              "&:hover": {
                backgroundColor: "rgba(200,169,110,0.9)",
                boxShadow: "0 0 30px rgba(200,169,110,0.5)",
              },
              "&:disabled": {
                backgroundColor: "rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.3)",
              },
            }}
          >
            {guardando ? "Guardando..." : editingId ? "Actualizar Sesión" : "Guardar Sesión"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
