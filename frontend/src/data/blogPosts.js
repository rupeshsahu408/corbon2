export const blogPosts = [
  {
    slug: 'scope-3-explained',
    title: 'Scope 3 Emissions Explained: A Complete Guide for 2026',
    description:
      'Scope 3 emissions cover everything that happens upstream and downstream of your business. Learn the 15 categories, why they matter, and how to start measuring them.',
    keywords:
      'scope 3 emissions, scope 3 categories, GHG protocol, supply chain emissions, indirect emissions, value chain emissions, carbon accounting guide',
    author: 'CarbonFlow Team',
    date: '2026-04-12',
    readMinutes: 9,
    category: 'Fundamentals',
    excerpt:
      'For most companies, Scope 3 is 70–90% of total emissions. Yet it is the hardest to measure. This guide breaks it down end to end.',
    sections: [
      {
        type: 'p',
        text: 'If you have started thinking about your company’s carbon footprint, you have probably hit the term <strong>Scope 3</strong> within the first hour. It is the largest, messiest, and most strategically important slice of corporate emissions — and for many businesses, it makes up 70 to 90 percent of the total. This guide explains what Scope 3 is, the 15 categories defined by the GHG Protocol, why regulators (and customers) increasingly demand it, and how to actually start measuring it without losing your mind.',
      },
      { type: 'h2', text: 'What are Scope 1, 2, and 3 emissions?' },
      {
        type: 'p',
        text: 'The Greenhouse Gas (GHG) Protocol — the global accounting standard used by the SEC, EU CSRD, India’s BRSR, and CDP — splits emissions into three buckets:',
      },
      {
        type: 'ul',
        items: [
          '<strong>Scope 1</strong> — Direct emissions from sources you own or control (company vehicles, on-site boilers, factory furnaces).',
          '<strong>Scope 2</strong> — Indirect emissions from the electricity, steam, heating, and cooling you purchase.',
          '<strong>Scope 3</strong> — Every other indirect emission across your value chain, both upstream (suppliers, logistics, business travel) and downstream (use of your sold products, end-of-life disposal).',
        ],
      },
      {
        type: 'callout',
        text: 'Scope 1 + Scope 2 are easy because they are inside your four walls. Scope 3 is hard because it requires data from people who do not work for you.',
      },
      { type: 'h2', text: 'The 15 Scope 3 categories (and which ones matter for you)' },
      {
        type: 'p',
        text: 'The GHG Protocol defines 15 distinct Scope 3 categories. You do not have to report all of them — only the ones that are <em>material</em> to your business.',
      },
      { type: 'h3', text: 'Upstream (8 categories)' },
      {
        type: 'ol',
        items: [
          '<strong>Purchased goods and services</strong> — Almost always #1 by volume for product companies.',
          '<strong>Capital goods</strong> — Machinery, buildings, IT hardware you buy.',
          '<strong>Fuel- and energy-related activities</strong> — Upstream emissions from the energy you already counted in Scope 2.',
          '<strong>Upstream transportation and distribution</strong> — Inbound logistics from suppliers.',
          '<strong>Waste generated in operations</strong>.',
          '<strong>Business travel</strong> — Flights, hotels, taxis.',
          '<strong>Employee commuting</strong>.',
          '<strong>Upstream leased assets</strong> — Leased vehicles, leased servers.',
        ],
      },
      { type: 'h3', text: 'Downstream (7 categories)' },
      {
        type: 'ol',
        items: [
          '<strong>Downstream transportation and distribution</strong> — Outbound logistics to customers.',
          '<strong>Processing of sold products</strong>.',
          '<strong>Use of sold products</strong> — Often dominant for energy-using products (cars, appliances, software).',
          '<strong>End-of-life treatment of sold products</strong>.',
          '<strong>Downstream leased assets</strong>.',
          '<strong>Franchises</strong>.',
          '<strong>Investments</strong> — Critical for banks and asset managers.',
        ],
      },
      { type: 'h2', text: 'Why Scope 3 matters more than ever in 2026' },
      {
        type: 'ul',
        items: [
          '<strong>Regulation</strong> — India’s BRSR Core, EU CSRD/ESRS, California SB 253, and the SEC climate rule all require Scope 3 disclosure (with phased timelines).',
          '<strong>Customer pressure</strong> — Large enterprises (Walmart, Microsoft, Apple, Tata, Reliance) now ask suppliers for emissions data as a procurement condition. No data, no contract.',
          '<strong>Investor demands</strong> — CDP, MSCI, and Sustainalytics ratings all weight Scope 3 heavily.',
          '<strong>Cost reduction</strong> — Mapping Scope 3 surfaces inefficiency hotspots that often cut spend, not just carbon.',
        ],
      },
      { type: 'h2', text: 'How to start measuring Scope 3 in 90 days' },
      {
        type: 'ol',
        items: [
          '<strong>Run a screening assessment</strong> — Use spend-based emission factors to estimate every category and find the top 3–5 by volume.',
          '<strong>Pick your priority categories</strong> — Usually purchased goods, transportation, and use of sold products.',
          '<strong>Identify your top suppliers</strong> — The 80/20 rule applies. Often 20 suppliers cover 80% of category 1.',
          '<strong>Collect activity data from suppliers</strong> — Send a structured request for electricity (kWh), fuel (litres), transport (km/tonne-km). A platform like CarbonFlow handles this with one-link supplier forms.',
          '<strong>Apply emission factors</strong> — Use DEFRA, IPCC, or India-specific factors to convert activity into kgCO₂e.',
          '<strong>Roll up and disclose</strong> — Aggregate to category, then to corporate total. Export to BRSR, CDP, or ESRS templates.',
        ],
      },
      { type: 'h2', text: 'Common mistakes to avoid' },
      {
        type: 'ul',
        items: [
          '<strong>Trying to be perfect on day one</strong> — Spend-based estimates are accepted; iterate to activity-based.',
          '<strong>Ignoring downstream</strong> — For SaaS, cars, appliances: use-phase often dwarfs everything else.',
          '<strong>Double-counting</strong> — Be careful not to count fuel-and-energy upstream emissions twice with Scope 2.',
          '<strong>One-off spreadsheets</strong> — Scope 3 is annual, audited, and growing. Use a system, not Excel.',
        ],
      },
      { type: 'h2', text: 'Bottom line' },
      {
        type: 'p',
        text: 'Scope 3 is no longer optional. It is where the real climate impact lives, where the regulators are heading, and where the next decade of B2B procurement will be decided. Start with a screening, prioritize the top three categories, and build a repeatable supplier data pipeline. The companies that move first will own the supplier relationships, the cost savings, and the disclosure narrative.',
      },
      {
        type: 'callout',
        text: 'Ready to start? CarbonFlow is free for Indian companies and gives you a working Scope 3 supplier-data pipeline in under an hour.',
      },
    ],
  },

  {
    slug: 'brsr-checklist',
    title: 'BRSR Reporting Checklist for Indian Companies (2026 Edition)',
    description:
      'A practical, section-by-section BRSR checklist for Indian listed and unlisted companies — covering all 9 NGRBC principles, BRSR Core KPIs, and assurance requirements.',
    keywords:
      'BRSR checklist, BRSR Core, BRSR reporting India, NGRBC principles, SEBI BRSR, ESG reporting India, BRSR format 2026',
    author: 'CarbonFlow Team',
    date: '2026-04-19',
    readMinutes: 11,
    category: 'Compliance',
    excerpt:
      'SEBI’s BRSR is now mandatory for the top 1,000 listed companies — and BRSR Core adds 9 KPIs that need third-party assurance. Here is exactly what to prepare.',
    sections: [
      {
        type: 'p',
        text: 'The Business Responsibility and Sustainability Report (BRSR) is SEBI’s mandatory ESG disclosure format for the top 1,000 listed companies in India by market capitalisation. Since FY 2023–24, a subset of those KPIs — known as <strong>BRSR Core</strong> — also requires reasonable assurance from a third party. This is the practical checklist your sustainability lead, CFO, and company secretary should be working from.',
      },
      { type: 'h2', text: 'Who has to file BRSR?' },
      {
        type: 'ul',
        items: [
          '<strong>Top 1,000 listed companies</strong> by market cap — full BRSR is mandatory.',
          '<strong>Top 250 listed companies</strong> — BRSR Core with reasonable assurance, plus value-chain reporting on a comply-or-explain basis.',
          '<strong>Unlisted companies</strong> — Voluntary, but increasingly demanded by global customers and investors.',
        ],
      },
      { type: 'h2', text: 'The 5 sections of the BRSR format' },
      {
        type: 'ol',
        items: [
          '<strong>Section A — General Disclosures</strong>: company details, products, employee count, locations, CSR spend.',
          '<strong>Section B — Management & Process Disclosures</strong>: policies, board oversight, governance against the 9 NGRBC principles.',
          '<strong>Section C — Principle-wise Performance Disclosures</strong>: the bulk of the report; quantitative KPIs against each NGRBC principle.',
          '<strong>BRSR Core attachment</strong>: the 9 KPIs needing assurance.',
          '<strong>Value-chain disclosures</strong> (top 250): upstream + downstream coverage of at least 75% by value.',
        ],
      },
      { type: 'h2', text: 'The 9 NGRBC principles you must report against' },
      {
        type: 'ul',
        items: [
          'P1 — Ethics, transparency, and accountability',
          'P2 — Sustainability across the product life cycle',
          'P3 — Employee well-being',
          'P4 — Stakeholder responsiveness',
          'P5 — Human rights',
          'P6 — Environment',
          'P7 — Public policy advocacy',
          'P8 — Inclusive growth and equitable development',
          'P9 — Customer value',
        ],
      },
      { type: 'h2', text: 'BRSR Core: the 9 assured KPIs' },
      {
        type: 'p',
        text: 'These nine attributes need <em>reasonable assurance</em> (not just limited) from a registered assurance provider. Make sure your data trail is audit-ready.',
      },
      {
        type: 'ol',
        items: [
          'Greenhouse gas emissions (Scope 1 and 2 intensity)',
          'Water consumption and discharge',
          'Energy consumption and intensity',
          'Embracing circularity (waste recycled / reused)',
          'Enhancing employee wellbeing and safety',
          'Enabling gender diversity in business',
          'Enabling inclusive development',
          'Fairness in engaging with customers and suppliers',
          'Open-ness of business (concentration of purchases / sales)',
        ],
      },
      { type: 'h2', text: 'The pre-filing checklist' },
      { type: 'h3', text: '90 days before filing' },
      {
        type: 'ul',
        items: [
          'Map every BRSR KPI to its data owner inside your company.',
          'Confirm board-approved policies exist for all 9 NGRBC principles.',
          'Identify your value-chain partners contributing >= 2% of upstream/downstream value (top-250 only).',
          'Engage your assurance provider and agree on scope.',
        ],
      },
      { type: 'h3', text: '60 days before filing' },
      {
        type: 'ul',
        items: [
          'Collect Scope 1 (fuel, refrigerants), Scope 2 (electricity bills), and intensity-denominator data (revenue, production, FTE).',
          'Pull HR data: gender ratio, training hours, safety incidents (LTIFR), wage parity.',
          'Pull procurement data: % from MSMEs, % local sourcing, supplier code-of-conduct coverage.',
          'Send supplier data requests for value-chain disclosures.',
        ],
      },
      { type: 'h3', text: '30 days before filing' },
      {
        type: 'ul',
        items: [
          'Run internal review against the SEBI BRSR XBRL taxonomy.',
          'Reconcile every KPI against source documents — assurance providers will sample.',
          'Cross-check the BRSR with the Director’s Report and MD&A; numbers must match.',
          'Get sign-off from the BRC / sustainability committee.',
        ],
      },
      { type: 'h2', text: 'Common pitfalls' },
      {
        type: 'ul',
        items: [
          '<strong>Saying "Yes" to a policy you do not actually have</strong> — assurance providers will ask for it.',
          '<strong>Mixing financial year vs calendar year</strong> for emissions data.',
          '<strong>Forgetting the value-chain ask</strong> — 75% coverage is hard if you start late.',
          '<strong>Using global emission factors</strong> — for India, use CEA grid factor for electricity (~0.716 kgCO₂/kWh, FY24).',
        ],
      },
      { type: 'h2', text: 'How CarbonFlow helps' },
      {
        type: 'p',
        text: 'CarbonFlow handles the hardest parts of the BRSR: collecting Scope 1, 2, and 3 data from operations and suppliers, applying India-specific emission factors, and exporting in a BRSR-ready format. It is free for Indian companies, so the most regulated market also gets the best toolkit.',
      },
    ],
  },

  {
    slug: 'how-to-collect-supplier-emissions-data',
    title: 'How to Collect Supplier Emissions Data (Without Annoying Your Suppliers)',
    description:
      'A pragmatic playbook for collecting Scope 3 supplier emissions data — what to ask, how to ask, response-rate benchmarks, and templates that actually work.',
    keywords:
      'supplier emissions data, scope 3 data collection, supplier survey template, supplier engagement, primary data carbon, supplier carbon questionnaire',
    author: 'CarbonFlow Team',
    date: '2026-04-25',
    readMinutes: 8,
    category: 'How-to',
    excerpt:
      'Most supplier surveys get a 12% response rate. With the right approach you can hit 70%+ on your top suppliers. Here is what works.',
    sections: [
      {
        type: 'p',
        text: 'Collecting emissions data from suppliers is the single biggest operational challenge in Scope 3 reporting. Spreadsheet questionnaires sent over email get 10–15% response rates. Done well, the same exercise can hit 70% on your top-revenue suppliers. The difference is not effort — it is approach.',
      },
      { type: 'h2', text: 'Step 1: Segment your suppliers before you ask anyone anything' },
      {
        type: 'p',
        text: 'Pareto applies. In most procurement portfolios, 20% of suppliers account for 80% of spend, and therefore most of your Scope 3 Category 1 emissions. Start there.',
      },
      {
        type: 'ul',
        items: [
          '<strong>Tier 1 — Strategic (top 20 by spend)</strong>: deserve a phone call and a tailored ask. Push for activity-based primary data.',
          '<strong>Tier 2 — Important (next 80)</strong>: structured digital form, monthly nudges.',
          '<strong>Tier 3 — Long tail</strong>: use spend-based estimates. Do not chase them.',
        ],
      },
      { type: 'h2', text: 'Step 2: Ask for the smallest possible amount of data' },
      {
        type: 'p',
        text: 'A 60-question ESG questionnaire is the fastest way to kill your response rate. For most categories, three numbers are enough to compute a credible emissions estimate:',
      },
      {
        type: 'ol',
        items: [
          '<strong>Electricity consumed</strong> in kWh (annual, allocated to your share if needed).',
          '<strong>Fuel consumed</strong> in litres or kg, by fuel type.',
          '<strong>Transport activity</strong> in km or tonne-km, by mode (road, rail, air, sea).',
        ],
      },
      {
        type: 'callout',
        text: 'CarbonFlow’s default supplier form asks exactly these three numbers — and computes CO₂ instantly using GHG Protocol factors.',
      },
      { type: 'h2', text: 'Step 3: Make it ridiculously easy to respond' },
      {
        type: 'ul',
        items: [
          '<strong>One link, no login</strong>. Suppliers should not have to create an account to answer three questions.',
          '<strong>Mobile-first form</strong>. The person filling it in is often a plant manager on a phone, not a sustainability analyst.',
          '<strong>Save & resume</strong>. They will need to find a bill from last March.',
          '<strong>One email per supplier, with their company name pre-filled</strong>. Generic blast emails go to spam.',
        ],
      },
      { type: 'h2', text: 'Step 4: Tell them why' },
      {
        type: 'p',
        text: 'Suppliers are getting flooded with carbon questionnaires. The ones they answer first are the ones where the customer relationship matters and where the ask is framed clearly. A two-line email that says <em>"We are reporting Scope 3 to comply with BRSR. Your data covers ~3% of our footprint — please share by April 30."</em> outperforms a 400-word ESG manifesto every time.',
      },
      { type: 'h2', text: 'Step 5: Reminders, escalation, and benchmarks' },
      {
        type: 'ul',
        items: [
          'Day 0 — Initial request from the procurement contact, not a generic sustainability mailbox.',
          'Day 7 — Polite reminder.',
          'Day 14 — Reminder + offer to do a 15-min call.',
          'Day 21 — Escalation through procurement: this becomes part of vendor scorecards.',
        ],
      },
      { type: 'h2', text: 'Response-rate benchmarks (for your top 100 suppliers)' },
      {
        type: 'ul',
        items: [
          '<strong>Year 1, generic email survey</strong>: 12–18%.',
          '<strong>Year 1, dedicated platform with one-click links</strong>: 35–45%.',
          '<strong>Year 2, plus procurement contracting language</strong>: 60–75%.',
          '<strong>Year 3, plus capability-building for suppliers</strong>: 80%+.',
        ],
      },
      { type: 'h2', text: 'What to do for suppliers who do not respond' },
      {
        type: 'p',
        text: 'Use spend-based emission factors (USEEIO, EXIOBASE, India IO tables) to estimate. Disclose the methodology. The GHG Protocol explicitly allows hybrid approaches — primary data where you can, secondary data where you must, with transparency on the split.',
      },
      { type: 'h2', text: 'Pulling it all together' },
      {
        type: 'p',
        text: 'Treat supplier emissions data collection as a procurement program, not a survey. Segment ruthlessly, ask for the minimum, make response frictionless, and build year-over-year. CarbonFlow gives you the secure-link supplier forms, automatic CO₂ calculations, and the supplier dashboard out of the box — so you can spend your time on the relationships, not the spreadsheets.',
      },
    ],
  },
]

export function getPostBySlug(slug) {
  return blogPosts.find((p) => p.slug === slug)
}

export function getRelatedPosts(slug, limit = 2) {
  return blogPosts.filter((p) => p.slug !== slug).slice(0, limit)
}
