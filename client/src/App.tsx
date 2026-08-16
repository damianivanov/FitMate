import { useEffect } from 'react'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from 'sonner'
import { router } from '@/routes'
import { useUserStore } from '@/stores/userStore'

function AppBootstrap() {
  return (
    <div className="app-bootstrap" role="status" aria-live="polite">
      <div className="app-bootstrap-content">
        <div className="app-bootstrap-logo" aria-hidden="true">
          Fit<span>Mate</span>
        </div>
        <span className="app-bootstrap-progress" aria-hidden="true" />
        <span className="app-bootstrap-status">Loading FitMate</span>
      </div>
    </div>
  )
}

export default function App() {
  const { initUser, userLoaded } = useUserStore()

  useEffect(() => {
    void initUser()
  }, [initUser])

  if (!userLoaded) {
    return <AppBootstrap />
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors duration={2000} />
    </>
  )
}
