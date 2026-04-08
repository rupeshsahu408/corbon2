const { buildInsights } = require('./insightEngine')
const { buildAlerts } = require('./alertEngine')
const { buildRecommendations } = require('./recommendationEngine')
const { buildForecast } = require('./forecastEngine')
const { buildSupplierScores } = require('./scoringEngine')
const { buildBenchmarkComparison } = require('./benchmarkEngine')
const { buildAssistantReply } = require('./assistantEngine')

const intelligenceEngines = {
  insights: buildInsights,
  alerts: buildAlerts,
  recommendations: buildRecommendations,
  forecast: buildForecast,
  scoring: buildSupplierScores,
  benchmark: buildBenchmarkComparison,
  assistant: buildAssistantReply,
}

module.exports = { intelligenceEngines }
