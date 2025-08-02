import { createFileRoute } from '@tanstack/react-router'
import SettingsPage from '@/pages/SettingsPage/SettingsPage'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})