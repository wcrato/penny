#!/usr/bin/env python3
"""Converte a tabela `valores` do dump MySQL/MariaDB (Adminer) para `lancamentos` no Postgres/Supabase.

Uso: python3 converter_dump.py <dump.sql> <saida.sql> <email-do-usuario>

O SQL gerado roda numa transação e confere, no próprio banco, a quantidade de
linhas e os totais de crédito/débito contra os valores lidos do dump. Se algo
não bater, a importação inteira é desfeita (nenhum dado parcial fica gravado).
"""
import sys
from decimal import Decimal

CATEGORIAS = [
    ("Alimentação", "#ea580c"), ("Transporte", "#2563eb"), ("Saúde", "#dc2626"),
    ("Contas da casa", "#0891b2"), ("Obra", "#a16207"), ("Educação", "#7c3aed"),
    ("Cartão de crédito", "#be185d"), ("Pessoal", "#db2777"), ("Família", "#16a34a"),
    ("Outros", "#64748b"), ("Salário", "#059669"), ("Outras receitas", "#0d9488"),
]

COLS = ["id", "user_id", "valor", "descricao", "tipo", "created_at", "updated_at"]


def ler_bloco_insert(texto, tabela):
    inicio = texto.index(f"INSERT INTO `{tabela}`")
    inicio = texto.index("VALUES", inicio) + len("VALUES")
    return texto, inicio


def parse_valores(texto, pos):
    """Tokeniza as tuplas (...) até o ';' final, respeitando aspas e escapes do MySQL."""
    linhas, campos, i = [], [], pos
    escapes = {"0": "\0", "n": "\n", "r": "\r", "t": "\t", "Z": "\x1a", "b": "\b"}
    while True:
        c = texto[i]
        if c in " \t\r\n,":
            i += 1
        elif c == "(":
            campos = []
            i += 1
        elif c == ")":
            linhas.append(campos)
            i += 1
        elif c == ";":
            return linhas
        elif c == "'":
            i += 1
            buf = []
            while True:
                c = texto[i]
                if c == "\\":
                    buf.append(escapes.get(texto[i + 1], texto[i + 1]))
                    i += 2
                elif c == "'" and texto[i + 1] == "'":
                    buf.append("'")
                    i += 2
                elif c == "'":
                    i += 1
                    break
                else:
                    buf.append(c)
                    i += 1
            campos.append("".join(buf))
        else:
            j = i
            while texto[j] not in ",)":
                j += 1
            tok = texto[i:j].strip()
            campos.append(None if tok == "NULL" else tok)
            i = j


def q(s):
    return "NULL" if s is None else "'" + s.replace("'", "''") + "'"


def main():
    origem, destino, email = sys.argv[1], sys.argv[2], sys.argv[3]
    texto = open(origem, encoding="utf-8").read()
    texto, pos = ler_bloco_insert(texto, "valores")
    linhas = parse_valores(texto, pos)

    for l in linhas:
        assert len(l) == len(COLS), f"linha com {len(l)} campos: {l}"
        assert l[4] in ("C", "D"), f"tipo inesperado: {l}"
    ids = [int(l[0]) for l in linhas]
    assert len(ids) == len(set(ids)), "ids duplicados no dump"
    usuarios = {l[1] for l in linhas}
    assert usuarios == {"1"}, f"dump tem lançamentos de outros usuários: {usuarios}"

    total = len(linhas)
    cred = sum(Decimal(l[2]) for l in linhas if l[4] == "C")
    deb = sum(Decimal(l[2]) for l in linhas if l[4] == "D")
    soma_ids = sum(ids)

    out = []
    out.append("-- Gerado por ferramentas/converter_dump.py a partir do dump MariaDB.")
    out.append(f"-- {total} lançamentos | créditos {cred} | débitos {deb}")
    out.append("-- Rode DEPOIS de 01_schema.sql e DEPOIS de criar seu usuário em Authentication > Users.")
    out.append("begin;")
    out.append("")
    out.append("do $$ begin")
    out.append(f"  if not exists (select 1 from auth.users where email = {q(email)}) then")
    out.append(f"    raise exception 'Crie primeiro o usuário {email} em Authentication > Users';")
    out.append("  end if;")
    out.append("  if exists (select 1 from public.lancamentos) then")
    out.append("    raise exception 'A tabela lancamentos já tem dados; importação abortada para não duplicar.';")
    out.append("  end if;")
    out.append("end $$;")
    out.append("")
    out.append("create temp table _import (id bigint, valor numeric(12,2), descricao text, tipo char(1),")
    out.append("  created_at timestamp, updated_at timestamp) on commit drop;")
    out.append("")
    for k in range(0, total, 500):
        out.append("insert into _import (id, valor, descricao, tipo, created_at, updated_at) values")
        bloco = linhas[k:k + 500]
        out.append(",\n".join(
            f"({l[0]}, {l[2]}, {q(l[3])}, {q(l[4])}, {q(l[5])}, {q(l[6])})" for l in bloco
        ) + ";")
        out.append("")
    # O app Laravel usava timezone UTC, então os horários do dump estão em UTC.
    # data do lançamento = dia do registro no horário de Brasília.
    out.append("insert into public.lancamentos (id, user_id, data, tipo, valor, descricao, created_at, updated_at)")
    out.append("select i.id, u.id, ((i.created_at at time zone 'UTC') at time zone 'America/Sao_Paulo')::date,")
    out.append("       case i.tipo when 'C' then 'receita' else 'despesa' end, i.valor, i.descricao,")
    out.append("       i.created_at at time zone 'UTC', coalesce(i.updated_at, i.created_at) at time zone 'UTC'")
    out.append(f"from _import i cross join (select id from auth.users where email = {q(email)}) u;")
    out.append("")
    out.append("-- Próximo id continua de onde o MariaDB parou")
    out.append("select setval(pg_get_serial_sequence('public.lancamentos', 'id'), (select max(id) from public.lancamentos));")
    out.append("")
    out.append("insert into public.categorias (user_id, nome, cor)")
    out.append(f"select u.id, c.nome, c.cor from (select id from auth.users where email = {q(email)}) u")
    out.append("cross join (values " + ", ".join(f"('{n}', '{c}')" for n, c in CATEGORIAS) + ") as c(nome, cor)")
    out.append("on conflict do nothing;")
    out.append("")
    out.append("do $$ declare n bigint; c numeric; d numeric; s numeric; begin")
    out.append("  select count(*), coalesce(sum(valor) filter (where tipo='receita'),0),")
    out.append("         coalesce(sum(valor) filter (where tipo='despesa'),0), sum(id)")
    out.append("    into n, c, d, s from public.lancamentos;")
    out.append(f"  if n <> {total} or c <> {cred} or d <> {deb} or s <> {soma_ids} then")
    out.append("    raise exception 'Conferência falhou: % linhas, créditos %, débitos %', n, c, d;")
    out.append("  end if;")
    out.append(f"  raise notice 'OK: {total} lançamentos importados e conferidos.';")
    out.append("end $$;")
    out.append("")
    out.append("commit;")
    open(destino, "w", encoding="utf-8").write("\n".join(out) + "\n")

    print(f"{total} linhas | ids {min(ids)}..{max(ids)} | créditos {cred} | débitos {deb} | saldo {cred - deb}")


if __name__ == "__main__":
    main()
