# Interface Cria Tech — implementação e validação

## O que mudou

- Identidade visual compartilhada: sidebar escura, superfície clara, azul da marca, ícones SVG locais, hierarquia tipográfica e espaçamento consistente.
- Navegação agrupada por área, busca de módulos com Ctrl/Cmd+K, menu mobile com Escape e contenção de foco, link para pular ao conteúdo.
- Login em duas colunas, campos identificados, autocomplete e controle de visibilidade da senha.
- Dashboard com métricas reais da API, comparação financeira mensal, distribuição de ordens, atalhos e estados de carregamento, falha com nova tentativa e ausência de movimentação.
- Busca de clientes por nome, telefone, documento e endereço, ignorando acentos; feedback de falha de exclusão.
- Financeiro com busca, filtros de pagamento/vencimento, datas sem deslocamento de fuso, exportação dos resultados filtrados em CSV e feedback de falhas nas ações.
- Filtros por status em orçamentos e ordens de serviço; identificação do cliente nos orçamentos.
- Busca de estoque e filtro de reposição com indicação do mínimo.
- Agenda baseada na data local, com validação da ordem dos horários.
- Sugestões de perguntas na IA, preservação de quebras de linha, rolagem da conversa e recuperação da pergunta após falha.
- WhatsApp com instruções de conexão e diferenciação entre status desconhecido e desconectado, além de bloqueio de cliques durante a requisição.
- Painel administrativo com resumo das assinaturas e ajustes visuais; cancelar o prompt de vencimento não registra pagamento.
- Módulos carregados sob demanda e página de rota não encontrada.

## Validação

- TypeScript: `node node_modules/typescript/bin/tsc -b client`.
- Testes de regressão: `npm run test:client` (Node test runner). Cinco casos cobrem datas de calendário, data local no fim do dia, vencimento, escape de CSV e neutralização de fórmulas em células.
- Neste sandbox Windows, o test runner não pode criar subprocessos. Os mesmos cinco testes foram executados com `node client/tests/format.test.mjs`.
- Build de produção: `node ../node_modules/vite/bin/vite.js build --configLoader native`, dentro de `client`. O carregador padrão do Vite encontrou `spawn EPERM` no sandbox; o carregador nativo compilou a aplicação.
- Lint: `npm run lint --workspace=client`. Advertências sobre efeitos React e exports dos contextos são registradas no resultado; sem erros de lint.
- Verificação interativa no navegador com API fictícia exclusivamente local: login, busca de módulos, busca de clientes sem acentos, filtro de vencidos e pagamento de teste, sugestões e resposta da IA, filtro de reposição e abertura/fechamento do menu mobile.
- Layout inspecionado no desktop e em 390 px. Nove módulos operacionais e o dashboard verificados no celular, sem transbordamento horizontal da página. Sem erros de console nos módulos inspecionados.

## Limites e publicação

Os dados fictícios e o servidor de verificação ficam apenas em arquivos locais de trabalho e não são incluídos na aplicação ou nesta branch. Nenhum dado de produção foi alterado. As integrações reais com MongoDB, Groq, WhatsApp e Cloudinary dependem das credenciais do ambiente e ainda exigem validação integrada antes do deploy. A branch não altera o backend nem os contratos da API.
