import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSoles(value: number | string) {
  const amount = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(amount)) return 'S/ 0.00'
  return `S/ ${amount.toFixed(2)}`
}
