import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import RecordsPage from './pages/RecordsPage'
import { SearchPage, ShrinePage } from './pages/ShrinePage'
import ProfilePage from './pages/ProfilePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<><HomePage /><BottomNav /></>} />
          <Route path="/records" element={<><RecordsPage /><BottomNav /></>} />
          <Route path="/search" element={<><SearchPage /><BottomNav /></>} />
          <Route path="/shrine/:id" element={<ShrinePage />} />
          <Route path="/profile" element={<><ProfilePage /><BottomNav /></>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
