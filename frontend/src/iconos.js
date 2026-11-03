/**
 * Íconos de ShowClinic.
 *
 * Toda la app usa una sola familia: Lucide, de línea fina, que acompaña a la
 * tipografía Amoret mejor que los íconos rellenos de Material. Este módulo los
 * exporta con los mismos nombres que tenían en @mui/icons-material, y se
 * comportan igual: aceptan sx, fontSize ("small" | "medium" | "large" |
 * "inherit"), color ("primary", "error", …), className, onClick, etc.
 *
 * Para un ícono nuevo: elegirlo en https://lucide.dev y agregarlo abajo.
 */
import React from "react";
import Box from "@mui/material/Box";
import * as L from "lucide-react";

const TAMANOS = { small: "1.25rem", medium: "1.5rem", large: "2.1875rem", inherit: "inherit" };
const COLORES_TEMA = ["primary", "secondary", "error", "warning", "info", "success"];

const colorDeTema = (color) => {
  if (!color || color === "inherit") return undefined;
  if (COLORES_TEMA.includes(color)) return `${color}.main`;
  if (color === "action") return "action.active";
  if (color === "disabled") return "action.disabled";
  return color;
};

// Algunos íconos de Material eran rellenos y su significado depende de ello
// (una estrella marcada, un corazón): esos se dibujan con relleno suave.
const crear = (Icono, { relleno = false } = {}) => {
  const Componente = React.forwardRef(function IconoShowClinic(
    { fontSize = "medium", color, sx, titleAccess, strokeWidth = 1.75, ...resto },
    ref
  ) {
    return (
      <Box
        ref={ref}
        component={Icono}
        width="1em"
        height="1em"
        strokeWidth={strokeWidth}
        aria-hidden={titleAccess ? undefined : true}
        aria-label={titleAccess}
        role={titleAccess ? "img" : undefined}
        {...(relleno ? { fill: "currentColor", fillOpacity: 0.18 } : {})}
        {...resto}
        sx={[
          {
            fontSize: TAMANOS[fontSize] || fontSize,
            flexShrink: 0,
            display: "inline-block",
            verticalAlign: "middle",
            userSelect: "none",
            color: colorDeTema(color),
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      />
    );
  });
  // Así Button, Chip, InputAdornment, etc. lo tratan como un ícono de MUI
  Componente.muiName = "SvgIcon";
  return Componente;
};

/* ───────── Personas ───────── */
export const People = crear(L.Users);
export const PeopleAltRounded = People;
export const Groups = People;
export const GroupsRounded = People;
export const Person = crear(L.User);
export const PersonRounded = Person;
export const PersonOutline = crear(L.UserRound);
export const PersonAdd = crear(L.UserPlus);
export const PersonOffRounded = crear(L.UserX);
export const SupervisorAccount = crear(L.UserCog);
export const Badge = crear(L.Stethoscope);
export const Face = crear(L.Smile);

/* ───────── Clínica y tratamientos ───────── */
export const MedicalServices = crear(L.Syringe);
export const LocalHospital = crear(L.CalendarHeart);
export const Spa = crear(L.Flower2);
export const ScienceRounded = crear(L.FlaskConical);
export const FitnessCenter = crear(L.Dumbbell);
export const AutoAwesome = crear(L.Sparkles);
export const CenterFocusStrong = crear(L.Focus);
export const Favorite = crear(L.Heart, { relleno: true });
export const Star = crear(L.Star, { relleno: true });
export const EmojiEvents = crear(L.Trophy);
export const HandshakeRounded = crear(L.Handshake);
export const Crown = crear(L.Crown);

/* ───────── Inventario ───────── */
export const Inventory = crear(L.Package);
export const Inventory2 = Inventory;
export const Inventory2Rounded = Inventory;
export const Category = crear(L.Shapes);
export const CategoryRounded = Category;
export const LocalOffer = crear(L.Tag);
export const QrCode2 = crear(L.QrCode);
export const QrCode2Rounded = QrCode2;
export const QrCodeScanner = crear(L.ScanLine);

/* ───────── Dinero ───────── */
export const AccountBalance = crear(L.Landmark);
export const AccountBalanceWallet = crear(L.Wallet);
export const AttachMoney = crear(L.Banknote);
export const Paid = AttachMoney;
export const PaidRounded = AttachMoney;
export const PaymentsRounded = AttachMoney;
export const MonetizationOn = crear(L.CircleDollarSign);
export const MoneyOff = crear(L.HandCoins);
export const Payment = crear(L.CreditCard);
export const CreditCard = Payment;
export const PointOfSale = crear(L.Calculator);
export const Receipt = crear(L.Receipt);
export const ReceiptLongRounded = crear(L.ReceiptText);
export const Percent = crear(L.Percent);
export const PercentRounded = Percent;
export const CardGiftcard = crear(L.Gift);
export const ShoppingCart = crear(L.ShoppingCart);
export const AddShoppingCart = ShoppingCart;
export const RemoveShoppingCart = ShoppingCart;
export const TrendingUp = crear(L.TrendingUp);
export const TrendingDown = crear(L.TrendingDown);

/* ───────── Reportes ───────── */
export const Insights = crear(L.ChartLine);
export const InsightsRounded = Insights;
export const Assessment = crear(L.ChartColumn);
export const BarChart = Assessment;
export const Assignment = crear(L.ClipboardList);
export const FactCheckRounded = crear(L.ListChecks);
export const SpaceDashboardRounded = crear(L.LayoutDashboard);

/* ───────── Fechas y tiempo ───────── */
export const CalendarMonth = crear(L.CalendarDays);
export const CalendarMonthRounded = CalendarMonth;
export const CalendarToday = crear(L.Calendar);
export const Today = crear(L.CalendarCheck2);
export const DateRange = crear(L.CalendarRange);
export const EventNote = crear(L.CalendarCheck);
export const EventRepeatRounded = crear(L.CalendarClock);
export const AccessTime = crear(L.Clock);
export const AccessTimeRounded = AccessTime;
export const Schedule = AccessTime;
export const PendingActionsRounded = crear(L.Hourglass);
export const History = crear(L.History);
export const Cake = crear(L.Cake);
export const CakeRounded = Cake;

/* ───────── Documentos y archivos ───────── */
export const Description = crear(L.FileText);
export const DescriptionOutlined = Description;
export const DescriptionRounded = Description;
export const PictureAsPdf = crear(L.FileDown);
export const Download = crear(L.Download);
export const FileDownload = Download;
export const CloudUploadRounded = crear(L.CloudUpload);
export const Backup = crear(L.DatabaseBackup);
export const Print = crear(L.Printer);
export const Save = crear(L.Save);
export const SaveRounded = Save;

/* ───────── Imágenes y video ───────── */
export const PhotoCamera = crear(L.Camera);
export const PhotoCameraRounded = PhotoCamera;
export const PhotoLibrary = crear(L.Images);
export const ImageRounded = crear(L.Image);
export const ImageNotSupportedRounded = crear(L.ImageOff);
export const AddPhotoAlternateRounded = crear(L.ImagePlus);
export const VideoLibrary = crear(L.Clapperboard);
export const VideoLibraryRounded = VideoLibrary;
export const MovieRounded = crear(L.Film);
export const PlayArrow = crear(L.Play);
export const PlayArrowRounded = PlayArrow;
export const PauseRounded = crear(L.Pause);
export const CompareRounded = crear(L.GitCompareArrows);

/* ───────── Contacto ───────── */
export const Phone = crear(L.Phone);
export const PhoneRounded = Phone;
export const PhoneIphone = crear(L.Smartphone);
export const LocationOnOutlined = crear(L.MapPin);

/* ───────── Acciones ───────── */
export const Add = crear(L.Plus);
export const AddRounded = Add;
export const AddCircle = crear(L.CirclePlus);
export const Remove = crear(L.Minus);
export const Edit = crear(L.Pencil);
export const EditRounded = Edit;
export const Delete = crear(L.Trash2);
export const DeleteForever = Delete;
export const DeleteOutlineRounded = Delete;
export const DeleteSweep = Delete;
export const Search = crear(L.Search);
export const SearchRounded = Search;
export const SearchOff = crear(L.SearchX);
export const ZoomIn = crear(L.ZoomIn);
export const FilterList = crear(L.Filter);
export const Tune = crear(L.SlidersHorizontal);
export const TuneRounded = Tune;
export const SortByAlpha = crear(L.ArrowDownAZ);
export const SwapVert = crear(L.ArrowUpDown);
export const SwapHorizRounded = crear(L.ArrowLeftRight);
export const Refresh = crear(L.RefreshCw);
export const UndoRounded = crear(L.Undo2);
export const OpenInNew = crear(L.ExternalLink);
export const OpenInFullRounded = crear(L.Expand);
export const Fullscreen = crear(L.Maximize2);
export const Settings = crear(L.Settings);
export const LogoutRounded = crear(L.LogOut);
export const FlagRounded = crear(L.Flag);

/* ───────── Estados ───────── */
export const Check = crear(L.Check);
export const CheckRounded = Check;
export const CheckCircle = crear(L.CircleCheck);
export const CheckCircleOutline = CheckCircle;
export const CheckCircleRounded = CheckCircle;
export const Cancel = crear(L.CircleX);
export const HighlightOff = Cancel;
export const RadioButtonUncheckedRounded = crear(L.Circle);
export const Warning = crear(L.TriangleAlert);
export const WarningAmberOutlined = Warning;
export const WarningAmberRounded = Warning;
export const ErrorOutlineRounded = crear(L.CircleAlert);
export const NotificationsActiveRounded = crear(L.BellRing);

/* ───────── Seguridad ───────── */
export const Lock = crear(L.Lock);
export const LockOutlined = crear(L.LockKeyhole);
export const LockOpen = crear(L.LockOpen);
export const Shield = crear(L.Shield);
export const VerifiedUser = crear(L.ShieldCheck);
export const AdminPanelSettings = VerifiedUser;
export const VpnKey = crear(L.KeyRound);
export const Visibility = crear(L.Eye);
export const VisibilityRounded = Visibility;
export const VisibilityOff = crear(L.EyeOff);
export const VisibilityOffRounded = VisibilityOff;

/* ───────── Navegación ───────── */
export const ArrowBack = crear(L.ArrowLeft);
export const Home = crear(L.House);
export const HomeRounded = Home;
export const Menu = crear(L.Menu);
export const Close = crear(L.X);
export const CloseRounded = Close;
export const ChevronLeft = crear(L.ChevronLeft);
export const ChevronLeftRounded = ChevronLeft;
export const ChevronRight = crear(L.ChevronRight);
export const ChevronRightRounded = ChevronRight;
export const ExpandMore = crear(L.ChevronDown);
export const ExpandMoreRounded = ExpandMore;
export const KeyboardArrowDown = ExpandMore;
export const ExpandLess = crear(L.ChevronUp);
export const KeyboardArrowUp = ExpandLess;
export const ViewListRounded = crear(L.List);
export const ViewModuleRounded = crear(L.LayoutGrid);
