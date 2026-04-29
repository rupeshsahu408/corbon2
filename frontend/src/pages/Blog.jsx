import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import useSEO from '../hooks/useSEO'
import { blogPosts } from '../data/blogPosts'

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://corbon2.vercel.app').replace(/\/$/, '')

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function Blog() {
  useSEO({
    title: 'Blog — Carbon Accounting, BRSR & Scope 3 Insights',
    description:
      'In-depth guides on Scope 3 emissions, BRSR reporting, BRSR Core, CDP, ESRS, CBAM, supplier engagement, and ESG disclosure — written for sustainability leaders, ESG managers, CFOs, and procurement teams in India and globally.',
    keywords:
      'carbon accounting blog, BRSR blog, BRSR articles, BRSR guide India, scope 3 guide, scope 3 explained, scope 1 2 3 guide, GHG Protocol blog, CDP guide, ESRS guide, CSRD guide, CBAM guide, ESG reporting blog India, sustainability insights India, supplier emissions guide, supplier engagement, net zero strategy, decarbonisation playbook, SBTi guide, climate disclosure India, BRSR checklist, BRSR Core KPIs, value chain emissions, NGRBC principles, sustainability for SMEs',
    path: '/blog',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'CarbonFlow Blog',
      description:
        'Practical guides on Scope 3, BRSR, CDP, ESRS, and carbon accounting.',
      url: `${SITE_URL}/blog`,
      blogPost: blogPosts.map((p) => ({
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.description,
        datePublished: p.date,
        author: { '@type': 'Organization', name: p.author },
        url: `${SITE_URL}/blog/${p.slug}`,
      })),
    },
  })

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* NAV */}
      <nav className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#030712]/90 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-black text-white">CarbonFlow</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/how-to-use" className="text-slate-300 hover:text-white">How it works</Link>
          <Link to="/blog" className="text-emerald-400 font-semibold">Blog</Link>
          <Link to="/login" className="text-slate-300 hover:text-white">Log in</Link>
          <Link to="/signup" className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:opacity-90 transition">
            Sign up free
          </Link>
        </div>
      </nav>

      {/* HEADER */}
      <header className="px-6 pt-20 pb-12 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 mb-4">
            CARBONFLOW INSIGHTS
          </span>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Carbon accounting, decoded.
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Practical guides on Scope 3, BRSR, CDP, and supplier engagement — written for the people who actually have to do the work.
          </p>
        </motion.div>
      </header>

      {/* POSTS */}
      <main className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid gap-6 md:grid-cols-2">
          {blogPosts.map((post, i) => (
            <motion.article
              key={post.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group"
            >
              <Link
                to={`/blog/${post.slug}`}
                className="block h-full p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-emerald-500/30 transition"
              >
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                  <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-300 font-semibold">
                    {post.category}
                  </span>
                  <span>·</span>
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                  <span>·</span>
                  <span>{post.readMinutes} min read</span>
                </div>
                <h2 className="text-2xl font-black mb-3 group-hover:text-emerald-300 transition">
                  {post.title}
                </h2>
                <p className="text-slate-400 leading-relaxed mb-4">
                  {post.excerpt}
                </p>
                <span className="inline-flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  Read article
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </Link>
            </motion.article>
          ))}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="px-6 py-10 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-black text-white">CarbonFlow</span>
            <span>· 🇮🇳 Made in India</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/how-to-use" className="hover:text-white">How it works</Link>
            <Link to="/blog" className="hover:text-white">Blog</Link>
            <Link to="/signup" className="hover:text-white">Sign up</Link>
          </div>
          <p>© {new Date().getFullYear()} CarbonFlow</p>
        </div>
      </footer>
    </div>
  )
}
