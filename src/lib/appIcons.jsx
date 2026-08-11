import {
  Factory, ClipboardCheck, Wrench, Package, FileText, Gauge,
  ShieldCheck, Boxes, LayoutDashboard, Settings, Database, Cpu,
  HardHat, Truck, ClipboardList, BarChart3, Activity,
} from "lucide-react";

// Registro central de ícones disponíveis para as aplicações.
// Adicione novos sistemas aqui — não há código de aplicação duplicado, apenas uma chave visual.
export const APP_ICONS = {
  factory: Factory,
  clipboardCheck: ClipboardCheck,
  wrench: Wrench,
  package: Package,
  fileText: FileText,
  gauge: Gauge,
  shieldCheck: ShieldCheck,
  boxes: Boxes,
  dashboard: LayoutDashboard,
  settings: Settings,
  database: Database,
  cpu: Cpu,
  hardHat: HardHat,
  truck: Truck,
  clipboard: ClipboardList,
  barChart: BarChart3,
  activity: Activity,
};

export const APP_ICON_OPTIONS = Object.keys(APP_ICONS).map(k => ({ value: k, label: k }));

export const APP_COLORS = {
  blue:  { tile: "bg-blue-50 text-blue-700", ring: "ring-blue-200", btn: "bg-blue-700 hover:bg-blue-800" },
  green: { tile: "bg-green-50 text-green-700", ring: "ring-green-200", btn: "bg-green-700 hover:bg-green-800" },
  amber: { tile: "bg-amber-50 text-amber-700", ring: "ring-amber-200", btn: "bg-amber-600 hover:bg-amber-700" },
  purple:{ tile: "bg-purple-50 text-purple-700", ring: "ring-purple-200", btn: "bg-purple-700 hover:bg-purple-800" },
  cyan:  { tile: "bg-cyan-50 text-cyan-700", ring: "ring-cyan-200", btn: "bg-cyan-700 hover:bg-cyan-800" },
  red:   { tile: "bg-red-50 text-red-700", ring: "ring-red-200", btn: "bg-red-700 hover:bg-red-800" },
  slate: { tile: "bg-slate-100 text-slate-700", ring: "ring-slate-200", btn: "bg-slate-700 hover:bg-slate-800" },
};

export const APP_COLOR_OPTIONS = Object.keys(APP_COLORS).map(k => ({ value: k, label: k }));

export function getIcon(key) {
  return APP_ICONS[key] || Factory;
}

export function getColor(key) {
  return APP_COLORS[key] || APP_COLORS.blue;
}