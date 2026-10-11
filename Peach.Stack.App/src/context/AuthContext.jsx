import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../services/apiClient'
import { getSessionInfo } from '../services/authSession'
import { toast } from 'react-toastify'

// --- Context Setup ------------------------------------------------------------

// The React context object that all consumers access via useAuth().
const AuthContext = createContext(null)

// --- State Helpers ------------------------------------------------------------

/**
 * Returns the baseline auth state used when no user is logged in and when the
 * app first loads before the session check completes.
 *
 * Having this as a named factory (rather than a plain object literal) lets us
 * call it both as the useState initialiser and as the value to set on logout,
 * guaranteeing the same shape every time.
 *
 * @returns {{ isAuthenticated: false, isAdmin: false, roles: [], user: null, isSessionVerified: false }}
 */
function createUnauthenticatedState() {
  return {
    isAuthenticated: false,
    isAdmin: false,
    roles: [],
    user: null,
    isSessionVerified: false,
  }
}

// --- Provider Component -------------------------------------------------------

/**
 * Wraps the application and provides authentication state plus account
 * operations (login, logout, register, refreshAuth) to all descendants
 * via the useAuth() hook.
 *
 * On mount it immediately checks whether a valid session cookie exists by
 * calling the /manage/info endpoint, and transitions from the loading state
 * to either authenticated or unauthenticated.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
  // The current auth snapshot.  Starts in the unauthenticated/unknown state.
  const [authState, setAuthState] = useState(createUnauthenticatedState)

  // True while the initial session check (or any explicit refreshAuth call) is
  // in-flight.  Consumers can use this to show a loading spinner instead of
  // the login page during the very first render.
  const [isLoadingAuthState, setIsLoadingAuthState] = useState(true)

  // --- Auth State Refresh -----------------------------------------------------

  /**
   * Fetches the latest auth information from the server (user info and roles)
   * and updates the auth state accordingly.
   *
   * This is called automatically on mount and can also be called manually after
   * any operation that changes the session (e.g. after enabling 2FA, changing
   * email, etc.) to ensure the in-memory auth state stays in sync.
   *
   * Only a 401 from the session endpoint confirms that the user is signed out.
   *
   * @returns {Promise<Object>} The new auth state that was stored in React state.
   */
  const refreshAuth = useCallback(async () => {
    setIsLoadingAuthState(true)

    try {
      const userInfo = await getSessionInfo()

      // If userInfo is null the session cookie is absent or expired.
      if (!userInfo) {
        const unauthenticatedState = createUnauthenticatedState()
        unauthenticatedState.isSessionVerified = true
        setAuthState(unauthenticatedState)
        return unauthenticatedState
      }

      const userRoles = await api.get('v1/account/roles', {
        redirectOnUnauthorized: false,
        showToast: false,
      })

      // Build the new auth state from the API responses.
      let resolvedRoles = []
      if (Array.isArray(userRoles)) {
        resolvedRoles = userRoles
      }

      const newAuthState = {
        isAuthenticated: true,
        isSessionVerified: true,
        isAdmin: Array.isArray(userRoles) && userRoles.includes('Administrator'),
        roles: resolvedRoles,
        user: {
          email: userInfo.email,
          claims: userInfo.claims ?? {},
        },
      }

      setAuthState(newAuthState)
      return newAuthState
    } catch {
      toast.error('Unable to verify your session. Please try again.')
      const unauthenticatedState = createUnauthenticatedState()
      setAuthState(unauthenticatedState)
      return unauthenticatedState
    } finally {
      setIsLoadingAuthState(false)
    }
  }, [])

  // Run the session check once when the provider first mounts.
  useEffect(() => {
    refreshAuth()
  }, [refreshAuth])

  // --- Auth Operations --------------------------------------------------------

  /**
   * Registers a new account with the given email and password.
   * After successful registration the user still needs to log in separately.
   *
   * @param {string} emailAddress - The new user's email address.
   * @param {string} password - The chosen password.
   * @returns {Promise<{ succeeded: boolean, errorList: string[] }>}
   */
  const register = useCallback(async (emailAddress, password) => {
    let errorMessages = ['Registration failed.']

    try {
      await api.post(
        'v1/account/register',
        { email: emailAddress, password },
        {
          redirectOnUnauthorized: false,
          showToast: false,
        },
      )

      return { succeeded: true, errorList: [] }
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        errorMessages = caughtError.messages
      }

      return { succeeded: false, errorList: errorMessages }
    }
  }, [])

  /**
   * Attempts to log in with the given credentials.
   * Handles the two-factor authentication challenge by returning
   * `prompt2FA: true` when the server signals that a 2FA code is required
   * before the login can be completed.
   *
   * @param {string} emailAddress - The user's email address.
   * @param {string} password - The user's password.
   * @param {string|null} twoFactorCode - TOTP code from the authenticator app, if the
   *   user is on the 2FA prompt step.
   * @param {string|null} twoFactorRecoveryCode - Recovery code, if the user has lost
   *   access to their authenticator app.
   * @returns {Promise<{ succeeded: boolean, prompt2FA: boolean, errorList: string[] }>}
   */
  const login = useCallback(
    async (emailAddress, password, twoFactorCode, twoFactorRecoveryCode) => {
      try {
        const loginResponse = await api.request(
          {
            method: 'post',
            url: 'login?useCookies=true', // useCookies=true tells ASP.NET Identity to set a session cookie
            data: {
              email: emailAddress,
              password,
              twoFactorCode,
              twoFactorRecoveryCode,
            },
          },
          {
            redirectOnUnauthorized: false,
            showToast: false,
          },
        )

        // A null response means the login endpoint returned an error body that
        // was silently consumed  -  treat it as invalid credentials.
        if (!loginResponse) {
          return {
            succeeded: false,
            prompt2FA: false,
            errorList: ['Invalid email and/or password.'],
          }
        }

        // Login succeeded  -  refresh auth state to populate user info and roles.
        await refreshAuth()
        return { succeeded: true, prompt2FA: false, errorList: [] }
      } catch (caughtError) {
        // The server returns a 401 with detail "RequiresTwoFactor" when the
        // credentials are correct but the account has 2FA enabled.  Signal this
        // to the UI so it can show the 2FA code input instead of an error.
        if (caughtError instanceof ApiError && caughtError.detail === 'RequiresTwoFactor') {
          return {
            succeeded: false,
            prompt2FA: true,
            errorList: [],
          }
        }

        // Any other error is a genuine login failure (wrong password, account
        // locked, etc.).
        let errorMessages = ['Invalid email and/or password.']
        if (caughtError instanceof ApiError) {
          errorMessages = caughtError.messages
        }

        return {
          succeeded: false,
          prompt2FA: false,
          errorList: errorMessages,
        }
      }
    },
    [refreshAuth],
  )

  /**
   * Logs the current user out by calling the server-side logout endpoint
   * and verifies that the server session is gone before clearing local state.
   *
   * @returns {Promise<void>}
   */
  const logout = useCallback(async () => {
    try {
      await api.get('v1/account/logout', {
        redirectOnUnauthorized: false,
        showToast: false,
      })
    } catch (caughtError) {
      if (!(caughtError instanceof ApiError) || caughtError.status !== 401) {
        throw caughtError
      }
    }

    const userInfo = await getSessionInfo()
    if (userInfo) {
      throw new Error('Your session is still active. Please try signing out again.')
    }

    try {
      localStorage.clear()
    } catch {
      toast.error('You are signed out, but saved browser data could not be cleared.')
    }

    const unauthenticatedState = createUnauthenticatedState()
    unauthenticatedState.isSessionVerified = true
    setAuthState(unauthenticatedState)
  }, [])

  // --- Context Value ----------------------------------------------------------

  // Memoise the context value to prevent unnecessary re-renders in consumers.
  // The dependency array includes all state and callbacks that the value exposes.
  const contextValue = useMemo(
    () => ({
      ...authState, // isAuthenticated, isAdmin, roles, user
      isLoading: isLoadingAuthState,
      login,
      logout,
      refreshAuth,
      register,
    }),
    [authState, isLoadingAuthState, login, logout, refreshAuth, register],
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

// --- Consumer Hook ------------------------------------------------------------

/**
 * Returns the current auth context value.
 * Must be called inside a component wrapped by AuthProvider.
 *
 * Exposes: isAuthenticated, isAdmin, isLoading, roles, user,
 *          login(), logout(), register(), refreshAuth().
 *
 * @returns {Object} The auth context value.
 * @throws {Error} If called outside of an AuthProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const authContext = useContext(AuthContext)

  if (!authContext) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return authContext
}
