import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'

// --- Page Imports -------------------------------------------------------------
import AccountPage from './pages/AccountPage'
import AdminPage from './pages/AdminPage'
import ConfirmEmailPage from './pages/ConfirmEmailPage'
import ConfirmEmailResendPage from './pages/ConfirmEmailResendPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import LogoutPage from './pages/LogoutPage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import CustomerPage from './pages/CustomerPage'
import CustomerSearchPage from './pages/CustomerSearchPage'

function ProtectedPage({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

function AdminPageRoute({ children }) {
  return <ProtectedRoute requireAdmin>{children}</ProtectedRoute>
}

/**
 * Root of the React component tree.
 *
 * Sets up the global providers (in order, outermost to innermost):
 *  1. BrowserRouter   -  client-side routing via the History API.
 *  2. AuthProvider    -  authentication state and account operations.
 *
 * All page routes are declared here in one place so the full site structure
 * is visible at a glance.
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* AppLayout renders the persistent top navbar and loading overlay,
            then slots the matched page component into its content area. */}
        <AppLayout>
          <Routes>
            {/* -- Home ------------------------------------------------------ */}
            {/* HomePage decides whether to show the document editor or the
                login form based on the user's authentication status. */}
            <Route path="/" element={<HomePage />} />

            {/* -- Authentication -------------------------------------------- */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/logout" element={<LogoutPage />} />

            {/* -- Account / Email / Password -------------------------------- */}
            <Route path="/confirmingEmail" element={<ConfirmEmailPage />} />
            <Route path="/confirmEmailResend" element={<ConfirmEmailResendPage />} />
            <Route path="/password/forgot" element={<ForgotPasswordPage />} />
            {/* :code is the reset token embedded in the password-reset email link. */}
            <Route path="/password/reset/:code" element={<ResetPasswordPage />} />

            {/* -- User Account Settings (protected) ------------------------- */}
            <Route
              path="/account"
              element={<ProtectedPage><AccountPage /></ProtectedPage>}
            />

            {/* -- Admin Panel (protected  -  Administrator role required) ------- */}
            <Route
              path="/admin"
              element={<AdminPageRoute><AdminPage /></AdminPageRoute>}
            />

            <Route
              path="/customers"
              element={<ProtectedPage><CustomerSearchPage /></ProtectedPage>}
            />

            <Route
              path="/customer"
              element={<ProtectedPage><CustomerPage /></ProtectedPage>}
            />

            <Route
              path="/customer/:id"
              element={<ProtectedPage><CustomerPage /></ProtectedPage>}
            />

            {/* -- Catch-all: redirect any unmatched path back to home --------- */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
