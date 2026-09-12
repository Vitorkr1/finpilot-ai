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
4. Configure todas as variáveis de `.env.example` em *Environment*.
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

## Fases de construção

1. ✅ **Fundação** — monorepo, MongoDB, `Company`/`User`, auth JWT, seed do super
   admin, CLI de admin, shell de login/dashboard no frontend.
2. ✅ **Núcleo operacional** — Clientes, Orçamentos (com conversão em OS), Ordens
   de Serviço (checklist, fotos/assinatura como campos prontos para o Cloudinary
   da fase 5), Agenda por técnico/dia, gestão de usuários da empresa com limite
   Basic/Pro já validado na API.
3. ⏳ Estoque e Financeiro.
4. ⏳ Dashboard e relatórios.
5. ⏳ WhatsApp (Baileys) + assistente de IA.
6. ⏳ Polimento do frontend, página secreta de admin, preparação final para deploy.
