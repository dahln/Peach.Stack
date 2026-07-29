import { Navigate } from 'react-router'
import { useAuth } from '../context/AuthContext'

/**
 * A route guard component that prevents unauthenticated (and optionally
 * non-admin) users from accessing a page.  Wrap any protected <Route>
 * element with this component in App.jsx.
 *
 * Behaviour:
 *  - While the auth state is still loading (initial session check), renders
 *    nothing so the page doesn't flash a redirect before the check finishes.
 *  - Redirects to "/" if the user is not logged in.
 *  - Redirects to "/" if requireAdmin is true but the user is not an admin.
 *  - Otherwise renders the child route content as normal.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The page component to render when access is granted.
 * @param {boolean} [props.requireAdmin=false] - When true, also requires the Administrator role.
 */
export default function ProtectedRoute({ children, requireAdmin = false }) {
  const authContext = useAuth()

  // The auth context is still performing the initial session check  -  render
  // nothing to avoid a premature redirect while cookies are being verified.
  if (authContext.isLoading) {
    return null
  }

  // User is not logged in  -  send them to the home page (which shows the login form).
  if (!authContext.isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // Page requires Administrator role but the user doesn't have it  -  redirect.
  if (requireAdmin && !authContext.isAdmin) {
    return <Navigate to="/" replace />
  }

  // All checks passed  -  render the protected page.
  return children
}
