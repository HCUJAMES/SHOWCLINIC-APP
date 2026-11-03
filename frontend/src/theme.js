import { createTheme, alpha } from "@mui/material/styles";
import { BRAND, FONTS } from "./brand";

// Tema basado en el Manual de Identidad ShowClinic 2025.
// Diseño plano y sobrio: crema de fondo, marrón dorado como acento,
// Amoret para títulos y Montserrat para todo el texto.
const showclinicColors = {
  gold: BRAND.oro,
  goldLight: BRAND.arena,
  goldDark: BRAND.oroOscuro,
  champagne: BRAND.crema,
  cream: BRAND.cremaClara,
  white: BRAND.blanco,
  black: BRAND.texto,
  grayDark: BRAND.texto,
  grayMedium: BRAND.textoSuave,
  grayLight: "#e9e2d3",
  success: BRAND.exito,
  error: BRAND.error,
  warning: BRAND.aviso,
};

const titulo = {
  fontFamily: FONTS.titulo,
  fontWeight: 400,
  letterSpacing: "0.04em",
  color: BRAND.texto,
};

const theme = createTheme({
  palette: {
    primary: {
      main: BRAND.oro,
      light: BRAND.arena,
      dark: BRAND.oroOscuro,
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: BRAND.arena,
      light: BRAND.arenaClara,
      dark: BRAND.oro,
      contrastText: "#FFFFFF",
    },
    background: {
      default: BRAND.cremaClara,
      paper: BRAND.blanco,
    },
    text: {
      primary: BRAND.texto,
      secondary: BRAND.textoSuave,
    },
    divider: "rgba(163,105,32,0.14)",
    success: { main: BRAND.exito },
    error: { main: BRAND.error },
    warning: { main: BRAND.aviso },
    info: { main: BRAND.info },
    // Colores personalizados accesibles via theme.palette.showclinic
    showclinic: showclinicColors,
  },
  typography: {
    fontFamily: FONTS.texto,
    h1: { ...titulo, fontSize: "2.6rem" },
    h2: { ...titulo, fontSize: "2.2rem" },
    h3: { ...titulo, fontSize: "1.9rem" },
    h4: { ...titulo, fontSize: "1.6rem", color: BRAND.oro },
    h5: { fontFamily: FONTS.texto, fontWeight: 600, color: BRAND.texto },
    h6: { fontFamily: FONTS.texto, fontWeight: 600, color: BRAND.texto },
    subtitle1: { fontFamily: FONTS.texto, color: BRAND.textoSuave },
    subtitle2: { fontFamily: FONTS.texto, fontWeight: 600, color: BRAND.textoSuave },
    body1: { fontFamily: FONTS.texto },
    body2: { fontFamily: FONTS.texto },
    button: { fontFamily: FONTS.texto, fontWeight: 600, textTransform: "none", letterSpacing: "0.02em" },
    caption: { fontFamily: FONTS.texto },
    overline: { fontFamily: FONTS.texto, fontWeight: 600, letterSpacing: "0.18em" },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: FONTS.texto,
          backgroundColor: BRAND.cremaClara,
          color: BRAND.texto,
        },
        "::selection": { backgroundColor: alpha(BRAND.arena, 0.35) },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: "9px 22px",
          transition: "background-color .2s ease, border-color .2s ease, color .2s ease",
        },
        sizeSmall: { padding: "5px 14px" },
        containedPrimary: {
          backgroundColor: BRAND.oro,
          "&:hover": { backgroundColor: BRAND.oroOscuro },
        },
        outlined: {
          borderWidth: 1,
          "&:hover": { borderWidth: 1 },
        },
        outlinedPrimary: {
          borderColor: alpha(BRAND.oro, 0.45),
          "&:hover": { borderColor: BRAND.oro, backgroundColor: alpha(BRAND.oro, 0.05) },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { "&:hover": { backgroundColor: alpha(BRAND.oro, 0.08) } },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: `1px solid ${BRAND.borde}`,
          boxShadow: "0 1px 2px rgba(92,60,18,0.04), 0 8px 24px -16px rgba(92,60,18,0.25)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 14, backgroundImage: "none" },
        elevation1: { boxShadow: "0 1px 2px rgba(92,60,18,0.04), 0 8px 24px -16px rgba(92,60,18,0.25)" },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: BRAND.blanco,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(163,105,32,0.22)" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: BRAND.arena },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: BRAND.oro, borderWidth: 1.5 },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: BRAND.textoSuave, "&.Mui-focused": { color: BRAND.oro } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, borderRadius: 8 },
        outlinedPrimary: { borderColor: alpha(BRAND.oro, 0.4) },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: BRAND.crema,
            color: BRAND.oroOscuro,
            fontWeight: 600,
            fontSize: "0.75rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            borderBottom: `1px solid ${BRAND.bordeFuerte}`,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: "1px solid rgba(163,105,32,0.10)" },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { "&:hover": { backgroundColor: alpha(BRAND.crema, 0.6) } },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, "&.Mui-selected": { color: BRAND.oro } },
      },
    },
    MuiTabs: {
      styleOverrides: { indicator: { backgroundColor: BRAND.oro, height: 2 } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 18, border: `1px solid ${BRAND.borde}` },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: FONTS.titulo,
          fontWeight: 400,
          letterSpacing: "0.05em",
          color: BRAND.oro,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, fontWeight: 500 },
        filledSuccess: { backgroundColor: BRAND.oro },
        filledInfo: { backgroundColor: BRAND.texto },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: BRAND.texto, fontSize: "0.75rem", borderRadius: 8 },
      },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { backgroundColor: alpha(BRAND.arena, 0.2) } },
    },
  },
});

export default theme;
