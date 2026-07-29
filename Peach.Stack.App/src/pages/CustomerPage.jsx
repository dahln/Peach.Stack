import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'react-toastify'
import ConfirmDialog from '../components/ConfirmDialog'
import { api } from '../services/apiClient'
import {
  createEmptyCustomer,
  genderOptions,
  normalizeCustomerForApi,
  toDateInputValue,
} from '../utils/models'
import { createResizedImageDataUrl } from '../utils/image'

/**
 * Customer details page used for both create and edit workflows.
 */
export default function CustomerPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [customer, setCustomer] = useState(createEmptyCustomer())
  const [isLocked, setIsLocked] = useState(Boolean(id))
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const loadCustomer = useCallback(async (customerId) => {
    const response = await api.get(`v1/customer/${customerId}`)
    if (!response) {
      toast.error('Customer failed to load.')
      return
    }

    setCustomer({
      ...createEmptyCustomer(),
      ...response,
      birthDate: toDateInputValue(response.birthDate),
      active: Boolean(response.active),
      gender: response.gender ?? 0,
    })

    setIsLocked(true)
  }, [])

  useEffect(() => {
    if (!id) {
      setCustomer(createEmptyCustomer())
      setIsLocked(false)
      return
    }

    loadCustomer(id)
  }, [id, loadCustomer])

  function updateCustomerField(field, value) {
    setCustomer((currentCustomer) => ({
      ...currentCustomer,
      [field]: value,
    }))
  }

  async function saveCustomer() {
    const payload = normalizeCustomerForApi(customer)

    if (!id) {
      const response = await api.post('v1/customer', payload)
      if (response) {
        navigate(`/customer/${response}`)
      }
      return
    }

    await api.put(`v1/customer/${id}`, payload)
    setIsLocked(true)
  }

  async function cancelChanges() {
    if (!id) {
      setCustomer(createEmptyCustomer())
      return
    }

    await loadCustomer(id)
  }

  async function deleteCustomer() {
    const response = await api.delete(`v1/customer/${id}`)
    if (response) {
      navigate('/customers')
    }
  }

  async function handleImageChange(event) {
    const [file] = event.target.files ?? []
    if (!file) {
      return
    }

    try {
      const imageBase64 = await createResizedImageDataUrl(file)
      updateCustomerField('imageBase64', imageBase64)
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <>
      <div className="my-3">
        <Link to="/customers">
          <i className="bi bi-arrow-left-short" /> Back to Search
        </Link>
      </div>

      <div className="row">
        <div className="col">
          <h3>
            Customer{' '}
            {isLocked ? (
              <button type="button" className="btn btn-link" onClick={() => setIsLocked(false)}>
                Edit
              </button>
            ) : null}
          </h3>
        </div>
      </div>

      <fieldset disabled={isLocked}>
        <div className="row">
          <div className="col-lg-6">
            <div className="row">
              <div className="col-md-6 text-center">
                <div className="d-flex align-items-center justify-content-center mb-3" style={{ minHeight: '16rem' }}>
                  {customer.imageBase64 ? (
                    <img src={customer.imageBase64} alt="Customer" className="img-fluid rounded-4" />
                  ) : (
                    <i className="bi bi-person-square fs-1 text-secondary mt-md-5 mb-2" />
                  )}
                </div>

                {!isLocked ? (
                  <>
                    <label className="btn btn-outline-primary w-100 mb-2">
                      <input type="file" hidden accept="image/*" onChange={handleImageChange} />
                      Upload File (32 MB size limit)
                    </label>

                    {customer.imageBase64 ? (
                      <button
                        type="button"
                        className="btn btn-danger w-100"
                        onClick={() => updateCustomerField('imageBase64', null)}
                      >
                        Remove Image
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label" htmlFor="customerName">Name</label>
                  <input
                    id="customerName"
                    className="form-control"
                    value={customer.name ?? ''}
                    onChange={(event) => updateCustomerField('name', event.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="customerBirthDate">Birth Date</label>
                  <input
                    id="customerBirthDate"
                    className="form-control"
                    type="date"
                    value={customer.birthDate ?? ''}
                    onChange={(event) => updateCustomerField('birthDate', event.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="customerGender">Gender</label>
                  <select
                    id="customerGender"
                    className="form-select"
                    value={customer.gender ?? 0}
                    onChange={(event) => updateCustomerField('gender', Number(event.target.value))}
                  >
                    {genderOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-check">
                  <input
                    id="customerActive"
                    className="form-check-input"
                    type="checkbox"
                    checked={Boolean(customer.active)}
                    onChange={(event) => updateCustomerField('active', event.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="customerActive">Active</label>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="row">
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label" htmlFor="customerEmail">Email</label>
                  <input
                    id="customerEmail"
                    className="form-control"
                    value={customer.email ?? ''}
                    onChange={(event) => updateCustomerField('email', event.target.value)}
                  />
                </div>
              </div>

              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label" htmlFor="customerPhone">Phone</label>
                  <input
                    id="customerPhone"
                    className="form-control"
                    value={customer.phone ?? ''}
                    onChange={(event) => updateCustomerField('phone', event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="customerAddress">Address</label>
              <input
                id="customerAddress"
                className="form-control"
                value={customer.address ?? ''}
                onChange={(event) => updateCustomerField('address', event.target.value)}
              />
            </div>

            <div className="row">
              <div className="col-md-4">
                <div className="mb-3">
                  <label className="form-label" htmlFor="customerCity">City</label>
                  <input
                    id="customerCity"
                    className="form-control"
                    value={customer.city ?? ''}
                    onChange={(event) => updateCustomerField('city', event.target.value)}
                  />
                </div>
              </div>

              <div className="col-md-4">
                <div className="mb-3">
                  <label className="form-label" htmlFor="customerState">State</label>
                  <input
                    id="customerState"
                    className="form-control"
                    value={customer.state ?? ''}
                    onChange={(event) => updateCustomerField('state', event.target.value)}
                  />
                </div>
              </div>

              <div className="col-md-4">
                <div className="mb-3">
                  <label className="form-label" htmlFor="customerPostal">Postal</label>
                  <input
                    id="customerPostal"
                    className="form-control"
                    value={customer.postal ?? ''}
                    onChange={(event) => updateCustomerField('postal', event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="customerNotes">Notes</label>
              <textarea
                id="customerNotes"
                className="form-control"
                rows={7}
                value={customer.notes ?? ''}
                onChange={(event) => updateCustomerField('notes', event.target.value)}
              />
            </div>
          </div>
        </div>
      </fieldset>

      <hr />

      {!isLocked ? (
        <div className="d-flex flex-column flex-sm-row gap-2 align-items-stretch align-items-sm-center">
          {id ? (
            <button type="button" className="btn btn-warning" onClick={() => setIsDeleteDialogOpen(true)}>
              Delete
            </button>
          ) : null}

          <div className="ms-sm-auto d-flex flex-column flex-sm-row gap-2">
            {id ? (
              <button type="button" className="btn btn-outline-danger" onClick={cancelChanges}>
                Cancel Changes
              </button>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={saveCustomer}>Save</button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Delete Customer"
        message="Are you sure you want to delete this customer?"
        confirmLabel="Delete"
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={async () => {
          setIsDeleteDialogOpen(false)
          await deleteCustomer()
        }}
      />
    </>
  )
}
