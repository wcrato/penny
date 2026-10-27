import './estilo.css';
import { configurado, sb } from './api';
import { aoAlterarDados, estado, recarregarCategorias, tratarErro } from './estado';
import { telaCategorias } from './telas/categorias';
import { telaConta } from './telas/conta';
import { telaGraficos } from './telas/graficos';
import { telaInicio } from './telas/inicio';
import { telaLogin } from './telas/login';
import { telaRelatorio } from './telas/relatorio';
import type { Tela } from './telas/tela';
import { el, icone } from './ui/dom';
import { esquecerSugestoes } from './ui/lancamento-form';

const raiz = document.getElementById('app')!;

type NomeAba = 'inicio' | 'relatorio' | 'graficos' | 'categorias' | 'conta';
const ABAS: { nome: NomeAba; rotulo: string; criar: () => Tela }[] = [
  { nome: 'inicio', rotulo: 'Início', criar: telaInicio },
  { nome: 'relatorio', rotulo: 'Relatório', criar: telaRelatorio },
  { nome: 'graficos', rotulo: 'Gráficos', criar: telaGraficos },
  { nome: 'categorias', rotulo: 'Categorias', criar: telaCategorias },
  { nome: 'conta', rotulo: 'Conta', criar: telaConta },
];

// undefined = ainda não sabemos; null = sem sessão (precisa distinguir para desenhar o login)
let usuarioAtual: string | null | undefined = undefined;
let desligarOuvinte: (() => void) | null = null;

function montarApp(): void {
  const telas = new Map<NomeAba, Tela>();
  const desatualizadas = new Set<NomeAba>();
  let ativa: NomeAba = 'inicio';
  const conteudo = el('main', { class: 'conteudo', id: 'conteudo' });
  const titulo = el('h1', { class: 'topo-titulo' });

  const botoes = ABAS.map((a) => el('button', {
    type: 'button', class: 'nav-item', 'data-aba': a.nome, 'aria-label': a.rotulo,
    onclick: () => abrir(a.nome),
  }, icone(a.nome), el('span', {}, a.rotulo)));

  function abrir(nome: NomeAba): void {
    ativa = nome;
    const def = ABAS.find((a) => a.nome === nome)!;
    let tela = telas.get(nome);
    const nova = !tela;
    if (!tela) { tela = def.criar(); telas.set(nome, tela); }
    titulo.textContent = def.rotulo === 'Início' ? 'SysFin' : def.rotulo;
    botoes.forEach((b) => b.toggleAttribute('aria-current', b.dataset.aba === nome));
    conteudo.replaceChildren(tela.elemento);
    window.scrollTo({ top: 0 });
    if (nova || desatualizadas.has(nome)) {
      desatualizadas.delete(nome);
      void tela.carregar();
    }
  }

  // quando algo muda, recarrega a aba visível e marca as outras para recarregar ao abrir
  desligarOuvinte?.();
  desligarOuvinte = aoAlterarDados(() => {
    for (const [nome, tela] of telas) {
      tela.aoMudarCategorias?.();
      if (nome === ativa) void tela.carregar();
      else desatualizadas.add(nome);
    }
  });

  raiz.replaceChildren(
    el('header', { class: 'topo' }, titulo),
    conteudo,
    el('nav', { class: 'nav', 'aria-label': 'Navegação principal' }, ...botoes),
  );
  abrir('inicio');
}

async function entrar(email: string): Promise<void> {
  estado.email = email;
  raiz.replaceChildren(el('div', { class: 'carregando tela-cheia' }, el('span', { class: 'giro' }), 'Carregando…'));
  try {
    await recarregarCategorias();
  } catch (e) { tratarErro(e); }
  montarApp();
}

function sair(): void {
  estado.email = '';
  estado.categorias = [];
  esquecerSugestoes();
  desligarOuvinte?.();
  desligarOuvinte = null;
  document.querySelectorAll('dialog').forEach((d) => d.remove());
  raiz.replaceChildren(telaLogin());
}

if (!configurado) {
  raiz.replaceChildren(el('main', { class: 'login' }, el('p', { class: 'erro' },
    'App não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.')));
} else {
  sb.auth.onAuthStateChange((_evento, sessao) => {
    const id = sessao?.user.id ?? null;
    if (id === usuarioAtual) return; // renovação de token: nada muda na tela
    usuarioAtual = id;
    // não chamar a API dentro do callback (recomendação da supabase-js)
    window.setTimeout(() => (sessao ? void entrar(sessao.user.email ?? '') : sair()), 0);
  });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('sw.js'));
}
