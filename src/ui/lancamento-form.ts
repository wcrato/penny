import { descricoesRecentes, excluirLancamento, salvarLancamento } from '../api';
import { dataValida, formatarData, hoje } from '../datas';
import { centavosParaCampo, formatarReais, lerValor, paraCentavos } from '../dinheiro';
import { categoriaPorId, dadosAlterados, estado, tratarErro } from '../estado';
import type { Lancamento, TipoLancamento } from '../tipos';
import { abrirDialogo, aviso, confirmar, el, icone, ocupado } from './dom';

type Sugestoes = Awaited<ReturnType<typeof descricoesRecentes>>;
let sugestoes: Promise<Sugestoes> | null = null;

export function esquecerSugestoes(): void {
  sugestoes = null;
}

export function seletorCategoria(valor: number | null, opts: { incluirTodas?: boolean } = {}): HTMLSelectElement {
  const s = el('select', { 'aria-label': 'Categoria' });
  if (opts.incluirTodas) s.add(new Option('Todas as categorias', ''));
  s.add(new Option('Sem categoria', opts.incluirTodas ? '0' : ''));
  for (const c of estado.categorias) s.add(new Option(c.nome, String(c.id)));
  s.value = valor == null ? '' : String(valor);
  return s;
}

/** Abre o formulário de novo lançamento (sem argumento) ou de edição. */
export function abrirLancamento(atual?: Lancamento): void {
  const editando = Boolean(atual);
  let tipo: TipoLancamento = atual?.tipo ?? 'despesa';

  const btnDespesa = el('button', { type: 'button', class: 'segmento', 'aria-pressed': 'false' }, 'Despesa');
  const btnReceita = el('button', { type: 'button', class: 'segmento', 'aria-pressed': 'false' }, 'Receita');
  const marcarTipo = (t: TipoLancamento) => {
    tipo = t;
    btnDespesa.setAttribute('aria-pressed', String(t === 'despesa'));
    btnReceita.setAttribute('aria-pressed', String(t === 'receita'));
    form.dataset.tipo = t;
  };
  btnDespesa.addEventListener('click', () => marcarTipo('despesa'));
  btnReceita.addEventListener('click', () => marcarTipo('receita'));

  const campoValor = el('input', {
    type: 'text', inputmode: 'decimal', autocomplete: 'off', required: true, placeholder: '0,00',
    class: 'campo-valor', 'aria-label': 'Valor em reais',
    value: atual ? centavosParaCampo(paraCentavos(atual.valor)) : '',
  });
  const listaId = 'sugestoes-descricao';
  const campoDescricao = el('input', {
    type: 'text', maxlength: 255, required: true, autocomplete: 'off', list: listaId,
    value: atual?.descricao ?? '', placeholder: 'Ex.: Supermercado',
  });
  const datalist = el('datalist', { id: listaId });
  const campoData = el('input', { type: 'date', required: true, value: atual?.data ?? hoje() });
  const campoCategoria = seletorCategoria(atual?.categoria_id ?? null);
  const erro = el('p', { class: 'erro', role: 'alert', hidden: true });

  // Sugestões: ao escolher uma descrição já usada, preenche a última categoria usada com ela
  sugestoes ??= descricoesRecentes().catch(() => new Map() as Sugestoes);
  void sugestoes.then((mapa) => {
    datalist.replaceChildren(...[...mapa.values()].slice(0, 300).map((s) => el('option', { value: s.descricao })));
  });
  campoDescricao.addEventListener('change', async () => {
    const s = (await sugestoes)?.get(campoDescricao.value.trim().toLowerCase());
    if (s && !campoCategoria.value && s.categoria_id && categoriaPorId(s.categoria_id)) {
      campoCategoria.value = String(s.categoria_id);
    }
  });

  const btnSalvar = el('button', { type: 'submit', class: 'btn primario' }, editando ? 'Salvar alterações' : 'Adicionar');
  const btnExcluir = editando
    ? el('button', { type: 'button', class: 'btn perigo', 'aria-label': 'Excluir lançamento' }, icone('lixeira', 18), 'Excluir')
    : null;

  const form = el('form', { class: 'dialogo-corpo form-lancamento', novalidate: true },
    el('div', { class: 'dialogo-topo' },
      el('h2', {}, editando ? 'Editar lançamento' : 'Novo lançamento'),
      el('button', { type: 'button', class: 'btn-icone', 'aria-label': 'Fechar', onclick: () => fechar() }, icone('fechar')),
    ),
    el('div', { class: 'segmentos', role: 'group', 'aria-label': 'Tipo' }, btnDespesa, btnReceita),
    el('label', { class: 'campo' }, 'Valor (R$)', campoValor),
    el('label', { class: 'campo' }, 'Descrição', campoDescricao, datalist),
    el('div', { class: 'linha-campos' },
      el('label', { class: 'campo' }, 'Data', campoData),
      el('label', { class: 'campo' }, 'Categoria', campoCategoria),
    ),
    erro,
    el('div', { class: 'acoes' }, btnExcluir, el('span', { class: 'espaco' }), btnSalvar),
  );
  marcarTipo(tipo);

  const mostrarErro = (msg: string, campo?: HTMLElement) => {
    erro.textContent = msg;
    erro.hidden = false;
    campo?.focus();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    erro.hidden = true;
    const centavos = lerValor(campoValor.value);
    const descricao = campoDescricao.value.trim();
    // zero só é aceito ao editar um dos lançamentos antigos que já eram zero
    const zeroPermitido = atual != null && paraCentavos(atual.valor) === 0;
    if (centavos == null || (centavos === 0 && !zeroPermitido)) {
      return mostrarErro('Informe um valor maior que zero. Ex.: 12,50', campoValor);
    }
    if (!descricao) return mostrarErro('Informe uma descrição.', campoDescricao);
    if (!dataValida(campoData.value)) return mostrarErro('Informe uma data válida.', campoData);

    void ocupado(btnSalvar, async () => {
      try {
        await salvarLancamento({
          tipo, valor: centavos / 100, descricao, data: campoData.value,
          categoria_id: campoCategoria.value ? Number(campoCategoria.value) : null,
        }, atual?.id);
        esquecerSugestoes();
        fechar();
        aviso(editando ? 'Lançamento atualizado.' : 'Lançamento adicionado.');
        dadosAlterados();
      } catch (err) { tratarErro(err); }
    });
  });

  btnExcluir?.addEventListener('click', async () => {
    if (!atual) return;
    const ok = await confirmar({
      titulo: 'Excluir lançamento?',
      mensagem: `"${atual.descricao || '(sem descrição)'}" — ${formatarReais(atual.valor)} em ${formatarData(atual.data)}. ` +
        'Esta operação não pode ser desfeita.',
      confirmar: 'Excluir definitivamente',
      perigo: true,
    });
    if (!ok) return;
    await ocupado(btnExcluir, async () => {
      try {
        await excluirLancamento(atual.id);
        esquecerSugestoes();
        fechar();
        aviso('Lançamento excluído.');
        dadosAlterados();
      } catch (err) { tratarErro(err); }
    });
  });

  const fechar = abrirDialogo(form);
  if (!editando) campoValor.focus();
}
