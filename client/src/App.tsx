import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
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

  return <RouterProvider router={router} />
}
