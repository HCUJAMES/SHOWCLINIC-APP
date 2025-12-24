import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

export const dispatchToast = ({ severity = "info", message }) => {
  if (!message) return;
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { severity, message } }));
};

export const logoutAndRedirect = (message) => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  if (message) {
    dispatchToast({ severity: "warning", message });
  }
  if (window.location.pathname !== "/") {
    window.location.assign("/");
  }
};

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      logoutAndRedirect("Tu sesión ha caducado. Inicia sesión nuevamente.");
    }
    return Promise.reject(err);
  }
);

export const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    logoutAndRedirect("Tu sesión ha caducado. Inicia sesión nuevamente.");
    throw new Error("Unauthorized");
  }

  return res;
};
