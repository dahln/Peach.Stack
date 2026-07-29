import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'

/**
 * Account registration form.
 *
 * Validates the submitted fields client-side first, then delegates to
 * `auth.register()`.  On success the user is redirected to the home route.
 * Server-side validation errors (e.g. email already taken) are displayed as
 * individual alert banners above the form.
 */
export default function RegisterPage() {
  const auth = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Array of validation or server error messages shown above the form.
  const [errorList, setErrorList] = useState([])

  /** Validates fields client-side, then calls the register API, and redirects on success. */
  async function handleSubmit(submitEvent) {
    submitEvent.preventDefault()

    const validationErrors = []
    const trimmedEmail = email.trim()

    // -- Client-side validation ----------------------------------------------
    if (!trimmedEmail) {
      validationErrors.push('Email is required.')
    }
    if (!password.trim()) {
      validationErrors.push('Password is required.')
    }
    if (!confirmPassword.trim()) {
      validationErrors.push('Please confirm your password.')
    }
    if (password !== confirmPassword) {
      validationErrors.push("Passwords don't match.")
    }

    if (validationErrors.length > 0) {
      setErrorList(validationErrors)
      return
    }

    // -- Server registration -------------------------------------------------
    const result = await auth.register(trimmedEmail, password)

    if (!result.succeeded) {
      setErrorList(result.errorList ?? ['Registration failed.'])
      return
    }

    toast.success('Registration successful. Please sign in.')
    navigate('/')
  }

  // If the user is already authenticated, show a status message instead of
  // the registration form.
  if (auth.isAuthenticated) {
    return <div className="alert alert-success" role="alert">You are logged in as {auth.user?.email}.</div>
  }

  return (
    <div className="row mt-5">
      <div className="col-md-6 col-lg-4 mx-auto">
        <div className="card feature-card">
          <div className="card-header">
            <h2 className="h3 mb-0">Register</h2>
          </div>

          <div className="card-body">
            {/* Server or validation error banners */}
            {errorList.map((errorMessage) => (
              <div key={errorMessage} className="alert alert-danger" role="alert">
                {errorMessage}
              </div>
            ))}

            <form onSubmit={handleSubmit} autoComplete="on">
              <div className="mb-3">
                <label className="form-label" htmlFor="registerEmail">Email</label>
                <input
                  id="registerEmail"
                  className="form-control"
                  type="email"
                  autoFocus
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(changeEvent) => setEmail(changeEvent.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="registerPassword">Password</label>
                <input
                  id="registerPassword"
                  className="form-control"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(changeEvent) => setPassword(changeEvent.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="registerConfirmPassword">Retype Password</label>
                <input
                  id="registerConfirmPassword"
                  className="form-control"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(changeEvent) => setConfirmPassword(changeEvent.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary">Register</button>
            </form>

            <div className="mt-3">
              <Link to="/">
                <strong>Have an account? Sign in here.</strong>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
