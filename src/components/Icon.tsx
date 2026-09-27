import {
  AlertCircle, AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Baby, BarChart3, BookOpen, Briefcase, CalendarDays,
  CalendarRange, Car, CircleDashed, Coffee, Dumbbell, FileText, Fuel, Gamepad2, Gauge, Gift, GraduationCap, HandHeart, HeartPulse,
  Home, Info, Landmark, LayoutDashboard, ListChecks, PawPrint, PieChart, PiggyBank, Plane, Receipt, Repeat, Settings, Shirt,
  ShoppingCart, Smartphone, Sparkles, Tags, Target, TrendingDown, TrendingUp, UtensilsCrossed, Wallet, Wrench, Zap, BrainCircuit,
  MessageSquareText, type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  AlertCircle, AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Baby, BarChart3, BookOpen, Briefcase, CalendarDays,
  CalendarRange, Car, CircleDashed, Coffee, Dumbbell, FileText, Fuel, Gamepad2, Gauge, Gift, GraduationCap, HandHeart, HeartPulse,
  Home, Info, Landmark, LayoutDashboard, ListChecks, PawPrint, PieChart, PiggyBank, Plane, Receipt, Repeat, Settings, Shirt,
  ShoppingCart, Smartphone, Sparkles, Tags, Target, TrendingDown, TrendingUp, UtensilsCrossed, Wallet, Wrench, Zap, BrainCircuit,
  MessageSquareText,
};

export function Icon({ name, size = 18, className, strokeWidth = 1.9 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  const C = MAP[name] ?? CircleDashed;
  return <C size={size} className={className} strokeWidth={strokeWidth} aria-hidden />;
}
