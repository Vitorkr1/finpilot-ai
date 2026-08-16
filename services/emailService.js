const config = require('../config/config');

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Envia um e-mail transacional via Resend (resend.com).
 * Plano gratuito: 3.000 e-mails/mês, 100/dia, em 1 domínio.
 * Sem RESEND_API_KEY configurada, apenas loga no console (não quebra o fluxo).
 */
async function sendEmail({ to, subject, html }) {
  if (!config.resendApiKey) {
    console.log(`[emailService] RESEND_API_KEY não configurada. E-mail não enviado. Para: ${to} | Assunto: ${subject}`);
    return { sent: false, reason: 'not_configured' };
  }

  const response = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.resendApiKey}`
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [to],
      subject,
      html
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[emailService] Falha ao enviar e-mail: ${response.status} ${errText}`);
    return { sent: false, reason: 'api_error', status: response.status };
  }

  const data = await response.json();
  return { sent: true, id: data.id };
}

function currency(value) {
  return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateBR(d) {
  return new Date(d).toLocaleDateString('pt-BR');
}

/**
 * Monta e envia o resumo diário de boletos vencendo/vencidos para um usuário.
 */
async function sendBillsDueEmail({ user, bills }) {
  const overdue = bills.filter((b) => new Date(b.dueDate) < new Date());
  const upcoming = bills.filter((b) => new Date(b.dueDate) >= new Date());

  const rowsHtml = (list, color) =>
    list
      .map(
        (b) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(b.description)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${color};font-weight:600;">${dateBR(b.dueDate)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${currency(b.amount)}</td>
      </tr>`
      )
      .join('');

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1E293B;">
    <h2 style="color:#2563EB;">FinPilot AI — Boletos para ficar de olho</h2>
    <p>Olá, ${escapeHtml(user.name.split(' ')[0])}! Aqui está o resumo dos seus boletos pendentes.</p>
    ${overdue.length > 0 ? `
      <h3 style="color:#DC2626;">Vencidos (${overdue.length})</h3>
      <table style="width:100%;border-collapse:collapse;">${rowsHtml(overdue, '#DC2626')}</table>
    ` : ''}
    ${upcoming.length > 0 ? `
      <h3 style="color:#B45309;margin-top:20px;">Vencendo em breve (${upcoming.length})</h3>
      <table style="width:100%;border-collapse:collapse;">${rowsHtml(upcoming, '#B45309')}</table>
    ` : ''}
    <p style="margin-top:24px;">
      <a href="${escapeHtml(require('../config/config').appUrl)}/transactions" style="background:#2563EB;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Ver no FinPilot AI</a>
    </p>
    <p style="font-size:12px;color:#94A3B8;margin-top:24px;">Você recebeu este e-mail porque tem alertas por e-mail ativados no seu perfil do FinPilot AI. Pode desativar a qualquer momento em Perfil &gt; Notificações.</p>
  </div>`;

  return sendEmail({
    to: user.email,
    subject: overdue.length > 0 ? `⚠️ Você tem ${overdue.length} boleto(s) vencido(s)` : `📅 Boletos vencendo em breve`,
    html
  });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/**
 * Envia um e-mail avisando sobre uma movimentação individual (criada ou
 * marcada como paga). Opt-in — só é chamado se o usuário ativar essa
 * preferência no perfil, para não lotar a caixa de entrada de quem não quer.
 */
async function sendTransactionEmail({ user, transaction, event = 'criada' }) {
  const sign = transaction.type === 'despesa' ? '-' : transaction.type === 'receita' ? '+' : '';
  const color = transaction.type === 'despesa' ? '#DC2626' : transaction.type === 'receita' ? '#16A34A' : '#2563EB';
  const eventLabel = { criada: 'Nova movimentação', paga: 'Movimentação paga', atualizada: 'Movimentação atualizada' }[event] || 'Movimentação';

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#1E293B;">
    <h2 style="color:#2563EB;">FinPilot AI</h2>
    <p style="color:#64748B;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">${escapeHtml(eventLabel)}</p>
    <div style="background:#F8FAFC;border-radius:12px;padding:16px 20px;margin:10px 0;">
      <div style="font-weight:700;font-size:16px;">${escapeHtml(transaction.description)}</div>
      <div style="font-size:22px;font-weight:700;color:${color};margin-top:6px;">${sign} ${currency(transaction.amount)}</div>
      <div style="font-size:13px;color:#64748B;margin-top:8px;">
        ${dateBR(transaction.date)} · ${escapeHtml(transaction.method || '')}${transaction.dueDate ? ' · Vencimento: ' + dateBR(transaction.dueDate) : ''}
      </div>
    </div>
    <p style="margin-top:20px;">
      <a href="${escapeHtml(require('../config/config').appUrl)}/transactions" style="background:#2563EB;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Ver no FinPilot AI</a>
    </p>
    <p style="font-size:12px;color:#94A3B8;margin-top:24px;">Você recebeu este e-mail porque ativou "notificar cada movimentação" no seu perfil do FinPilot AI. Pode desativar a qualquer momento em Perfil &gt; Notificações.</p>
  </div>`;

  return sendEmail({
    to: user.email,
    subject: `${eventLabel}: ${transaction.description} — ${currency(transaction.amount)}`,
    html
  });
}

module.exports = { sendEmail, sendBillsDueEmail, sendTransactionEmail };
