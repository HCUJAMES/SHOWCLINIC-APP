import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
};

const ToastProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState("info");
  const [message, setMessage] = useState("");

  const showToast = useCallback((next) => {
    const msg = typeof next === "string" ? next : next?.message;
    if (!msg) return;

    const sev = typeof next === "object" && next?.severity ? next.severity : "info";
    setSeverity(sev);
    setMessage(msg);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  useEffect(() => {
    const onToast = (e) => {
      const detail = e?.detail || {};
      showToast(detail);
    };
    window.addEventListener("app:toast", onToast);
    return () => window.removeEventListener("app:toast", onToast);
  }, [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={3500}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
