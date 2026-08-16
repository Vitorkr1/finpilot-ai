// Envolve funções async de controllers, encaminhando erros para o errorHandler
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
