import React, { useRef, useCallback, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Box, IconButton, Tooltip as MuiTooltip } from "@mui/material";
import { Add, Delete, Refresh } from "@mui/icons-material";
import { HeadModel } from "./FacialMap3D";

// Precargar el modelo (compartido con FacialMap3D)
useGLTF.preload("/models/male_head.glb");

/**
 * Componente reutilizable de mapa facial 3D.
 *
 * Modos:
 *  - editable=true  → permite marcar/borrar puntos (devuelve cambios por onChange)
 *  - editable=false → solo visualización de los puntos recibidos
 *
 * props:
 *  - points: { [pointId]: { color, position } }
 *  - onChange: (nuevosPuntos) => void   (solo editable)
 *  - color: color activo para nuevos puntos (solo editable)
 *  - editable: boolean
 *  - height: alto del visor (css)
 */
export default function FacialMapMini({
  points = {},
  onChange,
  color = "#a36920",
  editable = false,
  height = 360,
}) {
  const controlsRef = useRef();
  const [eraserMode, setEraserMode] = useState(false);

  const handlePointClick = useCallback(
    (pointId, position) => {
      if (!editable || typeof onChange !== "function") return;

      if (eraserMode) {
        // Borrar el punto más cercano al click
        const next = { ...points };
        let closestId = null;
        let minDist = Infinity;
        Object.entries(next).forEach(([pid, data]) => {
          if (!data?.position) return;
          const d = Math.sqrt(
            Math.pow(data.position.x - position.x, 2) +
              Math.pow(data.position.y - position.y, 2) +
              Math.pow(data.position.z - position.z, 2)
          );
          if (d < minDist && d < 0.05) {
            minDist = d;
            closestId = pid;
          }
        });
        if (closestId) {
          delete next[closestId];
          onChange(next);
        }
        return;
      }

      // Modo marcar: alternar punto
      const next = { ...points };
      if (next[pointId]) {
        delete next[pointId];
      } else {
        next[pointId] = {
          color,
          position: { x: position.x, y: position.y, z: position.z },
        };
      }
      onChange(next);
    },
    [editable, onChange, eraserMode, points, color]
  );

  const handleRotate = () => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = !controlsRef.current.autoRotate;
      controlsRef.current.autoRotateSpeed = 2.0;
    }
  };

  return (
    <Box sx={{ position: "relative", width: "100%", height, backgroundColor: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
      <Canvas camera={{ position: editable ? [0, 0.15, 4.0] : [0, 0.0, 3.3], fov: 42 }} style={{ width: "100%", height: "100%" }} gl={{ antialias: true }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[0, 5, 5]} intensity={0.9} />
        <directionalLight position={[0, 3, -5]} intensity={0.5} />
        <hemisphereLight args={["#ffffff", "#8d8d8d", 0.25]} />
        <Suspense
          fallback={
            <mesh>
              <boxGeometry args={[0.4, 0.4, 0.4]} />
              <meshStandardMaterial color="#a36920" />
            </mesh>
          }
        >
          <HeadModel
            markedPoints={points}
            onPointClick={handlePointClick}
            showWireframe={false}
            modelScale={0.5}
            modelPosition={editable ? [0, -0.55, 0] : [0, -0.78, 0]}
          />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableRotate={editable}
          enableZoom={editable}
          minDistance={editable ? 2.5 : 3.3}
          maxDistance={editable ? 6 : 3.3}
          target={editable ? [0, 0.35, 0] : [0, 0.22, 0]}
          dampingFactor={0.05}
          enableDamping
        />
      </Canvas>

      {/* Toolbar de edición */}
      {editable && (
        <Box
          sx={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 0.5,
            backgroundColor: "rgba(13,13,13,0.85)",
            backdropFilter: "blur(8px)",
            px: 1.2,
            py: 0.6,
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <MuiTooltip title="Marcar" arrow>
            <IconButton
              size="small"
              onClick={() => setEraserMode(false)}
              sx={{
                color: !eraserMode ? "#C8A96E" : "rgba(255,255,255,0.5)",
                backgroundColor: !eraserMode ? "rgba(200,169,110,0.15)" : "transparent",
                "&:hover": { color: "#C8A96E" },
              }}
            >
              <Add sx={{ fontSize: "1.1rem" }} />
            </IconButton>
          </MuiTooltip>
          <MuiTooltip title="Borrar" arrow>
            <IconButton
              size="small"
              onClick={() => setEraserMode(true)}
              sx={{
                color: eraserMode ? "#f44336" : "rgba(255,255,255,0.5)",
                backgroundColor: eraserMode ? "rgba(244,67,54,0.15)" : "transparent",
                "&:hover": { color: "#f44336" },
              }}
            >
              <Delete sx={{ fontSize: "1.1rem" }} />
            </IconButton>
          </MuiTooltip>
          <MuiTooltip title="Auto-rotar" arrow>
            <IconButton size="small" onClick={handleRotate} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#C8A96E" } }}>
              <Refresh sx={{ fontSize: "1.1rem" }} />
            </IconButton>
          </MuiTooltip>
        </Box>
      )}
    </Box>
  );
}
