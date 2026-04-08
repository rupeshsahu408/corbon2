const OpenAI = require('openai')

function buildPrompt(payload) {
  return `You are a carbon intelligence analyst.
Return concise enterprise-ready insights with sections:
1) Summary
2) Top risks
3) Recommendations
4) Next 30-day actions
Use simple, practical language.
Data:
${JSON.stringify(payload)}`
}

async function generateSummary(payload) {
  const provider = process.env.AI_PROVIDER || 'openai'
  if (provider !== 'openai' || !process.env.OPENAI_API_KEY) {
    return {
      provider: 'adapter',
      summary: 'AI adapter active. Configure OPENAI_API_KEY for model-generated summaries.',
      recommendations: [
        'Focus on top 20% suppliers by emissions.',
        'Set monthly reduction targets by scope.',
      ],
    }
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
  const completion = await client.responses.create({
    model,
    input: buildPrompt(payload),
  })
  const text = completion.output_text || 'No summary generated.'
  return {
    provider: 'openai',
    model,
    summary: text,
    recommendations: [],
  }
}

async function generateQueryAnswer(payload) {
  const provider = process.env.AI_PROVIDER || 'openai'
  const question = String(payload?.question || '').trim()
  if (!question) return { answer: 'Question is required.' }
  if (provider !== 'openai' || !process.env.OPENAI_API_KEY) {
    return {
      provider: 'adapter',
      answer: `AI query adapter active. Question received: "${question}". Configure OPENAI_API_KEY for model answers.`,
    }
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
  const completion = await client.responses.create({
    model,
    input: `Answer the enterprise carbon question with brief actionable guidance.\nQuestion: ${question}\nData: ${JSON.stringify(payload?.data || {})}`,
  })
  return {
    provider: 'openai',
    model,
    answer: completion.output_text || 'No answer generated.',
  }
}

module.exports = { generateSummary, generateQueryAnswer }
