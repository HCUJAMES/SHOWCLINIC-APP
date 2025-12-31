import { createTheme } from "@mui/material/styles";

// Paleta de colores ShowClinic - basada en showclinic.com
// Elegante, minimalista, tonos dorados/champagne con negro y blanco
const showclinicColors = {
  gold: "#A36920",           // Dorado principal (marrón dorado)
  goldLight: "#C4944A",      // Dorado claro
  goldDark: "#8A5A1A",       // Dorado oscuro (hover)
  champagne: "#F5EDE3",      // Champagne/crema claro
  cream: "#FAF8F5",          // Crema muy claro (fondos)
  white: "#FFFFFF",          // Blanco puro
  black: "#1A1A1A",          // Negro elegante
  grayDark: "#2E2E2E",       // Gris oscuro (texto)
  grayMedium: "#6B6B6B",     // Gris medio
  grayLight: "#E8E8E8",      // Gris claro (bordes)
  success: "#4CAF50",        // Verde éxito
  error: "#E53935",          // Rojo error
  warning: "#FF9800",        // Naranja advertencia
};

const theme = createTheme({
  palette: {
    primary: {
      main: showclinicColors.gold,
      light: showclinicColors.goldLight,
      dark: showclinicColors.goldDark,
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: showclinicColors.black,
      light: showclinicColors.grayDark,
      contrastText: "#FFFFFF",
    },
    background: {
      default: showclinicColors.cream,
      paper: showclinicColors.white,
    },
    text: {
      primary: showclinicColors.grayDark,
      secondary: showclinicColors.grayMedium,
    },
    success: {
      main: showclinicColors.success,
    },
    error: {
      main: showclinicColors.error,
    },
    warning: {
      main: showclinicColors.warning,
    },
    // Colores personalizados accesibles via theme.palette.showclinic
    showclinic: showclinicColors,
  },
  typography: {
    fontFamily: "'Poppins', sans-serif",
    h1: { 
      fontFamily: "'Playfair Display', 'Poppins', serif",
      fontWeight: 600,
      color: showclinicColors.grayDark,
    },
    h2: { 
      fontFamily: "'Playfair Display', 'Poppins', serif",
      fontWeight: 600,
      color: showclinicColors.grayDark,
    },
    h3: { 
      fontFamily: "'Playfair Display', 'Poppins', serif",
      fontWeight: 600,
      color: showclinicColors.grayDark,
    },
    h4: {
      fontFamily: "'Playfair Display', 'Poppins', serif",
      fontWeight: 600,
      color: showclinicColors.gold,
    },
    h5: {
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 500,
      color: showclinicColors.grayDark,
    },
    h6: { 
      fontFamily: "'Poppins', sans-serif",
      fontWeight: 500,
      color: showclinicColors.grayDark,
    },
    subtitle1: { 
      fontFamily: "'Poppins', sans-serif",
      color: showclinicColors.grayMedium,
    },
    subtitle2: { 
      fontFamily: "'Poppins', sans-serif",
      color: showclinicColors.grayMedium,
    },
    body1: {
      fontFamily: "'Poppins', sans-serif",
      color: showclinicColors.grayDark,
    },
    body2: {
      fontFamily: "'Poppins', sans-serif",
      color: showclinicColors.grayMedium,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 600,
          letterSpacing: 0.5,
          textTransform: "none",
          borderRadius: 8,
          padding: "10px 24px",
          transition: "all 0.2s ease-in-out",
        },
        contained: {
          boxShadow: "0 4px 14px rgba(163, 105, 32, 0.25)",
          "&:hover": {
            boxShadow: "0 6px 20px rgba(163, 105, 32, 0.35)",
          },
        },
        outlined: {
          borderWidth: 2,
          "&:hover": {
            borderWidth: 2,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 8px 30px rgba(163, 105, 32, 0.15)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
        elevation1: {
          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: showclinicColors.gold,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: showclinicColors.gold,
            },
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: showclinicColors.gold,
            color: "#FFFFFF",
            fontWeight: 600,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: showclinicColors.champagne,
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: "'Poppins', sans-serif",
          backgroundColor: showclinicColors.cream,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: "'Playfair Display', 'Poppins', serif",
          fontWeight: 600,
          color: showclinicColors.gold,
        },
      },
    },
  },
});

export default theme;

