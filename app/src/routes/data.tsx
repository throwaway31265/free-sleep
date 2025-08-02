import { createFileRoute, Outlet } from '@tanstack/react-router'
import DataPage from './data/DataPage'

export const Route = createFileRoute('/data')({
  component: DataPage,
})