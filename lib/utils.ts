import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumberWithCommas(x: number | string) {
  if (typeof x === 'number') x = x.toString();
  return x.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
