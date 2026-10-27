// Dinheiro: contas sempre em centavos inteiros para não acumular erro de
// ponto flutuante (0.1 + 0.2 !== 0.3).

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
});

export function paraCentavos(valor: number | string): number {
  return Math.round(Number(valor) * 100);
}

export function formatarReais(valor: number | string): string {
  //   vem do Intl; mantemos para o "R$" não quebrar de linha
  return brl.format(paraCentavos(valor) / 100);
}

export function formatarReaisCompacto(valor: number): string {
  return brlCompacto.format(valor);
}

/**
 * Lê um valor digitado: aceita "1.234,56", "1234,56", "1234.56", "R$ 10".
 * Retorna centavos, ou null se não for um valor válido e não negativo.
 */
export function lerValor(texto: string): number | null {
  let t = texto.replace(/R\$|\s| /g, '');
  if (!t) return null;
  if (t.includes(',')) {
    // formato brasileiro: ponto é milhar, vírgula é decimal
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return null;
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (!/^\d+(\.\d{1,2})?$/.test(t)) {
    return null;
  }
  const centavos = Math.round(Number(t) * 100);
  return Number.isSafeInteger(centavos) && centavos <= 999_999_999_999_99 ? centavos : null;
}

/** Centavos -> "1234,56" (para preencher o campo de edição) */
export function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

export interface Totais {
  receitas: number;
  despesas: number;
  saldo: number;
}

export function somarTotais(linhas: { tipo: string; valor: number | string }[]): Totais {
  let r = 0;
  let d = 0;
  for (const l of linhas) {
    if (l.tipo === 'receita') r += paraCentavos(l.valor);
    else d += paraCentavos(l.valor);
  }
  return { receitas: r / 100, despesas: d / 100, saldo: (r - d) / 100 };
}
