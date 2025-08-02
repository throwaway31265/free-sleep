import { createFileRoute } from '@tanstack/react-router'
import SleepPage from '@/pages/DataPage/SleepPage/SleepPage'

export const Route = createFileRoute('/data/sleep')({
  component: SleepPage,
})