import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './hooks/useToast'
import { ShrineIndexProvider } from './hooks/useShrineIndex'
import { PendingRecordsProvider } from './hooks/usePendingRecords'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import RecordPage from './pages/RecordPage'
import SearchPage from './pages/SearchPage'
import RecordsPage from './pages/RecordsPage'
import RecordDetailPage from './pages/RecordDetailPage'
import ShrinePage from './pages/ShrinePage'
import ShrineEditPage from './pages/ShrineEditPage'
import ShrineRequestPage from './pages/ShrineRequestPage'
import ProfilePage from './pages/ProfilePage'
import FeedbackPage from './pages/FeedbackPage'

// 地図ライブラリは大きいので、マップを開いたときに読み込む
const MapPage = lazy(() => import('./pages/MapPage'))
// 管理者しか使わないので、開いたときに読み込む
const AdminRequestsPage = lazy(() => import('./pages/AdminRequestsPage'))
const AdminEditsPage = lazy(() => import('./pages/AdminEditsPage'))
const AdminFeedbackPage = lazy(() => import('./pages/AdminFeedbackPage'))
const AdminNicknamesPage = lazy(() => import('./pages/AdminNicknamesPage'))

// 下部タブのある画面
function TabLayout() {
  return <><Outlet /><BottomNav /></>
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ShrineIndexProvider>
          <PendingRecordsProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<TabLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/map" element={<Suspense fallback={<div className="app-shell"><div className="spinner mt24" /></div>}><MapPage /></Suspense>} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/records" element={<RecordsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>
                <Route path="/record/:shrineId" element={<RecordPage />} />
                <Route path="/records/:id" element={<RecordDetailPage />} />
                <Route path="/shrine/:id" element={<ShrinePage />} />
                <Route path="/shrine/:id/edit" element={<ShrineEditPage />} />
                <Route path="/request" element={<ShrineRequestPage />} />
                <Route path="/admin/requests" element={<Suspense fallback={<div className="app-shell"><div className="spinner mt24" /></div>}><AdminRequestsPage /></Suspense>} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/admin/nicknames" element={<Suspense fallback={<div className="app-shell"><div className="spinner mt24" /></div>}><AdminNicknamesPage /></Suspense>} />
                <Route path="/admin/feedback" element={<Suspense fallback={<div className="app-shell"><div className="spinner mt24" /></div>}><AdminFeedbackPage /></Suspense>} />
                <Route path="/admin/edits" element={<Suspense fallback={<div className="app-shell"><div className="spinner mt24" /></div>}><AdminEditsPage /></Suspense>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </PendingRecordsProvider>
        </ShrineIndexProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
