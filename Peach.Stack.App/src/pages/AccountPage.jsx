import { useEffect, useState } from 'react'
import 'qrpeach'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/apiClient'

/**
 * AccountPage  -  lets the signed-in user manage their profile settings:
 *   - Change email address
 *   - Change password
 *   - Enable, disable, or reset two-factor authentication (TOTP)
 *   - Delete their account permanently
 *
 * Destructive operations are gated behind a ConfirmDialog before the API is called.
 */
export default function AccountPage() {
  const auth = useAuth()
  const navigate = useNavigate()

  // --- State ----------------------------------------------------------------

  // Change-email form field
  const [newEmail, setNewEmail] = useState('')

  // Change-password form fields
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // When true, all destructive fieldsets are disabled (server returned false for
  // the "operations allowed" check, e.g. SMTP not configured).
  const [areOperationsDisabled, setAreOperationsDisabled] = useState(false)

  // Whether the user currently has 2FA enabled (null = not yet loaded)
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(null)

  // True while the user is in the middle of 2FA setup (QR code + code entry shown)
  const [isTwoFactorSetupActive, setIsTwoFactorSetupActive] = useState(false)

  // The server-generated TOTP shared secret used to build the QR code
  const [twoFactorSharedKey, setTwoFactorSharedKey] = useState('')

  // Render-ready SVG markup returned by qrpeach.
  const [twoFactorQrSvg, setTwoFactorQrSvg] = useState('')

  // The 6-digit code the user types to confirm their authenticator app was enrolled
  const [twoFactorValidationCode, setTwoFactorValidationCode] = useState('')

  // One-time recovery codes returned after a successful 2FA setup or reset
  const [twoFactorRecoveryCodes, setTwoFactorRecoveryCodes] = useState([])

  // Current confirm action key for the shared ConfirmDialog.
  const [confirmAction, setConfirmAction] = useState(null)

  // --- Initial Data Load ----------------------------------------------------

  useEffect(() => {
    /**
     * Fetches two server values in parallel on mount:
     *   - operationsEnabled: whether account-mutating actions are allowed
     *   - twoFactorStatus:   whether 2FA is already enabled for this account
     */
    async function loadPage() {
      const [operationsEnabled, twoFactorStatus] = await Promise.all([
        api.get('v1/account/operations', {
          redirectOnUnauthorized: false,
          showToast: false,
        }),
        api.get('v1/account/2fa', {
          redirectOnUnauthorized: false,
          showToast: false,
        }),
      ])

      // operationsEnabled is `false` when the server explicitly disables mutations
      setAreOperationsDisabled(operationsEnabled === false)

      // twoFactorStatus is truthy when 2FA is already active on this account
      setIsTwoFactorEnabled(Boolean(twoFactorStatus))
    }

    loadPage()
  }, [])

  useEffect(() => {
    let isCancelled = false

    async function generateTwoFactorQr() {
      if (!isTwoFactorSetupActive || !twoFactorSharedKey || !auth.user?.email) {
        setTwoFactorQrSvg('')
        return
      }

      const qrPeachApi = globalThis.QRPeach
      if (!qrPeachApi?.Generate) {
        setTwoFactorQrSvg('')
        return
      }

      const otpAuthUri = `otpauth://totp/Peach.Stack:${auth.user.email}?secret=${twoFactorSharedKey}&issuer=Peach.Stack&digits=6`

      const generatedAsset = await qrPeachApi.Generate(
        {
          type: 'uri',
          inputs: { value: otpAuthUri },
          version: 6,
          ecc: 'M',
        },
        'svg',
        { download: false },
      )

      if (!isCancelled && generatedAsset?.svg) {
        setTwoFactorQrSvg(generatedAsset.svg)
        return
      }

      if (!isCancelled) {
        setTwoFactorQrSvg('')
      }
    }

    generateTwoFactorQr()

    return () => {
      isCancelled = true
    }
  }, [auth.user?.email, isTwoFactorSetupActive, twoFactorSharedKey])

  function getConfirmDetails() {
    if (confirmAction === 'changeEmail') {
      return {
        title: 'Change Email',
        message: 'Please confirm you want to change your email.',
        confirmLabel: 'Confirm',
      }
    }

    if (confirmAction === 'changePassword') {
      return {
        title: 'Change Password',
        message: 'Please confirm you want to change your password.',
        confirmLabel: 'Confirm',
      }
    }

    if (confirmAction === 'deleteAccount') {
      return {
        title: 'Delete Account',
        message: 'Please confirm you want to delete your account. This cannot be undone.',
        confirmLabel: 'Delete',
      }
    }

    return {
      title: 'Please Confirm',
      message: '',
      confirmLabel: 'Confirm',
    }
  }

  const confirmDetails = getConfirmDetails()

  // --- Email ----------------------------------------------------------------

  /**
   * Changes the account email address.
   * First checks whether the new address is already taken, then submits the
   * change. The server sends a confirmation link to the new address.
   */
  async function changeEmail() {
    const trimmedEmail = newEmail.trim()

    // Guard: reject the address if another account already uses it
    const isEmailTaken = await api.post(
      'v1/account/exists',
      { email: trimmedEmail },
      {
        redirectOnUnauthorized: false,
        showToast: false,
      },
    )

    if (isEmailTaken) {
      toast.error('Email is unavailable.')
      return
    }

    await api.post(
      'manage/info',
      { newEmail: trimmedEmail },
      {
        redirectOnUnauthorized: false,
        showToast: true,
      },
    )

    toast.success('Email changed. Confirm the new address using the email that was sent to you.')
  }

  // --- Password -------------------------------------------------------------

  /**
   * Changes the account password after verifying the two new-password fields
   * match.  Clears all password fields on success.
   */
  async function changePassword() {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.")
      return
    }

    await api.post(
      'manage/info',
      { oldPassword, newPassword },
      {
        redirectOnUnauthorized: false,
        showToast: true,
      },
    )

    toast.success('Done. Use your new password on the next sign in.')
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  // --- 2FA ------------------------------------------------------------------

  /**
   * Step 1 of 2FA setup  -  asks the server for a new shared TOTP key, then
   * reveals the QR code and manual-entry section so the user can enrol their
   * authenticator app.
   */
  async function startTwoFactorSetup() {
    const response = await api.post(
      'manage/2fa',
      {},
      {
        redirectOnUnauthorized: false,
        showToast: true,
      },
    )

    if (!response) {
      return
    }

    setTwoFactorSharedKey(response.sharedKey ?? '')
    setIsTwoFactorSetupActive(true)
  }

  /**
   * Step 2 of 2FA setup  -  submits the TOTP code that the user read from their
   * authenticator app to prove the enrolment succeeded.  Immediately resets the
   * recovery codes so the user receives a fresh set.
   */
  async function finishTwoFactorSetup() {
    await api.post(
      'manage/2fa',
      {
        enable: true,
        twoFactorCode: twoFactorValidationCode,
      },
      {
        redirectOnUnauthorized: false,
        showToast: true,
      },
    )

    // Fetch and display a fresh set of recovery codes after successful setup
    await resetRecoveryCodes()

    setIsTwoFactorEnabled(true)
    setIsTwoFactorSetupActive(false)
    setTwoFactorValidationCode('')
  }

  /**
   * Disables 2FA entirely.  Also resets the shared key and tells the server to
   * forget this device so the change takes effect immediately.
   */
  async function disableTwoFactor() {
    await api.post(
      'manage/2fa',
      {
        enable: false,
        forgetMachine: true,
        resetSharedKey: true,
      },
      {
        redirectOnUnauthorized: false,
        showToast: true,
      },
    )

    setIsTwoFactorEnabled(false)
    setIsTwoFactorSetupActive(false)
    setTwoFactorSharedKey('')
    setTwoFactorRecoveryCodes([])
  }

  /**
   * Generates a brand-new set of recovery codes and stores them in state so
   * they are displayed to the user.  Also called automatically after setup.
   */
  async function resetRecoveryCodes() {
    const response = await api.post(
      'manage/2fa',
      {
        resetRecoveryCodes: true,
      },
      {
        redirectOnUnauthorized: false,
        showToast: true,
      },
    )

    if (response?.recoveryCodes?.length > 0) {
      setTwoFactorRecoveryCodes(response.recoveryCodes)
    }
  }

  /**
   * Tells the server to forget the current browser/device so the next sign-in
   * will prompt for a 2FA code again (even if "Remember me" was previously set).
   */
  async function forgetMachine() {
    await api.post(
      'manage/2fa',
      {
        forgetMachine: true,
      },
      {
        redirectOnUnauthorized: false,
        showToast: true,
      },
    )

    toast.success('PC forgotten.')
  }

  // --- Account Deletion -----------------------------------------------------

  /**
   * Permanently deletes the user's account, logs them out, refreshes the auth
   * context, and redirects to the home page.
   */
  async function deleteAccount() {
    const response = await api.delete('v1/account')
    if (!response) {
      return
    }

    // Invalidate the server session
    await api.get('v1/account/logout', {
      redirectOnUnauthorized: false,
      showToast: false,
    })

    // Clear the client-side auth state and send the user home
    await auth.refreshAuth()
    navigate('/', { replace: true })
  }

  // --- Render ---------------------------------------------------------------

  return (
    <>
      <div className="row">
        <div className="col">
          <h3>Account Settings</h3>
        </div>
      </div>

      <div className="row mt-3 g-3">
        {/* -- Change Email Card -- */}
        <div className="col-12 col-md-6">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="mb-0">Change Email</h5>
            </div>

            <div className="card-body">
              <p className="mb-3">Current Email: {auth.user?.email}</p>

              <fieldset disabled={areOperationsDisabled}>
                <div className="mb-3">
                  <input
                    id="accountNewEmail"
                    className="form-control"
                    value={newEmail}
                    onChange={(changeEvent) => setNewEmail(changeEvent.target.value)}
                  />
                </div>

                <div className="text-end">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setConfirmAction('changeEmail')}
                  >
                    Save Email
                  </button>
                </div>
              </fieldset>
            </div>
          </div>
        </div>

        {/* -- Change Password Card -- */}
        <div className="col-12 col-md-6">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="mb-0">Change Password</h5>
            </div>

            <div className="card-body">
              <fieldset disabled={areOperationsDisabled}>
                <div className="mb-3">
                  <input
                    id="accountOldPassword"
                    className="form-control"
                    type="password"
                    placeholder="Old Password"
                    value={oldPassword}
                    onChange={(changeEvent) => setOldPassword(changeEvent.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <input
                    id="accountNewPassword"
                    className="form-control"
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(changeEvent) => setNewPassword(changeEvent.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <input
                    id="accountConfirmPassword"
                    className="form-control"
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(changeEvent) => setConfirmPassword(changeEvent.target.value)}
                  />
                </div>

                <div className="text-end">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setConfirmAction('changePassword')}
                  >
                    Save Password
                  </button>
                </div>
              </fieldset>
            </div>
          </div>
        </div>

        {/* -- Two Factor Authentication Card -- */}
        <div className="col-12 col-md-6">
          <div className="card" style={{ minHeight: '520px' }}>
            <div className="card-header">
              <h5 className="mb-0">Two Factor Authentication</h5>
            </div>

            <div className="card-body">
              {(() => {
                if (isTwoFactorEnabled) {
                  return (
                    <>
                      <h5>
                        Two Factor Authentication is <span className="text-success">ENABLED</span>
                      </h5>

                      <div className="d-flex flex-wrap gap-2 mt-3">
                        <button type="button" className="btn btn-danger" onClick={disableTwoFactor}>
                          Disable 2FA
                        </button>
                        <button type="button" className="btn btn-warning" onClick={forgetMachine}>
                          Forget this PC
                        </button>
                      </div>

                      {twoFactorRecoveryCodes.length > 0 && (
                        <div className="mt-4 text-center">
                          <p>
                            Print or save these recovery keys. You cannot retrieve them after leaving
                            this page.
                          </p>
                          {twoFactorRecoveryCodes.map((recoveryCode) => (
                            <h6 key={recoveryCode}>{recoveryCode}</h6>
                          ))}
                        </div>
                      )}
                    </>
                  )
                }

                if (isTwoFactorSetupActive) {
                  return (
                    <div className="text-center">
                      <p>
                        Use an authenticator app like Microsoft Authenticator to set up your 2FA
                        profile.
                      </p>

                      {twoFactorQrSvg && (
                        <div className="d-flex justify-content-center mb-3">
                          <div
                            role="img"
                            aria-label="Two factor authentication QR code"
                            dangerouslySetInnerHTML={{ __html: twoFactorQrSvg }}
                          />
                        </div>
                      )}

                      <p className="mb-1">Manually enter the key:</p>
                      <p className="fw-semibold">{twoFactorSharedKey}</p>

                      <div className="mb-3">
                        <label className="form-label" htmlFor="twoFactorValidation">
                          Code from authenticator app
                        </label>
                        <input
                          id="twoFactorValidation"
                          className="form-control"
                          value={twoFactorValidationCode}
                          onChange={(changeEvent) =>
                            setTwoFactorValidationCode(changeEvent.target.value)
                          }
                        />
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary w-100"
                        onClick={finishTwoFactorSetup}
                      >
                        Submit Code and Finish Setup
                      </button>
                    </div>
                  )
                }

                return (
                  <>
                    <h5>
                      Two Factor Authentication is <span className="text-danger">DISABLED</span>
                    </h5>

                    <button
                      type="button"
                      className="btn btn-primary mt-3"
                      onClick={startTwoFactorSetup}
                    >
                      Enable 2FA
                    </button>

                    <p className="mt-3 mb-1">
                      Use an authenticator app to get a security code when signing in.
                    </p>
                    <a
                      href="https://www.microsoft.com/en-us/security/mobile-authenticator-app"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Microsoft Authenticator App
                    </a>
                  </>
                )
              })()}
            </div>
          </div>
        </div>

        {/* -- Danger Zone Card -- */}
        <div className="col-12 col-md-6">
          <div className="card border-danger">
            <div className="card-header text-danger">
              <h5 className="mb-0">Danger Zone</h5>
            </div>

            <div className="card-body">
              <p>
                This will delete your account and the associated information. This operation cannot
                be undone.
              </p>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setConfirmAction('deleteAccount')}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* -- Confirm Dialog --------------------------------------------------- */}
      {/*
        All four destructive operations (change email, change password, disable 2FA,
        delete account) share this single dialog.  The `action` stored in
        `confirmState` determines what runs when the user clicks Confirm.
      */}
      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        title={confirmDetails.title}
        message={confirmDetails.message}
        confirmLabel={confirmDetails.confirmLabel}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          const pendingAction = confirmAction
          setConfirmAction(null)

          if (pendingAction === 'changeEmail') {
            await changeEmail()
            return
          }

          if (pendingAction === 'changePassword') {
            await changePassword()
            return
          }

          if (pendingAction === 'deleteAccount') {
            await deleteAccount()
          }
        }}
      />
    </>
  )
}
