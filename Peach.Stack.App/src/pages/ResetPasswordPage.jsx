import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'react-toastify'
import { api } from '../services/apiClient'

/**
 * Completes the password-reset flow for a recovery code delivered via email.
 *
 * The route is `/reset-password/:code`.  The form is disabled if the code
 * parameter is missing or if the server reports that account operations are
 * not permitted.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { code: recoveryCode } = useParams()

  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [areOperationsAllowed, setAreOperationsAllowed] = useState(false)

  // Check whether account operations are enabled, and warn immediately
  // if the URL is missing the recovery code.
  useEffect(() => {
    async function loadOperationsStatus() {
      try {
        const isEnabled = await api.get('v1/account/operations', {
          redirectOnUnauthorized: false,
          showToast: false,
        })

        // Cast to boolean  -  the endpoint can return null/undefined on error.
        setAreOperationsAllowed(Boolean(isEnabled))
      } catch {
        setAreOperationsAllowed(false)
      }
    }

    loadOperationsStatus()

    // Warn immediately if the URL is missing the recovery code.
    if (!recoveryCode) {
      toast.error('Invalid recovery code.')
    }
  }, [recoveryCode])

  /** Submits the new password using the recovery code from the URL. */
  async function handleSubmit(submitEvent) {
    submitEvent.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.")
      return
    }

    const response = await api.post(
      'resetpassword',
      {
        email,
        resetCode: recoveryCode,
        newPassword,
      },
      {
        redirectOnUnauthorized: false,
        showToast: true,
      },
    )

    if (response) {
      toast.success('Done. Password is reset. Please log in with your new password.')
      navigate('/')
    }
  }

  return (
    <fieldset disabled={!areOperationsAllowed}>
      <div className="row mt-4">
        <div className="col-md-6 col-lg-4 mx-auto">
          <div className="card feature-card">
            <div className="card-header">
              <h2 className="h4 mb-0">Reset Password</h2>
            </div>

            <div className="card-body">
              <p>Re-enter your account email and the new password.</p>

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <input
                    id="resetPasswordEmail"
                    className="form-control"
                    type="email"
                    value={email}
                    onChange={(changeEvent) => setEmail(changeEvent.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <input
                    id="resetPasswordNewPassword"
                    className="form-control"
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(changeEvent) => setNewPassword(changeEvent.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <input
                    id="resetPasswordConfirmPassword"
                    className="form-control"
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(changeEvent) => setConfirmPassword(changeEvent.target.value)}
                  />
                </div>

                <div className="text-end">
                  <button type="submit" className="btn btn-primary">Submit</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  )
}
