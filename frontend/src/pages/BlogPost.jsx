import { Link, useParams, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useSEO from '../hooks/useSEO'
import { getPostBySlug, getRelatedPosts } from '../data/blogPosts'

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://carbonflow.app').replace(/\/$/, '')

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function Section({ section }) {
  switch (section.type) {
    case 'h2':
      return <h2 className="text-2xl sm:text-3xl font-black text-white mt-12 mb-4">{section.text}</h2>
    case 'h3':
      return <h3 className="text-xl sm:text-2xl font-bold text-white mt-8 mb-3">{section.text}</h3>
    case 'p':
      return (
        <p
          className="text-slate-300 leading-relaxed text-lg mb-5"
          dangerouslySetInnerHTML={{ __html: section.text }}
        />
      )
    case 'ul':
      return (
        <ul className="list-disc list-outside pl-6 mb-6 space-y-2">
          {section.items.map((item, i) => (
            <li
              key={i}
              className="text-slate-300 leading-relaxed text-lg"
              dangerouslySetInnerHTML={{ __html: item }}
            />
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol className="list-decimal list-outside pl-6 mb-6 space-y-2">
          {section.items.map((item, i) => (
            <li
              key={i}
              className="text-slate-300 leading-relaxed text-lg"
              dangerouslySetInnerHTML={{ __html: item }}
            />
          ))}
        </ol>
      )
    case 'callout':
      return (
        <div className="my-8 p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
          <p
            className="text-emerald-100 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: section.text }}
          />
        </div>
      )
    case 'quote':
      return (
        <blockquote className="my-8 pl-6 border-l-4 border-emerald-500 italic text-slate-300 text-xl">
          {section.text}
        </blockquote>
      )
    default:
      return null
  }
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = getPostBySlug(slug)

  if (!post) {
    return <Navigate to="/blog" replace />
  }

  const url = `${SITE_URL}/blog/${post.slug}`
  const related = getRelatedPosts(post.slug, 2)

  useSEO({
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    path: `/blog/${post.slug}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.date,
      author: { '@type': 'Organization', name: post.author, url: SITE_URL },
      publisher: {
        '@type': 'Organization',
        name: 'CarbonFlow',
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.svg` },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      keywords: post.keywords,
      articleSection: post.category,
      timeRequired: `PT${post.readMinutes}M`,
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
          <Link to="/blog" className="text-slate-300 hover:text-white">← All articles</Link>
          <Link to="/signup" className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:opacity-90 transition">
            Try CarbonFlow free
          </Link>
        </div>
      </nav>

      {/* ARTICLE */}
      <article className="px-6 pt-16 pb-16 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500 mb-6">
            <ol className="flex items-center gap-2">
              <li><Link to="/" className="hover:text-white">Home</Link></li>
              <li>/</li>
              <li><Link to="/blog" className="hover:text-white">Blog</Link></li>
              <li>/</li>
              <li className="text-slate-300 truncate">{post.category}</li>
            </ol>
          </nav>

          <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
            <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-300 font-semibold">
              {post.category}
            </span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>·</span>
            <span>{post.readMinutes} min read</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-6">
            {post.title}
          </h1>
          <p className="text-xl text-slate-400 leading-relaxed mb-10">
            {post.description}
          </p>

          <div className="prose prose-invert max-w-none">
            {post.sections.map((section, i) => (
              <Section key={i} section={section} />
            ))}
          </div>

          {/* CTA */}
          <div className="mt-16 p-8 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-center">
            <h3 className="text-2xl font-black text-white mb-2">Start tracking your Scope 3 today</h3>
            <p className="text-slate-300 mb-5">
              CarbonFlow is free for Indian companies. Set up your first supplier in under 10 minutes.
            </p>
            <Link
              to="/signup"
              className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold hover:opacity-90 transition"
            >
              Create your free account
            </Link>
          </div>
        </motion.div>

        {/* RELATED */}
        {related.length > 0 && (
          <section className="mt-20">
            <h3 className="text-2xl font-black text-white mb-6">Keep reading</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  to={`/blog/${p.slug}`}
                  className="block p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-emerald-500/30 transition group"
                >
                  <div className="text-xs text-emerald-300 font-semibold mb-2">{p.category}</div>
                  <h4 className="font-bold text-white mb-1 group-hover:text-emerald-300 transition">{p.title}</h4>
                  <p className="text-slate-400 text-sm line-clamp-2">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

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
