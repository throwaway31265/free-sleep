import { createFileRoute } from '@tanstack/react-router'
import SchedulePage from '@/pages/SchedulePage/SchedulePage'

export const Route = createFileRoute('/schedules')({
  component: SchedulePage,
})