import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/apiClient'

/**
 * LoginPage  -  email/password sign-in form with optional two-factor authentication.
 *
 * Two-factor flow:
 *   1. User submits email + password.
 *   2. Server responds that 2FA is required -> `isTwoFactorCodeRequired` becomes true.
 *   3. User enters the TOTP code from their authenticator app and resubmits.
 *   4. Alternatively, user clicks "Security Code Recovery" to enter a one-time
 *      recovery code instead (`isTwoFactorRecoveryRequired` becomes true).
 *
 * @param {boolean} [embedded=false] - When true the form uses a smaller top margin,
 *   suitable for embedding inside the HomePage.
 */
export default function LoginPage({ embedded = false }) {
  const auth = useAuth()
  const navigate = useNavigate()

  // --- State ----------------------------------------------------------------

  // Primary credentials entered by the user
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Two-factor authentication inputs
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorRecoveryCode, setTwoFactorRecoveryCode] = useState('')

  // Whether the user wants this device remembered for 14 days (skips 2FA next time)
  const [twoFactorRememberMe, setTwoFactorRememberMe] = useState(false)

  // UI visibility flags for the two different 2FA entry modes
  const [isTwoFactorCodeRequired, setIsTwoFactorCodeRequired] = useState(false)
  const [isTwoFactorRecoveryRequired, setIsTwoFactorRecoveryRequired] = useState(false)

  // Server-side feature flags fetched on mount
  const [areAllOperationsAllowed, setAreAllOperationsAllowed] = useState(false)
  const [isRegistrationEnabled, setIsRegistrationEnabled] = useState(true)

  // Validation error messages shown above the form
  const [errorList, setErrorList] = useState([])

  // --- Server Options Loader ------------------------------------------------

  useEffect(() => {
    /**
     * Fetches two independent feature flags from the server in parallel:
     *   - registrationAllowed: whether the "Register" link should be visible
     *   - operationsAllowed:   whether password-reset / resend-email links appear
     * Falls back to safe defaults on network failure.
     */
    async function loadServerOptions() {
      try {
        const [registrationAllowed, operationsAllowed] = await Promise.all([
          api.get('v1/account/operations/registration', {
            redirectOnUnauthorized: false,
            showToast: false,
          }),
          api.get('v1/account/operations', {
            redirectOnUnauthorized: false,
            showToast: false,
          }),
        ])

        setIsRegistrationEnabled(Boolean(registrationAllowed))
        setAreAllOperationsAllowed(Boolean(operationsAllowed))
      } catch {
        // If the request fails, default to showing registration and hiding
        // the extra operation links (safest degraded state).
        setIsRegistrationEnabled(true)
        setAreAllOperationsAllowed(false)
      }
    }

    loadServerOptions()
  }, [])

  // --- 2FA Helpers ----------------------------------------------------------

  /**
   * Clears the 2FA input fields when the server asks the user to re-enter
   * their code (e.g. wrong code submitted).
   */
  function clearTwoFactorInputs() {
    setTwoFactorCode('')
    setTwoFactorRecoveryCode('')
  }

  // --- Submit Handler -------------------------------------------------------

  /**
   * Validates fields, calls auth.login(), and handles the multi-step 2FA
   * challenge-response cycle before navigating to the home page on success.
   */
  async function handleSubmit(submitEvent) {
    submitEvent.preventDefault()

    // Collect any front-end validation errors before hitting the server
    const validationErrors = []
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      validationErrors.push('Email is required.')
    }

    if (!password.trim()) {
      validationErrors.push('Password is required.')
    }

    if (validationErrors.length > 0) {
      setErrorList(validationErrors)
      return
    }

    // Attempt login  -  pass 2FA fields as null when not yet in the 2FA flow
    const result = await auth.login(
      trimmedEmail,
      password,
      twoFactorCode || null,
      twoFactorRecoveryCode || null,
    )

    // Server says 2FA is required and we are NOT in recovery mode yet ->
    // show the standard authenticator-code field.
    if (result.prompt2FA && !isTwoFactorRecoveryRequired) {
      clearTwoFactorInputs()
      setIsTwoFactorCodeRequired(true)
      toast.info('Enter your security code.')
      return
    }

    // Server says 2FA is required and we ARE already in recovery mode ->
    // keep showing the recovery field and ask again.
    if (result.prompt2FA && isTwoFactorRecoveryRequired) {
      clearTwoFactorInputs()
      toast.info('Enter your security recovery code.')
      return
    }

    // Login failed for a different reason (wrong password, locked account, etc.)
    if (!result.succeeded) {
      setErrorList(result.errorList ?? ['Invalid email and/or password.'])
      return
    }

    // Successful login  -  if the user did not opt-in to remembering this device,
    // explicitly tell the server to forget it so future logins still require 2FA.
    if (!twoFactorRememberMe && isTwoFactorCodeRequired) {
      await api.post(
        'manage/2fa',
        { forgetMachine: true },
        {
          redirectOnUnauthorized: false,
          showToast: false,
        },
      )
    }

    setErrorList([])
    navigate('/')
  }

  // --- Render ---------------------------------------------------------------

  // If the user is already signed in, show a confirmation instead of the form
  if (auth.isAuthenticated) {
    return <div className="alert alert-success" role="alert">You are logged in as {auth.user?.email}.</div>
  }

  let rowClassName = 'mt-5'
  if (embedded) {
    rowClassName = 'mt-4'
  }

  return (
    <div className={`row ${rowClassName}`}>
      <div className="col-md-6 col-lg-4 mx-auto">
        <div className="card feature-card">
          <div className="card-header">
            <h2 className="h3 mb-0">Login</h2>
          </div>

          <div className="card-body">
            {/* Validation errors collected during submit */}
            {errorList.map((errorMessage) => (
              <div key={errorMessage} className="alert alert-danger" role="alert">
                {errorMessage}
              </div>
            ))}

            <form onSubmit={handleSubmit} autoComplete="off">
              {/* Standard credentials */}
              <div className="mb-3">
                <label className="form-label" htmlFor="loginEmail">Email</label>
                <input
                  id="loginEmail"
                  className="form-control"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(changeEvent) => setEmail(changeEvent.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="loginPassword">Password</label>
                <input
                  id="loginPassword"
                  className="form-control"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(changeEvent) => setPassword(changeEvent.target.value)}
                />
              </div>

              {/* TOTP code field  -  only shown after the server requests 2FA */}
              {isTwoFactorCodeRequired && (
                <>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="loginTwoFactorCode">Security Code</label>
                    <input
                      id="loginTwoFactorCode"
                      className="form-control"
                      type="text"
                      placeholder="6-digit code"
                      value={twoFactorCode}
                      onChange={(changeEvent) => setTwoFactorCode(changeEvent.target.value)}
                    />
                  </div>

                  {/* Lets the user skip 2FA for 14 days on this device */}
                  <div className="form-check mb-3">
                    <input
                      id="rememberDevice"
                      className="form-check-input"
                      type="checkbox"
                      checked={twoFactorRememberMe}
                      onChange={(changeEvent) => setTwoFactorRememberMe(changeEvent.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="rememberDevice">
                      Remember this device for 14 days
                    </label>
                  </div>
                </>
              )}

              {/* Recovery code field  -  shown when user switches to recovery mode */}
              {isTwoFactorRecoveryRequired && (
                <div className="mb-3">
                  <label className="form-label" htmlFor="loginTwoFactorRecoveryCode">Recovery Code</label>
                  <input
                    id="loginTwoFactorRecoveryCode"
                    className="form-control"
                    type="text"
                    placeholder="Enter your 2FA recovery code"
                    value={twoFactorRecoveryCode}
                    onChange={(changeEvent) => setTwoFactorRecoveryCode(changeEvent.target.value)}
                  />
                </div>
              )}

              <button type="submit" className="btn btn-primary">Login</button>
            </form>

            {/* Password reset / email resend links  -  hidden when operations are restricted */}
            {areAllOperationsAllowed && (
              <div className="mt-3 d-flex flex-column gap-2">
                <Link to="/password/forgot">Forgot Password</Link>
                <Link to="/confirmEmailResend">Resend Email Confirmation</Link>
              </div>
            )}

            {/* Switch from TOTP mode to recovery code mode */}
            {isTwoFactorCodeRequired && (
              <button
                type="button"
                className="btn btn-link px-0 mt-3"
                onClick={() => {
                  setIsTwoFactorCodeRequired(false)
                  setIsTwoFactorRecoveryRequired(true)
                }}
              >
                Security Code Recovery
              </button>
            )}

            {/* Registration link  -  hidden when the server disables self-registration */}
            {isRegistrationEnabled && (
              <div className="mt-3">
                <Link to="/register">
                  <strong>Need an account? Register here.</strong>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
