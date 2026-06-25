import { useEffect, useRef, useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import './FAQ.css'

const faqs = [
  {
    q: 'Is SwiftCare HIPAA compliant?',
    a: 'Yes. SwiftCare uses end-to-end encryption for all data in transit and at rest. Audio is processed on-device or through HIPAA-eligible endpoints with zero-retention policies. We sign a BAA with all paid customers.'
  },
  {
    q: 'Does SwiftCare integrate with my EHR?',
    a: 'SwiftCare exports structured notes in standard formats. Enterprise customers get dedicated EHR integration support for Epic, Oracle Health, athenahealth, and other major systems. Native integrations are on the roadmap.'
  },
  {
    q: 'What specialties does SwiftCare support?',
    a: 'SwiftCare is trained across 100+ specialties including Internal Medicine, Family Medicine, Emergency Medicine, Hospitalist, Psychiatry, Oncology, Cardiology, and more. Specialty-specific note templates are available on Pro and Enterprise.'
  },
  {
    q: 'How accurate are the SOAP notes?',
    a: 'In independent testing, SwiftCare achieves >95% accuracy on clinical content. Most clinicians edit less than one sentence per note. The AI is trained on millions of de-identified clinical encounters across specialties.'
  },
  {
    q: "What is Quick Record and why would I use it?",
    a: "Quick Record lets you start recording immediately without selecting a patient first — perfect for hallway conversations, curbside consults, or when you're in a rush. You assign the visit to a patient afterward. Nothing gets lost."
  },
  {
    q: 'What happens to my recordings?',
    a: 'Audio is processed in real-time and not stored after transcription is complete. Transcripts are encrypted and stored only in your account. You can delete any visit at any time. See our Privacy Policy for full details.'
  },
  {
    q: 'Can I use SwiftCare for telehealth visits?',
    a: 'Yes. SwiftCare works for in-person visits, telehealth, and voice dictation modes. Simply start recording during your telehealth session and SwiftCare handles the rest.'
  },
]

function FAQItem({ faq, index }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`faq-item${open ? ' faq-item--open' : ''}`}>
      <button
        id={`faq-toggle-${index}`}
        className="faq-item__question"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>{faq.q}</span>
        <div className="faq-item__icon">
          {open ? <Minus size={16} /> : <Plus size={16} />}
        </div>
      </button>
      {open && (
        <div className="faq-item__answer">
          <p>{faq.a}</p>
        </div>
      )}
    </div>
  )
}

export default function FAQ() {
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.1 }
    )
    const els = ref.current?.querySelectorAll('.reveal') ?? []
    els.forEach((el, i) => { el.style.transitionDelay = `${i * 0.05}s`; observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  return (
    <section id="faq" className="section faq" ref={ref}>
      <div className="container faq__inner">
        <div className="faq__header reveal">
          <p className="section-label">FAQ</p>
          <h2 className="heading-xl">
            Common<br /><span className="text-gradient">questions</span>
          </h2>
          <p className="text-secondary" style={{ marginTop: 'var(--space-sm)', lineHeight: 1.65 }}>
            Can't find your answer? <a href="mailto:hello@swiftcare.ai" style={{ color: 'var(--teal)' }}>Contact us</a>
          </p>
        </div>

        <div className="faq__list">
          {faqs.map((faq, i) => (
            <div key={i} className="reveal">
              <FAQItem faq={faq} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
