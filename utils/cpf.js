// Remove tudo que não é dígito (pontos, traço, espaços)
function onlyDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

// Valida CPF pelos dígitos verificadores oficiais (algoritmo padrão da
// Receita Federal). Rejeita sequências repetidas (00000000000, 11111111111
// etc.), que passariam na conta mas nunca são CPFs reais.
function isValidCpf(cpf) {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (base) => {
    let sum = 0;
    let weight = base.length + 1;
    for (const digit of base) {
      sum += Number(digit) * weight;
      weight -= 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const base9 = digits.slice(0, 9);
  const digit1 = calcCheckDigit(base9);
  const digit2 = calcCheckDigit(base9 + digit1);

  return digits === base9 + String(digit1) + String(digit2);
}

module.exports = { onlyDigits, isValidCpf };
