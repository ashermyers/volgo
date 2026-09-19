import { createFileRoute } from '@tanstack/react-router'
import { AuthenticateWithRedirectCallback } from '@clerk/tanstack-react-start'

export const Route = createFileRoute('/sso-callback')({
  component: SSOCallbackPage,
})

function SSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />
}