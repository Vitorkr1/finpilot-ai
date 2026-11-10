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

O aplicativo **CriaOS para Android 1.2** abre o sistema completo da empresa: clientes, orçamentos, ordens, agenda e os demais módulos autorizados para cada perfil. Na primeira abertura, informe a origem HTTPS do sistema publicado e entre com a mesma conta do site. É necessário acesso à internet; o aplicativo não instala a API nem o banco no celular.

O botão **Minha rota**, na barra do aplicativo, abre a área nativa do técnico. Essa área solicita a autenticação do técnico separadamente da sessão do sistema, além da confirmação de compartilhamento. Admin e financeiro acompanham pelo módulo **Equipe em rota**, dentro do próprio aplicativo ou no site. O técnico vê apenas a própria rota e pode encerrá-la. O navegador pode ficar fechado; o serviço de localização usa uma notificação visível com a ação **Encerrar rota**.

- Android 8 ou superior; conexão HTTPS obrigatória. Não há versão para iPhone.
- Não inicia sozinho, não inicia ao reiniciar o celular e não solicita localização permanente fora da rota.
- Ative **Usar localização precisa** nas permissões do Android. O app solicita leituras a cada 2 segundos e tenta enviar novas posições com intervalo mínimo de 5 segundos; o painel consulta a API a cada 5 segundos enquanto visível. Esses intervalos não garantem a entrega nesse prazo: dependem de GPS, internet e disponibilidade da API.
- Somente leituras recentes (até 30 segundos) com margem estimada de até 50 metros são aceitas. Uma leitura de rede não substitui um GPS dos últimos 10 segundos. Saltos incompatíveis e leituras fora de ordem são descartados no aparelho.
- O mapa mostra o círculo de precisão e o horário com segundos. Uma leitura com margem superior a 50 metros não aparece como posição confiável; o sistema aguarda novo GPS. A margem é uma estimativa do Android e não garante a rua exata.
- Sem sinal ou internet, o painel mostra o horário da última amostra e sinaliza posições antigas. Nenhum histórico de deslocamentos é coletado ou armazenado.
- A rota tem limite de 12 horas. Encerrar remove a sessão e a posição; atualizações atrasadas não recriam a rota.
- O encerramento solicitado sem internet interrompe a coleta local imediatamente e tenta avisar o servidor quando a conexão voltar. Enquanto isso, o painel pode manter a última amostra como desatualizada.
- Desligar o celular, forçar a parada do app, revogar permissões ou restrições do fabricante podem interromper as atualizações. Para continuar, o técnico precisa abrir o app e retomar a rota explicitamente.
- O app não comprova presença nem impede todas as formas de localização falsa. A precisão exibida deve ser considerada ao interpretar um ponto no mapa.

Para instalar, distribua o APK assinado e informe o endereço HTTPS do próprio sistema. Esse endereço aparece no módulo **Minha rota**. A versão 1.2 usa o mesmo identificador e assinatura da versão 1.0 de rotas; pode ser instalada como atualização. Para aplicar todas as correções de localização da versão 1.2, atualize também a API e o site; o APK mantém compatibilidade com a API anterior, mas ela não oferece todas as novas proteções. Se quiser exibir um botão de download no site, configure `VITE_ANDROID_APK_URL` no build com uma URL HTTPS do APK hospedado por você, inclusive em um serviço de compartilhamento de arquivos.

Fotos são escolhidas pelo seletor de arquivos do Android, sem permissão geral de armazenamento. PDFs de orçamento e CSVs podem ser salvos no local escolhido pelo usuário, com limite de 16 MB. Mantenha o **Android System WebView atualizado**. Links para outros sites pedem confirmação e abrem no navegador. Certificados inválidos, conteúdo HTTP e navegação interna para outra origem são bloqueados. A comunicação para salvar documentos é restrita à origem configurada e à página principal; não expõe acesso geral ao celular.

No menu **⋮**, use **Recarregar sistema**, **Abrir no navegador** ou **Trocar endereço do sistema**. Uma rota pendente/ativa impede trocar de empresa. A sessão web usa os cookies de autenticação do sistema; a senha não é gravada pelo aplicativo. Não há versões para Windows ou Linux neste projeto.

## Redefinir senha de usuários

Em **Equipe → Redefinir senha**, o admin pode gerar uma nova senha para qualquer usuário da própria empresa, inclusive sua conta. O aviso informa que a senha anterior, as sessões e a rota ativa do usuário serão encerradas. É necessário confirmar usando a senha atual do administrador.

A nova senha aparece somente após a operação, com botão para copiar, sem armazenamento em texto aberto ou em logs. Fechar ou recarregar a tela elimina essa exibição; para obter outro acesso, gere outra senha. Ao redefinir a própria conta, copie antes de voltar ao login. Usuários inativos continuam inativos. A operação é limitada por administrador e não permite acessar usuários de outra empresa.

## Alterar e-mail de acesso

Em **Equipe → Alterar e-mail**, o admin corrige o e-mail de um usuário da própria empresa, inclusive o próprio. É necessário informar o novo endereço e confirmar com a senha atual do administrador. O e-mail é normalizado, validado e não pode estar em uso por outra conta. A senha e a função do usuário são mantidas; usuários inativos continuam inativos.

O aviso informa que o endereço antigo deixará de permitir login e que as sessões e a rota ativa serão encerradas. Após salvar, o usuário entra com **o novo e-mail e a mesma senha**. Ao mudar o próprio endereço, o admin vê o resultado e volta voluntariamente ao login. A alteração é transacional e protegida contra formulário antigo, sessão revogada e login em andamento com o e-mail anterior.

No login web, inclusive no WebView do app, erros de credenciais, suspensão, limite de tentativas, endereço incorreto e conexão passam a ter mensagens diferentes. Antes de redefinir uma senha, confira em Equipe o e-mail cadastrado e o status Ativo. Para corrigir a senha, continue usando **Redefinir senha**; após uma redefinição, a senha antiga não funciona mais. Estas telas chegam ao Android pela atualização do sistema web, sem novo APK.

## Assinatura Android

O projeto aceita `CRIAOS_KEYSTORE_FILE`, `CRIAOS_STORE_PASSWORD`, `CRIAOS_KEY_ALIAS` e `CRIAOS_KEY_PASSWORD` como variáveis de ambiente para `./gradlew assembleRelease`. Guarde a chave fora do Git: futuras atualizações precisam da mesma assinatura. O `.gitignore` exclui chaves, arquivos de ambiente e artefatos locais.

## Implantação das correções de segurança

As sessões passaram a ser registradas e revogáveis no banco. Após esta atualização, usuários com cookies antigos precisam entrar novamente. Logout de admin e de usuário da empresa são independentes. Senhas redefinidas e usuários desativados perdem as sessões existentes.

Técnicos não acessam o financeiro nem os totais financeiros do dashboard; acessam e atualizam somente suas próprias ordens e agenda. Admin e financeiro podem atribuir técnicos às ordens. Super admin administra assinaturas e empresas sem ler suas posições ou dados operacionais.

Validações, isolamento entre empresas, transações e limites de requisição são aplicados na API. Arquivos enviados precisam ter tipo e assinatura de imagem válidos. Erros internos não são retornados ao navegador. As rotas de posição não registram coordenadas em logs HTTP.

As integrações reais com WhatsApp, Cloudinary e Groq dependem das credenciais do ambiente. Testes com telefone Android real, GPS, tela bloqueada e perda de conexão devem ser feitos antes de distribuir para toda a equipe. Veja [a revisão e os limites da validação](docs/revisao-seguranca-e-rotas.md).

## Materiais para clientes

- [Manual do cliente (PDF)](docs/clientes/criaos-manual-do-cliente.pdf): uso dos módulos, perfis de acesso e aplicativo Android.
- [Proposta comercial (PDF)](docs/clientes/criaos-proposta-comercial.pdf): apresentação do sistema por R$ 250,00 mensais por empresa. Escopo de implantação, suporte e integrações deve ser confirmado na contratação.


## Importação de clientes pela web

Admin e financeiro podem abrir **Clientes → Importar planilha** no navegador. Aceita Excel **.xlsx** e **CSV**, com até **3 MB e 1.000 clientes por arquivo**. Arquivos .xls precisam ser salvos como .xlsx antes. Não é necessário atualizar o APK; o botão fica disponível no navegador.

1. Baixe o modelo CSV, que também pode ser preenchido no Excel, ou selecione sua planilha com cabeçalhos na primeira linha.
2. Selecione a aba e confira a correspondência das colunas: nome, telefone, e-mail, CPF/CNPJ, endereço completo e observações. Apenas nome é obrigatório. Colunas ignoradas são indicadas na tela.
3. Use **Conferir dados antes de salvar**. A prévia separa novos clientes, repetições e linhas inválidas, sem gravar nada.
4. Confirme a quantidade de novos clientes e importe. Cadastros existentes permanecem intactos; repetições e linhas inválidas ficam de fora. Baixe o relatório CSV para corrigir as linhas necessárias.

Telefones e documentos devem ser texto no Excel para preservar zeros à esquerda. O sistema não consegue recuperar zeros que já foram removidos pelo editor da planilha. A prévia mostra os valores que serão salvos.

O arquivo é lido em um processo separado do navegador, com limite de tempo e validação da estrutura do Excel. A API recebe somente os campos revisados, valida novamente e usa o companyId da sessão. A confirmação é transacional e tem identificação para que uma repetição por falha de rede não crie o mesmo lote novamente. Limites de tamanho, quantidade e requisições são aplicados na API.

Duplicatas são comparadas por CPF/CNPJ ou por nome e telefone/e-mail; sem contatos, por nome e endereço. Dois documentos diferentes não são fundidos por terem o mesmo nome. A conferência é repetida ao salvar, inclusive para importações simultâneas. O relatório conserva apenas o resumo das linhas, por até 24 horas, sem guardar o arquivo original. A comparação não substitui a conferência humana de homônimos ou dados incompletos.

## Registro do atendimento na OS

Em **Ordens de serviço**, admin e financeiro informam **data e hora do chamado** e **descrição da solicitação**, além do cliente, segmento e técnico. Em **Registrar atendimento**, a administração e o técnico responsável podem registrar **início e fim do atendimento**, **serviço realizado** e **pendências** por falta de material, imprevisto no local, necessidade de retorno ou outro motivo. O técnico só altera ordens atribuídas a ele; os dados de abertura continuam sob responsabilidade de admin/financeiro.

Marque **Há algo que não foi possível concluir**, escolha o motivo e descreva o que falta. A OS fica aberta ou em andamento e aparece no filtro **Com pendências**. Ao resolver, desmarque a opção: o texto pode ser mantido como pendência resolvida. Para concluir a OS, é obrigatório descrever o serviço e informar o fim do atendimento, sem pendência em aberto. Mudar o status para “Em andamento” registra o início atual quando ainda não informado; ao escolher “Concluída”, o formulário sugere o fim atual para conferência. O fim do atendimento também pode ser registrado em uma visita que exija retorno.

As informações aparecem na própria OS e em **Clientes → Histórico**. Admin/financeiro podem usar **Exportar para Excel (CSV)**, que exporta as ordens do filtro atual. Datas são armazenadas como instantes UTC e exibidas no fuso do dispositivo, identificado na tela e nas colunas do CSV. Não são datas de agendamento: visitas futuras continuam na Agenda. Datas fora de sequência e horários futuros (com tolerância de cinco minutos para o relógio do aparelho) são recusados.

Ordens antigas continuam funcionando e exibem a data de cadastro quando o horário do chamado não foi informado; horários de atendimento antigos não são inventados. Se outra pessoa alterar a OS enquanto o formulário estiver aberto, o salvamento é recusado para evitar sobrescrever o registro: feche, atualize a lista e confira novamente. **Atualizar lista** traz as últimas alterações de outro dispositivo. Estes campos são servidos pelo sistema web e também aparecem no aplicativo Android após a publicação e o recarregamento do sistema, sem um novo APK. A versão web não oferece atendimento offline.

### Excluir ou cancelar uma OS

Somente **admin e financeiro** veem **Excluir OS** no cartão da ordem, no navegador ou no app Android. O técnico não tem permissão para conferir ou executar a exclusão. O diálogo confere os vínculos no servidor: se a OS não tiver materiais usados, agendamentos ou lançamentos financeiros, a pessoa precisa marcar que entende a exclusão permanente e confirmar. A ordem é removida da lista e a ação fica na auditoria.

Se houver qualquer um desses vínculos, o diálogo lista os motivos e oferece somente **Cancelar OS e manter histórico**, além de voltar. O cancelamento mantém os materiais, os agendamentos e os lançamentos; não remove os vínculos. Uma OS já cancelada e com vínculos continua protegida. A exclusão confere novamente as relações em uma transação, inclusive quando alguém cria um vínculo depois que o diálogo foi aberto.
