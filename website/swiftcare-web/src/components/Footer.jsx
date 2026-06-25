import { Zap, Twitter, Linkedin, Github } from 'lucide-react'
import './Footer.css'

const links = {
  Product: ['Features', 'How It Works', 'Pricing', 'Changelog', 'Status'],
  Company: ['About', 'Blog', 'Careers', 'Press', 'Contact'],
  Resources: ['Documentation', 'API Reference', 'HIPAA Compliance', 'Privacy Policy', 'Terms of Service'],
  Specialties: ['Internal Medicine', 'Family Medicine', 'Emergency', 'Hospitalist', 'Psychiatry'],
}

export default function Footer() {
  return (
    <footer id="footer" className="footer">
      <div className="container">
        <div className="footer__top">
          {/* Brand */}
          <div className="footer__brand">
            <a href="#" className="footer__logo">
              <div className="footer__logo-icon">
                <Zap size={16} strokeWidth={2.5} />
              </div>
              <span className="footer__logo-text">SwiftCare</span>
            </a>
            <p className="footer__tagline">
              AI medical scribe for iOS.<br />
              Document less. Care more.
            </p>
            <div className="footer__social">
              <a href="#" id="footer-twitter" className="footer__social-link" aria-label="Twitter">
                <Twitter size={16} />
              </a>
              <a href="#" id="footer-linkedin" className="footer__social-link" aria-label="LinkedIn">
                <Linkedin size={16} />
              </a>
              <a href="#" id="footer-github" className="footer__social-link" aria-label="GitHub">
                <Github size={16} />
              </a>
            </div>
            <div className="footer__badges">
              <div className="footer__badge">HIPAA Compliant</div>
              <div className="footer__badge">SOC 2 Certified</div>
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category} className="footer__col">
              <h3 className="footer__col-title">{category}</h3>
              <ul className="footer__links">
                {items.map(item => (
                  <li key={item}>
                    <a href="#" className="footer__link">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer__bottom">
          <p className="footer__copy">
            © 2026 SwiftCare. All rights reserved.
          </p>
          <p className="footer__disclaimer">
            SwiftCare is a clinical documentation tool. It does not provide medical advice, diagnosis, or treatment.
          </p>
        </div>
      </div>
    </footer>
  )
}
