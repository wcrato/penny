// Datas do app: tudo no horário de Brasília. Datas de lançamento são strings
// 'AAAA-MM-DD' (coluna date do banco), então as contas abaixo não dependem do
// fuso do aparelho.

export const FUSO = 'America/Sao_Paulo';

export interface AnoMes {
  ano: number;
  mes: number; // 1-12
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const fmtIso = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Data de hoje em Brasília, 'AAAA-MM-DD'. */
export function hoje(agora: Date = new Date()): string {
  return fmtIso.format(agora);
}

export function anoMesDe(iso: string): AnoMes {
  return { ano: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) };
}

export function mesAtual(agora: Date = new Date()): AnoMes {
  return anoMesDe(hoje(agora));
}

export function somarMeses({ ano, mes }: AnoMes, delta: number): AnoMes {
  const total = ano * 12 + (mes - 1) + delta;
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function primeiroDia({ ano, mes }: AnoMes): string {
  return `${ano}-${pad(mes)}-01`;
}

export function ultimoDia({ ano, mes }: AnoMes): string {
  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${pad(mes)}-${pad(dias)}`;
}

/** 'AAAA-MM-DD' -> 'DD/MM/AAAA' */
export function formatarData(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** 'AAAA-MM-DD' -> 'seg, 20 de outubro' */
export function rotuloDia(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
  const semana = DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()] ?? '';
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${d} de ${MESES[m - 1]}`;
}

/** {2026, 10} -> 'Outubro de 2026' */
export function rotuloMes({ ano, mes }: AnoMes): string {
  const nome = MESES[mes - 1] ?? '';
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

/** 'AAAA-MM-01' -> 'out/26' */
export function rotuloMesCurto(iso: string): string {
  const { ano, mes } = anoMesDe(iso);
  return `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`;
}

export function nomeMes(mes: number): string {
  const nome = MESES[mes - 1] ?? '';
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/** Data e hora de um timestamp, no horário de Brasília. */
export function formatarDataHora(timestamp: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(timestamp));
}

export function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [a, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
