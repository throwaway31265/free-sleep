import { createFileRoute } from '@tanstack/react-router'
import BaseControlPage from '@/pages/BaseControlPage/BaseControlPage'

export const Route = createFileRoute('/base-control')({
  component: BaseControlPage,
})