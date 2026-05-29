import type { TrainOption, TrainStatus, OperatorCode } from './stations'

export function formatTime(iso: string): string {
  if (!iso) return '--:--'
  if (/^\d{2}:\d{2}$/.test(iso)) return iso
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export function formatDuration(mins?: number): string {
  if (!mins) return '?m'
  return `${mins}m`
}

export function operatorLabel(op: OperatorCode): string {
  if (op === 'Elizabeth') return 'ELZ'
  return op
}

export function statusLabel(train: TrainOption): string {
  if (train.status === 'on_time') return 'On time'
  if (train.status === 'delayed') return `+${train.delayMinutes ?? '?'}m`
  if (train.status === 'cancelled') return 'Cancelled'
  return 'Unknown'
}

export function deriveStatus(
  scheduledDep: string,
  estimatedDep: string
): { status: TrainStatus; delayMinutes: number } {
  if (!estimatedDep || estimatedDep === 'On time' || estimatedDep === scheduledDep) {
    return { status: 'on_time', delayMinutes: 0 }
  }
  if (estimatedDep === 'Cancelled') {
    return { status: 'cancelled', delayMinutes: 0 }
  }
  try {
    const [sh, sm] = scheduledDep.split(':').map(Number)
    const [eh, em] = estimatedDep.split(':').map(Number)
    const diff = (eh * 60 + em) - (sh * 60 + sm)
    if (diff > 0) return { status: 'delayed', delayMinutes: diff }
    return { status: 'on_time', delayMinutes: 0 }
  } catch {
    return { status: 'unknown', delayMinutes: 0 }
  }
}

export function nowTimestamp(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}
