export type TipoLancamento = 'receita' | 'despesa';

export interface Lancamento {
  id: number;
  user_id: string;
  data: string; // 'AAAA-MM-DD'
  tipo: TipoLancamento;
  valor: number;
  descricao: string;
  categoria_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface NovoLancamento {
  data: string;
  tipo: TipoLancamento;
  valor: number; // reais com 2 casas
  descricao: string;
  categoria_id: number | null;
}

export interface Categoria {
  id: number;
  nome: string;
  cor: string;
}

/** null = todas; 0 = sem categoria; >0 = a categoria */
export type FiltroCategoria = number | null;

export interface Filtros {
  inicio: string | null;
  fim: string | null;
  tipo: TipoLancamento | null;
  categoria: FiltroCategoria;
  busca: string;
  valor: number | null; // reais
}

export interface ResumoPeriodo {
  receitas: number;
  despesas: number;
  saldo: number;
  quantidade: number;
}

export interface ResumoMes {
  mes: string; // 'AAAA-MM-01'
  receitas: number;
  despesas: number;
}

export interface ResumoCategoria {
  categoria_id: number | null;
  nome: string;
  cor: string;
  total: number;
  quantidade: number;
}
