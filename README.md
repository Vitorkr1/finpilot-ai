# CriaOS / FinPilot

Gestão de clientes, orçamentos, ordens de serviço, agenda, estoque, financeiro e equipe em rota.

## Executar

Requer Node.js 22.12 ou superior e MongoDB com **replica set** (o MongoDB Atlas já oferece suporte). As operações de estoque, conversão de orçamento e administração de acessos usam transações para evitar alterações parciais.

1. Instale com `npm ci`.
2. Configure `server/.env` usando `server/.env.example` como referência. Use duas chaves JWT diferentes e aleatórias, com pelo menos 32 caracteres cada.
3. Desenvolvimento: `npm run dev`.
4. Produção: `npm run build:client` e `npm start`. A API também serve o site compilado.

No Render: comando de build `npm ci && npm run build:client`; comando de início `npm start`; `NODE_ENV=production`, `TRUST_PROXY=1`, `CLIENT_URL` igual à origem HTTPS do site, além das variáveis do banco e autenticação. Use `PORT` fornecida pelo Render.

## Verificações

- `npm test`: testes de interface utilitária, API integrada com banco temporário e PDF. Não usa o banco de produção.
- `npm run build:client`: TypeScript e build de produção.
- `npm run lint --workspace=client`: análise estática da interface.
- `npm audit --audit-level=low`: alertas conhecidos nas dependências.
- Android: dentro de `android`, `./gradlew testDebugUnitTest assembleDebug lintDebug` (JDK 17 e Android SDK 36).

O fluxo do GitHub Actions repete essas verificações e disponibiliza um APK de **teste** como artefato. Não contém a chave de assinatura de distribuição.

## Localização durante a rota

O módulo **Equipe em rota** exibe posições somente para admin e financeiro da mesma empresa. O técnico vê apenas a própria rota e pode encerrá-la pelo site. No aplicativo Android, o técnico entra com sua conta, confirma o compartilhamento e escolhe **Iniciar rota**. O navegador pode ficar fechado; o serviço de localização usa uma notificação visível com a ação **Encerrar rota**.

- Android 8 ou superior; conexão HTTPS obrigatória. Não há versão para iPhone.
- Não inicia sozinho, não inicia ao reiniciar o celular e não solicita localização permanente fora da rota.
- O app tenta enviar a última amostra aproximadamente a cada 30 segundos. O painel consulta a API a cada 15 segundos enquanto visível.
- Sem sinal ou internet, o painel mostra o horário da última amostra e sinaliza posições antigas. Nenhum histórico de deslocamentos é coletado ou armazenado.
- A rota tem limite de 12 horas. Encerrar remove a sessão e a posição; atualizações atrasadas não recriam a rota.
- O encerramento solicitado sem internet interrompe a coleta local imediatamente e tenta avisar o servidor quando a conexão voltar. Enquanto isso, o painel pode manter a última amostra como desatualizada.
- Desligar o celular, forçar a parada do app, revogar permissões ou restrições do fabricante podem interromper as atualizações. Para continuar, o técnico precisa abrir o app e retomar a rota explicitamente.
- O app não comprova presença nem impede todas as formas de localização falsa. A precisão exibida deve ser considerada ao interpretar um ponto no mapa.

Para instalar, distribua o APK assinado e informe o endereço HTTPS do próprio sistema. Esse endereço aparece no módulo **Minha rota**. Se quiser exibir um botão de download, configure `VITE_ANDROID_APK_URL` no build do site com uma URL HTTPS do APK hospedado por você.

## Assinatura Android

O projeto aceita `CRIAOS_KEYSTORE_FILE`, `CRIAOS_STORE_PASSWORD`, `CRIAOS_KEY_ALIAS` e `CRIAOS_KEY_PASSWORD` como variáveis de ambiente para `./gradlew assembleRelease`. Guarde a chave fora do Git: futuras atualizações precisam da mesma assinatura. O `.gitignore` exclui chaves, arquivos de ambiente e artefatos locais.

## Implantação das correções de segurança

As sessões passaram a ser registradas e revogáveis no banco. Após esta atualização, usuários com cookies antigos precisam entrar novamente. Logout de admin e de usuário da empresa são independentes. Senhas redefinidas e usuários desativados perdem as sessões existentes.

Técnicos não acessam o financeiro nem os totais financeiros do dashboard; acessam e atualizam somente suas próprias ordens e agenda. Admin e financeiro podem atribuir técnicos às ordens. Super admin administra assinaturas e empresas sem ler suas posições ou dados operacionais.

Validações, isolamento entre empresas, transações e limites de requisição são aplicados na API. Arquivos enviados precisam ter tipo e assinatura de imagem válidos. Erros internos não são retornados ao navegador. As rotas de posição não registram coordenadas em logs HTTP.

As integrações reais com WhatsApp, Cloudinary e Groq dependem das credenciais do ambiente. Testes com telefone Android real, GPS, tela bloqueada e perda de conexão devem ser feitos antes de distribuir para toda a equipe. Veja [a revisão e os limites da validação](docs/revisao-seguranca-e-rotas.md).
