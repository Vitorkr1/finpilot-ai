# PDF de orçamento: correção de layout

O gerador usa A4, margens fixas, dados do emitente e cliente em colunas, tabela com altura medida por linha, valores alinhados à direita e total destacado. Itens comuns não são divididos entre páginas. Descrições maiores que uma página continuam com identificação; cabeçalhos e numeração são repetidos sem invadir o rodapé. Datas de emissão usam America/Sao_Paulo e valores seguem pt-BR.

O botão de PDF agora baixa o Blob com nome de arquivo explícito, mostra progresso e apresenta erro com possibilidade de nova tentativa, sem depender de pop-ups.

Validação:
- `node server/tests/pdf.test.js`: cinco testes de regressão passaram, cobrindo A4, moeda/data, paginação, descrições extensas, campos opcionais e quantidades maiores.
- Sete cenários de PDF gerados e renderizados via Poppler: exemplo, 45 itens, descrição extensa, palavra sem espaços, dados cadastrais extensos, vazio e valores altos. As 24 páginas foram inspecionadas; extração com pdfplumber confirmou margens, rodapés numerados, um único total por orçamento e preservação do final da descrição longa.
- TypeScript e build de produção do frontend passaram. No sandbox Windows, o Vite usou `--configLoader native`.

Nenhuma alteração no cálculo ou nos valores persistidos dos orçamentos. Exemplos e testes utilizam dados fictícios; não exigem MongoDB ou serviços externos. Os arquivos temporários de QA não fazem parte da aplicação.
