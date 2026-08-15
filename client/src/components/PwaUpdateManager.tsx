import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
const UPDATE_TOAST_ID = 'pwa-update-ready'

function handleServiceWorkerError(error: unknown) {
  console.error('Unable to register the service worker.', error)
}

export function PwaUpdateManager() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>()

  function handleServiceWorkerRegistered(
    _serviceWorkerUrl: string,
    nextRegistration: ServiceWorkerRegistration | undefined,
  ) {
    setRegistration(nextRegistration)
  }

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW: handleServiceWorkerRegistered,
    onRegisterError: handleServiceWorkerError,
  })

  useEffect(() => {
    if (!needRefresh) {
      return
    }

    function handleUpdate() {
      toast.dismiss(UPDATE_TOAST_ID)
      void updateServiceWorker(true)
    }

    function handleUpdateLater() {
      setNeedRefresh(false)
      toast.dismiss(UPDATE_TOAST_ID)
    }

    toast.info('A new FitMate version is ready.', {
      id: UPDATE_TOAST_ID,
      description: 'Reload when you are ready to use the latest version.',
      duration: Infinity,
      action: {
        label: 'Reload',
        onClick: handleUpdate,
      },
      cancel: {
        label: 'Later',
        onClick: handleUpdateLater,
      },
    })

    return () => {
      toast.dismiss(UPDATE_TOAST_ID)
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker])

  useEffect(() => {
    if (!registration) {
      return
    }

    const serviceWorkerRegistration = registration

    async function checkForUpdate() {
      if (serviceWorkerRegistration.waiting) {
        setNeedRefresh(true)
        return
      }

      if (!navigator.onLine || serviceWorkerRegistration.installing) {
        return
      }

      try {
        await serviceWorkerRegistration.update()
      } catch (error) {
        console.error('Unable to check for a FitMate update.', error)
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void checkForUpdate()
      }
    }

    function handleOnline() {
      void checkForUpdate()
    }

    const intervalId = window.setInterval(() => {
      void checkForUpdate()
    }, UPDATE_CHECK_INTERVAL_MS)

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [registration, setNeedRefresh])

  return null
}
