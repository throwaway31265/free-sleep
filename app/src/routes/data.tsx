import { createFileRoute, Outlet } from '@tanstack/react-router'
import DataPage from '@/pages/DataPage/DataPage'

export const Route = createFileRoute('/data')({
  component: DataPage,
})