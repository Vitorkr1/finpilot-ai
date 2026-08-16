// ==========================================================================
// FinPilot AI — app.js (utilitários compartilhados do frontend)
// ==========================================================================

function fpToast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast-fp ${type === 'success' ? 'toast-success' : 'toast-error'}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Lê o token CSRF injetado pelo servidor numa <meta> tag no <head>.
// Usado em toda requisição que muda dado (POST/PUT/DELETE) — sem ele, o
// servidor rejeita com 403 (proteção contra CSRF via double-submit cookie).
function fpCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

async function fpFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  const opts = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(needsCsrf ? { 'X-CSRF-Token': fpCsrfToken() } : {}),
      ...(options.headers || {})
    },
    credentials: 'same-origin'
  };
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);

  let res = await fetch(url, opts);

  // Access token expirado: tenta renovar uma vez
  if (res.status === 401 && !url.includes('/api/auth/')) {
    const refresh = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
    if (refresh.ok) {
      res = await fetch(url, opts);
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Ocorreu um erro. Tente novamente.');
  }
  return data;
}

// Escapa texto controlado pelo usuário antes de inseri-lo via innerHTML,
// evitando XSS (ex: descrição de transação, nome de banco, título de meta,
// respostas da IA). Sempre usar ao montar HTML dinâmico com dados vindos da API.
function fpEscapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fpFormatCurrency(value) {
  return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fpFormatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

// ---------- Logout ----------
document.addEventListener('click', async (e) => {
  if (e.target.closest('#logoutBtn')) {
    try {
      await fpFetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (err) {
      fpToast(err.message, 'error');
    }
  }
});

// ---------- Tema ----------
function fpApplyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
  localStorage.setItem('fp-theme', theme);
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-theme-set]');
  if (btn) {
    const theme = btn.getAttribute('data-theme-set');
    fpApplyTheme(theme);
    fpFetch('/api/users/me', { method: 'PUT', body: { theme } }).catch(() => {});
  }
});

// ---------- Loading state em formulários ----------
function fpSetLoading(button, loading) {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Aguarde...';
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || button.innerHTML;
  }
}

// ---------- Sino de notificações (roda em toda página logada) ----------
(function fpInitNotificationBell() {
  const badge = document.getElementById('notifBadge');
  const dropdown = document.getElementById('notifDropdown');
  if (!badge || !dropdown) return; // página sem sidebar (login, registro etc.)

  const SEVERITY_COLOR = { danger: 'var(--danger)', warning: '#B45309' };

  async function loadNotifications() {
    try {
      const data = await fpFetch('/api/notifications');
      if (data.count > 0) {
        badge.textContent = data.count > 9 ? '9+' : String(data.count);
        badge.classList.remove('d-none');
      } else {
        badge.classList.add('d-none');
      }

      if (data.notifications.length === 0) {
        dropdown.innerHTML = '<p style="padding:0.75rem 1rem;margin:0;color:var(--text-muted);font-size:0.85rem;">Tudo em dia por aqui. 🎉</p>';
        return;
      }

      dropdown.innerHTML = data.notifications.map((n) => `
        <a href="${fpEscapeHtml(n.link)}" class="dropdown-item" style="white-space:normal;padding:0.6rem 1rem;border-bottom:1px solid var(--border);">
          <div style="font-weight:600;font-size:0.82rem;color:${SEVERITY_COLOR[n.severity] || 'inherit'};">${fpEscapeHtml(n.title)}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);">${fpEscapeHtml(n.message)}</div>
        </a>
      `).join('');
    } catch {
      dropdown.innerHTML = '<p style="padding:0.75rem 1rem;margin:0;color:var(--text-muted);font-size:0.85rem;">Não foi possível carregar.</p>';
    }
  }

  loadNotifications();
  setInterval(loadNotifications, 5 * 60 * 1000); // atualiza a cada 5 min sem precisar recarregar a página
})();

// ---------- PWA: registra o service worker (instalável) ----------
// O sw.js é propositalmente vazio de cache — só existe pra satisfazer o
// critério de "instalável" do navegador, sem risco de servir versão antiga
// do app depois de um deploy (ver comentário em public/sw.js).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
