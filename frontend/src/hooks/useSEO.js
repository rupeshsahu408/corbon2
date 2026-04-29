import { useEffect } from 'react'

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://carbonflow.app').replace(/\/$/, '')
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.svg`

function setMeta(attr, name, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel, href) {
  if (!href) return
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function setStructuredData(id, data) {
  if (!data) return
  let el = document.head.querySelector(`script[data-seo-id="${id}"]`)
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.setAttribute('data-seo-id', id)
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

export function useSEO({
  title,
  description,
  path = '/',
  image,
  noindex = false,
  keywords,
  jsonLd,
} = {}) {
  useEffect(() => {
    const fullTitle = title
      ? `${title} | CarbonFlow`
      : 'CarbonFlow — Scope 3 Carbon Accounting & BRSR Reporting Platform'

    const url = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
    const ogImage = image || DEFAULT_OG_IMAGE

    document.title = fullTitle

    setMeta('name', 'description', description)
    if (keywords) setMeta('name', 'keywords', keywords)
    setMeta(
      'name',
      'robots',
      noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
    )

    setLink('canonical', url)

    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:image', ogImage)
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:site_name', 'CarbonFlow')

    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', fullTitle)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'twitter:image', ogImage)

    if (jsonLd) setStructuredData('page', jsonLd)
  }, [title, description, path, image, noindex, keywords, jsonLd])
}

export default useSEO
