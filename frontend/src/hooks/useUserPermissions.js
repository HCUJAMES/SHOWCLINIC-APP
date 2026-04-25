import { useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

export default function useUserPermissions() {
  const [permissions, setPermissions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const role = localStorage.getItem("role");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setLoaded(true); return; }

    fetch(`${API_BASE}/api/admin/my-permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        setPermissions(data || []);
        setLoaded(true);
      })
      .catch(() => {
        setPermissions([]);
        setLoaded(true);
      });
  }, []);

  const hasAccess = (moduleName) => {
    if (role === "master") return true;
    return permissions.some(p => p.module_name === moduleName && p.can_access);
  };

  const canEdit = (moduleName) => {
    if (role === "master") return true;
    return permissions.some(p => p.module_name === moduleName && p.can_edit);
  };

  return { permissions, loaded, hasAccess, canEdit, role };
}
