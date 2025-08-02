import { createFileRoute } from '@tanstack/react-router'
import VitalsPage from '@/pages/DataPage/VitalsPage/VitalsPage'

export const Route = createFileRoute('/data/vitals')({
  component: VitalsPage,
})