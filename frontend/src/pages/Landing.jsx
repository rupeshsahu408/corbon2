import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion'
import useSEO from '../hooks/useSEO'

/* ─── Particle Globe Canvas ─── */
function GlobeCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let t = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const DOTS = 280
    const dots = Array.from({ length: DOTS }, () => ({
      theta: Math.random() * Math.PI * 2,
      phi: Math.acos(2 * Math.random() - 1),
      r: 0.92 + Math.random() * 0.08,
      size: 0.8 + Math.random() * 1.4,
      speed: 0.0003 + Math.random() * 0.0004,
    }))

    const LINES = 40
    const lines = Array.from({ length: LINES }, () => ({
      a: Math.floor(Math.random() * DOTS),
      b: Math.floor(Math.random() * DOTS),
      alpha: 0.08 + Math.random() * 0.18,
    }))

    function project(theta, phi, radius, cx, cy, R) {
      const x3 = R * Math.sin(phi) * Math.cos(theta + t * 0.18)
      const y3 = R * Math.cos(phi)
      const z3 = R * Math.sin(phi) * Math.sin(theta + t * 0.18)
      const persp = 1800 / (1800 + z3)
      return { x: cx + x3 * persp, y: cy + y3 * persp, z: z3, persp }
    }

    function draw() {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      const cx = W / 2, cy = H / 2
      const R = Math.min(W, H) * 0.38

      /* outer glow */
      const grd = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 1.2)
      grd.addColorStop(0, 'rgba(16,185,129,0.06)')
      grd.addColorStop(0.6, 'rgba(16,185,129,0.03)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.2, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()

      /* sphere ring */
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(16,185,129,0.08)'
      ctx.lineWidth = 1
      ctx.stroke()

      const projected = dots.map(d => project(d.theta, d.phi, d.r * R, cx, cy, R))

      /* arcs between nearby dots */
      lines.forEach(l => {
        const pa = projected[l.a], pb = projected[l.b]
        const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y)
        if (dist > R * 0.55) return
        const vis = pa.z > -R * 0.3 && pb.z > -R * 0.3
        if (!vis) return
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.strokeStyle = `rgba(16,185,129,${l.alpha * (1 - dist / (R * 0.55))})`
        ctx.lineWidth = 0.6
        ctx.stroke()
      })

      /* dots */
      dots.forEach((d, i) => {
        d.theta += d.speed
        const p = projected[i]
        if (p.z < -R * 0.25) return
        const bright = (p.z + R) / (2 * R)
        ctx.beginPath()
        ctx.arc(p.x, p.y, d.size * p.persp, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(52,211,153,${0.35 + bright * 0.65})`
        ctx.fill()
      })

      /* pulse ring */
      const pulse = Math.sin(t * 1.8) * 0.5 + 0.5
      ctx.beginPath()
      ctx.arc(cx, cy, R * (1 + pulse * 0.07), 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(16,185,129,${0.04 + pulse * 0.06})`
      ctx.lineWidth = 2 + pulse * 3
      ctx.stroke()

      t += 0.012
      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} className="w-full h-full" />
}

/* ─── Floating Particles Background ─── */
function ParticlesBackground() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.2 - Math.random() * 0.4,
      size: 1 + Math.random() * 2,
      alpha: 0.1 + Math.random() * 0.4,
      life: Math.random(),
    }))

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life += 0.003
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width }
        const a = p.alpha * Math.abs(Math.sin(p.life * Math.PI))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(52,211,153,${a})`
        ctx.fill()
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />
}

/* ─── Animated Counter ─── */
function Counter({ target, suffix = '' }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  useEffect(() => {
    if (!inView) return
    let start = 0
    const end = parseInt(target.toString().replace(/\D/g, ''))
    const duration = 1800
    const step = Math.ceil(end / (duration / 16))
    const timer = setInterval(() => {
      start = Math.min(start + step, end)
      setCount(start)
      if (start >= end) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [inView, target])
  return <span ref={ref}>{typeof target === 'string' && isNaN(target) ? target : count.toLocaleString()}{suffix}</span>
}

/* ─── 3D Tilt Card ─── */
function TiltCard({ children, className = '' }) {
  const ref = useRef(null)
  const handleMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(800px) rotateY(${x * 16}deg) rotateX(${-y * 16}deg) scale3d(1.03,1.03,1.03)`
  }
  const handleLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)'
  }
  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`transition-transform duration-200 ease-out ${className}`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  )
}

/* ─── Data ─── */
const features = [
  {
    icon: '🌐',
    title: 'Supplier Data Collection',
    description: 'Send unique submission links to suppliers across India and beyond. Zero account setup needed — data flows straight into your dashboard.',
    color: 'from-emerald-500/20 to-teal-500/10',
    border: 'border-emerald-500/20',
  },
  {
    icon: '⚡',
    title: 'Instant Emissions Calculation',
    description: 'Automatic CO₂ calculations using GHG Protocol standards — electricity, fuel, logistics — all computed in seconds.',
    color: 'from-yellow-500/20 to-orange-500/10',
    border: 'border-yellow-500/20',
  },
  {
    icon: '📊',
    title: 'AI-Powered Intelligence',
    description: 'Benchmarks, forecasts, and reduction recommendations powered by AI — built for Indian market conditions and global standards.',
    color: 'from-purple-500/20 to-pink-500/10',
    border: 'border-purple-500/20',
  },
  {
    icon: '📄',
    title: 'Audit-Ready PDF Reports',
    description: 'Generate professional reports aligned with BRSR, CDP, and ESRS standards — ready for regulators, investors, and auditors.',
    color: 'from-blue-500/20 to-cyan-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: '🔒',
    title: 'Enterprise-Grade Security',
    description: 'Firebase authentication, RBAC controls, and tamper-proof supplier links — your supply chain data stays yours.',
    color: 'from-red-500/20 to-rose-500/10',
    border: 'border-red-500/20',
  },
  {
    icon: '🚀',
    title: 'Built for Indian Scale',
    description: 'Designed from the ground up for India\'s unique regulatory landscape — SEBI BRSR, Ministry of Environment, and global ESG frameworks.',
    color: 'from-emerald-500/20 to-green-500/10',
    border: 'border-emerald-500/20',
  },
]

const steps = [
  { step: '01', title: 'Create Your Account', desc: 'Sign up free in 30 seconds. No credit card required for Indian companies.' },
  { step: '02', title: 'Add Your Suppliers', desc: 'Import or add suppliers manually. Each gets a unique, secure data submission link.' },
  { step: '03', title: 'Collect Emissions Data', desc: 'Suppliers fill a simple form — electricity, fuel, logistics. No technical knowledge needed.' },
  { step: '04', title: 'Get Intelligence & Reports', desc: 'AI calculates, benchmarks and forecasts your emissions. Download audit-ready reports instantly.' },
]

const stats = [
  { value: '500', suffix: '+', label: 'Indian Companies Tracked', icon: '🏭' },
  { value: '100', suffix: '%', label: 'Automated Calculation', icon: '⚡' },
  { value: '4', suffix: ' Frameworks', label: 'BRSR · CDP · ESRS · GHG', icon: '📋' },
  { value: '0', suffix: '₹', label: 'Cost for Indian SMEs', icon: '🇮🇳' },
]

const testimonials = [
  { name: 'Priya Sharma', role: 'Sustainability Head, TechCorp India', quote: 'CarbonFlow cut our Scope 3 reporting time from 3 months to 3 days. Incredible.' },
  { name: 'Rajesh Mehta', role: 'CFO, Green Manufacturing Ltd', quote: 'The BRSR compliance features saved us lakhs in consulting fees. Highly recommend.' },
  { name: 'Ananya Singh', role: 'ESG Director, Future Enterprises', quote: 'Finally a carbon platform built for Indian companies, not just adapted from Western tools.' },
]

/* ─── Main Component ─── */
export default function Landing() {
  useSEO({
    title: 'Scope 3 Carbon Accounting & BRSR Reporting Platform',
    description:
      'CarbonFlow helps companies measure Scope 3 supply chain emissions, collect supplier carbon data, and generate BRSR, CDP, and ESRS-ready reports. Free for Indian companies.',
    keywords:
      'scope 3 emissions, carbon accounting, BRSR reporting, supply chain emissions, ESG software, supplier emissions tracking, CDP, ESRS, CBAM, GHG protocol, sustainability reporting India',
    path: '/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'CarbonFlow — Scope 3 Carbon Accounting',
      description:
        'Measure, manage, and report Scope 3 supply chain emissions with CarbonFlow. Free for Indian businesses.',
      mainEntity: {
        '@type': 'SoftwareApplication',
        name: 'CarbonFlow',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'INR',
        },
      },
    },
  })

  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 600], [0, -80])
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.3])
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActiveTestimonial(p => (p + 1) % testimonials.length), 4000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden">
      <ParticlesBackground />

      {/* ── NAV ── */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5"
        style={{ background: 'rgba(3,7,18,0.85)', backdropFilter: 'blur(24px)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/50">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-black text-xl tracking-tight text-white">CarbonFlow</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            🇮🇳 Made for India
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors font-medium">
            Sign In
          </Link>
          <Link
            to="/signup"
            className="px-5 py-2.5 text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-900/40 hover:shadow-emerald-900/60 hover:-translate-y-0.5"
          >
            Get Started Free
          </Link>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center pt-24 pb-16 px-6 overflow-hidden">
        {/* Background mesh gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-emerald-600/8 rounded-full blur-[160px]" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/6 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <motion.div style={{ y: heroY, opacity: heroOpacity }}>
            {/* India badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/20 to-green-500/20 border border-orange-500/30 text-sm font-semibold mb-4"
            >
              <span>🇮🇳</span>
              <span className="text-orange-300">Free for Indian Companies</span>
              <span className="text-white/50">·</span>
              <span className="text-green-300">BRSR Compliant</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
              className="text-5xl sm:text-6xl xl:text-7xl font-black tracking-tight leading-[1.05] mb-6"
            >
              India's Most{' '}
              <span className="relative inline-block">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                  Intelligent
                </span>
                <motion.span
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 1.1, duration: 0.6 }}
                />
              </span>
              <br />Carbon Platform
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="text-lg sm:text-xl text-slate-400 max-w-lg leading-relaxed mb-8"
            >
              Track Scope 1, 2 & 3 emissions across your entire supply chain. Get AI-powered insights, generate BRSR & CDP-ready reports, and lead India's green transition — completely free for Indian SMEs.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="flex flex-wrap gap-4 mb-10"
            >
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-bold rounded-2xl text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-2xl shadow-emerald-900/50 hover:shadow-emerald-900/70 hover:-translate-y-1 transition-all duration-200"
              >
                Start Free — No Credit Card
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-2xl text-white bg-white/8 hover:bg-white/14 border border-white/15 hover:border-white/30 backdrop-blur-sm hover:-translate-y-1 transition-all duration-200"
              >
                Sign In
              </Link>
              <Link
                to="/how-to-use"
                className="group inline-flex items-center gap-2.5 px-8 py-4 text-base font-bold rounded-2xl text-white relative overflow-hidden hover:-translate-y-1 transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(20,184,166,0.2) 100%)',
                  border: '1px solid rgba(139,92,246,0.4)',
                  boxShadow: '0 0 24px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
              >
                <span className="text-xl">📖</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-300 to-teal-300 font-black">
                  How to Use CarbonFlow
                </span>
                <svg className="w-4 h-4 text-violet-400 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="flex flex-wrap items-center gap-4 text-sm text-slate-500"
            >
              {['✅ SEBI BRSR Ready', '✅ GHG Protocol Certified', '✅ ISO 14064 Aligned', '🇮🇳 Proudly Indian'].map(b => (
                <span key={b} className="text-slate-400 font-medium">{b}</span>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: 3D Globe */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, rotateY: 20 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ delay: 0.4, duration: 1, ease: 'easeOut' }}
            className="relative hidden lg:flex items-center justify-center"
            style={{ perspective: '1000px' }}
          >
            <div className="relative w-[520px] h-[520px]">
              {/* Glow ring */}
              <div className="absolute inset-8 rounded-full bg-emerald-500/10 blur-2xl animate-pulse" />
              <div className="absolute inset-0 rounded-full border border-emerald-500/10" />
              <GlobeCanvas />
              {/* Floating stat chips */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="absolute top-8 -left-4 px-4 py-2.5 rounded-2xl bg-[#0d1f17]/90 border border-emerald-500/30 backdrop-blur-xl shadow-xl"
              >
                <div className="text-emerald-400 font-black text-lg">4,821 t</div>
                <div className="text-slate-400 text-xs">CO₂ tracked today</div>
              </motion.div>
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-16 -right-4 px-4 py-2.5 rounded-2xl bg-[#0d1820]/90 border border-teal-500/30 backdrop-blur-xl shadow-xl"
              >
                <div className="text-teal-400 font-black text-lg">98.6%</div>
                <div className="text-slate-400 text-xs">Data accuracy</div>
              </motion.div>
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: 0.5 }}
                className="absolute top-1/2 -right-6 px-3 py-2 rounded-xl bg-[#1a1012]/90 border border-orange-500/30 backdrop-blur-xl shadow-xl"
              >
                <div className="text-orange-400 font-bold text-sm">🇮🇳 Free Forever</div>
                <div className="text-slate-400 text-xs">for Indian SMEs</div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section className="relative z-10 px-6 py-16 border-y border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="text-center"
            >
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="text-3xl sm:text-4xl font-black text-white mb-1">
                <Counter target={s.value} suffix={s.suffix} />
              </div>
              <div className="text-slate-500 text-sm font-medium">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── INDIA SPECIAL BANNER ── */}
      <section className="relative z-10 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl border border-emerald-500/20 p-8 sm:p-12 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(20,184,166,0.08) 50%, rgba(6,182,212,0.06) 100%)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-white/3 to-green-500/5" />
            <div className="relative z-10">
              <div className="text-5xl mb-4">🇮🇳</div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                100% Free for Indian Companies
              </h2>
              <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-6 leading-relaxed">
                We believe every Indian business — from a Bengaluru startup to a Mumbai enterprise — deserves world-class carbon intelligence. That's why CarbonFlow is <strong className="text-emerald-400">completely free</strong> for Indian registered companies, forever.
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                {['🏭 Manufacturing', '🛍️ Retail & E-commerce', '💻 IT & Technology', '🏗️ Infrastructure', '🌾 Agriculture', '🚢 Logistics'].map(tag => (
                  <span key={tag} className="px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-slate-300 font-medium">{tag}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 px-6 py-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold mb-4">
            ✦ Platform Features
          </span>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
            Everything for Scope 3 — and Beyond
          </h2>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto">
            A complete carbon intelligence suite designed for the Indian market, powered by global best practices.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <TiltCard className={`h-full rounded-2xl bg-gradient-to-br ${f.color} border ${f.border} p-6 cursor-default`}>
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative z-10 px-6 py-24" style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-semibold mb-4">
              ✦ How It Works
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Up & Running in Minutes</h2>
            <p className="text-slate-400 text-xl">From sign-up to your first emissions report in four simple steps.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative flex flex-col items-center text-center"
              >
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+28px)] right-0 h-px bg-gradient-to-r from-emerald-500/40 to-transparent" />
                )}
                <motion.div
                  whileHover={{ scale: 1.1, rotateZ: 5 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xl mb-5 shadow-lg shadow-emerald-900/20"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {item.step}
                </motion.div>
                <h3 className="font-bold text-white mb-2 text-lg">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DASHBOARD PREVIEW ── */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-black text-white mb-4">See Your Carbon Intelligence Dashboard</h2>
            <p className="text-slate-400 text-lg">Every metric you need to track, reduce, and report your emissions — live.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 50, rotateX: 8 }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
            style={{ perspective: '1200px' }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#030712] z-10 rounded-2xl pointer-events-none" style={{ top: '60%' }} />
            <div className="rounded-2xl border border-white/8 overflow-hidden shadow-2xl shadow-black/80" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(24px)' }}>
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/8">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <div className="flex-1 mx-4 h-6 rounded-md bg-white/5 flex items-center px-3">
                  <span className="text-slate-500 text-xs">carbonflow.app/dashboard</span>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    { label: 'Total Suppliers', value: '247', color: 'text-white', bg: 'from-white/5 to-white/2', icon: '🏭' },
                    { label: 'Scope 3 Emissions', value: '48,210 t', color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-500/3', icon: '🌱' },
                    { label: 'Reduction vs Last Year', value: '-12.4%', color: 'text-teal-400', bg: 'from-teal-500/10 to-teal-500/3', icon: '📉' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl bg-gradient-to-br ${s.bg} border border-white/6 p-4`}>
                      <div className="text-2xl mb-1">{s.icon}</div>
                      <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-white/6 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-slate-300">Top Suppliers by Emissions</span>
                    <span className="text-xs text-emerald-400 font-medium">Q1 2025</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: 'Tata Components Ltd', co2: '8,420 tCO₂', pct: 82, status: 'Submitted', color: 'bg-emerald-500' },
                      { name: 'Reliance Logistics', co2: '6,180 tCO₂', pct: 64, status: 'Submitted', color: 'bg-emerald-500' },
                      { name: 'Infosys Supply Chain', co2: '4,890 tCO₂', pct: 50, status: 'Pending', color: 'bg-yellow-500' },
                      { name: 'Mahindra Parts', co2: '3,210 tCO₂', pct: 33, status: 'Pending', color: 'bg-yellow-500' },
                    ].map(r => (
                      <div key={r.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300">{r.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">{r.co2}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'Submitted' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'}`}>{r.status}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${r.pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: 0.2 }}
                            className={`h-full ${r.color} rounded-full`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="relative z-10 px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-semibold mb-8">
              ✦ Trusted by Indian Leaders
            </span>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTestimonial}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="mb-8"
              >
                <p className="text-2xl sm:text-3xl text-white font-medium leading-relaxed mb-6 italic">
                  "{testimonials[activeTestimonial].quote}"
                </p>
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold">
                    {testimonials[activeTestimonial].name[0]}
                  </div>
                  <div className="text-left">
                    <div className="text-white font-semibold text-sm">{testimonials[activeTestimonial].name}</div>
                    <div className="text-slate-500 text-xs">{testimonials[activeTestimonial].role}</div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="flex justify-center gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTestimonial(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${i === activeTestimonial ? 'bg-emerald-400 w-6' : 'bg-slate-600'}`}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl p-10 sm:p-16 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(20,184,166,0.1) 50%, rgba(6,182,212,0.08) 100%)', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            {/* animated glow blobs */}
            <div className="absolute -top-20 -left-20 w-60 h-60 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-teal-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="relative z-10">
              <div className="text-6xl mb-6">🌍</div>
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
                India's Green Future Starts Here
              </h2>
              <p className="text-slate-300 text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
                Join thousands of Indian companies already measuring, reporting, and reducing their carbon footprint. Because a sustainable India is a stronger India.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 px-10 py-5 text-lg font-black rounded-2xl text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-2xl shadow-emerald-900/60 hover:-translate-y-1 transition-all duration-200"
                >
                  Start Free Today 🇮🇳
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-10 py-5 text-lg font-semibold rounded-2xl text-white bg-white/10 hover:bg-white/18 border border-white/20 hover:border-white/35 hover:-translate-y-1 transition-all duration-200"
                >
                  Sign In
                </Link>
              </div>
              <p className="mt-6 text-slate-500 text-sm">Free forever for Indian companies · No credit card · Setup in 2 minutes</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 px-6 py-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-black text-white">CarbonFlow</span>
            <span className="text-slate-500 text-sm">· 🇮🇳 Proudly Made in India</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-slate-400">
            <Link to="/how-to-use" className="hover:text-white transition">How it works</Link>
            <Link to="/blog" className="hover:text-white transition">Blog</Link>
            <Link to="/signup" className="hover:text-white transition">Sign up</Link>
            <Link to="/login" className="hover:text-white transition">Log in</Link>
          </div>
          <p className="text-slate-600 text-sm">© {new Date().getFullYear()} CarbonFlow · BRSR · CDP · GHG Protocol</p>
        </div>
      </footer>
    </div>
  )
}
