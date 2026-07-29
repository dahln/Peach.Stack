import './AppLayout.css'
import { ToastContainer } from 'react-toastify'
import { useLocation } from 'react-router'
import LoadingOverlay from './LoadingOverlay'
import TopNavigation from './TopNavigation'

/**
 * The persistent application shell that wraps every page in the app.
 *
 * Structure (top to bottom):
 *  1. TopNavigation   -  sticky navbar with auth-aware links.
 *  2. LoadingOverlay  -  full-viewport spinner shown during API requests.
 *  3. Page Content    -  fluid Bootstrap Container that slots in the matched route.
 *  4. ToastContainer  -  toast notification host anchored to bottom-left.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The currently matched page component.
 */
export default function AppLayout({ children }) {
  const currentLocation = useLocation()
  const isPublicShareView = currentLocation.pathname.startsWith('/share/')

  return (
    <div className="app-shell">
      {/* Sticky top navigation bar with links and user info. */}
      {!isPublicShareView && <TopNavigation />}

      {/* Full-page loading overlay  -  renders nothing when no requests are active. */}
      <LoadingOverlay />

      {/* Main content area with shared page padding around all routed pages. */}
      <main className="app-content">{children}</main>

      {/* Toast notifications appear here; autoClose=8000ms gives users time to read them. */}
      <ToastContainer position="bottom-left" autoClose={8000} newestOnTop />
    </div>
  )
}
