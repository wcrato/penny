// Utilitários de interface. Regra de segurança: textos do usuário entram sempre
// por textContent (nunca innerHTML), então uma descrição não consegue injetar código.

type Filho = Node | string | null | undefined | false;
type Atributos = Record<string, string | number | boolean | null | undefined | EventListener>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Atributos = {}, ...filhos: Filho[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = String(v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, String(v));
  }
  e.append(...filhos.filter((f): f is Node | string => f != null && f !== false));
  return e;
}

const SVG = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K, attrs: Record<string, string | number> = {}, ...filhos: (SVGElement | null)[]
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  for (const f of filhos) if (f) e.append(f);
  return e;
}

// Ícones de traço simples (24x24), desenhados com paths próprios
const ICONES: Record<string, string[]> = {
  inicio: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M10 21v-6h4v6'],
  relatorio: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3.5 6h.01', 'M3.5 12h.01', 'M3.5 18h.01'],
  graficos: ['M3 3v18h18', 'M8 17v-6', 'M13 17V7', 'M18 17v-3'],
  categorias: ['M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z', 'M7.5 7.5h.01'],
  conta: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
  mais: ['M12 5v14', 'M5 12h14'],
  anterior: ['M15 18l-6-6 6-6'],
  proximo: ['M9 18l6-6-6-6'],
  filtro: ['M3 5h18l-7 8v6l-4 2v-8z'],
  fechar: ['M6 6l12 12', 'M18 6 6 18'],
  lixeira: ['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 14h10l1-14'],
  editar: ['M4 20h4L19 9l-4-4L4 16z'],
  baixar: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 21h16'],
  sair: ['M15 4h4v16h-4', 'M10 8l-4 4 4 4', 'M6 12h10'],
};

export function icone(nome: keyof typeof ICONES | string, tamanho = 22): SVGSVGElement {
  const s = svg('svg', {
    viewBox: '0 0 24 24', width: tamanho, height: tamanho, fill: 'none', stroke: 'currentColor',
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  });
  for (const d of ICONES[nome] ?? []) s.append(svg('path', { d }));
  return s;
}

// ---------- aviso (toast) ----------

let avisoTimer: number | undefined;

export function aviso(mensagem: string, tipo: 'ok' | 'erro' = 'ok'): void {
  let a = document.getElementById('aviso');
  if (!a) {
    a = el('div', { id: 'aviso', role: 'status', 'aria-live': 'polite' });
    document.body.append(a);
  }
  a.textContent = mensagem;
  a.className = 'aviso visivel ' + tipo;
  window.clearTimeout(avisoTimer);
  avisoTimer = window.setTimeout(() => a?.classList.remove('visivel'), tipo === 'erro' ? 6000 : 3000);
}

// ---------- diálogos ----------

/** Abre um <dialog> modal e devolve uma função para fechá-lo. Remove-se ao fechar. */
export function abrirDialogo(conteudo: HTMLElement, aoFechar?: () => void): () => void {
  const d = el('dialog', { class: 'dialogo' }, conteudo);
  d.addEventListener('close', () => { d.remove(); aoFechar?.(); });
  // toque fora do conteúdo fecha
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  document.body.append(d);
  d.showModal();
  return () => d.close();
}

/** Confirmação em duas etapas. Resolve true só se o usuário confirmar. */
export function confirmar(opts: { titulo: string; mensagem: string; confirmar: string; perigo?: boolean }): Promise<boolean> {
  return new Promise((resolver) => {
    let resposta = false;
    const btnOk = el('button', { class: 'btn ' + (opts.perigo ? 'perigo-cheio' : 'primario'), type: 'button' }, opts.confirmar);
    const btnCancelar = el('button', { class: 'btn', type: 'button' }, 'Cancelar');
    const fechar = abrirDialogo(el('div', { class: 'dialogo-corpo' },
      el('h2', {}, opts.titulo),
      el('p', { class: 'texto-suave' }, opts.mensagem),
      el('div', { class: 'acoes' }, btnCancelar, btnOk),
    ), () => resolver(resposta));
    btnCancelar.addEventListener('click', fechar);
    btnOk.addEventListener('click', () => { resposta = true; fechar(); });
    btnCancelar.focus();
  });
}

export function baixarArquivo(nome: string, conteudo: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = el('a', { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms = 350): (...a: A) => void {
  let t: number | undefined;
  return (...a: A) => { window.clearTimeout(t); t = window.setTimeout(() => fn(...a), ms); };
}

/** Desabilita o botão enquanto a promessa roda (evita clique duplo salvando duas vezes). */
export async function ocupado<T>(botao: HTMLButtonElement, tarefa: () => Promise<T>): Promise<T> {
  botao.disabled = true;
  botao.setAttribute('aria-busy', 'true');
  try {
    return await tarefa();
  } finally {
    botao.disabled = false;
    botao.removeAttribute('aria-busy');
  }
}
