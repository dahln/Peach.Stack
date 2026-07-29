import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../services/apiClient'
import {
  createSearch,
  formatPageCount,
  genderLabels,
  pageSizeOptions,
  sortDirections,
  toApiSearch,
} from '../utils/models'

const searchStorageKey = 'CustomerSearch'
const defaultSortBy = 'Name'

/**
 * Search and browse customers with persisted filters, sorting, and paging.
 */
export default function CustomerSearchPage({ embedded = false }) {
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [search, setSearch] = useState(createSearch(defaultSortBy))
  const [totalFound, setTotalFound] = useState(0)

  const searchCustomers = useCallback(async (page, reset = false, currentSearch) => {
    const nextSearch = reset
      ? createSearch(defaultSortBy)
      : toApiSearch(currentSearch, page)

    setSearch(nextSearch)
    localStorage.setItem(searchStorageKey, JSON.stringify(nextSearch))

    const response = await api.post('v1/customers', nextSearch)
    if (response) {
      setItems(response.results ?? [])
      setTotalFound(response.total ?? 0)
    }
  }, [])

  useEffect(() => {
    const cachedSearch = localStorage.getItem(searchStorageKey)

    if (!cachedSearch) {
      searchCustomers(0, true, createSearch(defaultSortBy))
      return
    }

    const parsedSearch = JSON.parse(cachedSearch)
    setSearch(parsedSearch)
    searchCustomers(parsedSearch.page, false, parsedSearch)
  }, [searchCustomers])

  async function handleSubmit(event) {
    event.preventDefault()
    await searchCustomers(0, false, search)
  }

  async function handleSort(column) {
    const nextDirection =
      search.sortBy === column && search.sortDirection === sortDirections.ascending
        ? sortDirections.descending
        : sortDirections.ascending

    const nextSearch = {
      ...search,
      sortBy: column,
      sortDirection: nextDirection,
    }

    setSearch(nextSearch)
    await searchCustomers(nextSearch.page, false, nextSearch)
  }

  async function handlePageSizeChange(event) {
    const pageSize = Number(event.target.value)
    const nextSearch = {
      ...search,
      page: 0,
      pageSize,
    }

    setSearch(nextSearch)
    await searchCustomers(0, false, nextSearch)
  }

  const pageCount = formatPageCount(totalFound, search.pageSize)

  return (
    <div className={embedded ? 'pt-2' : 'pt-3'}>
      <div className="d-flex flex-wrap justify-content-between gap-3 align-items-center mb-3">
        <div />
        <button type="button" className="btn btn-success" onClick={() => navigate('/customer')}>
          <i className="bi bi-plus-lg me-2" />
          Add Customer
        </button>
      </div>

      <div className="d-flex flex-wrap justify-content-end gap-2 align-items-center mb-2">
        <form onSubmit={handleSubmit} autoComplete="off" style={{ maxWidth: '28rem', width: '100%' }}>
          <div className="input-group search-input-group">
            <input
              className="form-control"
              type="text"
              value={search.filterText}
              onChange={(event) =>
                setSearch((currentSearch) => ({
                  ...currentSearch,
                  filterText: event.target.value,
                }))
              }
            />
            <button type="submit" className="btn btn-outline-secondary">
              <i className="bi bi-search me-2" />
              Search
            </button>
            <span className="input-group-text page-size-label">
              <span>Page</span>
              <span>Size</span>
            </span>
            <select
              value={search.pageSize}
              onChange={handlePageSizeChange}
              aria-label="Select page size"
              className="form-select flex-grow-0"
              style={{ width: '4.5rem' }}
            >
              {pageSizeOptions.map((sizeOption) => (
                <option key={sizeOption} value={sizeOption}>
                  {sizeOption}
                </option>
              ))}
            </select>
          </div>
        </form>
      </div>

      <div className="text-end mb-3">
        <button
          type="button"
          className="btn btn-link btn-sm text-decoration-none"
          onClick={() => searchCustomers(0, true, createSearch(defaultSortBy))}
        >
          Reset Search
        </button>
      </div>

      <div className="d-flex justify-content-end mb-3">
        <PaginationSummary
          search={search}
          pageCount={pageCount}
          onPrevious={() => searchCustomers(search.page - 1, false, search)}
          onNext={() => searchCustomers(search.page + 1, false, search)}
        />
      </div>

      <div className="table-responsive">
        <table className="table table-hover table-sm align-middle">
          <thead>
            <tr>
              <SortableHeader
                label="Name"
                column="Name"
                search={search}
                onSort={handleSort}
                width="50%"
              />
              <SortableHeader
                label="State"
                column="State"
                search={search}
                onSort={handleSort}
                width="20%"
              />
              <SortableHeader
                label="Active"
                column="Active"
                search={search}
                onSort={handleSort}
                width="20%"
              />
              <SortableHeader
                label="Gender"
                column="Gender"
                search={search}
                onSort={handleSort}
                width="10%"
              />
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="table-row-link">
                <td>
                  <button
                    type="button"
                    className="btn btn-link text-decoration-none ps-2"
                    onClick={() => navigate(`/customer/${item.id}`)}
                  >
                    {item.name}
                  </button>
                </td>
                <td>{item.state}</td>
                <td>
                  {item.active ? (
                    <i className="bi bi-check-lg text-success" />
                  ) : (
                    <i className="bi bi-x-lg text-danger" />
                  )}
                </td>
                <td>
                  {item.gender === 1 ? <i className="bi bi-gender-male me-2" /> : null}
                  {item.gender === 2 ? <i className="bi bi-gender-female me-2" /> : null}
                  {genderLabels[item.gender ?? 0]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-3">
        <div className="small text-secondary">Found {totalFound.toLocaleString()}</div>
        <PaginationSummary
          search={search}
          pageCount={pageCount}
          onPrevious={() => searchCustomers(search.page - 1, false, search)}
          onNext={() => searchCustomers(search.page + 1, false, search)}
        />
      </div>
    </div>
  )
}

function SortableHeader({ label, column, search, onSort, width }) {
  const isCurrentColumn = search.sortBy === column

  const icon =
    !isCurrentColumn
      ? null
      : search.sortDirection === sortDirections.ascending
        ? 'bi bi-chevron-down'
        : 'bi bi-chevron-up'

  return (
    <th style={{ width }}>
      <button
        type="button"
        className="btn btn-link text-decoration-none d-inline-flex align-items-center text-nowrap"
        onClick={() => onSort(column)}
      >
        {label}
        {icon ? <i className={`${icon} ms-1`} /> : null}
      </button>
    </th>
  )
}

function PaginationSummary({ search, pageCount, onPrevious, onNext }) {
  return (
    <ul className="pagination mb-0">
      {search.page + 1 > 1 ? (
        <li className="page-item">
          <button type="button" className="page-link" onClick={onPrevious}>
            Previous
          </button>
        </li>
      ) : null}

      <li className="page-item disabled">
        <span className="page-link">
          Page {pageCount === 0 ? 0 : search.page + 1} of {pageCount}
        </span>
      </li>

      {search.page + 1 < pageCount ? (
        <li className="page-item">
          <button type="button" className="page-link" onClick={onNext}>
            Next
          </button>
        </li>
      ) : null}
    </ul>
  )
}
