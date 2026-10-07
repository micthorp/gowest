import type { TrainOption, TrainStatus, OperatorCode } from './stations'
import { advertisedTimeToHHMM } from './time'

export function formatTime(iso: string): string {
  if (!iso) return '--:--'
  return advertisedTimeToHHMM(iso) || iso
}

export function formatDuration(mins?: number): string {
  if (mins == null) return '?m'
  return `${mins}m`
}

export function operatorLabel(op: OperatorCode): string {
  if (op === 'Elizabeth') return 'ELZ'
  if (op === 'Chiltern') return 'CHL'
  return op
}

export function operatorClass(op: OperatorCode): string {
  if (op === 'GWR') return 'op-gwr'
  if (op === 'Chiltern') return 'op-chil'
  return 'op-eliz'
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
