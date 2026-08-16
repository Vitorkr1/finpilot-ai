// Compara descriptors faciais (arrays de 128 números vindos do face-api.js).
// Distância euclidiana: quanto menor, mais parecido. Abaixo do THRESHOLD
// consideramos que é a mesma pessoa. 0.5 é um valor conservador (o padrão
// usado pela própria lib costuma ser 0.6); preferimos errar rejeitando a
// aceitar um rosto parecido demais com o de outra pessoa.
const THRESHOLD = 0.5;

function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Recebe o descriptor capturado no login e a lista de usuários candidatos
// (cada um com _id e faceDescriptor). Retorna o usuário mais próximo, desde
// que dentro do threshold — senão retorna null.
function findBestMatch(inputDescriptor, users) {
  let best = null;
  let bestDistance = Infinity;

  for (const user of users) {
    if (!user.faceDescriptor || user.faceDescriptor.length !== 128) continue;
    const distance = euclideanDistance(inputDescriptor, user.faceDescriptor);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = user;
    }
  }

  if (best && bestDistance <= THRESHOLD) {
    return { user: best, distance: bestDistance };
  }
  return null;
}

module.exports = { euclideanDistance, findBestMatch, THRESHOLD };
