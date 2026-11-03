function notFound(req, res) {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

const FIELD_LABELS = { email: 'e-mail' };

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.name === 'ZodError') return res.status(400).json({ error: 'Confira os dados informados.', fields: err.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })) });
  if (err.name === 'CastError' || err.name === 'ValidationError') return res.status(400).json({ error: 'Identificador ou dados inválidos.' });
  if (err.name === 'VersionError') return res.status(409).json({ error: 'Este registro foi alterado por outra pessoa. Atualize a página e tente novamente.' });
  if (err.name === 'MulterError') return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'A imagem deve ter até 8 MB.' : 'Envio de arquivo inválido.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  // Erro de chave duplicada do MongoDB (ex.: e-mail já cadastrado) — nunca
  // deve vazar como 500 cru, é um erro de validação de quem está preenchendo.
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    const label = FIELD_LABELS[field] || 'registro';
    return res.status(409).json({ error: `Já existe um registro com esse ${label}.` });
  }

  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  if (status >= 500) {
    console.error('[api]', err.name || 'Error', err.code || '', err.message);
  }
  res.status(status).json({ error: err.publicMessage || (status < 500 ? err.message : 'Não foi possível concluir a operação. Tente novamente.') });
}

module.exports = { notFound, errorHandler };
