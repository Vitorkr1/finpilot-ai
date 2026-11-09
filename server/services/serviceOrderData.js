const { z } = require('zod');
const v = require('../utils/validation');

const PENDING_REASONS = ['material', 'imprevisto', 'retorno', 'outro'];
const dateTime = z.iso.datetime({ offset: true }).max(40).refine(
  (value) => Number.isFinite(Date.parse(value)) && v.date.safeParse(value.slice(0, 10)).success,
  'Data e hora inválidas.'
);
const openingFields = {
  calledAt: dateTime.optional(),
  requestDescription: v.text(4000).optional(),
};
const executionFields = {
  startedAt: dateTime.nullable().optional(),
  finishedAt: dateTime.nullable().optional(),
  serviceDescription: v.text(8000).optional(),
  hasPending: z.boolean().optional(),
  pendingReason: z.enum(PENDING_REASONS).nullable().optional(),
  pendingNotes: v.text(4000).optional(),
};

function validateAttendance(order, { requireCompletion = false, now = Date.now() } = {}) {
  const called = new Date(order.calledAt || order.createdAt).getTime();
  const started = order.startedAt ? new Date(order.startedAt).getTime() : null;
  const finished = order.finishedAt ? new Date(order.finishedAt).getTime() : null;
  if ([called, started, finished].some((value) => value !== null && (!Number.isFinite(value) || value > now + 300000))) {
    throw v.httpError(400, 'Informe datas válidas, sem horários futuros. Para agendar uma visita, use a Agenda.');
  }
  if (started !== null && started < called) throw v.httpError(400, 'O início do atendimento não pode ser anterior ao chamado.');
  if (finished !== null && finished < (started ?? called)) throw v.httpError(400, 'O fim do atendimento não pode ser anterior ao chamado ou ao início.');
  if (order.hasPending && (!order.pendingReason || !order.pendingNotes?.trim())) {
    throw v.httpError(400, 'Informe o motivo e descreva o que ficou pendente.');
  }
  if (order.status === 'concluida' && order.hasPending) throw v.httpError(400, 'Resolva as pendências antes de concluir a OS. Enquanto houver pendências, mantenha a OS aberta ou em andamento.');
  if (requireCompletion && (!order.serviceDescription?.trim() || !finished)) {
    throw v.httpError(400, 'Para concluir a OS, descreva o serviço realizado e informe o fim do atendimento.');
  }
}

function attendanceUpdate(current, changes, now = new Date()) {
  const patch = { ...changes };
  if (patch.status === 'em_andamento' && !current.startedAt && !current.finishedAt && !('startedAt' in patch)) patch.startedAt = now;
  if (patch.status === 'concluida' && !current.finishedAt && !('finishedAt' in patch)) patch.finishedAt = now;
  const merged = { ...current, ...patch };
  const requireCompletion = merged.status === 'concluida' && (
    current.status !== 'concluida' || ['serviceDescription', 'finishedAt'].some((key) => key in patch)
  );
  validateAttendance(merged, { requireCompletion, now: now.getTime() });
  return patch;
}

module.exports = { PENDING_REASONS, dateTime, openingFields, executionFields, validateAttendance, attendanceUpdate };
