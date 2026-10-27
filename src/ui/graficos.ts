import { rotuloMes, anoMesDe, rotuloMesCurto } from '../datas';
import { formatarReais, formatarReaisCompacto } from '../dinheiro';
import type { ResumoCategoria, ResumoMes, TipoLancamento } from '../tipos';
import { el, svg } from './dom';
import { pintarCores } from './componentes';

// Paleta validada (dataviz): série 1 = receitas (azul), série 2 = despesas (laranja).
// As cores vêm das variáveis CSS --serie-receita / --serie-despesa (claro e escuro).

const M = { topo: 12, dir: 4, base: 24, esq: 58 };

function tetoBonito(v: number): number {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function barraArredondada(x: number, y: number, w: number, h: number, r = 4): SVGPathElement | null {
  if (h <= 0.5) return null;
  const rr = Math.min(r, h, w / 2);
  return svg('path', {
    d: `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`,
  });
}

/** Barras agrupadas receitas × despesas por mês, com dica ao tocar/passar o mouse e tabela alternativa. */
export function graficoMensal(dados: ResumoMes[], porAno = false, largura = 340): HTMLElement {
  // desenha na largura real do contêiner: 1 unidade do SVG = 1px, texto sempre legível
  const L = Math.max(280, Math.round(largura));
  const A = Math.round(Math.min(280, Math.max(200, L * 0.6)));
  const rotuloCurto = (iso: string) => (porAno ? iso.slice(0, 4) : rotuloMesCurto(iso));
  const rotuloLongo = (iso: string) => (porAno ? iso.slice(0, 4) : rotuloMes(anoMesDe(iso)));
  const max = tetoBonito(Math.max(0, ...dados.flatMap((d) => [d.receitas, d.despesas])));
  const larguraUtil = L - M.esq - M.dir;
  const alturaUtil = A - M.topo - M.base;
  const faixa = larguraUtil / Math.max(dados.length, 1);
  const barra = Math.max(3, Math.min(16, (faixa - 6) / 2 - 1));
  const y = (v: number) => M.topo + alturaUtil - (v / max) * alturaUtil;

  const grafico = svg('svg', {
    viewBox: `0 0 ${L} ${A}`, class: 'grafico', role: 'img',
    'aria-label': `Receitas e despesas por ${porAno ? 'ano' : 'mês'}, de ${rotuloCurto(dados[0]?.mes ?? '')} a ${rotuloCurto(dados.at(-1)?.mes ?? '')}`,
  });

  // grade e eixo y (recessivos)
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    const yy = y(v);
    grafico.append(svg('line', { x1: M.esq, x2: L - M.dir, y1: yy, y2: yy, class: i === 0 ? 'eixo' : 'grade' }));
    const t = svg('text', { x: M.esq - 8, y: yy + 4, 'text-anchor': 'end', class: 'rotulo-eixo' });
    t.textContent = formatarReaisCompacto(v);
    grafico.append(t);
  }

  const passoRotulo = Math.max(1, Math.ceil(dados.length / Math.floor(larguraUtil / 34)));
  const dica = el('div', { class: 'dica', hidden: true, role: 'status' });
  const marcador = svg('rect', { class: 'marcador-faixa', y: M.topo, height: alturaUtil, width: faixa, x: 0, visibility: 'hidden' });
  grafico.append(marcador);

  dados.forEach((d, i) => {
    const x0 = M.esq + i * faixa;
    const centro = x0 + faixa / 2;
    const r = barraArredondada(centro - barra - 1, y(d.receitas), barra, y(0) - y(d.receitas));
    const dsp = barraArredondada(centro + 1, y(d.despesas), barra, y(0) - y(d.despesas));
    if (r) { r.setAttribute('class', 'barra receita'); grafico.append(r); }
    if (dsp) { dsp.setAttribute('class', 'barra despesa'); grafico.append(dsp); }

    if (i % passoRotulo === 0) {
      const t = svg('text', { x: centro, y: A - 8, 'text-anchor': 'middle', class: 'rotulo-eixo' });
      t.textContent = rotuloCurto(d.mes);
      grafico.append(t);
    }

    // área de toque maior que as barras
    const alvo = svg('rect', { x: x0, y: M.topo, width: faixa, height: alturaUtil + M.base, class: 'alvo' });
    const mostrar = () => {
      marcador.setAttribute('x', String(x0));
      marcador.setAttribute('visibility', 'visible');
      const saldo = d.receitas - d.despesas;
      dica.replaceChildren(
        el('strong', {}, rotuloLongo(d.mes)),
        el('span', {}, el('i', { class: 'marca receita' }), 'Receitas ', el('b', {}, formatarReais(d.receitas))),
        el('span', {}, el('i', { class: 'marca despesa' }), 'Despesas ', el('b', {}, formatarReais(d.despesas))),
        el('span', {}, 'Saldo ', el('b', { class: saldo < 0 ? 'negativo' : '' }, formatarReais(saldo))),
      );
      dica.hidden = false;
      // mantém a dica inteira dentro do gráfico
      const larg = dica.offsetWidth;
      dica.style.left = `${Math.min(Math.max(centro - larg / 2, 0), Math.max(L - larg, 0))}px`;
    };
    alvo.addEventListener('pointerenter', mostrar);
    alvo.addEventListener('click', mostrar);
    grafico.append(alvo);
  });

  grafico.addEventListener('pointerleave', (e) => {
    if ((e as PointerEvent).pointerType === 'mouse') { dica.hidden = true; marcador.setAttribute('visibility', 'hidden'); }
  });

  const legenda = el('div', { class: 'legenda' },
    el('span', {}, el('i', { class: 'marca receita' }), 'Receitas'),
    el('span', {}, el('i', { class: 'marca despesa' }), 'Despesas'),
  );

  const tabela = el('table', { class: 'tabela' },
    el('thead', {}, el('tr', {}, el('th', {}, porAno ? 'Ano' : 'Mês'), el('th', {}, 'Receitas'), el('th', {}, 'Despesas'), el('th', {}, 'Saldo'))),
    el('tbody', {}, ...dados.map((d) => el('tr', {},
      el('td', {}, rotuloCurto(d.mes)),
      el('td', {}, formatarReais(d.receitas)),
      el('td', {}, formatarReais(d.despesas)),
      el('td', { class: d.receitas - d.despesas < 0 ? 'negativo' : '' }, formatarReais(d.receitas - d.despesas)),
    ))),
  );

  return el('div', { class: 'grafico-bloco' },
    legenda,
    el('div', { class: 'grafico-area' }, grafico, dica),
    el('details', { class: 'ver-tabela' }, el('summary', {}, 'Ver como tabela'), el('div', { class: 'tabela-rolagem' }, tabela)),
  );
}

/** Barras horizontais por categoria: um tom só (o da série), nome e valor escritos em cada linha. */
export function graficoCategorias(dados: ResumoCategoria[], tipo: TipoLancamento): HTMLElement {
  if (!dados.length) return el('p', { class: 'vazio' }, 'Nenhum lançamento no período.');
  const total = dados.reduce((s, d) => s + d.total, 0);
  const max = Math.max(...dados.map((d) => d.total));
  const lista = el('ul', { class: 'barras-h' }, ...dados.map((d) => {
    const pct = total ? (d.total / total) * 100 : 0;
    const preenchimento = el('span', { class: 'barra-h-fill ' + tipo });
    preenchimento.style.width = `${max ? Math.max((d.total / max) * 100, 0.5) : 0}%`;
    return el('li', { class: 'barra-h', title: `${d.quantidade} lançamento(s)` },
      el('span', { class: 'barra-h-nome' }, el('i', { class: 'item-cor', 'data-cor': d.cor }), d.nome),
      el('span', { class: 'barra-h-valor' }, formatarReais(d.total), el('small', {}, ` ${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)),
      el('span', { class: 'barra-h-trilho' }, preenchimento),
    );
  }));
  pintarCores(lista);
  return lista;
}

/** Soma meses em anos (para períodos longos). */
export function agruparPorAno(meses: ResumoMes[]): ResumoMes[] {
  const anos = new Map<string, ResumoMes>();
  for (const m of meses) {
    const chave = m.mes.slice(0, 4) + '-01-01';
    const a = anos.get(chave) ?? { mes: chave, receitas: 0, despesas: 0 };
    a.receitas = Math.round((a.receitas + m.receitas) * 100) / 100;
    a.despesas = Math.round((a.despesas + m.despesas) * 100) / 100;
    anos.set(chave, a);
  }
  return [...anos.values()];
}
