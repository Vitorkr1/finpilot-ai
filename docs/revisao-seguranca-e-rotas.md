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

Resultado da versão 1.0: 14 testes do cliente, 46 do servidor e 2 do Android aprovados; compilação web e Android concluídas, APK de distribuição assinado e assinatura verificada. Auditoria npm sem vulnerabilidades conhecidas na data da revisão.

No navegador, usando dados temporários: login de administrador e técnico, criação de cliente e ordem com atribuição de técnico, mapa, encerramento de rota, bloqueio do financeiro para técnico e restauração da sessão do super admin após recarregar. A tela de rotas foi conferida em 1280 e 390 pixels de largura, sem transbordamento horizontal.

## Limites práticos

### Atualização Android 1.1

O aplicativo passa a abrir o sistema completo em WebView, mantendo a rota no serviço nativo. A navegação interna exige a mesma origem HTTPS. Arquivos locais, conteúdo misto, permissões de câmera/GPS pela página e cookies de terceiros são bloqueados. A única integração com a página salva PDF/CSV após o usuário escolher o destino; usa AndroidX WebKit com origem exata e checagem de página principal. Links externos exigem confirmação no aplicativo. O controle de acesso continua sendo aplicado pelo servidor.

Testes adicionais cobrem a política de navegação, validação de arquivos e nomes, PDF/CSV, limite de tamanho, origem dos blobs, salvamentos concorrentes e reinjeção dos eventos de download. A análise estática verifica APIs do Android 8 ao Android 16. Os seletores de arquivos, a sessão web e o GPS ainda precisam de validação em aparelho real; os testes não simulam um telefone completo.

Na versão 1.1, os 20 testes do cliente e 6 testes Android passaram localmente; a compilação de distribuição e o lint Android concluíram sem erros. O APK usa a mesma assinatura da versão 1.0. As regras da API não foram alteradas nesta atualização.

### Atualização Android, API e painel 1.2

Correção do cenário em que a localização começava correta e depois saltava para uma rua próxima: o Android exige permissão precisa, solicita GPS a cada 2 segundos e não troca um GPS recente por uma leitura de rede. A política rejeita coordenadas inválidas, leituras com mais de 30 segundos, margem acima de 50 metros, amostras fora de ordem e saltos fisicamente improváveis. A prioridade do GPS também vale quando duas leituras têm o mesmo instante.

O envio começa assim que há uma amostra utilizável e a API confirma o consentimento, com intervalo mínimo de 5 segundos. O painel consulta a cada 5 segundos enquanto visível, exibe segundos no horário e mantém o círculo de erro estimado visível. Leituras antigas permanecem identificadas como desatualizadas; leituras imprecisas de versões anteriores não são desenhadas no mapa. A API repete as validações de idade e precisão, protege o GPS recente contra substituição por rede e aceita melhoria de precisão no mesmo instante.

Sem GPS utilizável, a consulta de estado do dispositivo permite detectar o encerramento pelo site sem enviar coordenadas. O contrato informa sua versão para preservar compatibilidade com a API anterior. A implantação completa exige atualizar APK, API e interface.

Resultado local: **23 testes do cliente, 51 do servidor e 13 do Android aprovados (87 no total)**. Build web, APK de distribuição assinado e análise estática Android concluídos. Os testes cobrem a troca GPS/rede, leitura simultânea, qualidade, idade, movimento plausível, saltos, recuperação e encerramento remoto. A assinatura do APK 1.2 corresponde à distribuição anterior.

No navegador, com banco temporário e dados fictícios, foram conferidos o mapa com margem de 20 metros, a ocultação da leitura de 500 metros, o horário atualizado e a ausência de transbordamento horizontal. Isso valida a apresentação e a comunicação simulada; **não substitui teste de campo com GPS real**. A versão 1.2 ainda precisa ser retestada no telefone usado pelo cliente, incluindo tela bloqueada e perda de sinal. Mesmo com estes filtros, GPS não garante erro zero nem comprova endereço exato; a estimativa de precisão pode estar errada.

A revisão não prova ausência de todas as vulnerabilidades. Não inclui teste de invasão externo, infraestrutura de produção, permissões/configuração do provedor ou validação com credenciais reais de WhatsApp, Groq e Cloudinary. A auditoria de pacotes considera somente os avisos conhecidos na data da execução.

A compilação e análise Android não substituem testes físicos. Antes da distribuição ampla, verificar em aparelhos reais: iniciar/encerrar, bloquear tela, fechar o navegador e a tela do app, ficar sem internet e reconectar, desligar GPS, negar/remover permissão, encerrar pelo aviso, forçar parada, reiniciar aparelho, completar 12 horas e encerrar pelo site. Restrições de bateria do fabricante podem interromper atualizações.

O mapa usa OpenStreetMap com atribuição e política de referência compatíveis. O provedor pode impor limites ou bloquear requisições; para uso em escala, configure um provedor de mapas adequado à operação. Posições antigas e precisão reduzida são exibidas como tais.

## Redefinição de senhas pelo administrador

O admin da empresa pode redefinir a senha de outro usuário do mesmo tenant ou a própria senha. O formulário exibe o aviso antes da confirmação e exige a senha atual do ator. A API exige confirmação explícita, limita tentativas por administrador e revalida o ator e sua sessão na transação. Senha, revogação de sessões e remoção da rota são alteradas juntas; uma falha reverte as três operações. O registro de auditoria não inclui a senha, e as respostas têm cache desativado.

A senha gerada é retornada apenas naquela resposta e mantida em memória na tela até ser fechada. O banco conserva somente o hash. Usuários inativos não são reativados. A própria conta recebe o resultado antes do retorno voluntário ao login, embora seus tokens anteriores já estejam revogados na API.

Nove novos testes integrados cobrem troca efetiva, senha anterior inválida, próprio administrador, isolamento e perfis, confirmação e reautenticação, usuário inativo, reversão de falha, sessão revogada durante a operação, limite de tentativas, login e início de rota concorrentes à troca. Resultado: 23 testes do cliente e 60 do servidor aprovados, além do build web e análise estática sem erros. O Android não teve código alterado nesta atualização. Login e início de rota usam a mesma trava de empresa da redefinição, impedindo que uma requisição em andamento recrie o acesso revogado depois da troca.


## Importação de clientes (web)

A importação de .xlsx/CSV é restrita a admin e financeiro do tenant. O navegador valida o arquivo em worker com prazo máximo; a API não aceita arquivo Excel nem macros, apenas JSON com campos permitidos. O limite especial de 5 MB só existe no endpoint autenticado de importação; as demais rotas conservam 128 KB. O lote aceita até mil linhas, sem campos arbitrários ou identificadores de outra empresa.

Prévia não grava dados. A confirmação revalida o ator e sua sessão, confere as duplicatas na empresa atual, e grava os clientes junto do comprovante de importação em uma única transação. Operações concorrentes são serializadas por empresa. Reenvios com o mesmo identificador e conteúdo retornam o mesmo resultado; conteúdo diferente com esse identificador é recusado. Nenhum cadastro existente é atualizado. Relatórios CSV neutralizam fórmulas antes do download.

Os comprovantes têm limpeza TTL de 24 horas e são removidos na exclusão da empresa. Auditoria registra contagens, sem registrar conteúdo de planilha. A validação usa apenas clientes e bancos temporários; não importa dados reais na produção.

## Dados do chamado, execução e pendências

OS aceita data/hora do chamado e descrição da solicitação na abertura, e início/fim, serviço realizado e pendência no atendimento. API valida formatos ISO com fuso, datas reais, sequência temporal, limites de texto e motivos permitidos; recusa propriedades arbitrárias e horários futuros. Pendência ativa exige motivo e detalhes; conclusão exige descrição do serviço e fim do atendimento, sem pendência ativa. Validação considera os valores já persistidos junto dos campos alterados, inclusive em PATCH parcial.

Admin/financeiro alteram dados de abertura; técnico somente execução, checklist e pendências das próprias ordens. Todas as consultas e alterações conservam companyId da sessão e atribuição do técnico. A edição usa a data de atualização para detectar formulário desatualizado; a gravação também compara a versão e o instante lidos para recusar uma alteração concorrente. CSV mantém a proteção existente contra fórmulas e não adiciona endpoint público. Dados antigos não são migrados ou substituídos por horários de atendimento fictícios.

Novos testes integrados cobrem persistência e histórico, leitura por financeiro/técnico, resolução sem apagar o motivo, isolamento e perfis, entradas malformadas, datas e sequência, conclusão incompleta, conflitos e compatibilidade de OS antiga. Testes do cliente cobrem fusos, preservação de instantes/milissegundos e colunas da exportação. Todos usam dados fictícios e banco temporário. A verificação do Android é limitada à interface web em tela pequena e ao uso do WebView existente; não houve novo APK nem teste físico de campo nesta alteração.

## Exclusão de OS pela interface

O botão e a conferência dos vínculos são exclusivos de admin e financeiro. Tanto GET /service-orders/:id/deletion-check quanto DELETE /service-orders/:id mantêm a autorização de perfil e companyId da sessão. A conferência informa somente os tipos de vínculo, sem expor dados financeiros ou de outra empresa. A interface exige confirmação explícita de exclusão permanente, bloqueia ações repetidas e mantém o diálogo aberto durante a operação.

Materiais usados, qualquer agendamento ou lançamento financeiro impedem a exclusão; o diálogo oferece cancelar e preservar o histórico. Ordens canceladas continuam protegidas enquanto houver vínculos. DELETE revalida as relações na transação e retorna OS_HAS_LINKS se um vínculo existir, incluindo quando foi criado após a conferência inicial. A interface passa para a opção de cancelamento nesse caso. Uma tentativa bloqueada reverte a remoção e não gera auditoria de exclusão; cancelar não remove ou modifica os vínculos.

Testes com banco temporário cobrem exclusão permitida, auditoria, repetição, técnico sem permissão, isolamento entre empresas, cada tipo de vínculo, cancelamento, vínculo adicionado após a conferência e concorrência com agendamento/financeiro. O navegador foi usado com dados fictícios para conferir a confirmação obrigatória, o bloqueio com os três vínculos, o cancelamento e o diálogo em tela de celular. Nenhuma OS de cliente foi excluída nessa verificação.

## Alteração de e-mail de acesso e diagnóstico de login

PATCH /company-users/:id/email é exclusivo de admin do tenant e exige confirmação, endereço anterior esperado e a senha atual do ator. Normaliza e valida o e-mail, impede duplicação global e recusa propriedades desconhecidas. O ator, sua sessão e o endereço atual são revalidados dentro da transação, com a trava de empresa também usada por login e redefinição de senha. A troca de e-mail, revogação de sessões e encerramento da rota são atômicos. A senha, a função e o status ativo/inativo permanecem iguais. Auditoria registra a ação e o identificador, sem senha em texto aberto.

Login passa a revalidar o e-mail autenticado antes de emitir a sessão, além do hash da senha. Isso impede um login iniciado com o endereço antigo de criar uma sessão após a alteração. Limite de dez tentativas de alteração por administrador a cada 15 minutos é independente do limite de redefinição de senha. A interface informa a necessidade de usar o novo endereço, pede reautenticação e permite ao próprio admin conferir o resultado antes de voltar ao login.

Mensagens da tela de login distinguem resposta 401 (credenciais ou acesso inativo), validação, proibição, limite de tentativas, serviço ausente e conexão. Nenhuma resposta informa se uma conta específica existe; erros internos 5xx não são exibidos como senha incorreta. Campos de e-mail desativam capitalização e correção automática no navegador.

Dez testes integrados específicos cobrem troca com senha mantida, sessões/rota revogadas, próprio admin, empresa/perfis, entradas malformadas, duplicação, formulário antigo, usuário inativo, reversão de falha, login concorrente, criação/login dos três perfis com requisições de navegador e Android, sessão do ator revogada e limitação de tentativas. Usam contas e banco temporários, sem alterar usuários de produção. Não substituem a conferência do endereço e da senha atuais das contas reais.

## Exclusão definitiva de membros

DELETE /company-users/:id exige admin do tenant, confirmação explícita, o e-mail esperado do membro e a senha atual do administrador. A própria conta é protegida, inclusive com identificador em maiúsculas. Ator, sessão e empresa são revalidados dentro da transação com trava de empresa. A exclusão remove fisicamente o usuário, revoga todas as suas sessões e encerra a rota; a auditoria da exclusão participa da mesma transação. Uma falha reverte todos os passos. O limite é de dez tentativas por administrador a cada 15 minutos.

OS e agendamentos conservam o identificador anterior e uma cópia do nome do técnico excluído. Registros anteriores de auditoria também recebem o nome do autor. Os documentos operacionais, materiais, clientes e financeiro não são excluídos. Uma nova conta com o mesmo e-mail tem outro identificador e não herda esses vínculos. Atribuições de técnico em OS e agenda fazem uma escrita no usuário dentro da transação para coordenar criações e reatribuições com a remoção, garantindo o nome histórico mesmo em operações concorrentes. A reatribuição explícita a outro técnico remove a indicação de exclusão da atribuição atual.

Testes em banco temporário cobrem remoção física, sessões/refresh/rota bloqueados, preservação do histórico, reutilização do e-mail sem herança de acesso, exclusão de outros admins/financeiro/inativos, perfis e isolamento, senha/confirmação, reversão de falha, exclusões concorrentes de admins, criação/reatribuição concorrentes de OS/agenda, cancelamento e reatribuição do histórico, login e início de rota em andamento e limite de tentativas. Teste do cliente verifica o nome histórico no CSV. A regressão aprovou 103 testes do servidor e 33 do cliente. O navegador confirmou a proteção da própria conta, a confirmação e senha obrigatórias em tela de celular, e os nomes preservados nas OS e na agenda após remover uma conta fictícia pela API de teste. Nenhuma conta de produção é removida ao adicionar esta função.
