import { ErroApi, listarCategorias, sb } from './api';
import type { Categoria } from './tipos';
import { aviso } from './ui/dom';

export const estado = {
  email: '',
  categorias: [] as Categoria[],
};

export async function recarregarCategorias(): Promise<void> {
  estado.categorias = await listarCategorias();
}

export function categoriaPorId(id: number | null): Categoria | undefined {
  return id == null ? undefined : estado.categorias.find((c) => c.id === id);
}

// Avisa as telas quando lançamentos ou categorias mudam, para recarregarem.
const ouvintes = new Set<() => void>();

export function aoAlterarDados(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function dadosAlterados(): void {
  for (const fn of ouvintes) fn();
}

export function tratarErro(e: unknown): void {
  console.error(e);
  if (e instanceof ErroApi && e.sessaoExpirada) {
    aviso('Sua sessão expirou. Entre novamente.', 'erro');
    void sb.auth.signOut();
    return;
  }
  const msg = e instanceof Error ? e.message : 'Erro inesperado.';
  aviso(/Failed to fetch|NetworkError|Load failed/i.test(msg) ? 'Sem conexão com a internet.' : msg, 'erro');
}
