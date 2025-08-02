import { createFileRoute } from '@tanstack/react-router'
import VitalsPage from './data/VitalsPage/VitalsPage'

export const Route = createFileRoute('/data/vitals')({
  component: VitalsPage,
})