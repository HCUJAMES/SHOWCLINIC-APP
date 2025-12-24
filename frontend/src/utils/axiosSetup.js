import axios from "axios";
import { logoutAndRedirect } from "./api";

let installed = false;

export const installAxiosInterceptors = () => {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err?.response?.status;
      if (status === 401) {
        logoutAndRedirect("Tu sesión ha caducado. Inicia sesión nuevamente.");
      }
      return Promise.reject(err);
    }
  );
};

installAxiosInterceptors();
