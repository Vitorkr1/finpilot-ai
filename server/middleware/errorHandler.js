function notFound(req, res) {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

const FIELD_LABELS = { email: 'e-mail' };

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Erro de chave duplicada do MongoDB (ex.: e-mail já cadastrado) — nunca
  // deve vazar como 500 cru, é um erro de validação de quem está preenchendo.
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'valor';
    const label = FIELD_LABELS[field] || field;
    return res.status(409).json({ error: `Já existe um registro com esse ${label}.` });
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ error: err.publicMessage || err.message || 'Erro interno do servidor' });
}

module.exports = { notFound, errorHandler };
