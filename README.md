# CriaOS

SaaS de gestão da **Cria Tech** para empresas de instalação e manutenção (segurança
eletrônica, elétrica, ar-condicionado, energia solar, manutenção em geral).

Arquitetura multi-tenant em dois níveis: a **CriaTech** (super admin) gerencia quais
empresas assinam o produto, o plano de cada uma e o status de pagamento; cada
**empresa cliente** (tenant) tem seus próprios usuários, clientes finais, orçamentos,
ordens de serviço etc., sempre isolados por `companyId`.

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express |
| Banco de dados | MongoDB (Mongoose) — MongoDB Atlas free (M0) |
| Frontend | React + Vite + Tailwind CSS, servido pelo próprio Express em produção |
| Autenticação | JWT (access curto + refresh em cookie httpOnly) + bcrypt |
| Upload de arquivos | Cloudinary (free tier) — nunca disco local |
| IA | Groq API (Llama 3.3), isolada em `server/services/ai.js` |
| WhatsApp | Baileys (`@whiskeysockets/baileys`) |
| Deploy | Render (free web service) |

## Estrutura do repositório

```
/client            → React + Vite + Tailwind
/server
  /models
  /routes
  /controllers
  /middleware
  /services        → ai.js, whatsapp.js, cloudinary.js (fases futuras)
  /scripts         → admin.js (CLI), seedSuperAdmin.js
```

## Rodando localmente

Pré-requisitos: Node.js 20+, uma connection string do MongoDB Atlas (veja abaixo).

```bash
npm install                # instala client + server (npm workspaces)
cp .env.example .env       # preencha as variáveis (veja abaixo)
npm run seed:super-admin   # cria a conta super_admin a partir do .env
npm run dev                # sobe client (Vite, :5173) e server (Express, :5000) juntos
```

Em produção (ou para testar o build final), o Express serve o build do client:

```bash
npm run build:client
npm start                  # Express em process.env.PORT, servindo /client/dist
```

### CLI de administração (super admin)

Não expõe nenhuma rota HTTP — roda direto contra o banco:

```bash
npm run admin -- create-company --name "JDS Segurança Eletrônica" --email admin@jds.com --plan basic
npm run admin -- list
npm run admin -- set-plan --company <id> --plan pro
npm run admin -- mark-paid --company <id> --next-due 2026-11-10
npm run admin -- suspend --company <id>
npm run admin -- edit --company <id> --field name --value "Novo Nome"
npm run admin -- delete --company <id>
```

`create-company` também cria o primeiro usuário `admin` da empresa e imprime uma
senha temporária no terminal — repasse com segurança e peça a troca no primeiro login.

### Painel secreto (opcional, além da CLI)

Além da CLI, existe uma tela web para as mesmas ações: `/painel-criatech-k4m9vz`
(constante `SUPER_ADMIN_PATH` em `client/src/App.tsx`). Não está linkada em
nenhum menu do tenant e tem **login próprio**, separado do login das empresas
(`SuperAdminAuthContext`) — mesmo assim, troque esse caminho antes de um deploy
de produção real, já que uma URL escondida sozinha não é segurança. A API por
trás (`/api/companies/*`) já valida `role: 'super_admin'` em toda rota,
independentemente do caminho usado para chegar até ela.

### Sem acesso a shell no host (ex. Render free)

`npm run seed:super-admin` e a CLI acima rodam diretamente contra o banco, então
precisam de um terminal com acesso à rede — algo que planos free como o do
Render normalmente não oferecem. Para esse caso existe um bootstrap único via
HTTP, **desligado por padrão**:

1. Defina `SETUP_TOKEN` (qualquer string aleatória longa) nas variáveis de
   ambiente do deploy, junto com `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD`.
2. Faça uma requisição:
   ```bash
   curl -X POST https://<sua-url>.onrender.com/api/setup/bootstrap-super-admin \
     -H "x-setup-token: <o valor de SETUP_TOKEN>"
   ```
3. Isso cria o super admin (mesmo efeito do `seedSuperAdmin.js`) e a partir daí
   você já usa o painel secreto para criar as empresas — não precisa mais da
   CLI para nada além de manutenção pontual.
4. Remova `SETUP_TOKEN` do ambiente depois de usar. Mesmo que não remova: sem
   a variável definida a rota responde 404 (não existe), e mesmo com o valor
   certo ela recusa (409) qualquer chamada depois que o primeiro super admin
   já existir — não dá para reaproveitar o token nem criar um segundo super
   admin por essa via.

## Configurando o MongoDB Atlas (free)

1. Crie uma conta em [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Crie um cluster **M0 (Free Shared)** — 512 MB, sem prazo de expiração.
3. Em *Database Access*, crie um usuário com senha.
4. Em *Network Access*, libere `0.0.0.0/0` (ou o IP do Render) para conexões.
5. Em *Connect → Drivers*, copie a connection string e cole em `MONGODB_URI` no `.env`.

## Configurando o Cloudinary (free)

1. Crie uma conta em [cloudinary.com](https://cloudinary.com).
2. No dashboard, copie `Cloud Name`, `API Key` e `API Secret` para o `.env`.
3. O free tier dá ~25 créditos/mês (armazenamento + banda) — suficiente para começar;
   monitore o uso conforme o volume de fotos de OS crescer.

## Obtendo a chave da Groq

1. Crie uma conta em [console.groq.com](https://console.groq.com).
2. Gere uma API key e coloque em `GROQ_API_KEY` no `.env`.
3. O free tier não exige cartão de crédito.

## Deploy no Render

1. Crie um **Web Service** apontando para este repositório.
2. **Build Command:** `npm install && npm run build:client`
3. **Start Command:** `npm start`
4. Configure todas as variáveis de `.env.example` em *Environment*, incluindo
   `TRUST_PROXY=1` (o Render fica atrás de um proxy reverso — sem isso,
   `express-rate-limit` não consegue distinguir os IPs reais dos clientes).
5. O serviço free "dorme" após ~15 min sem tráfego (leva 30-60s para acordar na
   próxima requisição). Isso afeta a sessão do WhatsApp (Baileys), que depende de
   conexão constante — implementamos reconexão automática, mas um serviço externo
   gratuito de "ping" (ex. cron-job.org, UptimeRobot) ajuda a manter o app acordado
   em horário comercial. Isso é uma solução de contorno, não uma garantia.
6. Quando houver clientes pagantes de verdade, a peça mais provável de precisar
   virar paga é a hospedagem (Render Starter, ~US$7/mês, sem "dormir") para o
   WhatsApp funcionar de forma confiável o tempo todo.

## Decisões de arquitetura registradas

- **Monorepo com npm workspaces** (`/client`, `/server`) — simples, sem ferramenta
  adicional, e permite `npm run dev` único na raiz.
- **Tailwind CSS v4** via plugin oficial do Vite (`@tailwindcss/vite`) — zero
  arquivo de configuração extra.
- **JWT access (15 min) + refresh (7 dias) em cookie `httpOnly`** — refresh nunca
  chega ao JavaScript do cliente, mitigando XSS.
- **Cron interno (`node-cron`)** marca assinaturas como `overdue` diariamente, mas
  nunca suspende ou exclui automaticamente — isso é sempre uma ação manual do
  super admin (via CLI ou, futuramente, o painel secreto).
- **Preço do plano (`Company.price`)** fica editável no banco/CLI, nunca fixo na
  interface — os planos ainda não têm valor definido.
- **Limite de usuários por plano** (Basic: 3, Pro: 30) é checado no
  `userController.create`, bloqueando na API — nunca só escondendo botão no
  frontend.
- **Checklist de OS**: todo tenant usa o checklist fixo simples por padrão. O
  checklist dinâmico por segmento (`server/services/checklistTemplates.js`) só é
  aplicado na criação da OS para empresas no plano Pro, e a rota que expõe os
  templates (`GET /api/service-orders/checklist-template/:segment`) está atrás de
  `requirePlan('pro')`.

## API operacional (fase 2)

Todas as rotas abaixo exigem sessão autenticada de um usuário de empresa (tenant)
e filtram automaticamente por `companyId`:

- `GET/POST/PATCH/DELETE /api/clients`
- `GET/POST/PATCH/DELETE /api/budgets` + `POST /api/budgets/:id/convert` (orçamento
  aprovado → ordem de serviço)
- `GET/POST/PATCH/DELETE /api/service-orders`
- `GET/POST/PATCH/DELETE /api/appointments` (agenda, filtrável por `?date=` e
  `?technicianId=`)
- `GET/POST /api/company-users` + `PATCH /api/company-users/:id/active`
  (restrito a `admin`, aplica o limite de usuários do plano)
- `GET/POST/PATCH/DELETE /api/stock-items` (Pro) + `POST
  /api/service-orders/:id/materials` (baixa automática no estoque)
- `GET/POST /api/financial-entries` + `PATCH /api/financial-entries/:id/mark-paid`
- `GET /api/dashboard/summary`, `GET /api/clients/:id/history`, `GET
  /api/budgets/:id/pdf`
- `POST /api/ai/budget-draft`, `POST /api/ai/client-summary/:clientId`, `POST
  /api/ai/ask` (Pro)
- `POST /api/whatsapp/connect`, `GET /api/whatsapp/status`, `POST
  /api/whatsapp/disconnect` (Pro, restrito a `admin`)

As rotas abaixo são exclusivas do super admin (`role: 'super_admin'`, sem
`companyId`), usadas pela CLI e pelo painel secreto:

- `GET /api/companies`, `GET /api/companies/:id`
- `POST /api/companies` (cria a empresa + primeiro usuário admin)
- `PATCH /api/companies/:id` (edita nome/cnpj/segmento/preço)
- `PATCH /api/companies/:id/plan`, `PATCH /api/companies/:id/mark-paid`, `PATCH
  /api/companies/:id/suspend`
- `DELETE /api/companies/:id` (exige `{ confirm: true }` no corpo)

## WhatsApp e IA (fase 5)

- `server/services/ai.js` isola toda chamada à Groq (SDK compatível com OpenAI,
  `baseURL: https://api.groq.com/openai/v1`, modelo em `GROQ_MODEL` — padrão
  `llama-3.3-70b-versatile`). Trocar de provedor no futuro é mudar só este
  arquivo.
- `server/services/whatsapp.js` gerencia uma sessão Baileys por empresa. As
  credenciais (`creds` + chaves de sessão) ficam no MongoDB
  (`WhatsAppAuthFile`), nunca em disco — o Render free apaga `/server/whatsapp-sessions`
  a cada reinício. Ao cair a conexão (ex.: o serviço "dormiu"), reconecta
  automaticamente, exceto quando o WhatsApp desloga a sessão de verdade
  (`DisconnectReason.loggedOut`), caso em que as credenciais são apagadas e é
  preciso escanear o QR code de novo.
- Mensagens recebidas são classificadas pela IA (`classifyWhatsAppMessage`) e
  guardadas em `WhatsAppMessage` antes de cair na fila humana — a falha da IA
  nunca derruba o recebimento da mensagem.
- Use um número de WhatsApp dedicado para testes, nunca o número pessoal do
  dono da empresa.

## Fases de construção

1. ✅ **Fundação** — monorepo, MongoDB, `Company`/`User`, auth JWT, seed do super
   admin, CLI de admin, shell de login/dashboard no frontend.
2. ✅ **Núcleo operacional** — Clientes, Orçamentos (com conversão em OS), Ordens
   de Serviço (checklist, upload de fotos/assinatura direto para o Cloudinary),
   Agenda por técnico/dia, gestão de usuários da empresa com limite Basic/Pro
   já validado na API.
3. ✅ **Estoque e Financeiro** — estoque Pro com baixa automática na OS,
   financeiro essencial (contas a pagar/receber) disponível em todos os planos.
4. ✅ **Dashboard e relatórios** — indicadores básicos com gráfico, histórico de
   serviço por cliente, geração de orçamento em PDF.
5. ✅ **WhatsApp (Baileys) + assistente de IA** — chat de IA no dashboard,
   orçamento assistido por IA, conexão WhatsApp por QR code com triagem
   automática das mensagens recebidas.
6. ✅ **Polimento e preparação para deploy** — API completa de gestão de
   empresas (super admin), painel secreto web além da CLI, rodapé em todas as
   páginas (inclusive no painel admin), README com passo a passo de deploy.

## Checklist antes de considerar pronto

- [x] Login e isolamento por `companyId` — toda query operacional filtra por
  `req.user.companyId`; testado via schema/middleware, recomenda-se validar
  também com duas empresas reais no MongoDB Atlas antes de ir a produção.
- [x] Feature gating Basic/Pro bloqueando na API (`requirePlan`), não só
  escondendo botão — estoque, checklist dinâmico, IA e WhatsApp.
- [x] Senha nunca aparece em log nem em resposta de API (`User.toJSON` remove
  `passwordHash`; senhas temporárias só retornam uma vez, na criação).
- [x] Upload de foto de OS sobrevive a um redeploy — `POST
  /api/service-orders/:id/photos` e `.../signature` (`multer` em memória +
  `server/services/cloudinary.js`) enviam o arquivo direto para o Cloudinary,
  nunca gravam no disco local. Confirme na prática assim que
  `CLOUDINARY_*` estiver configurado num ambiente real: suba uma foto, faça um
  redeploy e verifique se a URL continua funcionando.
- [x] CLI de admin cria empresa, muda plano, marca pago, suspende e exclui,
  com confirmação antes de excluir.
- [x] Rodapé com "Powered by CriaTech" (link) e WhatsApp de suporte em todas
  as páginas, incluindo o painel secreto.
- [x] README permite a qualquer pessoa clonar e rodar do zero.
