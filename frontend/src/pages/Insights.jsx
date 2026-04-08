import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { api } from '../services/api'
import InsightCard from '../components/insights/InsightCard'
import AlertPanel from '../components/insights/AlertPanel'
import RecommendationList from '../components/insights/RecommendationList'
import ForecastPanel from '../components/insights/ForecastPanel'
import SupplierScoreTable from '../components/insights/SupplierScoreTable'
import BenchmarkPanel from '../components/insights/BenchmarkPanel'
import PeriodComparisonPanel from '../components/insights/PeriodComparisonPanel'

function getComparisonPeriods() {
  const now = new Date()
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previous = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  return { current, previous }
}

export default function Insights() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [periodCompare, setPeriodCompare] = useState(null)
  const [assistantQuestion, setAssistantQuestion] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantReply, setAssistantReply] = useState(null)
  const [assistantConversation, setAssistantConversation] = useState([])
  const [showClearModal, setShowClearModal] = useState(false)
  const [toast, setToast] = useState('')

  const periods = useMemo(getComparisonPeriods, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [overviewData, alertData, compareData] = await Promise.all([
        api.getIntelligenceOverview(),
        api.getIntelligenceAlerts('open'),
        api.getPeriodCompare(periods.current, periods.previous),
      ])
      setOverview(overviewData)
      setAlerts(alertData)
      setPeriodCompare(compareData)
    } catch (err) {
      setError(err.message || 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAcknowledge(id) {
    try {
      await api.acknowledgeIntelligenceAlert(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAskAssistant(e) {
    e.preventDefault()
    if (!assistantQuestion.trim()) return
    setAssistantLoading(true)
    try {
      const reply = await api.chatCarbonAssistant(assistantQuestion.trim())
      setAssistantReply(reply)
      setAssistantConversation(reply.conversationWindow || [])
      setAssistantQuestion('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAssistantLoading(false)
    }
  }

  async function handleClearAssistantConversation() {
    try {
      await api.clearCarbonAssistantConversation()
      setAssistantConversation([])
      setAssistantReply(null)
      setShowClearModal(false)
      setToast('Started a fresh conversation')
      setTimeout(() => setToast(''), 2500)
    } catch (err) {
      setError(err.message)
      setShowClearModal(false)
    }
  }

  return (
    <div className="flex min-h-screen page-main">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-white">Insights</h1>
          <p className="text-slate-400 text-sm mt-1">Intelligent optimization and alerting center</p>
        </div>

        <div className="px-8 py-6">
          {loading ? (
            <div className="text-slate-400">Loading insights...</div>
          ) : error ? (
            <div className="p-4 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm">{error}</div>
          ) : (
            <div className="space-y-6">
              <div className="card">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="text-base font-semibold text-white">AI Carbon Assistant</h3>
                  <button
                    type="button"
                    onClick={() => setShowClearModal(true)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    New conversation
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-3">Ask: "How can I reduce emissions?", "Which supplier is risky?", "Why did emissions increase?"</p>
                <form onSubmit={handleAskAssistant} className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={assistantQuestion}
                    onChange={(e) => setAssistantQuestion(e.target.value)}
                    placeholder="Ask a question..."
                  />
                  <button type="submit" className="btn-primary" disabled={assistantLoading}>
                    {assistantLoading ? 'Thinking...' : 'Ask'}
                  </button>
                </form>
                {assistantReply && (
                  <div className="mt-4 border border-slate-800 rounded-xl p-3 bg-slate-900/60">
                    <p className="text-sm text-white">{assistantReply.answer}</p>
                    {(assistantReply.suggestions || []).length > 0 && (
                      <ul className="mt-2 text-xs text-slate-400 space-y-1">
                        {assistantReply.suggestions.map((s, i) => <li key={i}>- {s}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                {assistantConversation.length > 0 && (
                  <div className="mt-3 border border-slate-800 rounded-xl p-3 bg-slate-900/40">
                    <p className="text-xs text-slate-500 mb-2">Recent conversation</p>
                    <div className="space-y-2">
                      {assistantConversation.map((m, idx) => (
                        <div key={`${m.created_at || idx}-${idx}`} className="text-xs">
                          <span className={m.role === 'assistant' ? 'text-brand-300' : 'text-slate-300'}>
                            {m.role === 'assistant' ? 'Assistant' : 'You'}:
                          </span>{' '}
                          <span className="text-slate-400">{m.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card"><p className="text-xs text-slate-500">Insights</p><p className="text-2xl font-bold text-white mt-1">{overview?.insights?.length || 0}</p></div>
                <div className="card"><p className="text-xs text-slate-500">Open alerts</p><p className="text-2xl font-bold text-rose-300 mt-1">{alerts?.length || 0}</p></div>
                <div className="card"><p className="text-xs text-slate-500">Recommendations</p><p className="text-2xl font-bold text-brand-300 mt-1">{overview?.recommendations?.length || 0}</p></div>
                <div className="card"><p className="text-xs text-slate-500">Next month forecast</p><p className="text-2xl font-bold text-white mt-1">{Number(overview?.forecast?.nextMonthEstimate || 0).toLocaleString()} kg</p></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(overview?.insights || []).slice(0, 3).map((insight) => <InsightCard key={insight.key} insight={insight} />)}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <AlertPanel alerts={alerts} onAcknowledge={handleAcknowledge} />
                <RecommendationList recommendations={overview?.recommendations || []} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <ForecastPanel forecast={overview?.forecast} />
                <BenchmarkPanel benchmark={overview?.benchmark} />
                <PeriodComparisonPanel comparison={periodCompare} />
              </div>

              <SupplierScoreTable scores={overview?.supplierScores || []} />
            </div>
          )}
        </div>
        {showClearModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowClearModal(false)} />
            <div className="relative z-50 w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-4">
              <h3 className="text-sm font-semibold text-white">Start fresh conversation?</h3>
              <p className="text-xs text-slate-400 mt-2">
                This clears only assistant chat memory for your company. Emissions, reports, and other data stay unchanged.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                  onClick={() => setShowClearModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-500"
                  onClick={handleClearAssistantConversation}
                >
                  Start fresh
                </button>
              </div>
            </div>
          </div>
        )}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-brand-700/40 bg-brand-950/80 px-3 py-2 text-xs text-brand-200">
            {toast}
          </div>
        )}
      </main>
    </div>
  )
}
