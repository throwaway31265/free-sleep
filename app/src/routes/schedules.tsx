import { createFileRoute } from '@tanstack/react-router'
import SchedulePage from './schedules/SchedulePage'

export const Route = createFileRoute('/schedules')({
  component: SchedulePage,
})