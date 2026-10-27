import { primeiraData, resumoMensal, resumoPorCategoria } from '../api';
import { hoje, mesAtual, primeiroDia, somarMeses, ultimoDia } from '../datas';
import { tratarErro } from '../estado';
import type { TipoLancamento } from '../tipos';
import { carregando } from '../ui/componentes';
import { el } from '../ui/dom';
import { agruparPorAno, graficoCategorias, graficoMensal } from '../ui/graficos';
import type { Tela } from './tela';

type Periodo = '12m' | 'ano' | 'ano-passado' | 'tudo';

export function telaGraficos(): Tela {
  let pedido = 0;
  let tipoCategoria: TipoLancamento = 'despesa';

  const periodo = el('select', { 'aria-label': 'Período dos gráficos' });
  periodo.add(new Option('Últimos 12 meses', '12m'));
  periodo.add(new Option('Este ano', 'ano'));
  periodo.add(new Option('Ano passado', 'ano-passado'));
  periodo.add(new Option('Tudo (por ano)', 'tudo'));
  periodo.addEventListener('change', () => void carregar());

  const areaMensal = el('div', {});
  const areaCategorias = el('div', {});
  const tituloCategorias = el('h2', {}, 'Despesas por categoria');

  const btnDesp = el('button', { type: 'button', class: 'segmento', 'aria-pressed': 'true' }, 'Despesas');
  const btnRec = el('button', { type: 'button', class: 'segmento', 'aria-pressed': 'false' }, 'Receitas');
  const trocar = (t: TipoLancamento) => {
    tipoCategoria = t;
    btnDesp.setAttribute('aria-pressed', String(t === 'despesa'));
    btnRec.setAttribute('aria-pressed', String(t === 'receita'));
    tituloCategorias.textContent = t === 'despesa' ? 'Despesas por categoria' : 'Receitas por categoria';
    void carregar();
  };
  btnDesp.addEventListener('click', () => trocar('despesa'));
  btnRec.addEventListener('click', () => trocar('receita'));

  const tituloMensal = el('h2', {}, 'Receitas × despesas');
  const elemento = el('section', { class: 'tela' },
    el('div', { class: 'barra-filtro' }, periodo),
    el('div', { class: 'cartao' }, tituloMensal, areaMensal),
    el('div', { class: 'cartao' },
      el('div', { class: 'cartao-topo' }, tituloCategorias,
        el('div', { class: 'segmentos pequenos', role: 'group', 'aria-label': 'Tipo' }, btnDesp, btnRec)),
      areaCategorias,
    ),
  );

  async function intervalo(): Promise<[string, string]> {
    const m = mesAtual();
    switch (periodo.value as Periodo) {
      case 'ano': return [`${m.ano}-01-01`, `${m.ano}-12-31`];
      case 'ano-passado': return [`${m.ano - 1}-01-01`, `${m.ano - 1}-12-31`];
      case 'tudo': return [(await primeiraData()) ?? hoje(), ultimoDia(m)];
      default: return [primeiroDia(somarMeses(m, -11)), ultimoDia(m)];
    }
  }

  async function carregar(): Promise<void> {
    const id = ++pedido;
    areaMensal.replaceChildren(carregando());
    areaCategorias.replaceChildren(carregando());
    try {
      const [ini, fim] = await intervalo();
      const [meses, cats] = await Promise.all([resumoMensal(ini, fim), resumoPorCategoria(ini, fim, tipoCategoria)]);
      if (id !== pedido) return;
      const porAno = periodo.value === 'tudo';
      tituloMensal.textContent = porAno ? 'Receitas × despesas por ano' : 'Receitas × despesas por mês';
      areaMensal.replaceChildren(graficoMensal(porAno ? agruparPorAno(meses) : meses, porAno, areaMensal.clientWidth || 340));
      areaCategorias.replaceChildren(graficoCategorias(cats, tipoCategoria));
    } catch (e) {
      if (id === pedido) { areaMensal.replaceChildren(); areaCategorias.replaceChildren(); tratarErro(e); }
    }
  }

  return { elemento, carregar };
}
