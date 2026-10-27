import { describe, expect, it } from 'vitest';
import { dataValida, formatarData, hoje, mesAtual, primeiroDia, rotuloDia, rotuloMes, somarMeses, ultimoDia } from '../src/datas';

describe('datas em Brasília', () => {
  it('hoje() usa o horário de Brasília, não o UTC', () => {
    // 31/10/2026 23:30 em Brasília = 01/11/2026 02:30 UTC
    expect(hoje(new Date('2026-11-01T02:30:00Z'))).toBe('2026-10-31');
    expect(mesAtual(new Date('2026-11-01T02:30:00Z'))).toEqual({ ano: 2026, mes: 10 });
    expect(hoje(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-01');
  });

  it('respeita o horário de verão antigo (2018: UTC-2)', () => {
    expect(hoje(new Date('2018-12-01T01:30:00Z'))).toBe('2018-11-30');
    expect(hoje(new Date('2018-12-01T02:30:00Z'))).toBe('2018-12-01');
  });

  it('soma meses atravessando anos', () => {
    expect(somarMeses({ ano: 2026, mes: 1 }, -1)).toEqual({ ano: 2025, mes: 12 });
    expect(somarMeses({ ano: 2026, mes: 12 }, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(somarMeses({ ano: 2026, mes: 10 }, -11)).toEqual({ ano: 2025, mes: 11 });
  });

  it('primeiro e último dia do mês, inclusive fevereiro bissexto', () => {
    expect(primeiroDia({ ano: 2026, mes: 3 })).toBe('2026-03-01');
    expect(ultimoDia({ ano: 2024, mes: 2 })).toBe('2024-02-29');
    expect(ultimoDia({ ano: 2026, mes: 2 })).toBe('2026-02-28');
    expect(ultimoDia({ ano: 2026, mes: 12 })).toBe('2026-12-31');
  });

  it('formata e valida', () => {
    expect(formatarData('2026-10-20')).toBe('20/10/2026');
    expect(rotuloDia('2026-10-20')).toBe('Ter, 20 de outubro');
    expect(rotuloMes({ ano: 2026, mes: 3 })).toBe('Março de 2026');
    expect(dataValida('2026-02-29')).toBe(false);
    expect(dataValida('2024-02-29')).toBe(true);
    expect(dataValida('20/10/2026')).toBe(false);
  });
});
