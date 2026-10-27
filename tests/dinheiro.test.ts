import { describe, expect, it } from 'vitest';
import { centavosParaCampo, formatarReais, lerValor, somarTotais } from '../src/dinheiro';

describe('dinheiro', () => {
  it('lê valores digitados no formato brasileiro e no formato com ponto', () => {
    expect(lerValor('12,50')).toBe(1250);
    expect(lerValor('1.234,56')).toBe(123456);
    expect(lerValor('1234.56')).toBe(123456);
    expect(lerValor('R$ 10')).toBe(1000);
    expect(lerValor('0,1')).toBe(10);
    expect(lerValor(' 7 ')).toBe(700);
  });

  it('recusa valores inválidos', () => {
    for (const t of ['', 'abc', '-5', '1,234', '12,345', '1.2.3', '1e5', '10,']) expect(lerValor(t)).toBeNull();
  });

  it('soma em centavos sem erro de ponto flutuante', () => {
    const t = somarTotais([
      { tipo: 'receita', valor: 0.1 }, { tipo: 'receita', valor: 0.2 }, { tipo: 'despesa', valor: 0.3 },
    ]);
    expect(t).toEqual({ receitas: 0.3, despesas: 0.3, saldo: 0 });
  });

  it('formata em reais', () => {
    expect(formatarReais(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(formatarReais(-10).replace(/\s/g, ' ')).toBe('-R$ 10,00');
    expect(centavosParaCampo(123456)).toBe('1234,56');
  });
});
