const { doubleCsrf } = require('csrf-csrf');
const config = require('../config/config');

// Proteção CSRF via "double submit cookie": o servidor guarda token+hash num
// cookie HttpOnly (o próprio pacote força isso, não dá pra desligar — é mais
// seguro que um double-submit clássico) e devolve só o token (sem o hash)
// pro front-end, via meta tag. O front-end tem que mandar esse token de
// volta no header X-CSRF-Token em toda requisição que muda dado. Um site
// malicioso não consegue ler nem o cookie nem o token, então não tem como
// forjar a requisição.
const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => config.csrfSecret,
  cookieName: config.env === 'production' ? '__Host-fp.csrf' : 'fp.csrf',
  cookieOptions: {
    sameSite: 'lax',
    secure: config.env === 'production',
    path: '/'
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// GET/HEAD/OPTIONS já são ignorados internamente pelo doubleCsrfProtection,
// então basta usá-lo direto.
const csrfProtection = doubleCsrfProtection;

// Injeta o token atual em res.locals para toda página renderizada colocar
// numa <meta> tag, e o front-end lê essa meta tag pra enviar no header.
function attachCsrfToken(req, res, next) {
  res.locals.csrfToken = generateToken(req, res);
  next();
}

module.exports = { csrfProtection, attachCsrfToken };
