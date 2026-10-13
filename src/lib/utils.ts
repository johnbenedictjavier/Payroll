import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
    Number.isFinite(amount) ? amount : 0,
  )
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? 'Invalid date'
    : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date)
}

export function initials(name: string | null | undefined) {
  return (name ?? 'User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function titleCase(value: string | null | undefined) {
  return (value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getTimeGreeting(date = new Date(), timeZone = 'Asia/Manila') {
  const hour = Number(new Intl.DateTimeFormat('en-PH', { hour: '2-digit', hour12: false, timeZone }).format(date))
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function formatToday(date = new Date(), timeZone = 'Asia/Manila') {
  return new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone }).format(date)
}
