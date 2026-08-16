const config = require('../config/config');

// Groq oferece uma API compatível com o padrão OpenAI, com plano gratuito
// generoso e modelos Llama de alta qualidade — sem necessidade de cartão de crédito.
// Crie sua chave gratuita em: https://console.groq.com/keys
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// A Groq depreca modelos periodicamente (ver console.groq.com/docs/deprecations).
// 'llama-3.3-70b-versatile' foi descontinuado — usando o substituto recomendado.
const MODEL = 'openai/gpt-oss-120b';
// Modelo com suporte a visão (imagens) para leitura de comprovantes/recibos.
const VISION_MODEL = 'qwen/qwen3.6-27b';

/**
 * Monta o contexto financeiro do usuário em texto compacto para a IA.
 */
function buildFinancialContext({ banks, transactions, goals, score }) {
  const bankSummary = banks
    .map((b) => `- ${b.name} (${b.type}): R$ ${b.currentBalance.toFixed(2)}`)
    .join('\n');

  const recent = transactions
    .slice(0, 60)
    .map(
      (t) =>
        `${t.date.toISOString().slice(0, 10)} | ${t.type} | ${t.description} | R$ ${t.amount.toFixed(2)} | ${
          t.category?.name || 'Sem categoria'
        }`
    )
    .join('\n');

  const goalSummary = goals
    .map((g) => `- ${g.title}: R$ ${g.currentAmount.toFixed(2)} de R$ ${g.targetAmount.toFixed(2)}`)
    .join('\n');

  return `
CONTAS DO USUÁRIO:
${bankSummary || 'Nenhuma conta cadastrada.'}

SCORE FINANCEIRO ATUAL: ${score}/1000

METAS FINANCEIRAS:
${goalSummary || 'Nenhuma meta cadastrada.'}

ÚLTIMAS TRANSAÇÕES (mais recentes primeiro):
${recent || 'Nenhuma transação registrada.'}
`.trim();
}

const SYSTEM_PROMPT = `Você é o consultor financeiro de IA do FinPilot AI, um SaaS de gestão financeira pessoal.
Analise os dados financeiros reais do usuário fornecidos no contexto e responda como um consultor financeiro experiente, direto e prático, em português do Brasil.

Regras:
- Baseie-se SOMENTE nos dados fornecidos. Nunca invente números.
- Seja específico: cite valores, categorias e datas quando relevante.
- Aponte gastos excessivos, possíveis assinaturas esquecidas, compras por impulso ou padrões incomuns quando notar.
- Dê recomendações acionáveis e realistas.
- Use um tom encorajador, mas honesto sobre riscos financeiros.
- Responda em texto corrido curto (parágrafos objetivos) ou em lista, conforme melhor se encaixe na pergunta.
- Não dê conselhos de investimento específicos de produtos financeiros (ex: não recomende ativos, corretoras ou fundos específicos); fale em termos gerais de planejamento.`;

async function callGroq({ systemPrompt, userContent, jsonMode = false }) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.groqApiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      temperature: 0.4,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API da IA: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Envia uma pergunta do usuário + contexto financeiro para a IA e retorna a resposta.
 */
async function askFinancialAdvisor({ question, banks, transactions, goals, score }) {
  if (!config.groqApiKey) {
    return {
      answer:
        'A funcionalidade de IA ainda não foi configurada neste servidor. Peça ao administrador para definir a variável GROQ_API_KEY no arquivo .env (chave gratuita em console.groq.com/keys).',
      configured: false
    };
  }

  const context = buildFinancialContext({ banks, transactions, goals, score });

  const answer = await callGroq({
    systemPrompt: SYSTEM_PROMPT,
    userContent: `${context}\n\nPERGUNTA DO USUÁRIO: ${question}`
  });

  return { answer: answer || 'A IA não conseguiu gerar uma resposta no momento.', configured: true };
}

/**
 * Gera automaticamente insights (alertas inteligentes) sobre os dados financeiros do usuário.
 */
async function generateInsights({ banks, transactions, goals, score }) {
  if (!config.groqApiKey) {
    return { insights: [], configured: false };
  }

  const context = buildFinancialContext({ banks, transactions, goals, score });

  try {
    const text = await callGroq({
      systemPrompt: `${SYSTEM_PROMPT}\n\nResponda ESTRITAMENTE em JSON válido, sem markdown, sem texto extra, no formato:
{"insights": [{"type": "alerta|oportunidade|previsao", "title": "string curta", "message": "string explicativa"}]}
Gere no máximo 5 insights, apenas os mais relevantes e acionáveis com base nos dados reais.`,
      userContent: `${context}\n\nGere os insights financeiros mais relevantes agora.`,
      jsonMode: true
    });

    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return { insights: parsed.insights || [], configured: true };
  } catch {
    return { insights: [], configured: true, error: true };
  }
}

/**
 * Analisa uma imagem de comprovante/recibo e extrai os dados da movimentação.
 * Retorna sugestões para o usuário confirmar antes de salvar — nunca cria a
 * transação sozinha, pois o reconhecimento pode errar valores ou datas.
 */
function extractJson(text) {
  const clean = String(text || '').replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Fallback: alguns modelos de raciocínio deixam texto antes/depois do
    // JSON (ex: rascunho de pensamento). Extrai só o trecho entre a
    // primeira "{" e a última "}" e tenta de novo antes de desistir.
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(clean.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function scanReceiptImage({ base64Image, mimeType, categories }) {
  if (!config.groqApiKey) {
    return {
      configured: false,
      message:
        'A leitura automática de comprovantes não foi configurada. Defina GROQ_API_KEY no .env (chave gratuita em console.groq.com/keys).'
    };
  }

  const categoryNames = (categories || []).map((c) => c.name).join(', ');

  const systemPrompt = `Você extrai dados estruturados de imagens de comprovantes, recibos, notas fiscais e boletos brasileiros.
Responda ESTRITAMENTE em JSON válido, sem markdown, sem texto extra, no formato:
{
  "description": "string curta (nome do estabelecimento/serviço)",
  "amount": number (apenas o valor numérico, sem "R$", use ponto decimal),
  "date": "YYYY-MM-DD" (data da compra/emissão; se não achar, use null),
  "dueDate": "YYYY-MM-DD" (data de vencimento, apenas se for boleto/fatura; senão null),
  "type": "despesa" ou "receita",
  "method": "PIX" | "Cartão" | "Boleto" | "TED" | "DOC" | "Dinheiro" | "Transferência" | "Outro",
  "suggestedCategory": "uma das categorias fornecidas, ou null se nenhuma combinar",
  "confidence": "alta" | "media" | "baixa"
}
Categorias disponíveis do usuário: ${categoryNames || 'nenhuma cadastrada'}.
Se a imagem não for um comprovante financeiro legível, retorne todos os campos como null e confidence "baixa".`;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.groqApiKey}`
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 600,
      temperature: 0.2,
      reasoning_effort: 'none', // desliga o "modo pensamento" do Qwen 3.6 — sem isso, o raciocínio
                                 // interno vinha misturado no texto de resposta e quebrava o parse do JSON
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extraia os dados desse comprovante.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[aiService] Erro na API de visão da Groq: ${response.status} ${errText}`);
    throw new Error(`Erro na API de visão da IA: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '{}';
  const parsed = extractJson(text);

  if (!parsed) {
    console.error('[aiService] Resposta da IA não era JSON válido:', text.slice(0, 300));
    return { configured: true, error: true, message: 'Não foi possível interpretar o comprovante. Preencha manualmente.' };
  }

  return { configured: true, ...parsed };
}

/**
 * Analisa o TEXTO extraído de um boleto em PDF (a maioria dos boletos
 * brasileiros gerados digitalmente tem camada de texto selecionável — não
 * precisa de OCR/imagem). Extrai valor, vencimento, beneficiário e linha
 * digitável quando presente. Assim como no comprovante, apenas sugere —
 * quem confirma e define o status (pago/pendente) é o usuário.
 */
async function analyzeBoletoText({ text, categories }) {
  if (!config.groqApiKey) {
    return {
      configured: false,
      message: 'A leitura automática de boletos não foi configurada. Defina GROQ_API_KEY no .env (chave gratuita em console.groq.com/keys).'
    };
  }

  const categoryNames = (categories || []).map((c) => c.name).join(', ');

  const systemPrompt = `Você extrai dados estruturados do texto de boletos bancários brasileiros (extraído de um PDF).
Responda ESTRITAMENTE em JSON válido, sem markdown, sem texto extra, no formato:
{
  "description": "string curta (nome do beneficiário/empresa cobrando)",
  "amount": number (valor do boleto, apenas número, ponto decimal),
  "dueDate": "YYYY-MM-DD" (data de vencimento do boleto),
  "issueDate": "YYYY-MM-DD" (data de emissão/documento, se houver, senão null),
  "barcodeLine": "a linha digitável, se conseguir identificar no texto, senão null",
  "suggestedCategory": "uma das categorias fornecidas, ou null se nenhuma combinar",
  "confidence": "alta" | "media" | "baixa"
}
Categorias disponíveis do usuário: ${categoryNames || 'nenhuma cadastrada'}.
IMPORTANTE: o texto de um boleto NUNCA indica se ele já foi pago — isso não existe no documento. Não tente adivinhar status de pagamento; apenas extraia os dados do boleto em si.
Se o texto não parecer um boleto legível, retorne os campos como null e confidence "baixa".`;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.groqApiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Texto extraído do PDF do boleto:\n\n${text.slice(0, 6000)}` }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[aiService] Erro na API da Groq (boleto): ${response.status} ${errText}`);
    throw new Error(`Erro na API da IA: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || '{}';
  const parsed = extractJson(rawText);

  if (!parsed) {
    console.error('[aiService] Resposta da IA (boleto) não era JSON válido:', rawText.slice(0, 300));
    return { configured: true, error: true, message: 'Não foi possível interpretar o boleto. Preencha manualmente.' };
  }

  return { configured: true, ...parsed };
}

module.exports = { askFinancialAdvisor, generateInsights, scanReceiptImage, analyzeBoletoText };
