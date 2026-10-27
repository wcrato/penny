# SysFin

Controle financeiro pessoal. App web instalável no Android (PWA), feito com Vite + TypeScript.
Os dados ficam na Supabase (plano grátis) e o site no GitHub Pages (grátis).

- **Início:** o mês com receitas, despesas e saldo, filtros e a lista agrupada por dia.
- **Relatório:** qualquer período, com filtros, totais e exportação CSV.
- **Gráficos:** receitas × despesas por mês (ou por ano) e gastos por categoria.
- **Categorias:** criar, renomear, mudar a cor e excluir.
- **Conta:** backup SQL/CSV, troca de senha e sair.

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes automáticos
npm run build      # gera dist/
```

A URL e a chave pública da Supabase ficam em `.env`. A chave *publishable* é pública por
natureza (quem protege os dados é o RLS do banco). **Nunca** coloque a chave
*secret*/*service_role* neste projeto.

## Banco de dados

- `supabase/01_schema.sql`: tabelas `categorias` e `lancamentos`, regras de segurança (RLS)
  e funções de resumo. Cada usuário só vê e altera os próprios dados.
- `supabase/02_migrar_valores.sql`: migração única, já aplicada, da tabela antiga `valores`
  do app Laravel.
- `ferramentas/converter_dump.py`: converte o dump MariaDB original para importação do zero.

Datas: a coluna `data` é o dia do lançamento, no horário de Brasília. `created_at` guarda
quando ele foi registrado.

## Publicação

Cada `git push` na branch `main` roda os testes, faz o build e publica no GitHub Pages
(`.github/workflows/publicar.yml`). Na primeira vez, ative em
**Settings → Pages → Source: GitHub Actions**.

## Backup e restauração

Na aba **Conta → Exportar SQL**. Para restaurar num projeto Supabase novo:
1. Rode `supabase/01_schema.sql` no SQL Editor.
2. Crie o usuário em **Authentication → Users** com o mesmo e-mail.
3. Rode o arquivo de backup no SQL Editor. Ele confere as quantidades e se recusa a
   duplicar dados.

A exclusão de lançamentos é definitiva (com confirmação). Faça backups periódicos;
o app avisa quando o último backup tem mais de 30 dias.

## Manutenção da Supabase grátis

Projetos grátis são pausados após 7 dias sem uso. Usando o app pelo menos uma vez por
semana, isso não acontece. Se pausar, clique em **Restore** no painel; nenhum dado se perde.
