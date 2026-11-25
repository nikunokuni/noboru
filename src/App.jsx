import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './hooks/useToast'
import { ShrineIndexProvider } from './hooks/useShrineIndex'
import { PendingRecordsProvider } from './hooks/usePendingRecords'
import { WishesProvider } from './hooks/useWishes'
import BottomNav from './components/BottomNav'
import UpdateBanner from './components/UpdateBanner'
import RecordPage from './pages/RecordPage'
import CommunityPage from './pages/CommunityPage'
import RecordsPage from './pages/RecordsPage'
import RecordDetailPage from './pages/RecordDetailPage'
import ShrinePage from './pages/ShrinePage'
import ShrineEditPage from './pages/ShrineEditPage'
import ShrineRequestPage from './pages/ShrineRequestPage'
import ProfilePage from './pages/ProfilePage'
import FeedbackPage from './pages/FeedbackPage'
import SupportPage from './pages/SupportPage'
import CollectionPage from './pages/CollectionPage'
import DeityListPage from './pages/DeityListPage'
import DeityDetailPage from './pages/DeityDetailPage'

// 地図ライブラリは大きいので、マップを開いたときに読み込む
const MapPage = lazy(() => import('./pages/MapPage'))
// 管理者しか使わないので、開いたときに読み込む
const AdminRequestsPage = lazy(() => import('./pages/AdminRequestsPage'))
const AdminEditsPage = lazy(() => import('./pages/AdminEditsPage'))
const AdminFeedbackPage = lazy(() => import('./pages/AdminFeedbackPage'))
const AdminNicknamesPage = lazy(() => import('./pages/AdminNicknamesPage'))
const AdminArticlesPage = lazy(() => import('./pages/AdminArticlesPage'))

// 「記録する」はマップに入った。/ はマップへ。以前の「/?shrine=ID」（記録画面がホームだったころ）は記録画面へ
function HomeRedirect() {
  const { search } = useLocation()
  const legacy = new URLSearchParams(search).get('shrine')
  return <Navigate to={legacy ? `/record/${legacy}` : '/map'} replace />
}

// 「探す」はマップに入った。以前のリンク（/search?deity=…）はマップの検索へ
function SearchRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/map${search}`} replace />
}

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
          <WishesProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<TabLayout />}>
                  <Route path="/map" element={<Suspense fallback={<div className="app-shell"><div className="spinner mt24" /></div>}><MapPage /></Suspense>} />
                  <Route path="/community" element={<CommunityPage />} />
                  <Route path="/records" element={<RecordsPage />} />
                  <Route path="/collection" element={<CollectionPage />} />
                  <Route path="/collection/deities" element={<DeityListPage />} />
                  <Route path="/collection/deities/:name" element={<DeityDetailPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/search" element={<SearchRedirect />} />
                <Route path="/record/:shrineId" element={<RecordPage />} />
                <Route path="/records/:id" element={<RecordDetailPage />} />
                <Route path="/shrine/:id" element={<ShrinePage />} />
                <Route path="/shrine/:id/edit" element={<ShrineEditPage />} />
                <Route path="/request" element={<ShrineRequestPage />} />
                <Route path="/admin/requests" element={<Suspense fallback={<div className="app-shell"><div className="spinner mt24" /></div>}><AdminRequestsPage /></Suspense>} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/admin/nicknames" element={<Suspense fallback={<div className="app-shell"><div className="spinner mt24" /></div>}><AdminNicknamesPage /></Suspense>} />
                <Route path="/admin/feedback" element={<Suspense fallback={<div className="app-shell"><div className="spinner mt24" /></div>}><AdminFeedbackPage /></Suspense>} />
                <Route path="/admin/articles" element={<Suspense fallback={<div className="app-shell"><div className="spinner mt24" /></div>}><AdminArticlesPage /></Suspense>} />
                <Route path="/admin/edits" element={<Suspense fallback={<div className="app-shell"><div className="spinner mt24" /></div>}><AdminEditsPage /></Suspense>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
            <UpdateBanner />
          </WishesProvider>
          </PendingRecordsProvider>
        </ShrineIndexProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
