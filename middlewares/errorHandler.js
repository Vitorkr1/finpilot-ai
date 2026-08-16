function notFound(req, res, next) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Rota não encontrada' });
  }
  res.status(404).render('errors/404', { title: 'Página não encontrada' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Erro interno do servidor';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = 'Este registro já existe (valor duplicado).';
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Identificador inválido.';
  }

  if (err.code === 'EBADCSRFTOKEN') {
    statusCode = 403;
    message = 'Token de segurança inválido. Recarregue a página e tente novamente.';
  }

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  res.status(statusCode).render('errors/500', { title: 'Algo deu errado', message });
}

module.exports = { notFound, errorHandler };
