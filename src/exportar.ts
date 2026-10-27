import type { Categoria, Lancamento } from './tipos';

const texto = (s: string) => "'" + s.replace(/'/g, "''") + "'";

/**
 * Gera um .sql que restaura categorias e lançamentos num projeto novo
 * (depois de rodar supabase/01_schema.sql e criar o usuário com o mesmo e-mail).
 * Roda numa transação e confere a quantidade de linhas no final.
 */
export function gerarSql(email: string, categorias: Categoria[], lancamentos: Lancamento[], agora = new Date()): string {
  const usuario = `(select id from auth.users where email = ${texto(email)})`;
  const l: string[] = [
    `-- Backup SysFin de ${email} em ${agora.toISOString()}`,
    `-- ${categorias.length} categorias, ${lancamentos.length} lançamentos`,
    '-- Para restaurar: rode supabase/01_schema.sql num projeto novo, crie o usuário',
    '-- em Authentication > Users com este e-mail e rode este arquivo no SQL Editor.',
    'begin;',
    '',
    'do $$ begin',
    `  if not exists ${usuario} then raise exception 'Crie primeiro o usuário ${email.replace(/'/g, "''")}'; end if;`,
    "  if exists (select 1 from public.lancamentos) or exists (select 1 from public.categorias) then",
    "    raise exception 'O banco já tem dados; restauração abortada para não duplicar.';",
    '  end if;',
    'end $$;',
    '',
  ];

  if (categorias.length) {
    l.push('insert into public.categorias (id, user_id, nome, cor)');
    l.push(`select v.id, u.id, v.nome, v.cor from ${usuario} u cross join (values`);
    l.push(categorias.map((c) => `  (${c.id}, ${texto(c.nome)}, ${texto(c.cor)})`).join(',\n'));
    l.push(') as v(id, nome, cor);');
    l.push("select setval(pg_get_serial_sequence('public.categorias', 'id'), (select max(id) from public.categorias));");
    l.push('');
  }

  if (lancamentos.length) {
    l.push('insert into public.lancamentos (id, user_id, data, tipo, valor, descricao, categoria_id, created_at, updated_at)');
    l.push('select v.id, u.id, v.data::date, v.tipo, v.valor::numeric(14,2), v.descricao, v.categoria_id::bigint,');
    l.push('       v.created_at::timestamptz, v.updated_at::timestamptz');
    l.push(`from ${usuario} u cross join (values`);
    l.push(lancamentos.map((x) =>
      `  (${x.id}, ${texto(x.data)}, ${texto(x.tipo)}, ${Number(x.valor).toFixed(2)}, ${texto(x.descricao)}, ` +
      `${x.categoria_id ?? 'null'}, ${texto(x.created_at)}, ${texto(x.updated_at)})`).join(',\n'));
    l.push(') as v(id, data, tipo, valor, descricao, categoria_id, created_at, updated_at);');
    l.push("select setval(pg_get_serial_sequence('public.lancamentos', 'id'), (select max(id) from public.lancamentos));");
    l.push('');
  }

  l.push('do $$ begin');
  l.push(`  if (select count(*) from public.lancamentos) <> ${lancamentos.length}`);
  l.push(`     or (select count(*) from public.categorias) <> ${categorias.length} then`);
  l.push("    raise exception 'Conferência da restauração falhou';");
  l.push('  end if;');
  l.push('end $$;');
  l.push('commit;');
  l.push('');
  return l.join('\n');
}

/** CSV com ; e vírgula decimal (abre direto no Excel/Sheets em português). */
export function gerarCsv(categorias: Categoria[], lancamentos: Lancamento[]): string {
  const nomes = new Map(categorias.map((c) => [c.id, c.nome]));
  const campo = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const linhas = lancamentos.map((x) => [
    x.id, x.data, x.tipo, campo(x.descricao),
    campo(x.categoria_id ? nomes.get(x.categoria_id) ?? '' : ''),
    Number(x.valor).toFixed(2).replace('.', ','),
  ].join(';'));
  return '﻿id;data;tipo;descricao;categoria;valor\n' + linhas.join('\n') + '\n';
}
