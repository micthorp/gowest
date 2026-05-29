import type { TrainOption } from './stations'

export const MOCK_TRAINS: Record<string, TrainOption[]> = {
  'ZFD-MAI': [
    { id: 'm1', operator: 'GWR', from: 'PAD', to: 'MAI', scheduledDeparture: '17:42', estimatedDeparture: '17:42', scheduledArrival: '18:05', estimatedArrival: '18:05', durationMinutes: 23, platform: '10', status: 'on_time', isFast: true },
    { id: 'm2', operator: 'Elizabeth', from: 'ZFD', to: 'MAI', scheduledDeparture: '17:44', estimatedDeparture: '17:48', scheduledArrival: '18:37', estimatedArrival: '18:41', durationMinutes: 53, platform: '6', status: 'delayed', delayMinutes: 4, isFast: false },
    { id: 'm3', operator: 'GWR', from: 'PAD', to: 'MAI', scheduledDeparture: '17:52', estimatedDeparture: '17:52', scheduledArrival: '18:16', estimatedArrival: '18:16', durationMinutes: 24, platform: 'TBC', status: 'on_time', isFast: true },
    { id: 'm4', operator: 'Elizabeth', from: 'ZFD', to: 'MAI', scheduledDeparture: '18:02', estimatedDeparture: '18:02', scheduledArrival: '18:49', estimatedArrival: '18:49', durationMinutes: 47, platform: '5', status: 'on_time', isFast: false },
    { id: 'm5', operator: 'GWR', from: 'PAD', to: 'MAI', scheduledDeparture: '18:12', estimatedDeparture: '18:12', scheduledArrival: '18:34', estimatedArrival: '18:34', durationMinutes: 22, platform: '9', status: 'on_time', isFast: true },
  ],
  'ZFD-RDG': [
    { id: 'r1', operator: 'GWR', from: 'PAD', to: 'RDG', scheduledDeparture: '17:45', estimatedDeparture: '17:45', scheduledArrival: '18:17', estimatedArrival: '18:17', durationMinutes: 32, platform: '3', status: 'on_time', isFast: true },
    { id: 'r2', operator: 'Elizabeth', from: 'ZFD', to: 'RDG', scheduledDeparture: '17:48', estimatedDeparture: '17:48', scheduledArrival: '19:01', estimatedArrival: '19:01', durationMinutes: 73, platform: '7', status: 'on_time', isFast: false },
    { id: 'r3', operator: 'GWR', from: 'PAD', to: 'RDG', scheduledDeparture: '18:00', estimatedDeparture: '18:06', scheduledArrival: '18:32', estimatedArrival: '18:38', durationMinutes: 32, platform: '2', status: 'delayed', delayMinutes: 6, isFast: true },
    { id: 'r4', operator: 'Elizabeth', from: 'ZFD', to: 'RDG', scheduledDeparture: '18:12', estimatedDeparture: '18:12', scheduledArrival: '19:17', estimatedArrival: '19:17', durationMinutes: 65, platform: '8', status: 'on_time', isFast: false },
  ],
  'MAI-PAD': [
    { id: 'l1', operator: 'GWR', from: 'MAI', to: 'PAD', scheduledDeparture: '17:38', estimatedDeparture: '17:38', scheduledArrival: '18:02', estimatedArrival: '18:02', durationMinutes: 24, platform: '1', status: 'on_time', isFast: true },
    { id: 'l2', operator: 'Elizabeth', from: 'MAI', to: 'ZFD', scheduledDeparture: '17:45', estimatedDeparture: '17:45', scheduledArrival: '18:38', estimatedArrival: '18:38', durationMinutes: 53, platform: '4', status: 'on_time', isFast: false },
    { id: 'l3', operator: 'GWR', from: 'MAI', to: 'PAD', scheduledDeparture: '17:52', estimatedDeparture: '17:52', scheduledArrival: '18:16', estimatedArrival: '18:16', durationMinutes: 24, platform: '2', status: 'on_time', isFast: true },
    { id: 'l4', operator: 'Elizabeth', from: 'MAI', to: 'PAD', scheduledDeparture: '18:00', estimatedDeparture: '18:03', scheduledArrival: '18:28', estimatedArrival: '18:31', durationMinutes: 28, platform: '4', status: 'delayed', delayMinutes: 3, isFast: false },
  ],
  'RDG-PAD': [
    { id: 'rl1', operator: 'GWR', from: 'RDG', to: 'PAD', scheduledDeparture: '17:35', estimatedDeparture: '17:35', scheduledArrival: '17:58', estimatedArrival: '17:58', durationMinutes: 23, platform: '5', status: 'on_time', isFast: true },
    { id: 'rl2', operator: 'GWR', from: 'RDG', to: 'PAD', scheduledDeparture: '17:50', estimatedDeparture: '17:50', scheduledArrival: '18:13', estimatedArrival: '18:13', durationMinutes: 23, platform: '7', status: 'on_time', isFast: true },
    { id: 'rl3', operator: 'Elizabeth', from: 'RDG', to: 'PAD', scheduledDeparture: '17:55', estimatedDeparture: '17:55', scheduledArrival: '18:42', estimatedArrival: '18:42', durationMinutes: 47, platform: '3', status: 'on_time', isFast: false },
  ],
}
