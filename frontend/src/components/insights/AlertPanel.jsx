export default function AlertPanel({ alerts = [], onAcknowledge }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">Alerts</h3>
        <span className="text-xs text-slate-400">{alerts.length} active</span>
      </div>
      <div className="space-y-2">
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">No active alerts.</p>
        ) : alerts.map((alert) => (
          <div key={alert.id || `${alert.type}-${alert.message}`} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-white">{alert.message}</p>
              {alert.id && onAcknowledge && (
                <button onClick={() => onAcknowledge(alert.id)} className="text-xs text-brand-400 hover:text-brand-300">
                  Acknowledge
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">{alert.type} · {alert.severity}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
