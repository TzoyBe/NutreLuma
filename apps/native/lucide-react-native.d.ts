// Type shim: το εγκατεστημένο lucide-react-native δεν συνοδεύεται από τα δικά
// του δηλωτικά τύπων (λείπει το dist/types), οπότε δηλώνουμε τα icons που
// χρησιμοποιούμε ως React components με το τυπικό lucide props interface.
declare module 'lucide-react-native' {
  import type { ComponentType } from 'react';

  export interface LucideProps {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
    fill?: string;
  }

  export type LucideIcon = ComponentType<LucideProps>;

  export const BarChart3: LucideIcon;
  export const Bell: LucideIcon;
  export const CalendarDays: LucideIcon;
  export const Camera: LucideIcon;
  export const ChefHat: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const Droplet: LucideIcon;
  export const Flame: LucideIcon;
  export const Footprints: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const LineChart: LucideIcon;
  export const Plus: LucideIcon;
  export const Scale: LucideIcon;
  export const Settings: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Target: LucideIcon;
  export const TrendingDown: LucideIcon;
  export const Trophy: LucideIcon;
  export const UserCircle2: LucideIcon;
}
