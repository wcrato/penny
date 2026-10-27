import { resumoPeriodo, todosLancamentos } from '../api';
import { type AnoMes, mesAtual, primeiroDia, rotuloMes, somarMeses, ultimoDia } from '../datas';
import { formatarReais } from '../dinheiro';
import { tratarErro } from '../estado';
import { cartoesTotais, carregando, listaPorDia, painelFiltros } from '../ui/componentes';
import { el, icone } from '../ui/dom';
import { abrirLancamento } from '../ui/lancamento-form';
import type { Tela } from './tela';

export function telaInicio(): Tela {
  let mes: AnoMes = mesAtual();
  let pedido = 0;

  const seletorMes = el('input', { type: 'month', class: 'mes-input', 'aria-label': 'Escolher mês' });
  const titulo = el('span', { class: 'mes-titulo' });
  const totais = cartoesTotais();
  const filtros = painelFiltros(() => void carregar());
  const resumoFiltro = el('p', { class: 'resumo-filtro', hidden: true });
  const lista = listaPorDia();
  const corpo = el('div', { class: 'lista-area' });

  const irPara = (novo: AnoMes) => { mes = novo; void carregar(); };
  seletorMes.addEventListener('change', () => {
    const [a, m] = seletorMes.value.split('-').map(Number);
    if (a && m) irPara({ ano: a, mes: m });
  });

  const elemento = el('section', { class: 'tela' },
    el('div', { class: 'mes-nav' },
      el('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Mês anterior', onclick: () => irPara(somarMeses(mes, -1)) }, icone('anterior')),
      el('label', { class: 'mes-rotulo' }, titulo, seletorMes),
      el('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Próximo mês', onclick: () => irPara(somarMeses(mes, 1)) }, icone('proximo')),
    ),
    totais.elemento,
    filtros.elemento,
    resumoFiltro,
    corpo,
    el('button', { type: 'button', class: 'fab', 'aria-label': 'Novo lançamento', onclick: () => abrirLancamento() }, icone('mais', 28)),
  );

  async function carregar(): Promise<void> {
    const id = ++pedido;
    titulo.textContent = rotuloMes(mes);
    seletorMes.value = `${mes.ano}-${String(mes.mes).padStart(2, '0')}`;
    const periodo = { inicio: primeiroDia(mes), fim: ultimoDia(mes) };
    const f = { ...periodo, ...filtros.ler() };
    if (!corpo.contains(lista.elemento)) corpo.replaceChildren(carregando());
    try {
      // totais do mês ignoram os filtros; a lista e o resumo filtrado respeitam
      const [doMes, linhas, filtrado] = await Promise.all([
        resumoPeriodo({ ...periodo, tipo: null, categoria: null, busca: '', valor: null }),
        todosLancamentos(f),
        filtros.ativos() ? resumoPeriodo(f) : Promise.resolve(null),
      ]);
      if (id !== pedido) return;
      totais.atualizar(doMes);
      resumoFiltro.hidden = !filtrado;
      if (filtrado) {
        resumoFiltro.textContent = `Filtro: ${filtrado.quantidade} lançamento(s) · receitas ${formatarReais(filtrado.receitas)} · ` +
          `despesas ${formatarReais(filtrado.despesas)}`;
      }
      lista.definir(linhas);
      corpo.replaceChildren(lista.elemento);
    } catch (e) {
      if (id === pedido) { corpo.replaceChildren(); tratarErro(e); }
    }
  }

  return {
    elemento,
    carregar,
    aoMudarCategorias: () => filtros.atualizarCategorias(),
  };
}
