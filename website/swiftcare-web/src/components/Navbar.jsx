import { useEffect, useState } from 'react'
import { Zap, Menu, X } from 'lucide-react'
import './Navbar.css'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ]

  return (
    <nav id="navbar" className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
      <div className="container navbar__inner">
        {/* Logo */}
        <a href="#" className="navbar__logo">
          <div className="navbar__logo-icon">
            <Zap size={18} strokeWidth={2.5} />
          </div>
          <span className="navbar__logo-text">SwiftCare</span>
        </a>

        {/* Desktop links */}
        <ul className="navbar__links">
          {links.map(l => (
            <li key={l.label}>
              <a href={l.href} className="navbar__link">{l.label}</a>
            </li>
          ))}
        </ul>

        {/* Desktop CTA */}
        <div className="navbar__cta">
          <a href="#pricing" className="btn btn-outline btn-sm">Sign In</a>
          <a href="#pricing" className="btn btn-primary btn-sm">Get Started Free</a>
        </div>

        {/* Mobile toggle */}
        <button
          id="navbar-menu-toggle"
          className="navbar__toggle"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="navbar__mobile">
          {links.map(l => (
            <a key={l.label} href={l.href} className="navbar__mobile-link" onClick={() => setMenuOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="#pricing" className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={() => setMenuOpen(false)}>
            Get Started Free
          </a>
        </div>
      )}
    </nav>
  )
}
