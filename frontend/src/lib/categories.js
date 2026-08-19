import {
  Briefcase,
  BookOpen,
  HeartPulse,
  GraduationCap,
  ClipboardList,
  User,
  Sparkles,
} from "lucide-react";

// Each category maps to a CSS variable pair (--<token>, --<token>-soft) defined in index.css
export const CATEGORIES = {
  trabajo: { label: "Trabajo", icon: Briefcase, token: "signal" },
  estudio: { label: "Estudio", icon: GraduationCap, token: "violet" },
  salud: { label: "Salud", icon: HeartPulse, token: "mint" },
  lectura: { label: "Lectura", icon: BookOpen, token: "sky" },
  personal: { label: "Personal", icon: User, token: "coral" },
  organizar: { label: "Organizar", icon: ClipboardList, token: "ink-faint" },
  otro: { label: "Otro", icon: Sparkles, token: "ink-faint" },
};

export function categoryMeta(key) {
  return CATEGORIES[key] || CATEGORIES.otro;
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([value, v]) => ({
  value,
  label: v.label,
}));
