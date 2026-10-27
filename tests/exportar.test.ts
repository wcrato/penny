import { describe, expect, it } from 'vitest';
import { gerarCsv, gerarSql } from '../src/exportar';
import type { Categoria, Lancamento } from '../src/tipos';

const cats: Categoria[] = [{ id: 1, nome: "Caixa D'água", cor: '#2563eb' }];
const lancs: Lancamento[] = [
  { id: 10, user_id: 'u', data: '2026-10-20', tipo: 'despesa', valor: 4, descricao: "Peças D'água \"boas\"", categoria_id: 1,
    created_at: '2026-10-20T21:47:21+00:00', updated_at: '2026-10-20T21:47:21+00:00' },
  { id: 11, user_id: 'u', data: '2026-10-21', tipo: 'receita', valor: 6238.48, descricao: '', categoria_id: null,
    created_at: '2026-10-21T10:00:00+00:00', updated_at: '2026-10-21T10:00:00+00:00' },
];

describe('exportação', () => {
  it('SQL escapa aspas e preserva nulos, ids e valores', () => {
    const sql = gerarSql("o'brien@x.com", cats, lancs, new Date('2026-10-27T00:00:00Z'));
    expect(sql).toContain("(1, 'Caixa D''água', '#2563eb')");
    expect(sql).toContain("(10, '2026-10-20', 'despesa', 4.00, 'Peças D''água \"boas\"', 1,");
    expect(sql).toContain("(11, '2026-10-21', 'receita', 6238.48, '', null,");
    expect(sql).toContain("where email = 'o''brien@x.com'");
    expect(sql.trim().startsWith('-- Backup')).toBe(true);
    expect(sql).toMatch(/begin;[\s\S]*commit;\s*$/);
  });

  it('CSV usa ; e vírgula decimal, com nome da categoria', () => {
    const csv = gerarCsv(cats, lancs);
    const linhas = csv.replace('﻿', '').trim().split('\n');
    expect(linhas[0]).toBe('id;data;tipo;descricao;categoria;valor');
    expect(linhas[1]).toBe('10;2026-10-20;despesa;"Peças D\'água ""boas""";"Caixa D\'água";4,00');
    expect(linhas[2]).toBe('11;2026-10-21;receita;"";"";6238,48');
  });
});
