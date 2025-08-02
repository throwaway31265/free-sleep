import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import Layout from '@/components/Layout'
import RouteErrorComponent from '@/components/RouteErrorComponent'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
  errorComponent: RouteErrorComponent,
})

function RootComponent() {
  return (
    <>
      <Layout />
      <TanStackRouterDevtools />
    </>
  )
}
