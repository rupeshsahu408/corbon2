import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { api } from '../services/api'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

const REPORT_TYPES = [
  { value: 'standard', label: 'Standard Emissions Report' },
  { value: 'brsr',     label: 'BRSR — Business Responsibility & Sustainability' },
  { value: 'cbam',     label: 'CBAM — Carbon Border Adjustment Mechanism' },
]

function FlagBadge({ flag }) {
  const styles = {
    warning: 'bg-yellow-950/40 border-yellow-700/40 text-yellow-400',
    info:    'bg-blue-950/40 border-blue-700/40 text-blue-400',
  }
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${styles[flag.type] || styles.info}`}>
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      {flag.message}
    </div>
  )
}

function generatePDFStandard(report, reportType) {
  const doc = new jsPDF()
  const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
  const typeLabel = REPORT_TYPES.find(t => t.value === reportType)?.label || 'Emissions Report'

  // Cover header
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, 220, 55, 'F')
  doc.setFillColor(22, 163, 74)
  doc.rect(0, 0, 6, 55, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('CarbonFlow', 14, 18)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(typeLabel, 14, 27)
  doc.text(`Company: ${report.companyName || 'N/A'}`, 14, 36)
  doc.text(`Report Date: ${today}`, 14, 44)
  doc.text(`Scope: 1, 2 & 3 Greenhouse Gas Emissions`, 14, 52)

  let y = 68

  // Quality flags
  if (report.flags?.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(245, 158, 11)
    doc.text('⚠ Data Quality Notices', 14, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    report.flags.forEach(f => {
      doc.text(`• ${f.message}`, 18, y)
      y += 5
    })
    y += 4
  }

  // Grand total box
  doc.setFillColor(240, 253, 244)
  doc.roundedRect(14, y, 182, 22, 3, 3, 'F')
  doc.setTextColor(22, 163, 74)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  const grandTotal = Number(report.stats?.grandTotal || report.stats?.totalCo2 || 0)
  doc.text(`Total Carbon Footprint: ${grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg CO₂`, 105, y + 9, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(`= ${(grandTotal / 1000).toFixed(3)} tonnes CO₂e`, 105, y + 17, { align: 'center' })
  y += 32

  // Scope summary boxes
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Scope Classification Summary', 14, y)
  y += 7

  const scopeBoxes = [
    { label: 'Scope 1 — Direct', value: report.stats?.scope1Total, color: [255, 237, 213], textColor: [194, 65, 12], desc: 'Fuel combustion, on-site sources' },
    { label: 'Scope 2 — Electricity', value: report.stats?.scope2Total, color: [219, 234, 254], textColor: [29, 78, 216], desc: 'Purchased electricity' },
    { label: 'Scope 3 — Supply Chain', value: report.stats?.scope3Total, color: [243, 232, 255], textColor: [126, 34, 206], desc: 'Supplier emissions + transport' },
  ]
  scopeBoxes.forEach((box, i) => {
    const x = 14 + i * 62
    doc.setFillColor(...box.color)
    doc.roundedRect(x, y, 58, 30, 2, 2, 'F')
    doc.setTextColor(...box.textColor)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text(box.label, x + 4, y + 7)
    doc.setFontSize(13)
    doc.text(`${Number(box.value || 0).toFixed(1)} kg`, x + 4, y + 18)
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(box.desc, x + 4, y + 26)
  })
  y += 40

  // Direct company emissions
  if (report.directEmissions?.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text('Company Direct Emissions (Scope 1 & 2)', 14, y)
    y += 4

    const directRows = report.directEmissions.map(d => [
      d.period_label,
      d.fuel_usage > 0 ? `${Number(d.fuel_usage).toFixed(1)} L (${d.fuel_type})` : '—',
      d.electricity_usage > 0 ? `${Number(d.electricity_usage).toFixed(1)} kWh` : '—',
      `${Number(d.scope1_co2).toFixed(2)} kg`,
      `${Number(d.scope2_co2).toFixed(2)} kg`,
      `${Number(d.total_co2).toFixed(2)} kg`,
    ])

    doc.autoTable({
      startY: y,
      head: [['Period', 'Fuel', 'Electricity', 'Scope 1 CO₂', 'Scope 2 CO₂', 'Total CO₂']],
      body: directRows,
      headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      styles: { cellPadding: 3 },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // Supplier breakdown
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Supplier Emissions Breakdown (Scope 3)', 14, y)
  y += 4

  const rows = (report.suppliers || []).filter(s => s.status === 'completed').map(s => [
    s.name,
    s.electricity_usage ? `${Number(s.electricity_usage).toFixed(1)} kWh` : '—',
    s.fuel_usage        ? `${Number(s.fuel_usage).toFixed(1)} L` : '—',
    s.transport_distance ? `${Number(s.transport_distance).toFixed(1)} km` : '—',
    s.scope1_co2 ? `${Number(s.scope1_co2).toFixed(2)}` : '—',
    s.scope2_co2 ? `${Number(s.scope2_co2).toFixed(2)}` : '—',
    s.scope3_co2 ? `${Number(s.scope3_co2).toFixed(2)}` : '—',
    s.total_co2  ? `${Number(s.total_co2).toFixed(2)}` : '—',
  ])

  if (rows.length > 0) {
    doc.autoTable({
      startY: y,
      head: [['Supplier', 'Electricity', 'Fuel', 'Transport', 'S1 CO₂', 'S2 CO₂', 'S3 CO₂', 'Total (kg)']],
      body: rows,
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [248, 255, 252] },
      styles: { cellPadding: 3 },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // Methodology
  if (y > 230) { doc.addPage(); y = 20 }
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Methodology & Emission Factors', 14, y)
  y += 6
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  const ef = report?.methodology?.emissionFactors
  const fuel = ef?.fuelKgCo2PerUnitByType || {}
  const methodLines = [
    `Engine version: ${report?.methodology?.calculationEngineVersion || '—'} · Factor library: ${report?.methodology?.factorLibraryVersion || '—'}`,
    `Scope 1 — Fuel combustion (kg CO₂ per unit): Diesel ${fuel.diesel ?? '—'}, Petrol ${fuel.petrol ?? '—'}, LPG ${fuel.lpg ?? '—'}, Natural Gas ${fuel.natural_gas ?? '—'}`,
    `Scope 2 — Purchased electricity: ${ef?.electricityKgCo2PerKwh ?? '—'} kg CO₂/kWh`,
    `Scope 3 — Transport: ${ef?.transportKgCo2PerKm ?? '—'} kg CO₂/km`,
    report?.methodology?.protocol ? `Protocol: ${report.methodology.protocol}` : 'Protocol: GHG Protocol Corporate Standard + Value Chain (Scope 3)',
  ]
  methodLines.forEach(line => {
    doc.text(`• ${line}`, 18, y)
    y += 5
  })

  // Footer on each page
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const ph = doc.internal.pageSize.height
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.text(`CarbonFlow — ${typeLabel} — ${today} — Page ${i} of ${pageCount}`, 105, ph - 8, { align: 'center' })
    doc.setDrawColor(220, 220, 220)
    doc.line(14, ph - 12, 196, ph - 12)
  }

  return doc
}

function defaultPeriodLabel() {
  const d = new Date()
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
}

export default function Reports() {
  const [report, setReport]           = useState(null)
  const [savedReports, setSavedReports] = useState([])
  const [snapshots, setSnapshots]     = useState([])
  const [methodology, setMethodology] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [reportType, setReportType]   = useState('standard')
  const [activeTab, setActiveTab]     = useState('generate')
  const [snapshotPeriod, setSnapshotPeriod] = useState(defaultPeriodLabel)
  const [snapshotNotes, setSnapshotNotes] = useState('')
  const [snapshotSaving, setSnapshotSaving] = useState(false)
  const [trustOverview, setTrustOverview] = useState(null)

  useEffect(() => {
    Promise.all([
      api.getReport(reportType),
      api.getSavedReports(),
      api.listInventorySnapshots().catch(() => []),
    ])
      .then(([r, s, snaps]) => {
        setReport(r)
        setSavedReports(s)
        setSnapshots(Array.isArray(snaps) ? snaps : [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [reportType])

  useEffect(() => {
    if (activeTab !== 'methodology') return
    setMethodology(null)
    setTrustOverview(null)
    api.getMethodology().then(setMethodology).catch(() => setMethodology(null))
    api.getTrustOverview().then(setTrustOverview).catch(() => setTrustOverview(null))
  }, [activeTab])

  async function downloadDisclosureJson(framework) {
    setError('')
    try {
      const data = await api.getDisclosureExport(framework)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `carbonflow-disclosure-${framework}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleGenerateAndSave() {
    if (!report) return
    setGenerating(true)
    setSaving(true)
    try {
      const doc = generatePDFStandard(report, reportType)
      doc.save(`CarbonFlow-${reportType.toUpperCase()}-Report-${new Date().toISOString().split('T')[0]}.pdf`)

      const saved = await api.saveReport({
        report_type: reportType,
        summary: {
          grandTotal: report.stats?.grandTotal,
          scope1:     report.stats?.scope1Total,
          scope2:     report.stats?.scope2Total,
          scope3:     report.stats?.scope3Total,
          suppliers:  report.stats?.total,
          completed:  report.stats?.completed,
        },
      })
      setSavedReports(prev => [saved, ...prev])
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
      setSaving(false)
    }
  }

  async function handleSaveSnapshot() {
    const label = snapshotPeriod.trim()
    if (!label) {
      setError('Enter a period label (e.g. 2026-Q1).')
      return
    }
    setSnapshotSaving(true)
    setError('')
    try {
      const row = await api.createInventorySnapshot({
        periodLabel: label,
        notes: snapshotNotes.trim() || undefined,
      })
      setSnapshots((prev) => [row, ...prev])
      setSnapshotNotes('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSnapshotSaving(false)
    }
  }

  const totalCo2 = Number(report?.stats?.grandTotal || report?.stats?.totalCo2 || 0)
  const methodologyFromReport = report?.methodology
  const checklist = report
    ? [
        {
          key: 'direct',
          label: 'Record company Scope 1 & 2 (fuel + electricity)',
          done: (report.directEmissions || []).length > 0,
        },
        {
          key: 'suppliers',
          label: 'Add suppliers and collect at least 1 submission',
          done: (report.stats?.completed || 0) > 0,
        },
        {
          key: 'inventory',
          label: 'Review total Scope 1, 2 & 3 inventory on dashboard',
          done: totalCo2 > 0,
        },
        {
          key: 'pdf',
          label: 'Generate and download a compliance PDF report',
          done: savedReports.length > 0,
        },
      ]
    : []

  return (
    <div className="flex min-h-screen page-main">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="px-8 py-6 page-header flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Compliance Reports</h1>
            <p className="text-slate-400 text-sm mt-1">Generate audit-ready reports — BRSR, CBAM, Standard</p>
          </div>
          <button
            onClick={handleGenerateAndSave}
            disabled={generating || loading || !report}
            className="btn-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            {generating ? 'Generating...' : 'Download PDF'}
          </button>
        </div>

        {/* Tabs */}
        <div className="px-8 border-b border-slate-800">
          <div className="flex gap-0">
            {[
              { key: 'generate', label: 'Generate Report' },
              { key: 'history', label: `Report History (${savedReports.length})` },
              { key: 'methodology', label: 'Methodology & snapshots' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-brand-500 text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-8 py-6">
          {loading ? (
            <div className="flex items-center gap-3 text-slate-400 py-12">
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Loading report data...
            </div>
          ) : error && activeTab !== 'methodology' ? (
            <div className="p-4 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm">{error}</div>
          ) : activeTab === 'methodology' ? (
            <div className="space-y-6">
              {error && (
                <div className="p-4 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm">{error}</div>
              )}
              <div className="card">
                <h2 className="font-semibold text-white mb-2">Methodology &amp; calculation version</h2>
                <p className="text-xs text-slate-500 mb-4">
                  Same factors apply to PDF exports and dashboard source charts. Strategic roadmap:{' '}
                  <span className="text-slate-400">repo </span>
                  <code className="text-slate-500">docs/STRATEGIC_WEDGES.md</code>
                  {' · '}
                  Integrations: <code className="text-slate-500">docs/INTEGRATIONS_SHORTLIST.md</code>
                  {' · '}
                  <a href="/api/docs" target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">
                    /api/docs
                  </a>
                </p>
                {(methodology || methodologyFromReport) ? (
                  <div className="space-y-3 text-sm text-slate-300">
                    <p>
                      <span className="text-slate-500">Engine version:</span>{' '}
                      <span className="text-white font-mono">{(methodology || methodologyFromReport).calculationEngineVersion}</span>
                    </p>
                    <p className="text-slate-400 leading-relaxed">{(methodology || methodologyFromReport).protocol}</p>
                    {Object.entries((methodology || methodologyFromReport).scopes || {}).map(([k, v]) => (
                      <div key={k} className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
                        <p className="text-xs text-brand-400 uppercase font-semibold mb-1">{k}</p>
                        <p className="text-xs text-slate-400 leading-relaxed">{v}</p>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                      {(methodology || methodologyFromReport).sourceAttribution}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">Loading methodology…</p>
                )}
              </div>

              {trustOverview && (
                <div className="card">
                  <h2 className="font-semibold text-white mb-2">Trust &amp; assurance readiness</h2>
                  <p className="text-xs text-slate-500 mb-3">
                    Factor versioning and lineage are API-backed. Full assurance workflows remain on the roadmap.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    {(trustOverview.assuranceReadiness?.checklist || []).map((c) => (
                      <div
                        key={c.id}
                        className={`text-xs border rounded-lg px-3 py-2 ${
                          c.status === 'ready'
                            ? 'border-emerald-800/50 bg-emerald-950/20 text-emerald-200'
                            : c.status === 'partial'
                              ? 'border-amber-800/40 bg-amber-950/20 text-amber-200'
                              : c.status === 'planned'
                                ? 'border-slate-700 bg-slate-900/50 text-slate-400'
                                : 'border-rose-900/40 bg-rose-950/20 text-rose-200'
                        }`}
                      >
                        <p className="font-semibold text-white">{c.id.replace(/_/g, ' ')}</p>
                        <p className="mt-0.5 opacity-90">{c.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => downloadDisclosureJson('cdp')}
                      className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
                    >
                      Download CDP skeleton (JSON)
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadDisclosureJson('esrs')}
                      className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
                    >
                      Download ESRS E1 skeleton (JSON)
                    </button>
                  </div>
                </div>
              )}

              <div className="card">
                <h2 className="font-semibold text-white mb-2">Inventory snapshot</h2>
                <p className="text-xs text-slate-500 mb-4">
                  Save a point-in-time copy of scope totals and CO₂ source split for audit trails and period-close.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <input
                    className="input flex-1"
                    value={snapshotPeriod}
                    onChange={(e) => setSnapshotPeriod(e.target.value)}
                    placeholder="e.g. 2026-Q1"
                  />
                  <button
                    type="button"
                    onClick={handleSaveSnapshot}
                    disabled={snapshotSaving}
                    className="btn-primary shrink-0"
                  >
                    {snapshotSaving ? 'Saving…' : 'Save snapshot'}
                  </button>
                </div>
                <textarea
                  className="input min-h-[72px] mb-4"
                  value={snapshotNotes}
                  onChange={(e) => setSnapshotNotes(e.target.value)}
                  placeholder="Optional notes (e.g. closed books, assurance period)"
                />
                <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Recent snapshots</h3>
                {snapshots.length === 0 ? (
                  <p className="text-sm text-slate-500">No snapshots yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {snapshots.map((s) => {
                      let snap = s.snapshot
                      if (typeof snap === 'string') {
                        try {
                          snap = JSON.parse(snap)
                        } catch {
                          snap = {}
                        }
                      }
                      const g = snap?.stats?.grandTotalKg
                      return (
                        <li key={s.id} className="border border-slate-800 rounded-xl p-3 text-sm bg-slate-900/40">
                          <div className="flex justify-between gap-2 flex-wrap">
                            <span className="text-white font-medium">{s.period_label}</span>
                            <span className="text-slate-500 text-xs">
                              {new Date(s.created_at).toLocaleString()}
                            </span>
                          </div>
                          {g != null && (
                            <p className="text-slate-400 text-xs mt-1">
                              Grand total: {Number(g).toLocaleString()} kg CO₂e · engine {s.calculation_engine_version}
                            </p>
                          )}
                          {s.notes && <p className="text-slate-500 text-xs mt-1">{s.notes}</p>}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : activeTab === 'generate' ? (
            <>
              {/* First-report checklist */}
              {report && (
                <div className="card mb-6">
                  <h2 className="font-semibold text-white mb-2 text-sm">First report checklist</h2>
                  <p className="text-xs text-slate-500 mb-3">
                    Follow these steps to get from raw data to an audit-ready PDF. All items turn green once completed.
                  </p>
                  <ul className="space-y-2">
                    {checklist.map((item) => (
                      <li
                        key={item.key}
                        className="flex items-center gap-3 text-sm"
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] border ${
                            item.done
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                              : 'bg-slate-900 border-slate-700 text-slate-500'
                          }`}
                        >
                          {item.done ? '✓' : '•'}
                        </span>
                        <span className={item.done ? 'text-slate-300 line-through decoration-slate-600' : 'text-slate-200'}>
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Data quality flags */}
              {report?.flags?.length > 0 && (
                <div className="space-y-2 mb-6">
                  {report.flags.map((f, i) => <FlagBadge key={i} flag={f} />)}
                </div>
              )}

              {report?.compliance && (
                <div className="card mb-6">
                  <h2 className="font-semibold text-white mb-3">Compliance Status</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="p-3 rounded-xl border border-slate-700 bg-slate-900">
                      <p className="text-xs text-slate-500 uppercase">Mode</p>
                      <p className="text-sm text-brand-300 font-semibold mt-1">{String(report.compliance.mode || 'standard').toUpperCase()}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-700 bg-slate-900">
                      <p className="text-xs text-slate-500 uppercase">Status</p>
                      <p className="text-sm text-white font-semibold mt-1">{report.compliance.status === 'ready' ? 'Ready' : 'Attention Required'}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-700 bg-slate-900">
                      <p className="text-xs text-slate-500 uppercase">Carbon Cost</p>
                      <p className="text-sm text-white font-semibold mt-1">INR {Number(report.stats?.estimatedCarbonCostInr || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(report.compliance.sections || []).map((sec) => (
                      <div key={sec.key} className="text-xs border border-slate-800 rounded-lg px-3 py-2 text-slate-300 bg-slate-900/60 flex items-center justify-between">
                        <span>{sec.title}</span>
                        <span className={sec.status === 'ready' ? 'text-brand-300' : 'text-yellow-300'}>{sec.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Report type selector */}
              <div className="card mb-6">
                <h2 className="font-semibold text-white mb-3">Report Format</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {REPORT_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => setReportType(type.value)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        reportType === type.value
                          ? 'border-brand-500 bg-brand-600/10'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className={`text-sm font-semibold mb-1 ${reportType === type.value ? 'text-brand-400' : 'text-white'}`}>
                        {type.value === 'standard' ? 'Standard' : type.value.toUpperCase()}
                      </div>
                      <div className="text-xs text-slate-500">{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grand total + scope cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div className="card col-span-1 sm:col-span-1 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Grand Total</p>
                  <p className="text-3xl font-black text-white">{totalCo2.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                  <p className="text-xs text-slate-500 mt-1">kg CO₂e (all scopes)</p>
                </div>
                {[
                  { label: 'Scope 1', value: report?.stats?.scope1Total, color: 'text-orange-400', bg: 'bg-orange-950/20 border-orange-800/30', desc: 'Direct' },
                  { label: 'Scope 2', value: report?.stats?.scope2Total, color: 'text-blue-400',   bg: 'bg-blue-950/20 border-blue-800/30',   desc: 'Electricity' },
                  { label: 'Scope 3', value: report?.stats?.scope3Total, color: 'text-purple-400', bg: 'bg-purple-950/20 border-purple-800/30', desc: 'Supply chain' },
                ].map(item => (
                  <div key={item.label} className={`card border ${item.bg}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${item.color}`}>{item.label} — {item.desc}</p>
                    <p className="text-2xl font-black text-white">{Number(item.value || 0).toFixed(1)}</p>
                    <p className="text-xs text-slate-500 mt-1">kg CO₂</p>
                  </div>
                ))}
              </div>

              {/* Completion stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Suppliers Completed', value: `${report?.stats?.completed} / ${report?.stats?.total}`, sub: `${report?.stats?.completionRate}% completion rate` },
                  { label: 'Direct Entries', value: report?.directEmissions?.length ?? 0, sub: 'Scope 1/2 records' },
                  { label: 'Report Version', value: `v${savedReports.length + 1}`, sub: 'Next download version' },
                ].map(s => (
                  <div key={s.label} className="card">
                    <p className="text-xs text-slate-400 mb-2">{s.label}</p>
                    <p className="text-2xl font-black text-white">{s.value}</p>
                    <p className="text-xs text-slate-600 mt-1">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Supplier table preview */}
              <div className="card p-0 overflow-hidden mb-6">
                <div className="px-6 py-4 page-header flex items-center justify-between">
                  <h2 className="font-semibold text-white">Supplier Scope Breakdown</h2>
                  <span className="text-xs text-slate-500">{report?.suppliers?.filter(s => s.status === 'completed').length} submitted</span>
                </div>
                {!report?.suppliers?.filter(s => s.status === 'completed').length ? (
                  <div className="px-6 py-10 text-center text-slate-500 text-sm">
                    No supplier data submitted yet. Share submission links to collect data.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-800">
                          {['Supplier', 'Electricity', 'Fuel', 'Transport', 'Scope 1', 'Scope 2', 'Scope 3', 'Total CO₂'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {report.suppliers.filter(s => s.status === 'completed').map(s => (
                          <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-white">{s.name}</td>
                            <td className="px-4 py-3 text-xs text-slate-400">{s.electricity_usage ? `${Number(s.electricity_usage).toFixed(1)} kWh` : '—'}</td>
                            <td className="px-4 py-3 text-xs text-slate-400">{s.fuel_usage ? `${Number(s.fuel_usage).toFixed(1)} L` : '—'}</td>
                            <td className="px-4 py-3 text-xs text-slate-400">{s.transport_distance ? `${Number(s.transport_distance).toFixed(1)} km` : '—'}</td>
                            <td className="px-4 py-3 text-xs text-orange-400 font-medium">{s.scope1_co2 ? Number(s.scope1_co2).toFixed(2) : '—'}</td>
                            <td className="px-4 py-3 text-xs text-blue-400 font-medium">{s.scope2_co2 ? Number(s.scope2_co2).toFixed(2) : '—'}</td>
                            <td className="px-4 py-3 text-xs text-purple-400 font-medium">{s.scope3_co2 ? Number(s.scope3_co2).toFixed(2) : '—'}</td>
                            <td className="px-4 py-3 text-sm font-bold text-white">{s.total_co2 ? `${Number(s.total_co2).toFixed(2)} kg` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Methodology note */}
              <div className="card border-slate-700 bg-slate-900">
                <h3 className="text-sm font-semibold text-white mb-3">Emission Factors Used</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-400">
                  <div>
                    <p className="text-orange-400 font-semibold mb-1.5">Scope 1 — Combustion</p>
                    <p>Diesel: 2.68 kg CO₂/L</p>
                    <p>Petrol: 2.31 kg CO₂/L</p>
                    <p>LPG: 1.51 kg CO₂/L</p>
                    <p>Natural Gas: 2.04 kg CO₂/L-eq</p>
                  </div>
                  <div>
                    <p className="text-blue-400 font-semibold mb-1.5">Scope 2 — Electricity</p>
                    <p>Grid average: 0.233 kg CO₂/kWh</p>
                    <p className="text-slate-500 mt-1">Source: IEA 2023</p>
                  </div>
                  <div>
                    <p className="text-purple-400 font-semibold mb-1.5">Scope 3 — Transport</p>
                    <p>Road freight: 0.10 kg CO₂/km</p>
                    <p className="text-slate-500 mt-1">Source: IPCC AR5</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Report history tab */
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800">
                <h2 className="font-semibold text-white">Downloaded Reports</h2>
                <p className="text-xs text-slate-500 mt-1">All reports are versioned and timestamped for audit purposes</p>
              </div>
              {savedReports.length === 0 ? (
                <div className="px-6 py-14 text-center text-slate-500 text-sm">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  No reports generated yet. Download your first report from the "Generate Report" tab.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {['Version', 'Type', 'Total CO₂', 'Scope 1', 'Scope 2', 'Scope 3', 'Suppliers', 'Generated'].map(h => (
                        <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {savedReports.map(r => {
                      const s = r.summary || {}
                      const label = REPORT_TYPES.find(t => t.value === r.report_type)?.value?.toUpperCase() || r.report_type
                      return (
                        <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-600/20 text-brand-400">v{r.version}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">{label}</td>
                          <td className="px-6 py-4 text-sm font-bold text-white">{s.grandTotal ? `${Number(s.grandTotal).toFixed(1)} kg` : '—'}</td>
                          <td className="px-6 py-4 text-xs text-orange-400">{s.scope1 ? `${Number(s.scope1).toFixed(1)} kg` : '—'}</td>
                          <td className="px-6 py-4 text-xs text-blue-400">{s.scope2 ? `${Number(s.scope2).toFixed(1)} kg` : '—'}</td>
                          <td className="px-6 py-4 text-xs text-purple-400">{s.scope3 ? `${Number(s.scope3).toFixed(1)} kg` : '—'}</td>
                          <td className="px-6 py-4 text-xs text-slate-400">{s.completed}/{s.suppliers}</td>
                          <td className="px-6 py-4 text-xs text-slate-500">
                            {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
