import { listarLancamentos, primeiraData, resumoPeriodo, todosLancamentos } from '../api';
import { dataValida, formatarData, hoje, mesAtual, primeiroDia, somarMeses, ultimoDia } from '../datas';
import { estado, tratarErro } from '../estado';
import { gerarCsv } from '../exportar';
import { cartoesTotais, carregando, listaPorDia, painelFiltros } from '../ui/componentes';
import { aviso, baixarArquivo, el, icone, ocupado } from '../ui/dom';
import type { Filtros } from '../tipos';
import type { Tela } from './tela';

const POR_PAGINA = 100;

type Atalho = { rotulo: string; periodo: () => Promise<[string, string]> | [string, string] };

export function telaRelatorio(): Tela {
  let pedido = 0;
  let carregados = 0;
  let total = 0;

  const inicio = el('input', { type: 'date', 'aria-label': 'Data inicial' });
  const fim = el('input', { type: 'date', 'aria-label': 'Data final' });
  const m = mesAtual();
  inicio.value = primeiroDia(m);
  fim.value = hoje();

  const atalhos: Atalho[] = [
    { rotulo: 'Este mês', periodo: () => [primeiroDia(mesAtual()), ultimoDia(mesAtual())] },
    { rotulo: 'Mês passado', periodo: () => { const p = somarMeses(mesAtual(), -1); return [primeiroDia(p), ultimoDia(p)]; } },
    { rotulo: '3 meses', periodo: () => [primeiroDia(somarMeses(mesAtual(), -2)), ultimoDia(mesAtual())] },
    { rotulo: 'Este ano', periodo: () => [`${mesAtual().ano}-01-01`, `${mesAtual().ano}-12-31`] },
    { rotulo: 'Ano passado', periodo: () => [`${mesAtual().ano - 1}-01-01`, `${mesAtual().ano - 1}-12-31`] },
    { rotulo: 'Tudo', periodo: async () => [(await primeiraData()) ?? hoje(), hoje()] },
  ];
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Períodos rápidos' },
    ...atalhos.map((a) => el('button', {
      type: 'button', class: 'chip',
      onclick: async () => {
        try {
          const [i, f] = await a.periodo();
          inicio.value = i;
          fim.value = f;
          void carregar();
        } catch (e) { tratarErro(e); }
      },
    }, a.rotulo)),
  );

  const totais = cartoesTotais();
  const filtros = painelFiltros(() => void carregar());
  const info = el('p', { class: 'resumo-filtro' });
  const lista = listaPorDia();
  const corpo = el('div', { class: 'lista-area' });
  const btnMais = el('button', { type: 'button', class: 'btn largo', hidden: true }, 'Carregar mais');
  const btnCsv = el('button', { type: 'button', class: 'btn pequeno' }, icone('baixar', 16), 'CSV deste relatório');

  inicio.addEventListener('change', () => void carregar());
  fim.addEventListener('change', () => void carregar());

  const filtrosAtuais = (): Filtros => ({
    inicio: dataValida(inicio.value) ? inicio.value : null,
    fim: dataValida(fim.value) ? fim.value : null,
    ...filtros.ler(),
  });

  btnMais.addEventListener('click', () => void ocupado(btnMais, async () => {
    try {
      const { linhas } = await listarLancamentos(filtrosAtuais(), carregados, carregados + POR_PAGINA - 1);
      carregados += linhas.length;
      lista.acrescentar(linhas);
      btnMais.hidden = carregados >= total;
    } catch (e) { tratarErro(e); }
  }));

  btnCsv.addEventListener('click', () => void ocupado(btnCsv, async () => {
    try {
      const f = filtrosAtuais();
      const linhas = await todosLancamentos(f, true);
      baixarArquivo(`relatorio-penny-${f.inicio ?? 'inicio'}-a-${f.fim ?? 'hoje'}.csv`, gerarCsv(estado.categorias, linhas), 'text/csv');
      aviso(`${linhas.length} lançamento(s) exportados.`);
    } catch (e) { tratarErro(e); }
  }));

  const elemento = el('section', { class: 'tela' },
    el('div', { class: 'cartao' },
      el('div', { class: 'linha-campos' },
        el('label', { class: 'campo' }, 'De', inicio),
        el('label', { class: 'campo' }, 'Até', fim),
      ),
      chips,
    ),
    totais.elemento,
    filtros.elemento,
    el('div', { class: 'linha-info' }, info, btnCsv),
    corpo,
    btnMais,
  );

  async function carregar(): Promise<void> {
    const id = ++pedido;
    const f = filtrosAtuais();
    if (f.inicio && f.fim && f.inicio > f.fim) {
      info.textContent = 'A data inicial é depois da final.';
      return;
    }
    corpo.replaceChildren(carregando());
    btnMais.hidden = true;
    try {
      const [resumo, pagina] = await Promise.all([resumoPeriodo(f), listarLancamentos(f, 0, POR_PAGINA - 1)]);
      if (id !== pedido) return;
      totais.atualizar(resumo);
      total = pagina.total;
      carregados = pagina.linhas.length;
      info.textContent = `${f.inicio ? formatarData(f.inicio) : 'Início'} a ${f.fim ? formatarData(f.fim) : 'hoje'} · ` +
        `${resumo.quantidade} lançamento(s)`;
      lista.definir(pagina.linhas);
      corpo.replaceChildren(lista.elemento);
      btnMais.hidden = carregados >= total;
    } catch (e) {
      if (id === pedido) { corpo.replaceChildren(); tratarErro(e); }
    }
  }

  return { elemento, carregar, aoMudarCategorias: () => filtros.atualizarCategorias() };
}
