import { createFileRoute } from '@tanstack/react-router'
import SleepPage from './data/SleepPage/SleepPage'

export const Route = createFileRoute('/data/sleep')({
  component: SleepPage,
})