import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function generateSkuCode(
  stoneType: string,
  shape: string,
  size: string,
  color: string,
  grade: string
): string {
  const t = stoneType.slice(0, 3).toUpperCase();
  const sh = shape.slice(0, 3).toUpperCase();
  const sz = size.replace("x", "X").toUpperCase();
  const c = color.slice(0, 3).toUpperCase();
  const g = grade.toUpperCase();
  return `${t}-${sh}-${sz}-${c}-${g}`;
}
