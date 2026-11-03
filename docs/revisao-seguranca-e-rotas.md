# Revisão de segurança e localização Android

Revisão concluída em 3 de novembro de 2026. Os testes de API usam MongoDB temporário com replica set e não alteram dados reais.

## Correções

- Sessão do super admin restaurada com usuário e token; cookies, clientes HTTP e logout separados do tenant.
- Sessões revogáveis persistidas no MongoDB, validação de tipo/destino do JWT e bloqueio imediato após logout/desativação.
- Financeiro protegido para admin e financeiro, inclusive no dashboard; técnico limitado às próprias ordens e agenda.
- Identificadores, e-mails, horários, datas, tamanhos, valores monetários, filtros e relacionamentos validados no servidor.
- JSON inválido retorna 400, payload excessivo retorna 413 e erros internos retornam mensagem genérica.
- Conversão de orçamento, consumo de estoque, criação de empresa e limites de usuários protegidos por transações e testes concorrentes.
- Arredondamento do orçamento em centavos; pagamento já registrado permanece idempotente.
- Exclusões com dependências bloqueadas para preservar histórico. Exclusão explícita de empresa limpa seus registros e sessões.
- Upload limitado a formatos de imagem conhecidos, com checagem de assinatura binária e tamanho.
- Origens de requisição verificadas, respostas privadas sem cache e CSP permitindo apenas os provedores de imagem necessários.
- Falhas de conexão do WhatsApp não deixam o estado preso em “conectando”; desconexão manual não dispara reconexão; callbacks assíncronos tratam rejeições.
- Dependências atualizadas, execução de desenvolvimento usando o observador nativo do Node e CI com ações fixadas por commit.
- Android com HTTPS, credencial de rota protegida no Android Keystore, backup desativado, notificação e encerramento explícitos. Sem senha persistida e sem início automático no boot.

## Cobertura de testes

Os testes versionados cobrem: login, refresh, logout, perfis, tenant, CRUD, referências, datas e valores, uploads falsos, concorrência, reversão após falhas injetadas, limites de plano, suspensão, exclusão de empresa, consentimento de rota, posições expiradas e amostras atrasadas. Testes da interface utilitária verificam CSV, datas e apresentação de posições antigas. Há testes Android para a validação do endereço HTTPS e análise estática da plataforma.

Verificações: `npm test`, `npm run build:client`, `npm run lint --workspace=client`, `npm audit --audit-level=low` e `./gradlew testDebugUnitTest assembleRelease lintRelease` com chave privada fora do repositório. Os alertas de lint de desenvolvimento React sobre exports/efeitos não indicam falha de build; estão separados de erros de compilação e das verificações de segurança.

Resultado local: 14 testes do cliente, 46 do servidor e 2 do Android aprovados; compilação web e Android concluídas, APK de distribuição assinado e assinatura verificada. Auditoria de dependências sem vulnerabilidades conhecidas na data da revisão.

No navegador, usando dados temporários: login de administrador e técnico, criação de cliente e ordem com atribuição de técnico, mapa, encerramento de rota, bloqueio do financeiro para técnico e restauração da sessão do super admin após recarregar. A tela de rotas foi conferida em 1280 e 390 pixels de largura, sem transbordamento horizontal.

## Limites práticos

A revisão não prova ausência de todas as vulnerabilidades. Não inclui teste de invasão externo, infraestrutura de produção, permissões/configuração do provedor ou validação com credenciais reais de WhatsApp, Groq e Cloudinary. A auditoria de pacotes considera somente os avisos conhecidos na data da execução.

A compilação e análise Android não substituem testes físicos. Antes da distribuição ampla, verificar em aparelhos reais: iniciar/encerrar, bloquear tela, fechar o navegador e a tela do app, ficar sem internet e reconectar, desligar GPS, negar/remover permissão, encerrar pelo aviso, forçar parada, reiniciar aparelho, completar 12 horas e encerrar pelo site. Restrições de bateria do fabricante podem interromper atualizações.

O mapa usa OpenStreetMap com atribuição e política de referência compatíveis. O provedor pode impor limites ou bloquear requisições; para uso em escala, configure um provedor de mapas adequado à operação. Posições antigas e precisão reduzida são exibidas como tais.
