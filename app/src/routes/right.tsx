import { createFileRoute } from '@tanstack/react-router'
import ControlTempPage from './temperature/ControlTempPage'

export const Route = createFileRoute('/right')({
  component: ControlTempPage,
})