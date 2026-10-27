import { contarPorCategoria, excluirCategoria, salvarCategoria } from '../api';
import { dadosAlterados, estado, recarregarCategorias, tratarErro } from '../estado';
import type { Categoria } from '../tipos';
import { carregando, pintarCores } from '../ui/componentes';
import { abrirDialogo, aviso, confirmar, el, icone, ocupado } from '../ui/dom';
import type { Tela } from './tela';

export const CORES = ['#ea580c', '#2563eb', '#dc2626', '#0891b2', '#a16207', '#7c3aed',
  '#be185d', '#db2777', '#16a34a', '#64748b', '#059669', '#0d9488'];

// as mesmas categorias criadas na migração, para contas novas não começarem vazias
const SUGERIDAS: [string, string][] = [
  ['Alimentação', '#ea580c'], ['Transporte', '#2563eb'], ['Saúde', '#dc2626'], ['Contas da casa', '#0891b2'],
  ['Moradia', '#a16207'], ['Educação', '#7c3aed'], ['Cartão de crédito', '#be185d'], ['Pessoal', '#db2777'],
  ['Família', '#16a34a'], ['Outros', '#64748b'], ['Salário', '#059669'], ['Outras receitas', '#0d9488'],
];

function botaoSugeridas(): HTMLButtonElement {
  const btn = el('button', { type: 'button', class: 'btn primario' }, 'Criar categorias sugeridas');
  btn.addEventListener('click', () => void ocupado(btn, async () => {
    try {
      for (const [nome, cor] of SUGERIDAS) await salvarCategoria({ nome, cor });
      await recarregarCategorias();
      aviso(`${SUGERIDAS.length} categorias criadas.`);
      dadosAlterados();
    } catch (e) { tratarErro(e); }
  }));
  return btn;
}

function abrirCategoria(atual?: Categoria): void {
  let cor = atual?.cor ?? CORES[0]!;
  const nome = el('input', { type: 'text', maxlength: 50, required: true, value: atual?.nome ?? '', autocomplete: 'off' });
  const erro = el('p', { class: 'erro', role: 'alert', hidden: true });
  const amostras = el('div', { class: 'amostras', role: 'radiogroup', 'aria-label': 'Cor' },
    ...CORES.map((c) => {
      const b = el('button', { type: 'button', class: 'amostra', role: 'radio', 'aria-checked': String(c === cor), 'aria-label': c, 'data-cor': c });
      b.addEventListener('click', () => {
        cor = c;
        amostras.querySelectorAll('.amostra').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      });
      return b;
    }));
  pintarCores(amostras);
  const btnSalvar = el('button', { type: 'submit', class: 'btn primario' }, atual ? 'Salvar' : 'Criar categoria');

  const form = el('form', { class: 'dialogo-corpo', novalidate: true },
    el('h2', {}, atual ? 'Editar categoria' : 'Nova categoria'),
    el('label', { class: 'campo' }, 'Nome', nome),
    el('div', { class: 'campo' }, 'Cor', amostras),
    erro,
    el('div', { class: 'acoes' }, el('button', { type: 'button', class: 'btn', onclick: () => fechar() }, 'Cancelar'), btnSalvar),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!nome.value.trim()) { erro.textContent = 'Informe o nome.'; erro.hidden = false; nome.focus(); return; }
    void ocupado(btnSalvar, async () => {
      try {
        await salvarCategoria({ nome: nome.value, cor }, atual?.id);
        await recarregarCategorias();
        fechar();
        aviso(atual ? 'Categoria atualizada.' : 'Categoria criada.');
        dadosAlterados();
      } catch (err) {
        erro.textContent = err instanceof Error ? err.message : 'Erro ao salvar.';
        erro.hidden = false;
      }
    });
  });
  const fechar = abrirDialogo(form);
  nome.focus();
}

export function telaCategorias(): Tela {
  const corpo = el('div', {});
  const elemento = el('section', { class: 'tela' },
    el('div', { class: 'cartao' },
      el('div', { class: 'cartao-topo' },
        el('h2', {}, 'Categorias'),
        el('button', { type: 'button', class: 'btn primario pequeno', onclick: () => abrirCategoria() }, icone('mais', 16), 'Nova'),
      ),
      el('p', { class: 'texto-suave' }, 'Excluir uma categoria não apaga lançamentos: eles ficam "Sem categoria".'),
      corpo,
    ),
  );

  async function carregar(): Promise<void> {
    corpo.replaceChildren(carregando());
    try {
      const [contagem] = await Promise.all([contarPorCategoria(), recarregarCategorias()]);
      const linhas = estado.categorias.map((c) => {
        const n = contagem.get(c.id) ?? 0;
        const btnExcluir = el('button', { type: 'button', class: 'btn-icone perigo', 'aria-label': `Excluir ${c.nome}` }, icone('lixeira', 18));
        btnExcluir.addEventListener('click', async () => {
          const ok = await confirmar({
            titulo: `Excluir "${c.nome}"?`,
            mensagem: n ? `${n} lançamento(s) ficarão sem categoria. Nenhum lançamento será apagado.` : 'Nenhum lançamento usa esta categoria.',
            confirmar: 'Excluir categoria', perigo: true,
          });
          if (!ok) return;
          try {
            await excluirCategoria(c.id);
            await recarregarCategorias();
            aviso('Categoria excluída.');
            dadosAlterados();
          } catch (e) { tratarErro(e); }
        });
        return el('li', { class: 'categoria-linha' },
          el('button', { type: 'button', class: 'categoria-botao', onclick: () => abrirCategoria(c) },
            el('i', { class: 'item-cor', 'data-cor': c.cor }),
            el('span', { class: 'item-texto' }, el('span', { class: 'item-desc' }, c.nome),
              el('span', { class: 'item-cat' }, `${n} lançamento(s)`)),
            icone('editar', 18),
          ),
          btnExcluir,
        );
      });
      const semCat = contagem.get(null) ?? 0;
      const lista = el('ul', { class: 'lista' }, ...linhas);
      pintarCores(lista);
      corpo.replaceChildren(
        estado.categorias.length ? lista : el('div', { class: 'vazio' },
          el('p', {}, 'Nenhuma categoria ainda.'), botaoSugeridas()),
        semCat ? el('p', { class: 'texto-suave' }, `${semCat} lançamento(s) sem categoria.`) : '',
      );
    } catch (e) { corpo.replaceChildren(); tratarErro(e); }
  }

  return { elemento, carregar };
}
