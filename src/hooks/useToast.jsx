import React, { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext({ showToast: () => {} })

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const showToast = useCallback((message, duration = 2500) => {
    clearTimeout(timer.current)
    setToast(message)
    timer.current = setTimeout(() => setToast(null), duration)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <div className="toast" role="status">{toast}</div>}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
