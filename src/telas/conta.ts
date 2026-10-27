import { sb, todosLancamentos } from '../api';
import { estado, recarregarCategorias, tratarErro } from '../estado';
import { gerarCsv, gerarSql } from '../exportar';
import { aviso, baixarArquivo, confirmar, el, icone, ocupado } from '../ui/dom';
import type { Tela } from './tela';

const CHAVE_BACKUP = 'penny-ultimo-backup';

function lerUltimoBackup(): string | null {
  try { return localStorage.getItem(CHAVE_BACKUP); } catch { return null; }
}

export function telaConta(): Tela {
  const email = el('strong', {});
  const ultimo = el('p', { class: 'texto-suave' });
  const status = el('p', { class: 'texto-suave', role: 'status' });

  const mostrarUltimo = () => {
    const u = lerUltimoBackup();
    if (!u) { ultimo.textContent = 'Nenhum backup feito neste aparelho ainda.'; return; }
    const dias = Math.floor((Date.now() - new Date(u).getTime()) / 86_400_000);
    ultimo.textContent = `Último backup neste aparelho: ${new Date(u).toLocaleString('pt-BR')}` +
      (dias >= 30 ? ` (há ${dias} dias — faça um novo)` : '');
    ultimo.classList.toggle('alerta', dias >= 30);
  };

  const exportar = (formato: 'sql' | 'csv') => async () => {
    status.textContent = 'Baixando todos os lançamentos…';
    try {
      await recarregarCategorias();
      const linhas = await todosLancamentos({ inicio: null, fim: null, tipo: null, categoria: null, busca: '', valor: null }, true);
      const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      if (formato === 'sql') baixarArquivo(`backup-penny-${carimbo}.sql`, gerarSql(estado.email, estado.categorias, linhas), 'application/sql');
      else baixarArquivo(`backup-penny-${carimbo}.csv`, gerarCsv(estado.categorias, linhas), 'text/csv');
      try { localStorage.setItem(CHAVE_BACKUP, new Date().toISOString()); } catch { /* sem armazenamento */ }
      status.textContent = `${linhas.length} lançamentos e ${estado.categorias.length} categorias exportados.`;
      mostrarUltimo();
    } catch (e) { status.textContent = ''; tratarErro(e); }
  };
  const btnSql = el('button', { type: 'button', class: 'btn primario' }, icone('baixar', 18), 'Exportar SQL');
  const btnCsv = el('button', { type: 'button', class: 'btn' }, icone('baixar', 18), 'Exportar CSV');
  btnSql.addEventListener('click', () => void ocupado(btnSql, exportar('sql')));
  btnCsv.addEventListener('click', () => void ocupado(btnCsv, exportar('csv')));

  const senha1 = el('input', { type: 'password', autocomplete: 'new-password', minlength: 10, required: true });
  const senha2 = el('input', { type: 'password', autocomplete: 'new-password', minlength: 10, required: true });
  const statusSenha = el('p', { class: 'texto-suave', role: 'status' });
  const btnSenha = el('button', { type: 'submit', class: 'btn primario' }, 'Salvar nova senha');
  const formSenha = el('form', { class: 'cartao', novalidate: true },
    el('h2', {}, 'Trocar senha'),
    el('label', { class: 'campo' }, 'Nova senha (mínimo 10 caracteres)', senha1),
    el('label', { class: 'campo' }, 'Repita a nova senha', senha2),
    statusSenha,
    el('div', { class: 'acoes' }, btnSenha),
  );
  formSenha.addEventListener('submit', (e) => {
    e.preventDefault();
    if (senha1.value.length < 10) { statusSenha.textContent = 'Use pelo menos 10 caracteres.'; return; }
    if (senha1.value !== senha2.value) { statusSenha.textContent = 'As senhas não conferem.'; return; }
    void ocupado(btnSenha, async () => {
      const { error } = await sb.auth.updateUser({ password: senha1.value });
      if (error) { statusSenha.textContent = error.message; return; }
      senha1.value = senha2.value = '';
      statusSenha.textContent = '';
      aviso('Senha alterada.');
    });
  });

  const btnSair = el('button', { type: 'button', class: 'btn perigo' }, icone('sair', 18), 'Sair');
  btnSair.addEventListener('click', async () => {
    if (await confirmar({ titulo: 'Sair do Penny?', mensagem: 'Você precisará entrar com e-mail e senha de novo.', confirmar: 'Sair' })) {
      await sb.auth.signOut();
    }
  });

  const elemento = el('section', { class: 'tela' },
    el('div', { class: 'cartao' },
      el('h2', {}, 'Backup'),
      el('p', { class: 'texto-suave' },
        'Baixa todos os seus lançamentos e categorias. O arquivo SQL restaura tudo em um banco novo. ' +
        'Guarde-o num lugar seguro (ex.: Google Drive).'),
      ultimo,
      el('div', { class: 'acoes inicio' }, btnSql, btnCsv),
      status,
    ),
    formSenha,
    el('div', { class: 'cartao' },
      el('p', { class: 'texto-suave' }, 'Conectado como ', email),
      el('div', { class: 'acoes inicio' }, btnSair),
      el('p', { class: 'texto-suave versao' }, `Penny ${__VERSAO__}`),
    ),
  );

  return {
    elemento,
    async carregar() {
      email.textContent = estado.email;
      mostrarUltimo();
    },
  };
}
