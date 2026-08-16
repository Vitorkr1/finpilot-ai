<p align="center">
  <img src="public/img/logo.svg" width="90" alt="FinPilot AI">
</p>

<h1 align="center">FinPilot AI</h1>
<p align="center"><strong>A inteligência que cuida do seu dinheiro.</strong></p>

<p align="center">
  SaaS completo de gestão financeira pessoal com Inteligência Artificial — múltiplas contas bancárias,
  transações, metas, score financeiro e um consultor financeiro em IA que analisa seus dados reais.
</p>

---

## ✨ Principais Recursos

- 🔐 Autenticação segura (JWT + Refresh Token, cookies HttpOnly, bcrypt)
- 🏦 Múltiplos bancos e carteiras (Nubank, Inter, Itaú, Bradesco, custom, etc.)
- 💸 Receitas, despesas, transferências, parcelamentos e recorrências
- 🏷️ Categorias e subcategorias personalizáveis
- 🎯 Metas financeiras com barra de progresso e previsão de conclusão
- 🤖 Consultor financeiro com IA (Groq / Llama 3.3 — gratuito) — responde perguntas reais sobre seus dados
- 📊 Score Financeiro (0–1000) calculado automaticamente
- 📈 Dashboard com gráficos interativos (Chart.js)
- 🌗 Tema claro / escuro / automático
- 📤 Exportação em CSV, PDF e backup em JSON
- 📱 100% responsivo — bottom navigation e FAB no mobile, sidebar fixa no desktop
- 🛡️ Segurança de nível empresarial (Helmet, Rate Limit, sanitização, CSRF-ready)

---

## 🧱 Tecnologias

| Camada          | Tecnologias                                                        |
|-----------------|---------------------------------------------------------------------|
| Frontend        | HTML5, CSS3, JavaScript ES2024, EJS, Bootstrap 5, Chart.js, Font Awesome, AOS |
| Backend         | Node.js LTS, Express.js                                             |
| Banco de Dados  | MongoDB Atlas + Mongoose                                            |
| Autenticação    | JWT, bcrypt, Cookies HttpOnly, Refresh Tokens, Helmet, Rate Limit    |
| IA              | Groq API (Llama 3.3 70B) — gratuita                                  |

---

## 🗂️ Arquitetura (MVC)

```
finpilot-ai/
├── config/          # Configurações (banco de dados, variáveis)
├── controllers/      # Lógica de negócio das rotas
├── models/           # Schemas Mongoose (User, Bank, Transaction, Category, Goal)
├── routes/           # Definição das rotas (páginas + API)
├── middlewares/       # Autenticação, upload, rate limit, tratamento de erros
├── services/          # E-mail, IA, score financeiro, exportação
├── utils/             # Funções utilitárias (tokens, async handler, categorias padrão)
├── views/             # Templates EJS (auth, dashboard, banks, transactions, goals, ai, profile)
├── public/            # CSS, JS e imagens estáticas
├── scripts/           # Scripts CLI (criador de usuário admin)
└── server.js          # Ponto de entrada da aplicação
```

---

## 🚀 Instalação Local

### 1. Pré-requisitos

- [Node.js 18+](https://nodejs.org)
- Uma conta gratuita no [MongoDB Atlas](https://www.mongodb.com/atlas)
- (Opcional) Uma chave de API gratuita da [Groq](https://console.groq.com/keys) para habilitar o Consultor IA

### 2. Clonar e instalar dependências

```bash
git clone https://github.com/SEU_USUARIO/finpilot-ai.git
cd finpilot-ai
npm install
```

### 3. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha os valores:

```bash
cp .env.example .env
```

Edite o `.env` com seu editor de preferência e preencha, no mínimo:

```env
MONGODB_URI=mongodb+srv://usuario:senha@cluster0.mongodb.net/finpilot?retryWrites=true&w=majority
JWT_SECRET=uma_string_bem_grande_e_aleatoria
JWT_REFRESH_SECRET=outra_string_bem_grande_e_aleatoria
COOKIE_SECRET=mais_uma_string_aleatoria
GROQ_API_KEY=gsk_... (opcional, necessário para o Consultor IA e leitura de comprovantes — gratuito em console.groq.com/keys)
RESEND_API_KEY=re_... (opcional, necessário para os e-mails de boleto vencendo — gratuito em resend.com/api-keys)
```

### 4. Configurar o MongoDB Atlas

1. Crie um cluster gratuito em [cloud.mongodb.com](https://cloud.mongodb.com)
2. Em **Database Access**, crie um usuário com senha
3. Em **Network Access**, libere o IP `0.0.0.0/0` (ou o IP do seu servidor/Render)
4. Em **Database → Connect → Drivers**, copie a connection string e cole em `MONGODB_URI`

### 5. Criar o usuário administrador

```bash
npm run create-user
```

O terminal vai pedir nome, e-mail e senha do administrador.

### 6. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse **http://localhost:3000**

### 7. Rodar em produção

```bash
npm start
```

---

## 📜 Scripts NPM

| Comando                | Descrição                                      |
|-------------------------|------------------------------------------------|
| `npm install`            | Instala as dependências                        |
| `npm run dev`             | Roda em modo desenvolvimento (nodemon)         |
| `npm start`               | Roda em modo produção                          |
| `npm run create-user`      | Cria um usuário administrador via terminal     |

---

## ☁️ Deploy no GitHub

```bash
git init
git add .
git commit -m "chore: primeira versão do FinPilot AI"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/finpilot-ai.git
git push -u origin main
```

> O arquivo `.env` **nunca** é enviado ao GitHub (já está no `.gitignore`). Apenas o `.env.example` é versionado.

---

## 🌐 Deploy no Render

1. Acesse [render.com](https://render.com) e crie uma conta (pode usar login com GitHub)
2. Clique em **New +** → **Web Service**
3. Selecione o repositório `finpilot-ai` que você acabou de subir no GitHub
4. Configure:
   - **Name**: `finpilot-ai`
   - **Region**: a mais próxima de você
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (ou pago, conforme sua necessidade)
5. Em **Environment Variables**, adicione todas as variáveis do seu `.env`:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `COOKIE_SECRET`
   - `CSRF_SECRET`
   - `GROQ_API_KEY` (opcional — gratuito em console.groq.com/keys)
   - `NODE_ENV=production`
   - `APP_URL=https://finpilot-ai.onrender.com` (ajuste para a URL que o Render fornecer)
6. Clique em **Create Web Service**
7. Aguarde o build e o deploy finalizarem — o Render fornecerá uma URL pública (ex: `https://finpilot-ai.onrender.com`)
8. Depois do primeiro deploy, rode o criador de usuário administrador localmente apontando o `MONGODB_URI` para o mesmo banco de produção, ou use o **Shell** do próprio Render:

```bash
npm run create-user
```

> 💡 No plano gratuito do Render, o serviço "dorme" após períodos de inatividade e pode levar alguns segundos para acordar na primeira requisição.

---

## 🔒 Segurança

- Helmet (cabeçalhos HTTP seguros e Content Security Policy)
- Rate limiting (geral, login e IA)
- Sanitização contra NoSQL Injection (`express-mongo-sanitize`)
- Senhas com hash bcrypt (12 salt rounds)
- JWT de curta duração + Refresh Token rotativo em cookie HttpOnly
- Isolamento total de dados por usuário em todas as queries

---

## 📸 Capturas de Tela

> Adicione aqui capturas de tela do seu ambiente após o primeiro deploy:
>
> - `docs/screenshot-dashboard.png`
> - `docs/screenshot-transactions.png`
> - `docs/screenshot-ai.png`

---

## 📄 Licença

Este projeto está licenciado sob a licença MIT.

---

<p align="center">
  Made with ❤️ by <a href="https://criatech.online">Criatech</a><br>
  © 2026 FinPilot AI. Todos os direitos reservados.
</p>
"# finpilot-ai" 
