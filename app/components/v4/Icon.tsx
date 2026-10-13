import {
  Activity, AlertTriangle, Archive, ArrowLeftRight, BarChart3, Bell, BookOpen, Building2, Camera, CheckCheck,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Clock, CreditCard, Database, Download, Eye, EyeOff,
  FileText, Fingerprint, Grid3x3, HelpCircle, History, Info, KeyRound, Landmark, Laptop, LayoutDashboard, List,
  Lock, LogOut, Mail, Menu, Monitor, Moon, PenLine, PenTool, Phone, Plus, Printer, QrCode, RotateCcw, Route, Scale,
  Search, Send, Settings, ShieldCheck, Shuffle, SlidersVertical, Smartphone, Sun, TrendingUp, Upload, UserRound,
  Users, Wallet, XCircle, type LucideIcon,
} from "lucide-react";

/**
 * ReqGen v4 icon set. The approved mock-ups were drawn with the same Lucide
 * outlines, so every icon here matches its mock-up stroke for stroke.
 */
const ICONS: Record<string, LucideIcon> = {
  activity: Activity, alert: AlertTriangle, archive: Archive, arrows: ArrowLeftRight, chart: BarChart3, bell: Bell,
  book: BookOpen, building: Building2, camera: Camera, checkall: CheckCheck, check: CheckCircle2, tick: Check, chevron: ChevronDown, left: ChevronLeft,
  right: ChevronRight, audit: ClipboardCheck, clock: Clock, card: CreditCard, database: Database, download: Download,
  eye: Eye, eyeoff: EyeOff, file: FileText, fingerprint: Fingerprint, grid: Grid3x3, help: HelpCircle,
  history: History, info: Info, key: KeyRound, landmark: Landmark, laptop: Laptop, dashboard: LayoutDashboard,
  list: List, lock: Lock, logout: LogOut, mail: Mail, menu: Menu, monitor: Monitor, moon: Moon, pen: PenLine,
  pentool: PenTool, phone: Phone, plus: Plus, printer: Printer, qr: QrCode, returned: RotateCcw, route: Route,
  scale: Scale, search: Search, send: Send, settings: Settings, shield: ShieldCheck, shuffle: Shuffle,
  admin: SlidersVertical, smartphone: Smartphone, sun: Sun, trend: TrendingUp, upload: Upload, user: UserRound,
  users: Users, wallet: Wallet, x: XCircle,
};

export type IconName = keyof typeof ICONS;

export default function Icon({ name, size = "md", className = "", label }: { name: string; size?: "sm" | "md" | "lg"; className?: string; label?: string }) {
  const Glyph = ICONS[name] || Info;
  const cls = ["v4-icon", size === "sm" ? "v4-icon-sm" : size === "lg" ? "v4-icon-lg" : "", className].filter(Boolean).join(" ");
  return <Glyph className={cls} strokeWidth={1.8} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined} />;
}
