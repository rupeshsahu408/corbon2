export default function BenchmarkPanel({ benchmark }) {
  const monthly = benchmark?.monthlyTotal || {}
  const supplier = benchmark?.supplierAverage || {}

  function line(label, data) {
    return (
      <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-white mt-1">
          {Number(data.companyValue || 0).toLocaleString()} vs benchmark {Number(data.benchmarkValue || 0).toLocaleString()}
        </p>
        <p className={`text-xs mt-1 ${Number(data.deltaPct || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
          {Number(data.deltaPct || 0).toFixed(1)}% {data.status || 'below'} industry average
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-white mb-4">Benchmark Comparison</h3>
      <div className="space-y-3">
        {line('Monthly total CO2', monthly)}
        {line('Average supplier CO2', supplier)}
      </div>
    </div>
  )
}
