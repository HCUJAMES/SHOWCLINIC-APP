import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
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
  Alert,
  Fade,
  Grow,
  Avatar,
  Tooltip,
  Tabs,
  Tab
} from "@mui/material";
import {
  PersonAdd,
  Delete,
  Lock,
  LockOpen,
  Visibility,
  VisibilityOff,
  Save,
  ArrowBack,
  Person,
  AdminPanelSettings,
  SupervisorAccount,
  CheckCircle,
  Cancel,
  Shield,
  Edit,
  Add,
  Badge
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useToast } from "../components/ToastProvider";

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

const defaultRoleConfig = {
  master: { label: "Master", color: "#a36920", icon: <Shield sx={{ fontSize: 16 }} /> },
  admin: { label: "Admin", color: "#1976d2", icon: <AdminPanelSettings sx={{ fontSize: 16 }} /> },
  doctor: { label: "Doctor", color: "#2e7d32", icon: <Person sx={{ fontSize: 16 }} /> },
  doctora: { label: "Doctora", color: "#7b1fa2", icon: <Person sx={{ fontSize: 16 }} /> },
  asistente: { label: "Asistente", color: "#ed6c02", icon: <SupervisorAccount sx={{ fontSize: 16 }} /> },
  logistica: { label: "Logística", color: "#0288d1", icon: <SupervisorAccount sx={{ fontSize: 16 }} /> },
};

const roleColors = ["#a36920", "#1976d2", "#2e7d32", "#7b1fa2", "#ed6c02", "#0288d1", "#d32f2f", "#388e3c", "#f57c00", "#5c6bc0"];

export default function GestionUsuariosPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(0);
  const [usuarios, setUsuarios] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [passwordEditing, setPasswordEditing] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [openCreateUser, setOpenCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "asistente", permissions: [] });
  const [creatingUser, setCreatingUser] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [openPermissionsDialog, setOpenPermissionsDialog] = useState(false);
  const [tempPermissions, setTempPermissions] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ username: "", role: "" });
  const [openCreateRole, setOpenCreateRole] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", label: "", default_modules: [] });
  const [editingRole, setEditingRole] = useState(null);
  const [openEditRole, setOpenEditRole] = useState(false);
  const [editRoleForm, setEditRoleForm] = useState({ label: "", default_modules: [] });

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const cargarUsuarios = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/users-with-permissions`, { headers: authHeaders });
      setUsuarios(res.data || []);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
    }
  }, []);

  const cargarRoles = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/roles`, { headers: authHeaders });
      setCustomRoles(res.data || []);
    } catch (err) {
      console.error("Error al cargar roles:", err);
    }
  }, []);

  useEffect(() => {
    cargarUsuarios();
    cargarRoles();
  }, [cargarUsuarios, cargarRoles]);

  const getAllRoles = () => {
    const base = [
      { value: "asistente", label: "Asistente" },
      { value: "admin", label: "Admin" },
      { value: "doctor", label: "Doctor" },
      { value: "doctora", label: "Doctora" },
      { value: "logistica", label: "Logística" },
    ];
    customRoles.forEach(cr => {
      if (!base.find(b => b.value === cr.name)) {
        base.push({ value: cr.name, label: cr.label });
      }
    });
    return base;
  };

  const getRoleConfig = (role) => {
    if (defaultRoleConfig[role]) return defaultRoleConfig[role];
    const cr = customRoles.find(r => r.name === role);
    if (cr) {
      const idx = customRoles.indexOf(cr);
      return { label: cr.label, color: roleColors[idx % roleColors.length], icon: <Badge sx={{ fontSize: 16 }} /> };
    }
    return { label: role, color: "#666", icon: <Person sx={{ fontSize: 16 }} /> };
  };

  const crearUsuario = async () => {
    if (!newUser.username || !newUser.password || !newUser.role) {
      showToast({ severity: "warning", message: "Completa todos los campos requeridos" });
      return;
    }
    if (newUser.password.length < 4) {
      showToast({ severity: "warning", message: "La contraseña debe tener al menos 4 caracteres" });
      return;
    }
    try {
      setCreatingUser(true);
      await axios.post(`${API_BASE_URL}/api/admin/users`, newUser, { headers: authHeaders });
      showToast({ severity: "success", message: `Usuario "${newUser.username}" creado exitosamente` });
      setOpenCreateUser(false);
      setNewUser({ username: "", password: "", role: "asistente", permissions: [] });
      setShowCreatePassword(false);
      cargarUsuarios();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al crear usuario" });
    } finally {
      setCreatingUser(false);
    }
  };

  const eliminarUsuario = async (userId, username) => {
    if (!window.confirm(`¿Eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/users/${userId}`, { headers: authHeaders });
      showToast({ severity: "success", message: `Usuario "${username}" eliminado` });
      cargarUsuarios();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al eliminar usuario" });
    }
  };

  const abrirEditarUsuario = (user) => {
    setEditingUser(user);
    setEditForm({ username: user.username, role: user.role });
    setOpenEditDialog(true);
  };

  const guardarEdicionUsuario = async () => {
    if (!editingUser) return;
    try {
      if (editForm.username !== editingUser.username) {
        await axios.put(`${API_BASE_URL}/api/admin/users/${editingUser.id}/username`, { username: editForm.username }, { headers: authHeaders });
      }
      if (editForm.role !== editingUser.role) {
        await axios.put(`${API_BASE_URL}/api/admin/users/${editingUser.id}/role`, { role: editForm.role }, { headers: authHeaders });
      }
      showToast({ severity: "success", message: "Usuario actualizado exitosamente" });
      setOpenEditDialog(false);
      setEditingUser(null);
      cargarUsuarios();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al actualizar usuario" });
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
      await axios.put(`${API_BASE_URL}/api/admin/users/${editingPermissions}/permissions`, { permissions: tempPermissions }, { headers: authHeaders });
      showToast({ severity: "success", message: "Permisos actualizados" });
      setOpenPermissionsDialog(false);
      setEditingPermissions(null);
      cargarUsuarios();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al actualizar permisos" });
    }
  };

  const togglePermission = (moduleKey, field) => {
    setTempPermissions(prev => prev.map(p => p.module_name === moduleKey ? { ...p, [field]: !p[field] } : p));
  };

  const toggleNewUserPermission = (moduleKey, field) => {
    setNewUser(prev => {
      const perms = prev.permissions || [];
      const existing = perms.find(p => p.module_name === moduleKey);
      if (existing) {
        return { ...prev, permissions: perms.map(p => p.module_name === moduleKey ? { ...p, [field]: !p[field] } : p) };
      }
      return { ...prev, permissions: [...perms, { module_name: moduleKey, can_access: field === 'can_access', can_edit: field === 'can_edit' }] };
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
      await axios.put(`${API_BASE_URL}/api/admin/users/${userId}/password`, { newPassword }, { headers: authHeaders });
      showToast({ severity: "success", message: "Contraseña actualizada" });
      setPasswordEditing(null);
      setNewPassword("");
      setShowPassword(false);
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al cambiar contraseña" });
    } finally {
      setSavingPassword(false);
    }
  };

  const crearRol = async () => {
    if (!newRole.name || !newRole.label) {
      showToast({ severity: "warning", message: "Nombre y etiqueta son requeridos" });
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/admin/roles`, newRole, { headers: authHeaders });
      showToast({ severity: "success", message: `Rol "${newRole.label}" creado` });
      setOpenCreateRole(false);
      setNewRole({ name: "", label: "", default_modules: [] });
      cargarRoles();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al crear rol" });
    }
  };

  const abrirEditarRol = (role) => {
    setEditingRole(role);
    setEditRoleForm({ label: role.label, default_modules: role.default_modules || [] });
    setOpenEditRole(true);
  };

  const guardarEdicionRol = async () => {
    if (!editingRole) return;
    try {
      await axios.put(`${API_BASE_URL}/api/admin/roles/${editingRole.id}`, editRoleForm, { headers: authHeaders });
      showToast({ severity: "success", message: "Rol actualizado" });
      setOpenEditRole(false);
      setEditingRole(null);
      cargarRoles();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al actualizar rol" });
    }
  };

  const eliminarRol = async (roleId, roleName) => {
    if (!window.confirm(`¿Eliminar el rol "${roleName}"?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/roles/${roleId}`, { headers: authHeaders });
      showToast({ severity: "success", message: "Rol eliminado" });
      cargarRoles();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al eliminar rol" });
    }
  };

  const toggleRoleModule = (moduleKey, list, setList) => {
    if (list.includes(moduleKey)) {
      setList(list.filter(m => m !== moduleKey));
    } else {
      setList([...list, moduleKey]);
    }
  };

  const allRoles = getAllRoles();

  const renderRoleSelect = (value, onChange) => (
    <FormControl fullWidth>
      <InputLabel>Rol del usuario</InputLabel>
      <Select value={value} onChange={onChange} label="Rol del usuario">
        {allRoles.map(r => (
          <MenuItem key={r.value} value={r.value}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {getRoleConfig(r.value).icon}
              <span>{r.label}</span>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(180deg, #faf8f5 0%, #f0ebe0 100%)" }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Fade in timeout={500}>
          <Box>
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
              <IconButton onClick={() => navigate("/dashboard")} sx={{ mr: 2, backgroundColor: "white", border: `1px solid ${BRAND_COLORS.secondary}`, "&:hover": { backgroundColor: BRAND_COLORS.light } }}>
                <ArrowBack sx={{ color: BRAND_COLORS.primary }} />
              </IconButton>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: "#2e2e2e", letterSpacing: "-0.5px" }}>
                  Gestión de Usuarios
                </Typography>
                <Typography variant="body2" sx={{ color: "#999", mt: 0.5 }}>
                  Crea usuarios, asigna roles y gestiona permisos de acceso
                </Typography>
              </Box>
            </Box>

            {/* Tabs */}
            <Paper sx={{ mb: 3, borderRadius: 2, overflow: "hidden" }}>
              <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 600 }, "& .Mui-selected": { color: BRAND_COLORS.primary }, "& .MuiTabs-indicator": { backgroundColor: BRAND_COLORS.primary } }}>
                <Tab icon={<Person sx={{ fontSize: 20 }} />} iconPosition="start" label="Usuarios" />
                <Tab icon={<Badge sx={{ fontSize: 20 }} />} iconPosition="start" label="Roles" />
              </Tabs>
            </Paper>

            {/* ====== TAB 0: USUARIOS ====== */}
            {activeTab === 0 && (
              <>
                <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 3 }}>
                  <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setOpenCreateUser(true)} sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark }, borderRadius: 2, px: 3, py: 1, fontWeight: 600, textTransform: "none", boxShadow: "0 4px 12px rgba(163,105,32,0.3)" }}>
                    Crear Usuario
                  </Button>
                </Box>

                {/* Resumen */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ p: 2, textAlign: "center", borderRadius: 2, border: `1px solid ${BRAND_COLORS.secondary}20`, backgroundColor: "white" }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: BRAND_COLORS.primary }}>{usuarios.length}</Typography>
                      <Typography variant="caption" sx={{ color: "#999" }}>Total</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ p: 2, textAlign: "center", borderRadius: 2, border: "1px solid #2e7d3220", backgroundColor: "white" }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#2e7d32" }}>{usuarios.filter(u => u.role === "doctor" || u.role === "doctora").length}</Typography>
                      <Typography variant="caption" sx={{ color: "#999" }}>Doctores</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ p: 2, textAlign: "center", borderRadius: 2, border: "1px solid #ed6c0220", backgroundColor: "white" }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#ed6c02" }}>{usuarios.filter(u => u.role === "asistente").length}</Typography>
                      <Typography variant="caption" sx={{ color: "#999" }}>Asistentes</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ p: 2, textAlign: "center", borderRadius: 2, border: "1px solid #1976d220", backgroundColor: "white" }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#1976d2" }}>{usuarios.filter(u => u.role === "admin").length}</Typography>
                      <Typography variant="caption" sx={{ color: "#999" }}>Admins</Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Lista de Usuarios */}
                <Grid container spacing={2.5}>
                  {usuarios.map((u, index) => {
                    const rc = getRoleConfig(u.role);
                    const activePerms = (u.permissions || []).filter(p => p.can_access);
                    return (
                      <Grid item xs={12} sm={6} md={4} key={u.id}>
                        <Grow in timeout={300 + index * 80}>
                          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid rgba(186,154,99,0.15)", backgroundColor: "white", transition: "all 0.3s ease", "&:hover": { boxShadow: "0 8px 24px rgba(163,105,32,0.1)", border: `1px solid ${BRAND_COLORS.secondary}50` } }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                              <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                                <Avatar sx={{ width: 44, height: 44, backgroundColor: `${rc.color}15`, color: rc.color, fontWeight: 700, fontSize: "1.1rem" }}>
                                  {u.username.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box>
                                  <Typography sx={{ fontWeight: 700, color: "#2e2e2e", fontSize: "1rem", lineHeight: 1.2 }}>{u.username}</Typography>
                                  <Chip icon={rc.icon} label={rc.label} size="small" sx={{ mt: 0.5, height: 22, backgroundColor: `${rc.color}12`, color: rc.color, fontWeight: 600, fontSize: "0.7rem", border: `1px solid ${rc.color}30`, "& .MuiChip-icon": { color: rc.color } }} />
                                </Box>
                              </Box>
                              <Stack direction="row" spacing={0.5}>
                                {u.role !== "master" && (
                                  <>
                                    <Tooltip title="Editar usuario">
                                      <IconButton size="small" onClick={() => abrirEditarUsuario(u)} sx={{ color: "#bbb", "&:hover": { color: BRAND_COLORS.primary, backgroundColor: "#faf5ee" } }}>
                                        <Edit fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Eliminar">
                                      <IconButton size="small" onClick={() => eliminarUsuario(u.id, u.username)} sx={{ color: "#ccc", "&:hover": { color: "#d32f2f", backgroundColor: "#ffeaea" } }}>
                                        <Delete fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                              </Stack>
                            </Box>

                            <Box sx={{ mb: 2, minHeight: 28 }}>
                              {activePerms.length > 0 ? (
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                  {activePerms.slice(0, 4).map((perm, idx) => (
                                    <Chip key={idx} label={availableModules.find(m => m.key === perm.module_name)?.name || perm.module_name} size="small" icon={perm.can_edit ? <CheckCircle sx={{ fontSize: "14px !important" }} /> : undefined} sx={{ height: 22, fontSize: "0.65rem", backgroundColor: perm.can_edit ? "#e8f5e9" : "#f5f1e4", color: perm.can_edit ? "#2e7d32" : "#8a5a1a", border: perm.can_edit ? "1px solid #c8e6c9" : "1px solid #e0d6c2", "& .MuiChip-icon": { color: "#2e7d32" } }} />
                                  ))}
                                  {activePerms.length > 4 && <Chip label={`+${activePerms.length - 4} más`} size="small" sx={{ height: 22, fontSize: "0.65rem", backgroundColor: "#f5f5f5", color: "#999" }} />}
                                </Box>
                              ) : (
                                <Typography variant="caption" sx={{ color: "#ccc", fontStyle: "italic" }}>Sin permisos asignados</Typography>
                              )}
                            </Box>

                            <Divider sx={{ mb: 2 }} />

                            <Stack direction="row" spacing={1}>
                              <Button size="small" variant="outlined" startIcon={<Lock sx={{ fontSize: "16px !important" }} />} fullWidth onClick={() => { setPasswordEditing(u.id); setNewPassword(""); setShowPassword(false); }} sx={{ borderColor: "#e0d6c2", color: BRAND_COLORS.primary, fontSize: "0.72rem", textTransform: "none", borderRadius: 1.5, "&:hover": { borderColor: BRAND_COLORS.primary, backgroundColor: "rgba(163,105,32,0.04)" } }}>
                                Contraseña
                              </Button>
                              <Button size="small" variant="outlined" startIcon={<LockOpen sx={{ fontSize: "16px !important" }} />} fullWidth onClick={() => abrirEditarPermisos(u)} sx={{ borderColor: "#e0d6c2", color: BRAND_COLORS.secondary, fontSize: "0.72rem", textTransform: "none", borderRadius: 1.5, "&:hover": { borderColor: BRAND_COLORS.secondary, backgroundColor: "rgba(186,154,99,0.04)" } }}>
                                Permisos
                              </Button>
                            </Stack>

                            {passwordEditing === u.id && (
                              <Fade in>
                                <Box sx={{ mt: 2, p: 2, backgroundColor: "#faf8f5", borderRadius: 2, border: "1px solid #e0d6c2" }}>
                                  <TextField size="small" fullWidth type={showPassword ? "text" : "password"} label="Nueva contraseña" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") cambiarPassword(u.id); }} InputProps={{ endAdornment: (<InputAdornment position="end"><IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">{showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment>) }} sx={{ mb: 1.5 }} />
                                  <Stack direction="row" spacing={1}>
                                    <Button size="small" variant="contained" fullWidth disabled={savingPassword} onClick={() => cambiarPassword(u.id)} sx={{ backgroundColor: BRAND_COLORS.primary, textTransform: "none", "&:hover": { backgroundColor: BRAND_COLORS.dark } }}>{savingPassword ? "Guardando..." : "Guardar"}</Button>
                                    <Button size="small" variant="outlined" fullWidth onClick={() => { setPasswordEditing(null); setNewPassword(""); }} sx={{ textTransform: "none" }}>Cancelar</Button>
                                  </Stack>
                                </Box>
                              </Fade>
                            )}
                          </Paper>
                        </Grow>
                      </Grid>
                    );
                  })}
                </Grid>
              </>
            )}

            {/* ====== TAB 1: ROLES ====== */}
            {activeTab === 1 && (
              <>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                  <Typography variant="body2" sx={{ color: "#999" }}>
                    Crea roles personalizados y define qué módulos tiene acceso cada rol por defecto.
                  </Typography>
                  <Button variant="contained" startIcon={<Add />} onClick={() => setOpenCreateRole(true)} sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark }, borderRadius: 2, px: 3, py: 1, fontWeight: 600, textTransform: "none" }}>
                    Crear Rol
                  </Button>
                </Box>

                {/* Roles base */}
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: "#999", textTransform: "uppercase", letterSpacing: 1, fontSize: "0.7rem" }}>Roles del sistema</Typography>
                <Grid container spacing={2} sx={{ mb: 4 }}>
                  {Object.entries(defaultRoleConfig).map(([key, cfg]) => (
                    <Grid item xs={6} sm={4} md={2} key={key}>
                      <Paper sx={{ p: 2, textAlign: "center", borderRadius: 2, border: `1px solid ${cfg.color}20`, backgroundColor: "white" }}>
                        <Avatar sx={{ width: 40, height: 40, mx: "auto", mb: 1, backgroundColor: `${cfg.color}15`, color: cfg.color }}>{cfg.icon}</Avatar>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: cfg.color }}>{cfg.label}</Typography>
                        <Typography variant="caption" sx={{ color: "#bbb" }}>Fijo</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                {/* Roles personalizados */}
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: "#999", textTransform: "uppercase", letterSpacing: 1, fontSize: "0.7rem" }}>Roles personalizados</Typography>
                {customRoles.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: "center", borderRadius: 3, border: "1px dashed #ddd" }}>
                    <Badge sx={{ fontSize: 50, color: "#ddd", mb: 1 }} />
                    <Typography sx={{ color: "#999" }}>No hay roles personalizados</Typography>
                    <Typography variant="body2" sx={{ color: "#bbb" }}>Crea uno para asignarlo a tus usuarios</Typography>
                  </Paper>
                ) : (
                  <Grid container spacing={2}>
                    {customRoles.map((role, idx) => {
                      const color = roleColors[idx % roleColors.length];
                      const usersCount = usuarios.filter(u => u.role === role.name).length;
                      return (
                        <Grid item xs={12} sm={6} md={4} key={role.id}>
                          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${color}20`, backgroundColor: "white", transition: "all 0.3s", "&:hover": { boxShadow: `0 4px 16px ${color}15` } }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <Avatar sx={{ width: 40, height: 40, backgroundColor: `${color}15`, color }}><Badge /></Avatar>
                                <Box>
                                  <Typography sx={{ fontWeight: 700, color: "#2e2e2e" }}>{role.label}</Typography>
                                  <Typography variant="caption" sx={{ color: "#999" }}>@{role.name} · {usersCount} usuario{usersCount !== 1 ? "s" : ""}</Typography>
                                </Box>
                              </Box>
                              <Stack direction="row" spacing={0.5}>
                                <Tooltip title="Editar rol">
                                  <IconButton size="small" onClick={() => abrirEditarRol(role)} sx={{ color: "#bbb", "&:hover": { color } }}><Edit fontSize="small" /></IconButton>
                                </Tooltip>
                                <Tooltip title="Eliminar rol">
                                  <IconButton size="small" onClick={() => eliminarRol(role.id, role.label)} sx={{ color: "#ccc", "&:hover": { color: "#d32f2f" } }}><Delete fontSize="small" /></IconButton>
                                </Tooltip>
                              </Stack>
                            </Box>
                            <Typography variant="caption" sx={{ color: "#999", fontWeight: 600 }}>Módulos por defecto:</Typography>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                              {(role.default_modules || []).length > 0 ? role.default_modules.map(mod => (
                                <Chip key={mod} label={availableModules.find(m => m.key === mod)?.name || mod} size="small" sx={{ height: 22, fontSize: "0.65rem", backgroundColor: "#f5f1e4", color: "#8a5a1a", border: "1px solid #e0d6c2" }} />
                              )) : <Typography variant="caption" sx={{ color: "#ccc", fontStyle: "italic" }}>Ninguno</Typography>}
                            </Box>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </>
            )}
          </Box>
        </Fade>
      </Container>

      {/* Dialog: Crear Usuario */}
      <Dialog open={openCreateUser} onClose={() => { setOpenCreateUser(false); setShowCreatePassword(false); }} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, #c48a3a 100%)`, color: "white", py: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <PersonAdd />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Crear Nuevo Usuario</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Asigna nombre, contraseña, rol y permisos</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Nombre de usuario" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} required placeholder="Ej: doctor_garcia" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Contraseña" type={showCreatePassword ? "text" : "password"} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required placeholder="Mínimo 4 caracteres" InputProps={{ endAdornment: (<InputAdornment position="end"><IconButton onClick={() => setShowCreatePassword(!showCreatePassword)} edge="end" size="small">{showCreatePassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment>) }} />
            </Grid>
            <Grid item xs={12}>
              {renderRoleSelect(newUser.role, (e) => setNewUser({ ...newUser, role: e.target.value }))}
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700, color: "#2e2e2e" }}>Permisos de Módulos</Typography>
              <Alert severity="info" sx={{ mb: 2, fontSize: "0.8rem" }}><strong>Acceso</strong> = puede ver el módulo | <strong>Editar</strong> = puede modificar datos</Alert>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "#faf8f5" }}>
                      <TableCell sx={{ fontWeight: 700, color: "#555" }}>Módulo</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, color: "#555" }}>Acceso</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, color: "#555" }}>Editar</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availableModules.map((mod) => (
                      <TableRow key={mod.key} hover>
                        <TableCell sx={{ fontWeight: 500 }}>{mod.name}</TableCell>
                        <TableCell align="center"><Checkbox checked={getNewUserPermission(mod.key, 'can_access')} onChange={() => toggleNewUserPermission(mod.key, 'can_access')} sx={{ color: BRAND_COLORS.secondary, "&.Mui-checked": { color: BRAND_COLORS.primary } }} /></TableCell>
                        <TableCell align="center"><Checkbox checked={getNewUserPermission(mod.key, 'can_edit')} onChange={() => toggleNewUserPermission(mod.key, 'can_edit')} sx={{ color: BRAND_COLORS.secondary, "&.Mui-checked": { color: "#2e7d32" } }} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: "1px solid #eee" }}>
          <Button onClick={() => { setOpenCreateUser(false); setShowCreatePassword(false); }} variant="outlined" sx={{ textTransform: "none", borderRadius: 2 }}>Cancelar</Button>
          <Button onClick={crearUsuario} variant="contained" disabled={creatingUser} startIcon={<PersonAdd />} sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark }, textTransform: "none", borderRadius: 2, px: 3, fontWeight: 600 }}>{creatingUser ? "Creando..." : "Crear Usuario"}</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Editar Usuario (nombre + rol) */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, #c48a3a 100%)`, color: "white", py: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Edit />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Editar Usuario</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField fullWidth label="Nombre de usuario" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
            {renderRoleSelect(editForm.role, (e) => setEditForm({ ...editForm, role: e.target.value }))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: "1px solid #eee" }}>
          <Button onClick={() => setOpenEditDialog(false)} variant="outlined" sx={{ textTransform: "none", borderRadius: 2 }}>Cancelar</Button>
          <Button onClick={guardarEdicionUsuario} variant="contained" startIcon={<Save />} sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark }, textTransform: "none", borderRadius: 2, fontWeight: 600 }}>Guardar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Editar Permisos */}
      <Dialog open={openPermissionsDialog} onClose={() => setOpenPermissionsDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, #c48a3a 100%)`, color: "white", py: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <LockOpen />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Gestionar Permisos</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Activa o desactiva el acceso a cada módulo</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "#faf8f5" }}>
                  <TableCell sx={{ fontWeight: 700, color: "#555" }}>Módulo</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: "#555" }}>Acceso</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: "#555" }}>Editar</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tempPermissions.map((perm) => (
                  <TableRow key={perm.module_name} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{perm.module_label}</TableCell>
                    <TableCell align="center"><IconButton size="small" onClick={() => togglePermission(perm.module_name, 'can_access')} sx={{ color: perm.can_access ? "#4caf50" : "#ddd" }}>{perm.can_access ? <CheckCircle /> : <Cancel />}</IconButton></TableCell>
                    <TableCell align="center"><IconButton size="small" onClick={() => togglePermission(perm.module_name, 'can_edit')} sx={{ color: perm.can_edit ? "#4caf50" : "#ddd" }}>{perm.can_edit ? <CheckCircle /> : <Cancel />}</IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: "1px solid #eee" }}>
          <Button onClick={() => setOpenPermissionsDialog(false)} variant="outlined" sx={{ textTransform: "none", borderRadius: 2 }}>Cancelar</Button>
          <Button onClick={guardarPermisos} variant="contained" startIcon={<Save />} sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark }, textTransform: "none", borderRadius: 2, px: 3, fontWeight: 600 }}>Guardar Cambios</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Crear Rol */}
      <Dialog open={openCreateRole} onClose={() => setOpenCreateRole(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, #c48a3a 100%)`, color: "white", py: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Add />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Crear Nuevo Rol</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Define un rol personalizado con módulos por defecto</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField fullWidth label="Nombre del rol (sin espacios)" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })} placeholder="Ej: recepcionista" helperText="Se usará como identificador interno" />
            <TextField fullWidth label="Etiqueta visible" value={newRole.label} onChange={(e) => setNewRole({ ...newRole, label: e.target.value })} placeholder="Ej: Recepcionista" helperText="Nombre que verán los usuarios" />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Módulos por defecto</Typography>
              <Alert severity="info" sx={{ mb: 1.5, fontSize: "0.78rem" }}>Al crear un usuario con este rol, estos módulos se asignarán automáticamente.</Alert>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {availableModules.map(mod => (
                  <Chip key={mod.key} label={mod.name} clickable onClick={() => { const mods = newRole.default_modules.includes(mod.key) ? newRole.default_modules.filter(m => m !== mod.key) : [...newRole.default_modules, mod.key]; setNewRole({ ...newRole, default_modules: mods }); }} color={newRole.default_modules.includes(mod.key) ? "primary" : "default"} variant={newRole.default_modules.includes(mod.key) ? "filled" : "outlined"} sx={newRole.default_modules.includes(mod.key) ? { backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark } } : {}} />
                ))}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: "1px solid #eee" }}>
          <Button onClick={() => setOpenCreateRole(false)} variant="outlined" sx={{ textTransform: "none", borderRadius: 2 }}>Cancelar</Button>
          <Button onClick={crearRol} variant="contained" startIcon={<Add />} sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark }, textTransform: "none", borderRadius: 2, fontWeight: 600 }}>Crear Rol</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Editar Rol */}
      <Dialog open={openEditRole} onClose={() => setOpenEditRole(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, #c48a3a 100%)`, color: "white", py: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Edit />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Editar Rol</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField fullWidth label="Etiqueta visible" value={editRoleForm.label} onChange={(e) => setEditRoleForm({ ...editRoleForm, label: e.target.value })} />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Módulos por defecto</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {availableModules.map(mod => (
                  <Chip key={mod.key} label={mod.name} clickable onClick={() => { const mods = editRoleForm.default_modules.includes(mod.key) ? editRoleForm.default_modules.filter(m => m !== mod.key) : [...editRoleForm.default_modules, mod.key]; setEditRoleForm({ ...editRoleForm, default_modules: mods }); }} color={editRoleForm.default_modules.includes(mod.key) ? "primary" : "default"} variant={editRoleForm.default_modules.includes(mod.key) ? "filled" : "outlined"} sx={editRoleForm.default_modules.includes(mod.key) ? { backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark } } : {}} />
                ))}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: "1px solid #eee" }}>
          <Button onClick={() => setOpenEditRole(false)} variant="outlined" sx={{ textTransform: "none", borderRadius: 2 }}>Cancelar</Button>
          <Button onClick={guardarEdicionRol} variant="contained" startIcon={<Save />} sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.dark }, textTransform: "none", borderRadius: 2, fontWeight: 600 }}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
