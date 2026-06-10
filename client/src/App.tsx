import { useEffect } from 'react'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from 'sonner'
import { router } from '@/routes'
import { useUserStore } from '@/stores/userStore'

export default function App() {
  const { initUser, userLoaded } = useUserStore()

  useEffect(() => {
    void initUser()
  }, [initUser])

  if (!userLoaded) {
    return <></>
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors duration={2000} />
    </>
  )
}
