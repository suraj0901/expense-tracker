import {
  UtensilsCrossed, Car, ShoppingBag, Zap, Home, Heart,
  GraduationCap, Clapperboard, Plane, ShoppingCart,
  Scissors, Gift, Smartphone, Package,
  type LucideIcon,
} from 'lucide-react';

const map: Record<string, LucideIcon> = {
  Food: UtensilsCrossed,
  Transport: Car,
  Shopping: ShoppingBag,
  'Bills & Utilities': Zap,
  Rent: Home,
  Health: Heart,
  Education: GraduationCap,
  Entertainment: Clapperboard,
  Travel: Plane,
  Groceries: ShoppingCart,
  'Personal Care': Scissors,
  Gifts: Gift,
  Subscriptions: Smartphone,
  Other: Package,
};

export function getCategoryIcon(category: string): LucideIcon {
  return map[category] ?? Package;
}
