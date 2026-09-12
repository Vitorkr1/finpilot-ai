// Único ponto de contato com o provedor de IA (Seção 9 do spec).
// Trocar de Groq/Llama para outro provedor (ex. Gemini) deve significar
// mudar apenas este arquivo — nenhum controller conhece o SDK usado aqui.
const OpenAI = require('openai');

// Configurável porque provedores descontinuam/renomeiam modelos com o tempo —
// se este endpoint passar a responder 502 "falha ao falar com a IA", confira
// os modelos disponíveis em console.groq.com/docs/models e ajuste GROQ_MODEL.
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

let client = null;
function getClient() {
  if (!process.env.GROQ_API_KEY) {
    const err = new Error('GROQ_API_KEY não configurada — recurso de IA indisponível');
    err.status = 503;
    throw err;
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
  }
  return client;
}

// O SDK do Groq (compatível com OpenAI) propaga o status HTTP bruto do
// provedor em erros (err.status) — sem isso, um 404 "modelo não existe" da
// Groq vazava como um 404 da nossa própria API, indistinguível de rota
// inexistente. Sempre normalizamos para 502 com uma mensagem diagnosticável.
async function chatCompletion(messages, options = {}) {
  try {
    return await getClient().chat.completions.create({ model: MODEL, messages, ...options });
  } catch (err) {
    if (err.status === 503) throw err; // GROQ_API_KEY ausente — já é claro
    const upstreamMessage = err.error?.message || err.message || 'erro desconhecido';
    const wrapped = new Error(`Falha ao falar com o provedor de IA (Groq, modelo "${MODEL}"): ${upstreamMessage}`);
    wrapped.status = 502;
    throw wrapped;
  }
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error('Resposta da IA não continha JSON');
  return JSON.parse(match[0]);
}

async function draftBudgetItems(description) {
  const completion = await chatCompletion(
    [
      {
        role: 'system',
        content:
          'Você ajuda técnicos de empresas de instalação e manutenção (elétrica, solar, ' +
          'ar-condicionado, segurança eletrônica) a rascunhar orçamentos. Responda SOMENTE ' +
          'com um array JSON de itens no formato [{"description": string, "qty": number, ' +
          '"unitPrice": number}], em reais, sem texto adicional.',
      },
      { role: 'user', content: description },
    ],
    { temperature: 0.2 }
  );

  const items = extractJson(completion.choices[0].message.content);
  if (!Array.isArray(items)) throw new Error('Resposta da IA não era um array de itens');
  return items;
}

async function summarizeClientHistory({ client, budgets, serviceOrders }) {
  const completion = await chatCompletion(
    [
      {
        role: 'system',
        content: 'Resuma em português, em até 5 frases, o histórico de um cliente de uma empresa de serviços.',
      },
      {
        role: 'user',
        content: JSON.stringify({ client: client?.name, budgets, serviceOrders }),
      },
    ],
    { temperature: 0.3 }
  );

  return completion.choices[0].message.content;
}

async function answerQuestion(question) {
  const completion = await chatCompletion(
    [
      {
        role: 'system',
        content:
          'Você é o assistente do CriaOS, um sistema de gestão para empresas de instalação ' +
          'e manutenção (elétrica, solar, ar-condicionado, segurança). Responda dúvidas de uso ' +
          'do sistema de forma breve e direta, em português.',
      },
      { role: 'user', content: question },
    ],
    { temperature: 0.3 }
  );

  return completion.choices[0].message.content;
}

// Triagem de mensagens do WhatsApp (Seção 8, recurso Pro): classifica antes
// de cair na fila de atendimento humano.
async function classifyWhatsAppMessage(text) {
  const completion = await chatCompletion(
    [
      {
        role: 'system',
        content:
          'Classifique a mensagem de um cliente de uma empresa de instalação/manutenção. ' +
          'Responda SOMENTE com um JSON {"type": string, "urgency": "baixa"|"media"|"alta"}. ' +
          'type deve ser uma categoria curta como "novo_orcamento", "suporte_tecnico", ' +
          '"financeiro", "agendamento" ou "outro".',
      },
      { role: 'user', content: text },
    ],
    { temperature: 0 }
  );

  return extractJson(completion.choices[0].message.content);
}

module.exports = { draftBudgetItems, summarizeClientHistory, answerQuestion, classifyWhatsAppMessage };
