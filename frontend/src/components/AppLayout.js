import React, { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  Button,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useToast } from "./ToastProvider";

const drawerWidth = 270;

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      showToast({ severity: "warning", message: "Inicia sesión para continuar" });
      navigate("/", { replace: true });
    }
  }, [navigate, showToast]);

  const role = localStorage.getItem("role") || "";

  const items = useMemo(() => {
    const base = [
      { label: "Dashboard", path: "/dashboard" },
      { label: "Pacientes", path: "/pacientes" },
      { label: "Historial clínico", path: "/historial-clinico" },
      { label: "Tratamientos", path: "/tratamientos" },
      { label: "Inventario", path: "/inventario" },
      { label: "Finanzas", path: "/finanzas" },
    ];

    if (role === "admin" || role === "doctor") return base;
    return [{ label: "Dashboard", path: "/dashboard" }];
  }, [role]);

  const title = useMemo(() => {
    const found = items.find((it) => location.pathname.startsWith(it.path));
    return found?.label || "ShowClinic";
  }, [items, location.pathname]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/");
  };

  const drawer = (
    <Box sx={{ height: "100%" }}>
      <Box sx={{ px: 2.5, py: 2.3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.3 }}>
          <Box
            component="img"
            src="/logo-showclinic.png"
            alt="ShowClinic"
            sx={{ width: 34, height: 34, borderRadius: "50%" }}
          />
          <Box>
            <Typography sx={{ fontWeight: 800, color: "#a36920" }}>ShowClinic</Typography>
            <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.62)" }}>
              Rol: {role || "-"}
            </Typography>
          </Box>
        </Box>
      </Box>
      <Divider />
      <List sx={{ py: 1 }}>
        {items.map((it) => (
          <ListItemButton
            key={it.path}
            selected={location.pathname.startsWith(it.path)}
            onClick={() => {
              navigate(it.path);
              setMobileOpen(false);
            }}
            sx={{
              mx: 1.0,
              borderRadius: 2,
              "&.Mui-selected": {
                backgroundColor: "rgba(212,175,55,0.18)",
              },
            }}
          >
            <ListItemText
              primary={it.label}
              primaryTypographyProps={{ fontWeight: 700, color: "rgba(0,0,0,0.82)" }}
            />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ flex: 1 }} />
      <Box sx={{ px: 2, pb: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          sx={{ borderColor: "rgba(163,105,32,0.45)", color: "#a36920" }}
          onClick={logout}
        >
          Cerrar sesión
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "background.default" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: "rgba(255,255,255,0.78)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(212,175,55,0.22)",
          color: "#2E2E2E",
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 800, color: "#a36920" }}>
            {title}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="text"
            sx={{ color: "#a36920" }}
            onClick={() => navigate("/dashboard")}
          >
            Inicio
          </Button>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": { width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>

        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              borderRight: "1px solid rgba(212,175,55,0.22)",
              backgroundColor: "rgba(255,255,255,0.78)",
              backdropFilter: "blur(10px)",
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          pt: { xs: 8, sm: 9 },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default AppLayout;
