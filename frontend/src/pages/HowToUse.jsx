import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import useSEO from '../hooks/useSEO'

/* ─── Reusable fade-in wrapper ─── */
function FadeIn({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ─── Feature Illustration ─── */
function FeatureIllustration({ type }) {
  const illustrations = {
    dashboard: (
      <div className="w-full h-full flex flex-col gap-3 p-5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Suppliers', val: '247', color: 'from-emerald-500/30 to-teal-500/20', text: 'text-emerald-400' },
            { label: 'CO₂ Total', val: '48.2kt', color: 'from-yellow-500/20 to-orange-500/10', text: 'text-yellow-400' },
            { label: 'Reduction', val: '-12%', color: 'from-blue-500/20 to-cyan-500/10', text: 'text-blue-400' },
          ].map(c => (
            <div key={c.label} className={`rounded-xl bg-gradient-to-br ${c.color} border border-white/10 p-3 flex flex-col items-center justify-center`}>
              <div className={`font-black text-lg ${c.text}`}>{c.val}</div>
              <div className="text-slate-500 text-[10px] mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-white/3 border border-white/8 p-3 flex-1">
          <div className="text-slate-400 text-xs mb-2 font-semibold">Emissions Trend</div>
          <div className="flex items-end gap-1 h-14">
            {[40, 65, 55, 80, 70, 90, 75, 85, 95, 72, 88, 60].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-emerald-500/60 to-emerald-400/30" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    ),
    suppliers: (
      <div className="w-full h-full flex flex-col gap-3 p-5">
        <div className="text-slate-400 text-xs font-semibold mb-1">Your Suppliers</div>
        {[
          { name: 'Tata Components Ltd', status: 'Submitted', pct: 88, color: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400' },
          { name: 'Reliance Logistics', status: 'Submitted', pct: 72, color: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400' },
          { name: 'Infosys Supply Co.', status: 'Pending', pct: 0, color: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400' },
          { name: 'Mahindra Parts', status: 'Invited', pct: 0, color: 'bg-slate-500', badge: 'bg-slate-500/15 text-slate-400' },
        ].map(s => (
          <div key={s.name} className="rounded-xl bg-white/3 border border-white/8 px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm flex-shrink-0">🏭</div>
              <span className="text-slate-300 text-xs font-medium truncate">{s.name}</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${s.badge}`}>{s.status}</span>
          </div>
        ))}
        <button className="mt-auto w-full py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold">
          + Send Invitation Link
        </button>
      </div>
    ),
    calculator: (
      <div className="w-full h-full flex flex-col gap-3 p-5">
        <div className="text-slate-400 text-xs font-semibold">Supplier Data Form</div>
        {[
          { label: '⚡ Electricity Used', value: '12,400 kWh', color: 'text-yellow-400' },
          { label: '🔥 Fuel Consumed', value: '800 litres', color: 'text-orange-400' },
          { label: '🚚 Transport KM', value: '15,000 km', color: 'text-blue-400' },
        ].map(f => (
          <div key={f.label} className="rounded-xl bg-white/3 border border-white/8 px-3 py-2.5">
            <div className="text-slate-500 text-[10px] mb-1">{f.label}</div>
            <div className={`font-bold text-sm ${f.color}`}>{f.value}</div>
          </div>
        ))}
        <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/25 p-3 flex items-center justify-between mt-auto">
          <span className="text-slate-300 text-xs font-semibold">Total CO₂ Calculated</span>
          <span className="text-emerald-400 font-black text-lg">8.42 tCO₂</span>
        </div>
      </div>
    ),
    ai: (
      <div className="w-full h-full flex flex-col gap-3 p-5">
        <div className="rounded-xl bg-gradient-to-br from-purple-500/15 to-pink-500/10 border border-purple-500/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-purple-400 text-sm">🤖</span>
            <span className="text-purple-300 text-xs font-bold">AI Insight</span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">"Your Scope 3 emissions are 18% above industry average. Switching 3 suppliers to renewable energy could cut emissions by 24%."</p>
        </div>
        <div className="grid grid-cols-2 gap-2 flex-1">
          <div className="rounded-xl bg-white/3 border border-white/8 p-3 flex flex-col justify-center">
            <div className="text-slate-500 text-[10px] mb-1">📈 Forecast (2025)</div>
            <div className="text-blue-400 font-black text-base">-19%</div>
            <div className="text-slate-500 text-[10px]">if actions taken</div>
          </div>
          <div className="rounded-xl bg-white/3 border border-white/8 p-3 flex flex-col justify-center">
            <div className="text-slate-500 text-[10px] mb-1">🏆 Industry Rank</div>
            <div className="text-yellow-400 font-black text-base">Top 22%</div>
            <div className="text-slate-500 text-[10px]">Manufacturing</div>
          </div>
        </div>
        <div className="rounded-xl bg-white/3 border border-white/8 p-3">
          <div className="text-slate-500 text-[10px] mb-2">Top Recommendations</div>
          {['Switch to solar for 3 suppliers', 'Optimise last-mile logistics', 'Green freight partnerships'].map((r, i) => (
            <div key={r} className="flex items-center gap-2 py-0.5">
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-[9px] font-bold">{i + 1}</div>
              <span className="text-slate-300 text-[10px]">{r}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    reports: (
      <div className="w-full h-full flex flex-col gap-3 p-5">
        <div className="text-slate-400 text-xs font-semibold">Generate Reports</div>
        {[
          { icon: '📋', name: 'BRSR Report', tag: 'SEBI Compliant', color: 'from-orange-500/20 to-red-500/10', border: 'border-orange-500/25', btn: 'text-orange-400' },
          { icon: '🌍', name: 'CDP Disclosure', tag: 'Global Standard', color: 'from-blue-500/20 to-cyan-500/10', border: 'border-blue-500/25', btn: 'text-blue-400' },
          { icon: '🌱', name: 'GHG Protocol', tag: 'Scope 1,2,3', color: 'from-emerald-500/20 to-teal-500/10', border: 'border-emerald-500/25', btn: 'text-emerald-400' },
        ].map(r => (
          <div key={r.name} className={`rounded-xl bg-gradient-to-br ${r.color} border ${r.border} px-3 py-2.5 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{r.icon}</span>
              <div>
                <div className="text-slate-200 text-xs font-bold">{r.name}</div>
                <div className="text-slate-500 text-[10px]">{r.tag}</div>
              </div>
            </div>
            <span className={`text-xs font-bold ${r.btn}`}>↓ PDF</span>
          </div>
        ))}
      </div>
    ),
    enterprise: (
      <div className="w-full h-full flex flex-col gap-3 p-5">
        <div className="text-slate-400 text-xs font-semibold">Enterprise Features</div>
        {[
          { icon: '👥', title: 'Team Roles', desc: 'Admin · Manager · Viewer', color: 'text-purple-400' },
          { icon: '🔗', title: 'API Access', desc: 'Connect your existing tools', color: 'text-blue-400' },
          { icon: '📊', title: 'Audit Log', desc: 'Every action tracked & logged', color: 'text-yellow-400' },
          { icon: '🔔', title: 'Smart Alerts', desc: 'Threshold & deadline alerts', color: 'text-red-400' },
        ].map(e => (
          <div key={e.title} className="rounded-xl bg-white/3 border border-white/8 px-3 py-2 flex items-center gap-3">
            <span className="text-xl">{e.icon}</span>
            <div>
              <div className={`text-xs font-bold ${e.color}`}>{e.title}</div>
              <div className="text-slate-500 text-[10px]">{e.desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  }
  return illustrations[type] || null
}

/* ─── Data ─── */
const features = [
  {
    id: 'dashboard',
    emoji: '📊',
    title: 'Live Dashboard',
    tagline: 'See everything at a glance',
    color: 'from-emerald-500/15 to-teal-500/8',
    border: 'border-emerald-500/20',
    glow: 'shadow-emerald-900/20',
    accent: 'text-emerald-400',
    description: 'The Dashboard is your home screen. As soon as you log in, you see your total CO₂ emissions, how many suppliers have submitted data, and how your emissions are trending over time. Everything is shown in easy-to-read numbers and charts — no technical knowledge needed.',
    points: [
      'Total emissions across all suppliers shown in big, clear numbers',
      'A bar chart showing emissions month-by-month so you can see progress',
      'Quick view of which suppliers have submitted data and who hasn\'t',
      'Alerts if any emissions spike suddenly',
    ],
  },
  {
    id: 'suppliers',
    emoji: '🏭',
    title: 'Supplier Management',
    tagline: 'Collect data from your supply chain — effortlessly',
    color: 'from-blue-500/15 to-cyan-500/8',
    border: 'border-blue-500/20',
    glow: 'shadow-blue-900/20',
    accent: 'text-blue-400',
    description: 'This is where you manage all your suppliers — the factories, logistics companies, and vendors who are part of your supply chain. You add them once, and CarbonFlow sends them a special link. Your supplier just clicks the link and fills a simple form. No account, no password, no technical hassle.',
    points: [
      'Add supplier name, contact person, and email in seconds',
      'System automatically sends them a unique, secure submission link',
      'Track who has submitted, who is pending, and who needs a reminder',
      'Send automatic reminder emails with one click',
    ],
  },
  {
    id: 'calculator',
    emoji: '⚡',
    title: 'Automatic Emissions Calculator',
    tagline: 'Numbers done for you — 100% automatically',
    color: 'from-yellow-500/15 to-orange-500/8',
    border: 'border-yellow-500/20',
    glow: 'shadow-yellow-900/20',
    accent: 'text-yellow-400',
    description: 'Once a supplier submits their data (electricity used, fuel consumed, distance travelled), CarbonFlow automatically calculates the CO₂ emissions using internationally recognized GHG Protocol formulas. You don\'t need to do any math or use Excel — the system does it all.',
    points: [
      'Covers electricity, diesel/petrol, natural gas, and transport emissions',
      'Uses globally accepted emission factors (IPCC, IEA)',
      'Results appear instantly — no waiting, no manual calculation',
      'Breaks down emissions by supplier, category, and time period',
    ],
  },
  {
    id: 'ai',
    emoji: '🤖',
    title: 'AI-Powered Intelligence',
    tagline: 'Smart insights that tell you exactly what to do next',
    color: 'from-purple-500/15 to-pink-500/8',
    border: 'border-purple-500/20',
    glow: 'shadow-purple-900/20',
    accent: 'text-purple-400',
    description: 'CarbonFlow\'s AI engine studies your emissions data and tells you what\'s going on and what you should do. It compares your performance against other companies in your industry, predicts your future emissions, and gives you specific, actionable recommendations to reduce your carbon footprint.',
    points: [
      'Benchmarking: See how you compare to others in your industry in India',
      'Forecasting: See what your emissions will look like in 6-12 months',
      'Recommendations: Get a prioritized list of the best actions to take',
      'Risk Alerts: Get warned about suppliers with dangerously high emissions',
    ],
  },
  {
    id: 'reports',
    emoji: '📄',
    title: 'Compliance Reports',
    tagline: 'One click — professional reports ready for auditors',
    color: 'from-red-500/15 to-rose-500/8',
    border: 'border-red-500/20',
    glow: 'shadow-red-900/20',
    accent: 'text-red-400',
    description: 'When regulators, investors, or auditors ask for your carbon report, you don\'t need to hire a consultant or spend weeks building spreadsheets. CarbonFlow generates professional, regulation-ready PDF reports in seconds — formatted exactly as SEBI, CDP, and international frameworks require.',
    points: [
      'BRSR Report for SEBI compliance (mandatory for listed Indian companies)',
      'CDP Climate Disclosure for international investors',
      'GHG Protocol Report (Scope 1, 2, and 3) for auditors',
      'ESRS E1 Report for European market compliance',
    ],
  },
  {
    id: 'enterprise',
    emoji: '🏢',
    title: 'Enterprise Hub',
    tagline: 'For larger teams — control who sees what',
    color: 'from-slate-500/15 to-zinc-500/8',
    border: 'border-slate-500/20',
    glow: 'shadow-slate-900/20',
    accent: 'text-slate-300',
    description: 'If your company has multiple people managing sustainability, the Enterprise Hub lets you give each person the right level of access. Your CEO can see everything, your data team can enter numbers, and your junior staff can only view reports — all perfectly controlled.',
    points: [
      'Role-Based Access: Admin, Manager, Analyst, and Viewer roles',
      'Full Audit Log: Every change made by every person is recorded',
      'API Access: Connect CarbonFlow to your ERP or data systems',
      'Smart Alerts: Get notified when emissions cross a threshold you set',
    ],
  },
]

const steps = [
  {
    number: '01',
    title: 'Create Your Company Account',
    description: 'Go to CarbonFlow and click "Get Started Free." Enter your company name, email, and password. It takes less than 60 seconds. Indian companies get full access completely free.',
    tip: '💡 Tip: Use your official company email so it\'s easy to share access with your team later.',
    visual: {
      label: 'Sign Up Screen',
      content: (
        <div className="space-y-2.5">
          <div className="rounded-lg bg-white/4 border border-white/10 px-3 py-2.5">
            <div className="text-slate-500 text-[10px] mb-0.5">Company Name</div>
            <div className="text-slate-200 text-xs">Infosys Limited</div>
          </div>
          <div className="rounded-lg bg-white/4 border border-white/10 px-3 py-2.5">
            <div className="text-slate-500 text-[10px] mb-0.5">Work Email</div>
            <div className="text-slate-200 text-xs">sustainability@infosys.com</div>
          </div>
          <div className="rounded-lg bg-white/4 border border-white/10 px-3 py-2.5">
            <div className="text-slate-500 text-[10px] mb-0.5">Password</div>
            <div className="text-slate-200 text-xs">••••••••••</div>
          </div>
          <button className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs">
            Create Free Account 🇮🇳
          </button>
        </div>
      ),
    },
  },
  {
    number: '02',
    title: 'Set Up Your Company Profile',
    description: 'After signing up, complete a short onboarding form. Tell CarbonFlow what industry you\'re in (manufacturing, IT, logistics, etc.), your company size, and the financial year you want to report on. This takes 2-3 minutes.',
    tip: '💡 Tip: Selecting the right industry is important — it\'s what CarbonFlow uses to benchmark your emissions against others in your sector.',
    visual: {
      label: 'Company Setup',
      content: (
        <div className="space-y-2.5">
          <div className="rounded-lg bg-white/4 border border-white/10 px-3 py-2.5">
            <div className="text-slate-500 text-[10px] mb-0.5">Industry Sector</div>
            <div className="text-slate-200 text-xs flex items-center justify-between">
              <span>🏭 Manufacturing</span>
              <span className="text-slate-500">▼</span>
            </div>
          </div>
          <div className="rounded-lg bg-white/4 border border-white/10 px-3 py-2.5">
            <div className="text-slate-500 text-[10px] mb-0.5">Company Size</div>
            <div className="text-slate-200 text-xs flex items-center justify-between">
              <span>501 - 2000 employees</span>
              <span className="text-slate-500">▼</span>
            </div>
          </div>
          <div className="rounded-lg bg-white/4 border border-white/10 px-3 py-2.5">
            <div className="text-slate-500 text-[10px] mb-0.5">Reporting Year</div>
            <div className="text-slate-200 text-xs flex items-center justify-between">
              <span>FY 2024-25</span>
              <span className="text-slate-500">▼</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-semibold">
            <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">✓</div>
            Profile Complete — 3/3 steps done
          </div>
        </div>
      ),
    },
  },
  {
    number: '03',
    title: 'Add Your Suppliers',
    description: 'Go to the "Suppliers" section and click "Add Supplier." Enter the supplier\'s company name, contact person\'s name, and their email. Hit save — that\'s it. CarbonFlow automatically emails them a secure link to submit their carbon data. No back-and-forth needed.',
    tip: '💡 Tip: You can add as many suppliers as you want. Even if you have 200+ suppliers, the system handles all the email sending and tracking automatically.',
    visual: {
      label: 'Add Supplier',
      content: (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">🏭</div>
            <div>
              <div className="text-slate-200 text-xs font-semibold">Add New Supplier</div>
              <div className="text-slate-500 text-[10px]">They\'ll get an email automatically</div>
            </div>
          </div>
          <div className="rounded-lg bg-white/4 border border-white/10 px-3 py-2">
            <div className="text-slate-200 text-xs">Tata Components Ltd</div>
          </div>
          <div className="rounded-lg bg-white/4 border border-white/10 px-3 py-2">
            <div className="text-slate-200 text-xs">Rajesh Kumar (Sustainability)</div>
          </div>
          <div className="rounded-lg bg-white/4 border border-white/10 px-3 py-2">
            <div className="text-slate-200 text-xs">rajesh@tatacomponents.com</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex-1 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs">Save & Send Link</button>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 text-[10px]">✅ Email sent to rajesh@tatacomponents.com</div>
        </div>
      ),
    },
  },
  {
    number: '04',
    title: 'Suppliers Submit Their Data',
    description: 'Your supplier receives an email with a simple link. They click it and see a clean form asking for their electricity usage, fuel consumption, and kilometres travelled for transport. They fill it and submit — no account, no login, no confusion. You get notified instantly.',
    tip: '💡 Tip: The form is designed to be so simple that even a supplier\'s accountant (not a sustainability expert) can fill it in under 5 minutes.',
    visual: {
      label: 'Supplier\'s Form',
      content: (
        <div className="space-y-2.5">
          <div className="text-center mb-2">
            <div className="text-emerald-400 text-sm font-black">CarbonFlow</div>
            <div className="text-slate-400 text-[10px]">Submission for Tata Components Ltd</div>
          </div>
          {[
            { icon: '⚡', label: 'Electricity Used (kWh)', value: '12,400' },
            { icon: '🔥', label: 'Diesel Used (litres)', value: '800' },
            { icon: '🚚', label: 'Transport Distance (km)', value: '15,200' },
          ].map(f => (
            <div key={f.label} className="rounded-lg bg-white/4 border border-white/10 px-3 py-2">
              <div className="text-slate-500 text-[10px] mb-0.5">{f.icon} {f.label}</div>
              <div className="text-slate-200 text-xs font-semibold">{f.value}</div>
            </div>
          ))}
          <button className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs">Submit Data ✓</button>
        </div>
      ),
    },
  },
  {
    number: '05',
    title: 'View Insights & AI Recommendations',
    description: 'Head to the "Insights" section. CarbonFlow\'s AI has analyzed all your supplier data and will show you: where your biggest emissions come from, how you compare to others in your industry, and exactly which actions will reduce your carbon footprint the most — ranked by impact.',
    tip: '💡 Tip: Focus on the "Top 3 Recommendations" first. These are the highest-impact, easiest-to-implement changes identified specifically for your company.',
    visual: {
      label: 'AI Insights',
      content: (
        <div className="space-y-2">
          <div className="rounded-lg bg-gradient-to-r from-purple-500/15 to-pink-500/10 border border-purple-500/20 p-2.5">
            <div className="text-purple-300 text-[10px] font-bold mb-1">🤖 AI Analysis Complete</div>
            <div className="text-slate-300 text-[10px] leading-relaxed">"3 suppliers account for 68% of your emissions. Switching them to renewables saves 2,100 tCO₂/year."</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/3 border border-white/8 p-2 text-center">
              <div className="text-yellow-400 font-black text-base">Top 28%</div>
              <div className="text-slate-500 text-[9px]">Industry rank</div>
            </div>
            <div className="rounded-lg bg-white/3 border border-white/8 p-2 text-center">
              <div className="text-blue-400 font-black text-base">-22%</div>
              <div className="text-slate-500 text-[9px]">Forecast 2025</div>
            </div>
          </div>
          {['Solar panels for Supplier A', 'EV logistics for last mile', 'Energy audit — 3 suppliers'].map((r, i) => (
            <div key={r} className="flex items-center gap-2 rounded-lg bg-white/2 border border-white/5 px-2 py-1.5">
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-black flex items-center justify-center">{i + 1}</div>
              <span className="text-slate-300 text-[10px]">{r}</span>
            </div>
          ))}
        </div>
      ),
    },
  },
  {
    number: '06',
    title: 'Generate & Download Reports',
    description: 'When you\'re ready to report to regulators, investors, or your board, go to "Reports" and click the report you need. CarbonFlow generates a fully formatted, professionally designed PDF in seconds. For Indian listed companies, the BRSR report is automatically formatted to SEBI\'s exact requirements.',
    tip: '💡 Tip: You can generate reports anytime — as many times as you like. Run a mid-year check, share a draft with your auditors, and then generate the final version at year-end.',
    visual: {
      label: 'Report Ready',
      content: (
        <div className="space-y-2.5">
          <div className="text-slate-400 text-[10px] font-semibold">Available Reports</div>
          {[
            { icon: '📋', name: 'BRSR Report 2024-25', size: '2.4 MB', color: 'text-orange-400', ready: true },
            { icon: '🌍', name: 'CDP Climate Disclosure', size: '1.8 MB', color: 'text-blue-400', ready: true },
            { icon: '🌱', name: 'GHG Protocol Report', size: '3.1 MB', color: 'text-emerald-400', ready: true },
          ].map(r => (
            <div key={r.name} className="rounded-lg bg-white/3 border border-white/8 px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{r.icon}</span>
                <div>
                  <div className={`text-xs font-semibold ${r.color}`}>{r.name}</div>
                  <div className="text-slate-600 text-[9px]">{r.size} · PDF</div>
                </div>
              </div>
              <button className={`text-[10px] font-bold ${r.color} bg-white/5 px-2 py-1 rounded-md`}>↓ Download</button>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-semibold">
            ✅ All reports SEBI & CDP compliant
          </div>
        </div>
      ),
    },
  },
]

export default function HowToUse() {
  useSEO({
    title: 'How CarbonFlow Works — Scope 3 Carbon Accounting Guide',
    description:
      'Step-by-step guide to using CarbonFlow: invite suppliers, collect Scope 3 emissions data, calculate CO₂ with GHG Protocol factors, and export BRSR, BRSR Core, CDP, ESRS, and CBAM disclosure reports in minutes.',
    keywords:
      'how to do carbon accounting, how to measure scope 3 emissions, how to calculate scope 3, how to do BRSR reporting, BRSR step by step, BRSR filing guide, supplier emissions data collection guide, supplier survey template, carbon footprint calculation tutorial, GHG Protocol guide, scope 1 2 3 calculation, how to build a GHG inventory, ESG reporting tutorial India, CDP disclosure guide, ESRS step by step, CBAM how to file, CO2 calculation methodology, emission factor lookup India, supplier engagement playbook, value chain mapping, BRSR Core assurance preparation',
    path: '/how-to-use',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to track Scope 3 supply chain emissions with CarbonFlow',
      description:
        'A step-by-step guide to measuring and reporting Scope 3 supply chain carbon emissions using CarbonFlow.',
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Sign up', text: 'Create a free CarbonFlow account for your company.' },
        { '@type': 'HowToStep', position: 2, name: 'Invite suppliers', text: 'Send each supplier a unique secure submission link — no login required for them.' },
        { '@type': 'HowToStep', position: 3, name: 'Collect emissions data', text: 'Suppliers submit electricity, fuel, and transport activity through a guided form.' },
        { '@type': 'HowToStep', position: 4, name: 'Generate reports', text: 'Download BRSR, CDP, ESRS, or PDF emissions reports with full supplier breakdown.' },
      ],
    },
  })
  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden">
      {/* ── NAV ── */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5"
        style={{ background: 'rgba(3,7,18,0.9)', backdropFilter: 'blur(24px)' }}
      >
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <span className="font-black text-xl text-white">CarbonFlow</span>
            <div className="text-emerald-400 text-[10px] font-semibold -mt-0.5">← Back to Home</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors font-medium">Sign In</Link>
          <Link to="/signup" className="px-5 py-2.5 text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl hover:-translate-y-0.5 transition-all shadow-lg shadow-emerald-900/40">
            Get Started Free
          </Link>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="pt-32 pb-16 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-600/8 rounded-full blur-[150px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold mb-6"
          >
            📖 Complete Guide
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="text-5xl sm:text-6xl font-black tracking-tight mb-6"
          >
            How to Use{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
              CarbonFlow
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="text-xl text-slate-400 leading-relaxed mb-8"
          >
            Everything you need to know — explained simply. No jargon, no complexity. From signing up to generating your first compliance report, we've got you covered step by step.
          </motion.p>
          {/* Quick jump links */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-3"
          >
            <a href="#features" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-medium hover:bg-white/10 transition-colors">✦ All Features</a>
            <a href="#steps" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-medium hover:bg-white/10 transition-colors">✦ Step-by-Step Guide</a>
            <a href="#faq" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-medium hover:bg-white/10 transition-colors">✦ FAQs</a>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="px-6 py-16 max-w-7xl mx-auto">
        <FadeIn className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold mb-4">
            ✦ All Features
          </span>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">What Can CarbonFlow Do?</h2>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto">
            Six powerful tools — all in one platform. Here's exactly what each one does and how it helps your company.
          </p>
        </FadeIn>

        <div className="space-y-10">
          {features.map((f, i) => (
            <FadeIn key={f.id} delay={0.05}>
              <div className={`rounded-3xl bg-gradient-to-br ${f.color} border ${f.border} overflow-hidden shadow-2xl ${f.glow}`}>
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-0 ${i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                  {/* Text side */}
                  <div className="p-8 sm:p-10 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="text-5xl">{f.emoji}</div>
                      <div>
                        <div className={`text-xs font-bold uppercase tracking-widest ${f.accent} mb-1`}>Feature {String(i + 1).padStart(2, '0')}</div>
                        <h3 className="text-2xl sm:text-3xl font-black text-white">{f.title}</h3>
                      </div>
                    </div>
                    <p className={`text-base font-semibold ${f.accent} mb-4`}>{f.tagline}</p>
                    <p className="text-slate-300 text-base leading-relaxed mb-6">{f.description}</p>
                    <ul className="space-y-3">
                      {f.points.map(point => (
                        <li key={point} className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${f.accent} bg-white/8`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-slate-300 text-sm leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Visual side */}
                  <div className="relative flex items-center justify-center p-8 min-h-[300px] lg:min-h-0">
                    <div className="absolute inset-4 rounded-2xl bg-[#030712]/60 border border-white/8 backdrop-blur-sm overflow-hidden">
                      {/* Mock title bar */}
                      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                        <span className="ml-2 text-slate-600 text-[10px]">carbonflow.app · {f.title}</span>
                      </div>
                      <div className="h-[calc(100%-36px)] overflow-hidden">
                        <FeatureIllustration type={f.id} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── STEPS ── */}
      <section id="steps" className="px-6 py-20 border-t border-white/5" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-semibold mb-4">
              ✦ Step-by-Step Guide
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">How to Get Started</h2>
            <p className="text-slate-400 text-xl max-w-2xl mx-auto">
              Follow these 6 steps and you'll go from zero to your first compliance report — in a single afternoon.
            </p>
          </FadeIn>

          <div className="space-y-8">
            {steps.map((step, i) => (
              <FadeIn key={step.number} delay={0.05}>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 rounded-3xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {/* Step content — 3 cols */}
                  <div className={`lg:col-span-3 p-8 flex flex-col justify-center ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xl flex-shrink-0">
                        {step.number}
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 font-semibold uppercase tracking-widest mb-1">Step {step.number}</div>
                        <h3 className="text-xl sm:text-2xl font-black text-white">{step.title}</h3>
                      </div>
                    </div>
                    <p className="text-slate-300 text-base leading-relaxed mb-5">{step.description}</p>
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-yellow-500/8 border border-yellow-500/15">
                      <span className="text-sm leading-relaxed text-yellow-200">{step.tip}</span>
                    </div>
                  </div>
                  {/* Visual — 2 cols */}
                  <div className={`lg:col-span-2 relative min-h-[260px] flex items-center justify-center p-6 border-t lg:border-t-0 ${i % 2 === 1 ? 'lg:border-r lg:order-1' : 'lg:border-l'} border-white/5`} style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <div className="w-full max-w-xs">
                      <div className="text-slate-600 text-[10px] font-semibold uppercase tracking-wider text-center mb-3">{step.visual.label}</div>
                      <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5">
                          <div className="w-2 h-2 rounded-full bg-red-500/40" />
                          <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
                          <div className="w-2 h-2 rounded-full bg-green-500/40" />
                        </div>
                        <div className="p-4">{step.visual.content}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="px-6 py-20 max-w-4xl mx-auto">
        <FadeIn className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-semibold mb-4">
            ✦ Common Questions
          </span>
          <h2 className="text-4xl font-black text-white mb-4">Frequently Asked Questions</h2>
          <p className="text-slate-400 text-lg">Quick answers to the questions new users ask most.</p>
        </FadeIn>
        <div className="space-y-4">
          {[
            { q: 'Is CarbonFlow really free for Indian companies?', a: 'Yes, completely. If your company is registered in India, you get full access to all features at no cost, forever. We believe every Indian business deserves world-class carbon tools.' },
            { q: 'Do my suppliers need to create an account?', a: 'No. Your suppliers just receive an email with a link. They click the link, fill a simple form, and submit. No account, no password, no app download required — it takes them about 5 minutes.' },
            { q: 'What if I don\'t know my Scope 1, 2, or 3 emissions?', a: 'That\'s exactly what CarbonFlow calculates for you! You just tell your suppliers to enter their electricity bills, fuel receipts, and travel distances. CarbonFlow converts all of that into CO₂ numbers automatically using international standards.' },
            { q: 'Which compliance frameworks does CarbonFlow support?', a: 'CarbonFlow supports BRSR (SEBI), CDP Climate Disclosure, GHG Protocol (Scope 1, 2, 3), and ESRS E1 for European reporting. More frameworks are being added regularly.' },
            { q: 'How long does it take to get my first report?', a: 'Most companies go from sign-up to their first emissions report in one afternoon. Setup takes about 10 minutes. Once your suppliers submit data (usually within a few days), your report is generated instantly.' },
            { q: 'Is my data safe and private?', a: 'Yes. CarbonFlow uses enterprise-grade Firebase authentication, encrypted data storage, and RBAC (Role-Based Access Control). Only the people you authorize can see your company\'s data.' },
          ].map((item, i) => (
            <FadeIn key={i} delay={i * 0.04}>
              <div className="rounded-2xl border border-white/8 p-6" style={{ background: 'rgba(255,255,255,0.025)' }}>
                <h4 className="text-white font-bold text-base mb-2 flex items-start gap-3">
                  <span className="text-emerald-400 font-black flex-shrink-0">Q.</span>
                  {item.q}
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed pl-6">{item.a}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <div className="rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden border border-emerald-500/20"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(20,184,166,0.08) 100%)' }}>
              <div className="absolute -top-16 -left-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="relative z-10">
                <div className="text-5xl mb-5">🚀</div>
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Ready to Start?</h2>
                <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                  Create your free account in 60 seconds and start tracking your supply chain emissions today. Free forever for Indian companies.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-2 px-10 py-4 text-base font-black rounded-2xl text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-2xl shadow-emerald-900/50 hover:-translate-y-1 transition-all duration-200"
                  >
                    Get Started Free 🇮🇳
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-2xl text-white bg-white/8 hover:bg-white/14 border border-white/15 hover:border-white/30 hover:-translate-y-1 transition-all duration-200"
                  >
                    ← Back to Home
                  </Link>
                </div>
                <p className="mt-5 text-slate-500 text-sm">No credit card · Free for Indian companies · Setup in 2 minutes</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 py-8 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-black text-white">CarbonFlow</span>
        </div>
        <div className="flex items-center justify-center gap-5 text-sm text-slate-400 mb-2">
          <Link to="/" className="hover:text-white transition">Home</Link>
          <Link to="/how-to-use" className="hover:text-white transition">How it works</Link>
          <Link to="/blog" className="hover:text-white transition">Blog</Link>
          <Link to="/signup" className="hover:text-white transition">Sign up</Link>
        </div>
        <p className="text-slate-600 text-sm">© {new Date().getFullYear()} CarbonFlow · 🇮🇳 Made for India · Free forever for Indian companies</p>
      </footer>
    </div>
  )
}
