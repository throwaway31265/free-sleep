import { createFileRoute } from '@tanstack/react-router'
import LogsPage from './data/LogsPage/LogsPage'

export const Route = createFileRoute('/data/logs')({
  component: LogsPage,
})