export default function NetworkGraphCanvas({ graph }) {
  const nodes = graph?.nodes || []
  const edges = graph?.edges || []
  const width = 560
  const height = 260
  const centerX = 120
  const centerY = height / 2
  const radius = 90

  const companyNode = nodes.find((n) => n.type === 'company')
  const supplierNodes = nodes.filter((n) => n.type === 'supplier')

  const positionedSuppliers = supplierNodes.map((node, idx) => {
    const angle = (Math.PI * 2 * idx) / Math.max(supplierNodes.length, 1)
    return {
      ...node,
      x: centerX + 240 + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    }
  })

  const companyPoint = { x: centerX, y: centerY, label: companyNode?.label || 'Company' }

  return (
    <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
      <p className="text-xs text-slate-500 mb-2">Network graph</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[240px]">
        {positionedSuppliers.map((node) => (
          <line
            key={`edge-${node.id}`}
            x1={companyPoint.x}
            y1={companyPoint.y}
            x2={node.x}
            y2={node.y}
            stroke="rgba(148,163,184,0.4)"
            strokeWidth="1.5"
          />
        ))}

        <circle cx={companyPoint.x} cy={companyPoint.y} r="26" fill="rgba(34,197,94,0.3)" stroke="rgba(34,197,94,0.8)" />
        <text x={companyPoint.x} y={companyPoint.y + 4} textAnchor="middle" fill="#dcfce7" fontSize="10" fontWeight="700">HQ</text>
        <text x={companyPoint.x} y={companyPoint.y + 42} textAnchor="middle" fill="#94a3b8" fontSize="10">{companyPoint.label}</text>

        {positionedSuppliers.map((node) => {
          const score = Number(node.score || 0)
          const fill = score < 45 ? 'rgba(244,63,94,0.25)' : 'rgba(59,130,246,0.25)'
          const stroke = score < 45 ? 'rgba(244,63,94,0.8)' : 'rgba(96,165,250,0.8)'
          return (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r="18" fill={fill} stroke={stroke} />
              <text x={node.x} y={node.y + 3} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="700">
                {Math.round(score)}
              </text>
              <text x={node.x} y={node.y + 30} textAnchor="middle" fill="#94a3b8" fontSize="9">
                {node.label?.slice(0, 10)}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="text-[11px] text-slate-600 mt-1">{edges.length} connections visualized</p>
    </div>
  )
}
