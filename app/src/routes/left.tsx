import { createFileRoute } from '@tanstack/react-router'
import ControlTempPage from '@/pages/ControlTempPage/ControlTempPage'

export const Route = createFileRoute('/left')({
  component: ControlTempPage,
})