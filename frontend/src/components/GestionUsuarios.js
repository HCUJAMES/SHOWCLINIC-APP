import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Chip,
  IconButton,
  Divider,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  InputAdornment,
  Alert
} from "@mui/material";
import {
  PersonAdd,
  Delete,
  Lock,
  LockOpen,
  VpnKey,
  Visibility,
  VisibilityOff,
  Save,
  Close
} from "@mui/icons-material";
import axios from "axios";
import { useToast } from "./ToastProvider";

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

const BRAND_COLORS = {
  primary: '#a36920',
  secondary: '#ba9a63',
  light: '#f5f1e4',
  veryLight: '#fffdf7',
  dark: '#8a5a1a'
};

const availableModules = [
  { name: "Pacientes", key: "pacientes" },
  { name: "Tratamientos", key: "tratamientos" },
  { name: "Paquetes", key: "paquetes" },
  { name: "Inventario", key: "inventario" },
  { name: "Finanzas", key: "finanzas" },
  { name: "Especialistas", key: "especialistas" },
  { name: "Gestión Clínica", key: "gestion-clinica" },
  { name: "Estadísticas", key: "estadisticas" }
];

const GestionUsuarios = () => {
  const { showToast } = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [passwordEditing, setPasswordEditing] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [openCreateUser, setOpenCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "asistente",
    permissions: []
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [openPermissionsDialog, setOpenPermissionsDialog] = useState(false);
  const [tempPermissions, setTempPermissions] = useState([]);

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/users-with-permissions`, { headers: authHeaders });
      setUsuarios(res.data || []);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
    }
  };

  const crearUsuario = async () => {
    if (!newUser.username || !newUser.password || !newUser.role) {
      showToast({ severity: "warning", message: "Completa todos los campos requeridos" });
      return;
    }

    try {
      setCreatingUser(true);
      await axios.post(`${API_BASE_URL}/api/admin/users`, newUser, { headers: authHeaders });
      showToast({ severity: "success", message: "Usuario creado exitosamente" });
      setOpenCreateUser(false);
      setNewUser({ username: "", password: "", role: "asistente", permissions: [] });
      cargarUsuarios();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al crear usuario" });
    } finally {
      setCreatingUser(false);
    }
  };

  const eliminarUsuario = async (userId, username) => {
    if (!window.confirm(`¿Estás seguro de eliminar al usuario "${username}"?`)) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/admin/users/${userId}`, { headers: authHeaders });
      showToast({ severity: "success", message: "Usuario eliminado exitosamente" });
      cargarUsuarios();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al eliminar usuario" });
    }
  };

  const abrirEditarPermisos = (user) => {
    setEditingPermissions(user.id);
    const userPerms = user.permissions || [];
    const perms = availableModules.map(mod => {
      const existing = userPerms.find(p => p.module_name === mod.key);
      return {
        module_name: mod.key,
        module_label: mod.name,
        can_access: existing ? Boolean(existing.can_access) : false,
        can_edit: existing ? Boolean(existing.can_edit) : false
      };
    });
    setTempPermissions(perms);
    setOpenPermissionsDialog(true);
  };

  const guardarPermisos = async () => {
    try {
      await axios.put(
        `${API_BASE_URL}/api/admin/users/${editingPermissions}/permissions`,
        { permissions: tempPermissions },
        { headers: authHeaders }
      );
      showToast({ severity: "success", message: "Permisos actualizados exitosamente" });
      setOpenPermissionsDialog(false);
      setEditingPermissions(null);
      cargarUsuarios();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al actualizar permisos" });
    }
  };

  const togglePermission = (moduleKey, field) => {
    setTempPermissions(prev =>
      prev.map(p =>
        p.module_name === moduleKey
          ? { ...p, [field]: !p[field] }
          : p
      )
    );
  };

  const toggleNewUserPermission = (moduleKey, field) => {
    setNewUser(prev => {
      const perms = prev.permissions || [];
      const existing = perms.find(p => p.module_name === moduleKey);

      if (existing) {
        return {
          ...prev,
          permissions: perms.map(p =>
            p.module_name === moduleKey
              ? { ...p, [field]: !p[field] }
              : p
          )
        };
      } else {
        return {
          ...prev,
          permissions: [...perms, { module_name: moduleKey, can_access: field === 'can_access', can_edit: field === 'can_edit' }]
        };
      }
    });
  };

  const getNewUserPermission = (moduleKey, field) => {
    const perm = newUser.permissions.find(p => p.module_name === moduleKey);
    return perm ? Boolean(perm[field]) : false;
  };

  const cambiarPassword = async (userId) => {
    if (!newPassword || newPassword.length < 4) {
      showToast({ severity: "warning", message: "La contraseña debe tener al menos 4 caracteres" });
      return;
    }
    try {
      setSavingPassword(true);
      const res = await axios.put(`${API_BASE_URL}/api/admin/users/${userId}/password`, { newPassword }, { headers: authHeaders });
      showToast({ severity: "success", message: res.data.message || "Contraseña actualizada" });
      setPasswordEditing(null);
      setNewPassword("");
      setShowPassword(false);
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al cambiar contraseña" });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Box>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: `1px solid ${BRAND_COLORS.secondary}`, backgroundColor: BRAND_COLORS.veryLight }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: "bold", color: BRAND_COLORS.primary, display: "flex", alignItems: "center", gap: 1 }}>
            <VpnKey /> Gestión de Usuarios del Sistema
          </Typography>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => setOpenCreateUser(true)}
            sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark } }}
          >
            Crear Usuario
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Desde aquí puedes crear usuarios, asignar roles y gestionar permisos de acceso a los módulos del sistema.
        </Alert>

        <Divider sx={{ mb: 3 }} />

        {usuarios.length === 0 ? (
          <Typography color="text.secondary">No se encontraron usuarios.</Typography>
        ) : (
          <Grid container spacing={2}>
            {usuarios.map((u) => (
              <Grid item xs={12} sm={6} md={4} key={u.id}>
                <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${BRAND_COLORS.secondary}`, backgroundColor: BRAND_COLORS.light }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                    <Box>
                      <Typography sx={{ fontWeight: "bold", color: "#333", fontSize: "1.05rem" }}>{u.username}</Typography>
                      <Chip
                        label={u.role}
                        size="small"
                        sx={{
                          mt: 0.5,
                          backgroundColor: u.role === "master" ? BRAND_COLORS.primary : u.role === "doctor" ? BRAND_COLORS.secondary : "#e0d6c2",
                          color: u.role === "master" || u.role === "doctor" ? "white" : "#555",
                          fontWeight: 600,
                          fontSize: "0.7rem"
                        }}
                      />
                    </Box>
                    {u.role !== "master" && (
                      <IconButton
                        size="small"
                        onClick={() => eliminarUsuario(u.id, u.username)}
                        sx={{ color: "#d32f2f" }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  <Stack spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Lock />}
                      fullWidth
                      onClick={() => { setPasswordEditing(u.id); setNewPassword(""); setShowPassword(false); }}
                      sx={{
                        borderColor: BRAND_COLORS.primary,
                        color: BRAND_COLORS.primary,
                        fontSize: "0.75rem",
                        "&:hover": { borderColor: BRAND_COLORS.dark, backgroundColor: "rgba(163,105,32,0.05)" }
                      }}
                    >
                      Cambiar Contraseña
                    </Button>

                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<LockOpen />}
                      fullWidth
                      onClick={() => abrirEditarPermisos(u)}
                      sx={{
                        borderColor: BRAND_COLORS.secondary,
                        color: BRAND_COLORS.secondary,
                        fontSize: "0.75rem",
                        "&:hover": { borderColor: BRAND_COLORS.primary, backgroundColor: "rgba(186,154,99,0.05)" }
                      }}
                    >
                      Gestionar Permisos
                    </Button>
                  </Stack>

                  {passwordEditing === u.id && (
                    <Box sx={{ mt: 1.5, p: 1.5, backgroundColor: "white", borderRadius: 1, border: `1px solid ${BRAND_COLORS.secondary}` }}>
                      <TextField
                        size="small"
                        fullWidth
                        type={showPassword ? "text" : "password"}
                        label="Nueva contraseña"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          )
                        }}
                        sx={{ mb: 1 }}
                      />
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          fullWidth
                          disabled={savingPassword}
                          onClick={() => cambiarPassword(u.id)}
                          sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark } }}
                        >
                          {savingPassword ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          fullWidth
                          onClick={() => { setPasswordEditing(null); setNewPassword(""); }}
                        >
                          Cancelar
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* Dialog: Crear Usuario */}
      <Dialog open={openCreateUser} onClose={() => setOpenCreateUser(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ backgroundColor: BRAND_COLORS.light, color: BRAND_COLORS.primary, fontWeight: "bold" }}>
          Crear Nuevo Usuario
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nombre de usuario"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contraseña"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Rol</InputLabel>
                <Select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  label="Rol"
                >
                  <MenuItem value="asistente">Asistente</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="doctor">Doctor</MenuItem>
                  <MenuItem value="logistica">Logística</MenuItem>
                  <MenuItem value="doctora">Doctora</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Permisos de Módulos</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Módulo</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Acceso</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Editar</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availableModules.map((mod) => (
                      <TableRow key={mod.key}>
                        <TableCell>{mod.name}</TableCell>
                        <TableCell align="center">
                          <Checkbox
                            checked={getNewUserPermission(mod.key, 'can_access')}
                            onChange={() => toggleNewUserPermission(mod.key, 'can_access')}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Checkbox
                            checked={getNewUserPermission(mod.key, 'can_edit')}
                            onChange={() => toggleNewUserPermission(mod.key, 'can_edit')}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCreateUser(false)} variant="outlined">
            Cancelar
          </Button>
          <Button
            onClick={crearUsuario}
            variant="contained"
            disabled={creatingUser}
            sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark } }}
          >
            {creatingUser ? "Creando..." : "Crear Usuario"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Editar Permisos */}
      <Dialog open={openPermissionsDialog} onClose={() => setOpenPermissionsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: BRAND_COLORS.light, color: BRAND_COLORS.primary, fontWeight: "bold" }}>
          Gestionar Permisos
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Módulo</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Acceso</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Editar</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tempPermissions.map((perm) => (
                  <TableRow key={perm.module_name}>
                    <TableCell>{perm.module_label}</TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={perm.can_access}
                        onChange={() => togglePermission(perm.module_name, 'can_access')}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={perm.can_edit}
                        onChange={() => togglePermission(perm.module_name, 'can_edit')}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenPermissionsDialog(false)} variant="outlined">
            Cancelar
          </Button>
          <Button
            onClick={guardarPermisos}
            variant="contained"
            startIcon={<Save />}
            sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark } }}
          >
            Guardar Cambios
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GestionUsuarios;
