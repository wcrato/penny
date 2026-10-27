import { rotuloDia } from '../datas';
import { formatarReais, lerValor } from '../dinheiro';
import { categoriaPorId } from '../estado';
import type { Filtros, Lancamento, ResumoPeriodo, TipoLancamento } from '../tipos';
import { debounce, el, icone } from './dom';
import { abrirLancamento, seletorCategoria } from './lancamento-form';

// ---------- totais ----------

export function cartoesTotais(): { elemento: HTMLElement; atualizar: (r: ResumoPeriodo | null) => void } {
  const valor = (cls: string) => el('strong', { class: 'total-valor ' + cls }, '—');
  const vR = valor('receita');
  const vD = valor('despesa');
  const vS = valor('saldo');
  const elemento = el('div', { class: 'totais' },
    el('div', { class: 'total' }, el('span', { class: 'total-rotulo' }, el('i', { class: 'marca receita' }), 'Receitas'), vR),
    el('div', { class: 'total' }, el('span', { class: 'total-rotulo' }, el('i', { class: 'marca despesa' }), 'Despesas'), vD),
    el('div', { class: 'total destaque' }, el('span', { class: 'total-rotulo' }, 'Saldo'), vS),
  );
  return {
    elemento,
    atualizar(r) {
      vR.textContent = r ? formatarReais(r.receitas) : '—';
      vD.textContent = r ? formatarReais(r.despesas) : '—';
      vS.textContent = r ? formatarReais(r.saldo) : '—';
      vS.classList.toggle('negativo', !!r && r.saldo < 0);
    },
  };
}

// ---------- lista ----------

function itemLancamento(l: Lancamento): HTMLElement {
  const cat = categoriaPorId(l.categoria_id);
  return el('li', {},
    el('button', { type: 'button', class: 'item', onclick: () => abrirLancamento(l) },
      el('i', { class: 'item-cor', 'data-cor': cat?.cor ?? '' }),
      el('span', { class: 'item-texto' },
        el('span', { class: 'item-desc' }, l.descricao || '(sem descrição)'),
        el('span', { class: 'item-cat' }, cat?.nome ?? 'Sem categoria'),
      ),
      el('span', { class: 'item-valor ' + l.tipo }, (l.tipo === 'receita' ? '+ ' : '− ') + formatarReais(l.valor)),
    ),
  );
}

/** Pinta as bolinhas de categoria (cor vem de dado, por isso via CSSOM e não atributo style). */
function pintarCores(raiz: HTMLElement): void {
  raiz.querySelectorAll<HTMLElement>('[data-cor]').forEach((e) => {
    const cor = e.dataset.cor;
    if (cor && /^#[0-9a-f]{6}$/i.test(cor)) e.style.backgroundColor = cor;
    else e.classList.add('sem-cor');
  });
}

/** Lista agrupada por dia, com subtotal do dia. `acrescentar` continua o último grupo. */
export function listaPorDia(): { elemento: HTMLElement; definir: (l: Lancamento[]) => void; acrescentar: (l: Lancamento[]) => void } {
  const elemento = el('div', { class: 'lista-dias' });
  let ultimoDia = '';
  let ultimoGrupo: HTMLUListElement | null = null;
  let ultimoSaldo = 0;
  let ultimoRotuloSaldo: HTMLElement | null = null;

  const acrescentar = (linhas: Lancamento[]) => {
    for (const l of linhas) {
      if (l.data !== ultimoDia || !ultimoGrupo) {
        ultimoDia = l.data;
        ultimoSaldo = 0;
        ultimoRotuloSaldo = el('span', { class: 'dia-saldo' });
        ultimoGrupo = el('ul', { class: 'lista' });
        elemento.append(el('section', { class: 'dia' },
          el('h3', { class: 'dia-topo' }, el('span', {}, rotuloDia(l.data)), ultimoRotuloSaldo),
          ultimoGrupo));
      }
      ultimoSaldo += (l.tipo === 'receita' ? 1 : -1) * Math.round(l.valor * 100);
      if (ultimoRotuloSaldo) ultimoRotuloSaldo.textContent = formatarReais(ultimoSaldo / 100);
      const item = itemLancamento(l);
      ultimoGrupo.append(item);
      pintarCores(item);
    }
  };

  return {
    elemento,
    definir(linhas) {
      elemento.replaceChildren();
      ultimoDia = '';
      ultimoGrupo = null;
      if (!linhas.length) elemento.append(el('p', { class: 'vazio' }, 'Nenhum lançamento encontrado.'));
      acrescentar(linhas);
    },
    acrescentar,
  };
}

export { pintarCores };

// ---------- filtros ----------

export interface PainelFiltros {
  elemento: HTMLElement;
  ler: () => Pick<Filtros, 'tipo' | 'categoria' | 'busca' | 'valor'>;
  limpar: () => void;
  atualizarCategorias: () => void;
  ativos: () => number;
}

export function painelFiltros(aoMudar: () => void): PainelFiltros {
  const busca = el('input', { type: 'search', placeholder: 'Buscar na descrição', 'aria-label': 'Buscar na descrição', enterkeyhint: 'search' });
  const valor = el('input', { type: 'text', inputmode: 'decimal', placeholder: 'Valor exato', 'aria-label': 'Valor exato' });
  const tipo = el('select', { 'aria-label': 'Tipo' });
  tipo.add(new Option('Receitas e despesas', ''));
  tipo.add(new Option('Só receitas', 'receita'));
  tipo.add(new Option('Só despesas', 'despesa'));
  let categoria = seletorCategoria(null, { incluirTodas: true });
  const contador = el('span', { class: 'contador', hidden: true });
  const btnLimpar = el('button', { type: 'button', class: 'btn pequeno' }, 'Limpar filtros');

  const disparar = debounce(() => { atualizarContador(); aoMudar(); }, 350);
  const ligar = () => {
    categoria.addEventListener('change', () => { atualizarContador(); aoMudar(); });
  };
  busca.addEventListener('input', disparar);
  valor.addEventListener('input', disparar);
  tipo.addEventListener('change', () => { atualizarContador(); aoMudar(); });
  ligar();

  const grade = el('div', { class: 'filtros-grade' }, busca, valor, tipo, categoria, btnLimpar);
  const detalhes = el('details', { class: 'filtros' },
    el('summary', {}, icone('filtro', 18), 'Filtros', contador),
    grade,
  );

  const ler = () => {
    const centavos = valor.value.trim() ? lerValor(valor.value) : null;
    return {
      busca: busca.value,
      valor: centavos == null ? null : centavos / 100,
      tipo: (tipo.value || null) as TipoLancamento | null,
      categoria: categoria.value === '' ? null : Number(categoria.value),
    };
  };
  const ativos = () => {
    const f = ler();
    return [f.busca.trim(), f.valor != null, f.tipo, f.categoria != null].filter(Boolean).length;
  };
  const atualizarContador = () => {
    const n = ativos();
    contador.textContent = String(n);
    contador.hidden = n === 0;
    valor.classList.toggle('invalido', valor.value.trim() !== '' && lerValor(valor.value) == null);
  };
  const limpar = () => {
    busca.value = '';
    valor.value = '';
    tipo.value = '';
    categoria.value = '';
    atualizarContador();
  };
  btnLimpar.addEventListener('click', () => { limpar(); aoMudar(); });

  return {
    elemento: detalhes,
    ler,
    limpar,
    ativos,
    atualizarCategorias() {
      const atual = categoria.value;
      const novo = seletorCategoria(null, { incluirTodas: true });
      novo.value = [...novo.options].some((o) => o.value === atual) ? atual : '';
      categoria.replaceWith(novo);
      categoria = novo;
      ligar();
    },
  };
}

export function carregando(): HTMLElement {
  return el('div', { class: 'carregando', role: 'status' }, el('span', { class: 'giro' }), 'Carregando…');
}
