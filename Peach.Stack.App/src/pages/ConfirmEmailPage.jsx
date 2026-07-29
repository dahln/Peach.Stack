import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '../services/apiClient'

/**
 * Confirms a user's email address using token values from the callback URL.
 *
 * The backend sends a link to the user's inbox that includes `userId`, `code`,
 * and optionally `changedEmail` as query parameters.  This page reads those
 * parameters and calls the confirmation endpoint on mount.
 */
export default function ConfirmEmailPage() {
  const [searchParams] = useSearchParams()

  // Whether the confirmation API call has returned successfully.
  const [isConfirmationComplete, setIsConfirmationComplete] = useState(false)

  useEffect(() => {
    async function confirmEmail() {
      const confirmationCode = searchParams.get('code')
      const changedEmail = searchParams.get('changedEmail')
      const userId = searchParams.get('userId')

      // Both code and userId must be present in the callback URL  -  abort
      // silently if either is missing (e.g. the user navigated here manually).
      if (!confirmationCode || !userId) {
        return
      }

      // Build the query string for the confirmation endpoint.
      const queryParams = new URLSearchParams({ userId, code: confirmationCode })

      // changedEmail is only present when the user changed their email address  -
      // append it when provided so the backend can update the stored address.
      if (changedEmail) {
        queryParams.set('changedEmail', changedEmail)
      }

      const response = await api.get(`confirmEmail?${queryParams.toString()}`, {
        redirectOnUnauthorized: false,
        showToast: true,
      })

      if (response) {
        setIsConfirmationComplete(true)
      }
    }

    confirmEmail()
  }, [searchParams])

  return (
    <div className="row mt-4">
      <div className="col">
        {isConfirmationComplete && (
          <div className="alert alert-success text-center" role="alert">
            Your email address has been verified.
          </div>
        )}
      </div>
    </div>
  )
}
