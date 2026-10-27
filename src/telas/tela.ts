export interface Tela {
  elemento: HTMLElement;
  /** Busca os dados e redesenha. Chamado ao abrir a aba e quando os dados mudam. */
  carregar: () => Promise<void>;
  aoMudarCategorias?: () => void;
}
