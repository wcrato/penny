import { sb } from '../api';
import { el, ocupado } from '../ui/dom';

export function telaLogin(): HTMLElement {
  const email = el('input', { type: 'email', autocomplete: 'username', required: true, inputmode: 'email' });
  const senha = el('input', { type: 'password', autocomplete: 'current-password', required: true });
  const erro = el('p', { class: 'erro', role: 'alert', hidden: true });
  const btn = el('button', { type: 'submit', class: 'btn primario largo' }, 'Entrar');

  const form = el('form', { class: 'login-cartao', novalidate: true },
    el('img', { src: 'icons/icon-192.png', alt: '', class: 'login-logo', width: 72, height: 72 }),
    el('h1', {}, 'Penny'),
    el('p', { class: 'texto-suave' }, 'Controle financeiro pessoal'),
    el('label', { class: 'campo' }, 'E-mail', email),
    el('label', { class: 'campo' }, 'Senha', senha),
    erro,
    btn,
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    erro.hidden = true;
    if (!email.value.trim() || !senha.value) {
      erro.textContent = 'Informe e-mail e senha.';
      erro.hidden = false;
      return;
    }
    void ocupado(btn, async () => {
      const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: senha.value });
      senha.value = '';
      if (error) {
        erro.textContent = error.status === 400 ? 'E-mail ou senha incorretos.'
          : error.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.'
          : /fetch/i.test(error.message) ? 'Sem conexão com a internet.' : error.message;
        erro.hidden = false;
        senha.focus();
      }
    });
  });

  return el('main', { class: 'login' }, form);
}
