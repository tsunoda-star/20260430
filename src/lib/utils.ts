import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classnames — clsx + tailwind-merge.
 * Always use this in components instead of string concatenation.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
