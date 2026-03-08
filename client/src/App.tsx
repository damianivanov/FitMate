import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes'
import { useUserStore } from '@/stores/userStore'

function App() {
  const initialize = useUserStore((state) => state.initialize)

  useEffect(() => {
    void initialize()
  }, [initialize])

  return <RouterProvider router={router} />
}

export default App
