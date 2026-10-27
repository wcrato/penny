import { createClient, type PostgrestError } from '@supabase/supabase-js';
import type {
  Categoria, Filtros, Lancamento, NovoLancamento, ResumoCategoria, ResumoMes, ResumoPeriodo, TipoLancamento,
} from './tipos';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const configurado = Boolean(url && chave && chave !== 'PENDENTE');

export const sb = createClient(url ?? 'https://invalido.supabase.co', chave ?? 'invalida', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export class ErroApi extends Error {
  constructor(mensagem: string, readonly sessaoExpirada = false) {
    super(mensagem);
  }
}

function checar<T>(resp: { data: T | null; error: PostgrestError | null }): T {
  if (resp.error) {
    const e = resp.error;
    const expirada = e.code === 'PGRST301' || e.code === 'PGRST303' || /JWT/i.test(e.message);
    throw new ErroApi(traduzirErro(e), expirada);
  }
  return resp.data as T;
}

function traduzirErro(e: PostgrestError): string {
  if (e.code === '23505') return 'Já existe um registro com esse nome.';
  if (e.code === '23514') return 'Valor inválido para o banco de dados.';
  if (e.code === '42501') return 'Sem permissão para esta operação.';
  if (/Failed to fetch|NetworkError/i.test(e.message)) return 'Sem conexão com a internet.';
  return e.message || 'Erro desconhecido.';
}

const POR_REQUISICAO = 1000; // limite padrão de linhas por requisição da Supabase

function argsFiltro(f: Filtros) {
  return {
    p_inicio: f.inicio,
    p_fim: f.fim,
    p_tipo: f.tipo,
    p_categoria: f.categoria,
    p_busca: f.busca.trim() || null,
    p_valor: f.valor,
  };
}

// ---------- lançamentos ----------

export async function listarLancamentos(f: Filtros, de: number, ate: number): Promise<{ linhas: Lancamento[]; total: number }> {
  const resp = await sb.rpc('lancamentos_filtrados', argsFiltro(f), { count: 'exact' })
    .order('data', { ascending: false }).order('id', { ascending: false })
    .range(de, ate);
  const linhas = checar(resp) as Lancamento[];
  return { linhas: linhas.map(normalizar), total: resp.count ?? linhas.length };
}

/** Todos os lançamentos que batem com o filtro (paginando de 1000 em 1000). */
export async function todosLancamentos(f: Filtros, ordemCrescente = false): Promise<Lancamento[]> {
  const todas: Lancamento[] = [];
  for (let de = 0; ; de += POR_REQUISICAO) {
    const resp = await sb.rpc('lancamentos_filtrados', argsFiltro(f))
      .order('data', { ascending: ordemCrescente }).order('id', { ascending: ordemCrescente })
      .range(de, de + POR_REQUISICAO - 1);
    const pagina = checar(resp) as Lancamento[];
    todas.push(...pagina.map(normalizar));
    if (pagina.length < POR_REQUISICAO) return todas;
  }
}

function normalizar(l: Lancamento): Lancamento {
  return { ...l, valor: Number(l.valor) };
}

export async function salvarLancamento(dados: NovoLancamento, id?: number): Promise<void> {
  if (id) checar(await sb.from('lancamentos').update(dados).eq('id', id).select('id'));
  else checar(await sb.from('lancamentos').insert(dados).select('id'));
}

export async function excluirLancamento(id: number): Promise<void> {
  const linhas = checar(await sb.from('lancamentos').delete().eq('id', id).select('id'));
  if (!linhas.length) throw new ErroApi('Lançamento não encontrado (talvez já tenha sido excluído).');
}

/** Descrições recentes com a última categoria usada, para sugerir ao digitar. */
export async function descricoesRecentes(): Promise<Map<string, { descricao: string; categoria_id: number | null; tipo: TipoLancamento }>> {
  const linhas = checar(await sb.from('lancamentos')
    .select('descricao, categoria_id, tipo')
    .order('data', { ascending: false }).order('id', { ascending: false })
    .limit(POR_REQUISICAO)) as { descricao: string; categoria_id: number | null; tipo: TipoLancamento }[];
  const mapa = new Map<string, { descricao: string; categoria_id: number | null; tipo: TipoLancamento }>();
  for (const l of linhas) {
    const chaveDesc = l.descricao.trim().toLowerCase();
    if (chaveDesc && !mapa.has(chaveDesc)) mapa.set(chaveDesc, { ...l, descricao: l.descricao.trim() });
  }
  return mapa;
}

export async function primeiraData(): Promise<string | null> {
  const linhas = checar(await sb.from('lancamentos').select('data').order('data').limit(1)) as { data: string }[];
  return linhas[0]?.data ?? null;
}

// ---------- resumos ----------

export async function resumoPeriodo(f: Filtros): Promise<ResumoPeriodo> {
  const linhas = checar(await sb.rpc('resumo_periodo', argsFiltro(f))) as ResumoPeriodo[];
  const r = linhas[0];
  return {
    receitas: Number(r?.receitas ?? 0),
    despesas: Number(r?.despesas ?? 0),
    saldo: Number(r?.saldo ?? 0),
    quantidade: Number(r?.quantidade ?? 0),
  };
}

export async function resumoMensal(inicio: string, fim: string): Promise<ResumoMes[]> {
  const linhas = checar(await sb.rpc('resumo_mensal', { p_inicio: inicio, p_fim: fim })) as ResumoMes[];
  return linhas.map((l) => ({ mes: l.mes, receitas: Number(l.receitas), despesas: Number(l.despesas) }));
}

export async function resumoPorCategoria(inicio: string, fim: string, tipo: TipoLancamento): Promise<ResumoCategoria[]> {
  const linhas = checar(await sb.rpc('resumo_por_categoria', { p_inicio: inicio, p_fim: fim, p_tipo: tipo })) as ResumoCategoria[];
  return linhas.map((l) => ({ ...l, total: Number(l.total), quantidade: Number(l.quantidade) }));
}

// ---------- categorias ----------

export async function listarCategorias(): Promise<Categoria[]> {
  const linhas = checar(await sb.from('categorias').select('id, nome, cor')) as Categoria[];
  return linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function salvarCategoria(dados: { nome: string; cor: string }, id?: number): Promise<void> {
  const limpo = { nome: dados.nome.trim(), cor: dados.cor };
  if (id) checar(await sb.from('categorias').update(limpo).eq('id', id).select('id'));
  else checar(await sb.from('categorias').insert(limpo).select('id'));
}

export async function excluirCategoria(id: number): Promise<void> {
  checar(await sb.from('categorias').delete().eq('id', id).select('id'));
}

export async function contarPorCategoria(): Promise<Map<number | null, number>> {
  const r = await resumoPorCategoriaTudo();
  return new Map(r.map((c) => [c.categoria_id, c.quantidade]));
}

async function resumoPorCategoriaTudo(): Promise<ResumoCategoria[]> {
  const [d, r] = await Promise.all([
    resumoPorCategoria('1900-01-01', '2999-12-31', 'despesa'),
    resumoPorCategoria('1900-01-01', '2999-12-31', 'receita'),
  ]);
  const mapa = new Map<number | null, ResumoCategoria>();
  for (const c of [...d, ...r]) {
    const atual = mapa.get(c.categoria_id);
    if (atual) atual.quantidade += c.quantidade;
    else mapa.set(c.categoria_id, { ...c });
  }
  return [...mapa.values()];
}
