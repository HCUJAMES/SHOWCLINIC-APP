import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#D4AF37", // dorado elegante
    },
    secondary: {
      main: "#2E2E2E", // gris oscuro
    },
    background: {
      default: "#F5F5F5", // fondo claro
    },
  },
  typography: {
    fontFamily: "'Poppins', sans-serif",
    h1: { fontFamily: "'The Amoret Collection Sans', 'Poppins', sans-serif" },
    h2: { fontFamily: "'The Amoret Collection Sans', 'Poppins', sans-serif" },
    h3: { fontFamily: "'The Amoret Collection Sans', 'Poppins', sans-serif" },
    h4: {
      fontFamily: "'The Amoret Collection Sans', 'Poppins', sans-serif",
      fontWeight: 600,
      color: "#2E2E2E",
    },
    h5: {
      fontFamily: "'The Amoret Collection Sans', 'Poppins', sans-serif",
      fontWeight: 500,
      color: "#2E2E2E",
    },
    h6: { fontFamily: "'The Amoret Collection Sans', 'Poppins', sans-serif" },
    subtitle1: { fontFamily: "'Poppins', sans-serif" },
    subtitle2: { fontFamily: "'Poppins', sans-serif" },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: "'The Amoret Collection Sans', 'Poppins', sans-serif",
          fontWeight: 700,
          letterSpacing: 0.2,
          textTransform: "none",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: "'Poppins', sans-serif",
        },
      },
    },
  },
});

export default theme;

