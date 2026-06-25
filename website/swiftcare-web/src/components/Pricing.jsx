import { useEffect, useRef } from 'react'
import { Check, Zap, Building2 } from 'lucide-react'
import './Pricing.css'

const plans = [
  {
    id: 'free',
    icon: Zap,
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Perfect for getting started or occasional use.',
    features: [
      '5 visits per month',
      'Ambient SOAP note generation',
      'Basic patient search',
      '1 device',
      'Community support',
    ],
    notIncluded: ['Unlimited visits', 'Appointment scheduling', 'Unassigned queue', 'Priority support'],
    cta: 'Start Free',
    ctaStyle: 'outline',
    popular: false,
  },
  {
    id: 'pro',
    icon: Zap,
    name: 'Pro',
    price: '$49',
    period: 'per month',
    desc: 'Everything you need for a full clinical practice.',
    features: [
      'Unlimited visits',
      'Ambient SOAP note generation',
      'Full patient management',
      'Appointment scheduling',
      'Unassigned visit queue',
      'Quick Record mode',
      'AI patient summaries',
      'Priority email support',
    ],
    notIncluded: [],
    cta: 'Start 14-Day Free Trial',
    ctaStyle: 'primary',
    popular: true,
  },
  {
    id: 'team',
    icon: Building2,
    name: 'Team / Enterprise',
    price: 'Custom',
    period: 'per user',
    desc: 'For health systems, group practices, and clinics.',
    features: [
      'Everything in Pro',
      'Multi-provider management',
      'EHR integration support',
      'HIPAA BAA included',
      'Admin dashboard',
      'Custom onboarding',
      'Dedicated support',
      'SLA guarantees',
    ],
    notIncluded: [],
    cta: 'Contact Sales',
    ctaStyle: 'ghost',
    popular: false,
  },
]

export default function Pricing() {
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.1 }
    )
    const els = ref.current?.querySelectorAll('.reveal') ?? []
    els.forEach((el, i) => { el.style.transitionDelay = `${i * 0.1}s`; observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  return (
    <section id="pricing" className="section pricing" ref={ref}>
      <div className="pricing__glow" />
      <div className="container">
        <div className="section-header reveal">
          <p className="section-label">Pricing</p>
          <h2 className="heading-xl section-title">
            Simple, transparent<br />
            <span className="text-gradient">pricing</span>
          </h2>
          <p className="section-subtitle">
            Start free. Upgrade when you're ready. No hidden fees, no per-note charges.
          </p>
        </div>

        <div className="pricing__grid">
          {plans.map((plan, i) => {
            const Icon = plan.icon
            return (
              <div
                key={plan.id}
                id={`pricing-${plan.id}`}
                className={`pricing-card reveal${plan.popular ? ' pricing-card--popular' : ''}`}
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                {plan.popular && (
                  <div className="pricing-card__badge">Most Popular</div>
                )}

                <div className="pricing-card__header">
                  <div className={`pricing-card__icon${plan.popular ? ' pricing-card__icon--popular' : ''}`}>
                    <Icon size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="pricing-card__name">{plan.name}</p>
                    <p className="pricing-card__desc">{plan.desc}</p>
                  </div>
                </div>

                <div className="pricing-card__price">
                  <span className="pricing-card__amount">{plan.price}</span>
                  <span className="pricing-card__period">/{plan.period}</span>
                </div>

                <a
                  href={plan.id === 'team' ? '#contact' : '#download'}
                  className={`btn btn-${plan.ctaStyle} pricing-card__cta`}
                  id={`pricing-cta-${plan.id}`}
                >
                  {plan.cta}
                </a>

                <ul className="pricing-card__features">
                  {plan.features.map(f => (
                    <li key={f} className="pricing-card__feature pricing-card__feature--yes">
                      <Check size={14} />
                      {f}
                    </li>
                  ))}
                  {plan.notIncluded.map(f => (
                    <li key={f} className="pricing-card__feature pricing-card__feature--no">
                      <span className="pricing-card__cross">✕</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <p className="pricing__footer reveal">
          All plans include a 14-day free trial · Cancel anytime · HIPAA compliant
        </p>
      </div>
    </section>
  )
}
