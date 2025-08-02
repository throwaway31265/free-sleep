import { createFileRoute } from '@tanstack/react-router'
import BaseControlPage from './base-control/BaseControlPage'

export const Route = createFileRoute('/base-control')({
  component: BaseControlPage,
})