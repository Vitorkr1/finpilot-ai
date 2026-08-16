// Parser simples de User-Agent — cobre os casos comuns (não é 100%
// preciso como uma lib dedicada, mas não precisa de dependência externa
// pra uma informação que é só exibida, não usada pra decisão de segurança).
function describeUserAgent(ua) {
  const str = String(ua || '');

  let browser = 'Navegador desconhecido';
  if (/Edg\//.test(str)) browser = 'Edge';
  else if (/OPR\//.test(str)) browser = 'Opera';
  else if (/Chrome\//.test(str) && !/Chromium/.test(str)) browser = 'Chrome';
  else if (/Firefox\//.test(str)) browser = 'Firefox';
  else if (/Safari\//.test(str) && /Version\//.test(str)) browser = 'Safari';

  let os = 'dispositivo desconhecido';
  if (/Windows/.test(str)) os = 'Windows';
  else if (/Mac OS X/.test(str) && !/iPhone|iPad/.test(str)) os = 'macOS';
  else if (/iPhone/.test(str)) os = 'iPhone';
  else if (/iPad/.test(str)) os = 'iPad';
  else if (/Android/.test(str)) os = 'Android';
  else if (/Linux/.test(str)) os = 'Linux';

  return `${browser} no ${os}`;
}

module.exports = { describeUserAgent };
