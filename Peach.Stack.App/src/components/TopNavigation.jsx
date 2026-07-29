import './TopNavigation.css'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'
import PeachStackLogo from './PeachStackLogo'

const THEME_STORAGE_KEY = 'Peach.Stack.theme'

function readInitialTheme() {
  const fallbackTheme = 'light'

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

    if (storedTheme === 'dark') {
      return 'dark'
    }

    if (storedTheme === 'light') {
      return 'light'
    }
  } catch {
    return fallbackTheme
  }

  return fallbackTheme
}

/**
 * The sticky top navigation bar rendered on every page.
 *
 * Behaviour:
 *  - Renders different sets of links depending on whether the user is
 *    authenticated, and whether they hold the Administrator role.
 *  - Surfaces a single Toolkit link for shared document support features.
 *  - Collapses to a hamburger menu on small screens (Bootstrap responsive).
 *  - Automatically closes the hamburger menu after any navigation.
 *  - Owns the dark/light theme toggle.
 */
export default function TopNavigation() {
  // --- State & Context ----------------------------------------------------

  // Whether the mobile hamburger menu is currently expanded.
  const [isMobileMenuExpanded, setIsMobileMenuExpanded] = useState(false)

  // Current route  -  used to detect page changes so we can close the mobile menu.
  const currentLocation = useLocation()

  // Auth state: tells us whether the user is logged in, their role, and features.
  const authContext = useAuth()

  // Active theme ('light' | 'dark').
  const [theme, setTheme] = useState(readInitialTheme)

  // --- Theme Management ---------------------------------------------------

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme)

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Ignore storage write failures (private mode, blocked storage, etc.).
    }
  }, [theme])

  function toggleTheme() {
    if (theme === 'light') {
      setTheme('dark')
    } else {
      setTheme('light')
    }
  }

  let themeIconClassName = 'bi bi-moon-fill'
  let nextThemeLabel = 'dark'

  if (theme === 'dark') {
    themeIconClassName = 'bi bi-sun-fill'
    nextThemeLabel = 'light'
  }

  // --- Auto-Close Mobile Menu on Navigation -------------------------------

  // Whenever the user navigates to a new page, collapse the hamburger menu so
  // it doesn't remain open over the new page's content.
  useEffect(() => {
    const closeMenuTimeoutId = window.setTimeout(() => {
      setIsMobileMenuExpanded(false)
    }, 0)

    return () => {
      window.clearTimeout(closeMenuTimeoutId)
    }
  }, [currentLocation.pathname])

  // --- Render ----------------------------------------------------------

  let navigationClassName = 'collapse navbar-collapse'

  if (isMobileMenuExpanded) {
    navigationClassName = 'collapse navbar-collapse show'
  }

  function renderAuthenticatedLinks() {
    return (
      <>
        <Link to="/customers" className="nav-link text-white d-inline-flex align-items-center">
          <i className="bi bi-search me-2 flex-shrink-0 text-info" />
          Search
        </Link>

        {authContext.isAdmin && (
          <Link to="/admin" className="nav-link text-white d-inline-flex align-items-center">
            <i className="bi bi-gear me-2 flex-shrink-0 text-primary" />
            Admin
          </Link>
        )}

        <Link to="/account" className="nav-link text-white d-inline-flex align-items-center">
          <i className="bi bi-person-gear me-2 flex-shrink-0 text-secondary" />
          {authContext.user?.email}
        </Link>

        <Link to="/logout" className="nav-link text-white d-inline-flex align-items-center">
          <i className="bi bi-box-arrow-right me-2 flex-shrink-0 text-danger" />
          Log out
        </Link>
      </>
    )
  }

  function renderAnonymousLinks() {
    return (
      <>
        <Link to="/register" className="nav-link text-white d-inline-flex align-items-center">
          <i className="bi bi-person-plus me-2 flex-shrink-0 text-success" />
          Register
        </Link>

        <Link to="/login" className="nav-link text-white d-inline-flex align-items-center">
          <i className="bi bi-box-arrow-in-right me-2 flex-shrink-0 text-info" />
          Sign In
        </Link>
      </>
    )
  }

  function renderNavigationLinks() {
    if (authContext.isAuthenticated) {
      return renderAuthenticatedLinks()
    }

    return renderAnonymousLinks()
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm sticky-top">
      <div className="container-fluid">
        {/* Brand logo + app name  -  clicking navigates to the home page. */}
        <Link
          to="/"
          className="navbar-brand ms-2 d-inline-flex align-items-center gap-2 text-white"
        >
          <PeachStackLogo className="top-nav-brand-logo" />
          <span className=" brand-name text-white">PEACH.STACK</span>
        </Link>

        {/* Hamburger toggle button  -  only visible on small screens. */}
        <button
          type="button"
          className="navbar-toggler"
          aria-controls="main-navigation"
          aria-expanded={isMobileMenuExpanded}
          aria-label="Toggle navigation"
          onClick={() => setIsMobileMenuExpanded((isExpanded) => !isExpanded)}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div
          id="main-navigation"
          className={navigationClassName}
        >
          <div className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
            {renderNavigationLinks()}
            <button
              type="button"
              className="theme-toggle-btn top-nav-theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${nextThemeLabel} theme`}
              title={`Switch to ${nextThemeLabel} theme`}
            >
              <i className={themeIconClassName} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
