import { createFileRoute } from '@tanstack/react-router'
import LogsPage from '@/pages/DataPage/LogsPage/LogsPage'

export const Route = createFileRoute('/data/logs')({
  component: LogsPage,
})