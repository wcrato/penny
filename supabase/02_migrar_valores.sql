-- Migração única: tabela antiga "valores" (C/D, só created_at) -> "lancamentos".
-- Rode DEPOIS de 01_schema.sql, num banco que ainda tem public.valores.
-- Tudo numa transação: se a conferência falhar, nada muda.

begin;

do $$ begin
  if exists (select 1 from public.lancamentos) then
    raise exception 'lancamentos já tem dados; migração abortada para não duplicar.';
  end if;
end $$;

-- data do lançamento = dia em que foi registrado, no horário de Brasília
-- (created_at original fica preservado como registro de quando foi lançado)
insert into public.lancamentos (id, user_id, data, tipo, valor, descricao, categoria_id, created_at, updated_at)
select id, user_id,
       (created_at at time zone 'America/Sao_Paulo')::date,
       case tipo when 'C' then 'receita' when 'D' then 'despesa' end,
       valor, descricao, null, created_at, updated_at
from public.valores;

select setval(pg_get_serial_sequence('public.lancamentos', 'id'),
              greatest((select max(id) from public.lancamentos),
                       (select last_value from public.valores_id_seq)));

do $$
declare a record; n record;
begin
  select count(*) q, sum(valor) filter (where tipo = 'C') c, sum(valor) filter (where tipo = 'D') d, sum(id) s
    into a from public.valores;
  select count(*) q, sum(valor) filter (where tipo = 'receita') c, sum(valor) filter (where tipo = 'despesa') d, sum(id) s
    into n from public.lancamentos;
  if a is distinct from n then
    raise exception 'Conferência falhou: antigo % / novo %', a, n;
  end if;
  if exists (
    select 1 from public.valores v join public.lancamentos l using (id)
    where (v.user_id, v.valor, v.descricao, v.created_at, v.updated_at)
       is distinct from (l.user_id, l.valor, l.descricao::varchar, l.created_at, l.updated_at)
  ) then
    raise exception 'Conferência linha a linha falhou';
  end if;
  raise notice 'OK: % lançamentos migrados e conferidos.', n.q;
end $$;

-- categorias iniciais para cada usuário que tem lançamentos
insert into public.categorias (user_id, nome, cor)
select u.user_id, c.nome, c.cor
from (select distinct user_id from public.lancamentos) u
cross join (values
  ('Alimentação', '#ea580c'), ('Transporte', '#2563eb'), ('Saúde', '#dc2626'),
  ('Contas da casa', '#0891b2'), ('Obra', '#a16207'), ('Educação', '#7c3aed'),
  ('Cartão de crédito', '#be185d'), ('Pessoal', '#db2777'), ('Família', '#16a34a'),
  ('Outros', '#64748b'), ('Salário', '#059669'), ('Outras receitas', '#0d9488')
) as c(nome, cor);

drop table public.valores;
drop function if exists public.valores_antes_update();

commit;
