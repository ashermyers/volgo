import { createFileRoute } from '@tanstack/react-router'
import { useSignIn } from '@clerk/tanstack-react-start/legacy'
import { useEffect, useRef } from 'react'
import { Spinner } from '#/components/ui/spinner'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { isLoaded, signIn } = useSignIn()
  const started = useRef(false)

  useEffect(() => {
    if (!isLoaded || !signIn || started.current) return

    started.current = true

    void (async () => {
      try {
        const result = await signIn.create({
          strategy: 'oauth_google',
          redirectUrl: '/sso-callback',
          actionCompleteRedirectUrl: '/',
        })

        const redirect =
          result.firstFactorVerification.externalVerificationRedirectURL

        if (!redirect) {
          throw new Error('Clerk did not return an OAuth redirect URL')
        }

        const url = new URL(redirect.toString())

        url.searchParams.set('hd', 'vt.edu')

        console.log('OAuth redirect:', url.toString())

        window.location.assign(url.toString())
      } catch (error) {
        started.current = false
        console.error('Failed to start Google OAuth:', error)
      }
    })()
  }, [isLoaded, signIn])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8 text-primary" />
    </div>
  )
}