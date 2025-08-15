/* =====================================================================
   PROJETO: Sistema de Biblioteca Comunitária
   ARQUIVO: scripts.js (FRONT)
   FUNÇÃO: Login 1 clique, proteção de páginas e integração com a API
           • Usuários: Status + Excluir
           • Livros:   Status + Excluir
           • Empréstimos: dias corridos/restantes + Reagendar (calendário)
   ===================================================================== */

(() => {
  "use strict";

  // [1] UTILIDADES DOM
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const setText = (el, txt) => {
    if (el) el.textContent = txt;
  };

  // [2] AUTENTICAÇÃO (protótipo)
  const AUTH_KEY = "biblioteca.auth.user";
  function setAuth(userObj, remember) {
    const t = remember ? localStorage : sessionStorage;
    t.setItem(AUTH_KEY, JSON.stringify(userObj));
    (remember ? sessionStorage : localStorage).removeItem(AUTH_KEY);
  }
  function getAuth() {
    const raw =
      sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function clearAuth() {
    sessionStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_KEY);
  }
  const isAuthenticated = () => !!getAuth();

  // [3] LOGIN rápido
  function quickLogin() {
    setAuth({ username: "Bibliotecário", loginAt: Date.now() }, false);
    window.location.href = "menu.html";
  }

  // [4] Proteção de rotas
  const PROTECTED = new Set([
    "page-menu",
    "page-usuarios",
    "page-livros",
    "page-novo-emprestimo",
    "page-emprestimos",
  ]);
  function enforceAuthOnCurrentPage() {
    const isProtected = [...document.body.classList].some((c) =>
      PROTECTED.has(c)
    );
    if (isProtected && !isAuthenticated()) {
      window.location.replace("index.html");
      return false;
    }
    return true;
  }

  // [5] MENU
  function initMenu() {
    const user = getAuth();
    setText($("#user-badge"), user?.username || "Bibliotecário");
    [
      ["#btn-usuarios", "usuario.html"],
      ["#btn-livros", "livros.html"],
      ["#btn-novo-emp", "novo_emprestimo.html"],
      ["#btn-emp", "emprestimo.html"],
    ].forEach(([sel, href]) => {
      const el = $(sel);
      if (el) el.addEventListener("click", () => (window.location.href = href));
    });
    $("#btn-logout")?.addEventListener("click", () => {
      clearAuth();
      window.location.href = "index.html";
    });
  }

  // [6] Novo Empréstimo: datas padrão
  function initNovoEmprestimo() {
    const todayISO = new Date().toISOString().slice(0, 10);
    const plusDays = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };
    if ($("#retirada") && !$("#retirada").value)
      $("#retirada").value = todayISO;
    if ($("#devolucao") && !$("#devolucao").value)
      $("#devolucao").value = plusDays(7);
  }

  // [7] Visuais
  function setCurrentYear() {
    setText($("#ano-atual"), String(new Date().getFullYear()));
  }

  // [8] Bootstrap
  document.addEventListener("DOMContentLoaded", () => {
    setCurrentYear();
    const body = document.body;

    if (body.classList.contains("page-login")) {
      $("#btn-login")?.addEventListener("click", quickLogin);
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          quickLogin();
        }
      });
      return;
    }

    if (!enforceAuthOnCurrentPage()) return;

    if (body.classList.contains("page-menu")) initMenu();
    if (body.classList.contains("page-novo-emprestimo")) {
      initNovoEmprestimo();
      initNovoEmprestimoIntegrado();
    }
    if (body.classList.contains("page-usuarios")) initUsuariosPage();
    if (body.classList.contains("page-livros")) initLivrosPage();
    if (body.classList.contains("page-emprestimos")) initEmprestimosPage();
  });

  // [9] API
  const API = "http://localhost:3000/api";
  async function api(method, path, data) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (data) opts.body = JSON.stringify(data);
    let res;
    try {
      res = await fetch(API + path, opts);
    } catch {
      throw new Error(
        "Não foi possível conectar à API. Verifique se o backend está rodando."
      );
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        json?.detail || json?.error || res.statusText || "Erro de rede";
      throw new Error(msg);
    }
    return json;
  }

  // ---------------------------------------------------------------------
  // [10] USUÁRIOS  (Status + Excluir)
  // ---------------------------------------------------------------------
  async function loadUsuarios() {
    const list = await api("GET", "/usuarios");
    const tbody = $("#userTable tbody");
    if (!tbody) return;
    tbody.innerHTML =
      list
        .map(
          (u) => `
      <tr>
        <td>${u.id}</td>
        <td>${u.nome}</td>
        <td>${u.email}</td>
        <td>—</td>
        <td>Leitor</td>
        <td>
          <button class="btn btn--ghost"  data-action="status-user" data-id="${u.id}">Status</button>
          <button class="btn btn--danger" data-action="del-user"    data-id="${u.id}">Excluir</button>
        </td>
      </tr>`
        )
        .join("") || '<tr><td colspan="6">Nenhum usuário.</td></tr>';
  }

  function initUsuariosPage() {
    const form = $("#userForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btnSubmit = form.querySelector('button[type="submit"]');
        const nome = $("#nome")?.value.trim();
        const email = $("#email")?.value.trim();
        if (!nome) return alert("Informe o nome.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          return alert("E-mail inválido.");
        try {
          if (btnSubmit) btnSubmit.disabled = true;
          await api("POST", "/usuarios", { nome, email });
          alert("Usuário salvo!");
          form.reset();
          await loadUsuarios();
        } catch (err) {
          alert("Erro ao salvar: " + (err.message || err));
        } finally {
          if (btnSubmit) btnSubmit.disabled = false;
        }
      });
    }

    const table = $("#userTable");
    if (table) {
      table.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        if (!id) return alert("ID inválido.");

        if (action === "status-user") {
          try {
            btn.disabled = true;
            const r = await api("GET", `/usuarios/${id}/resumo-emprestimos`);
            const linhas = [
              `Usuário #${id} — RESUMO DE EMPRÉSTIMOS:`,
              `• Ativos: ${r.Ativo}`,
              `• Atrasados: ${r.Atrasado}`,
              `• Devolvidos: ${r.Devolvido}`,
              `• Total: ${r.total}`,
              "",
              r.pode_excluir
                ? "→ Este usuário não possui empréstimos vinculados (poderia ser excluído)."
                : "→ Este usuário possui empréstimos vinculados (exclusão bloqueada).",
            ];
            alert(linhas.join("\n"));
          } catch (err) {
            alert("Erro ao consultar status: " + (err.message || err));
          } finally {
            btn.disabled = false;
          }
          return;
        }

        if (action === "del-user") {
          if (!confirm(`Excluir usuário #${id}?`)) return;
          try {
            btn.disabled = true;
            const res = await fetch(`${API}/usuarios/${id}`, {
              method: "DELETE",
            });

            if (res.status === 409) {
              const j = await res.json().catch(() => ({}));
              return alert(j.error || "Usuário com empréstimos vinculados.");
            }
            if (!res.ok) {
              let msg = "Falha ao excluir";
              try {
                const j = await res.json();
                msg = j.error || j.detail || msg;
              } catch {}
              throw new Error(msg);
            }

            await loadUsuarios();
          } catch (err) {
            alert("Erro: " + (err.message || err));
          } finally {
            btn.disabled = false;
          }
        }
      });
    }

    loadUsuarios();
  }

  // ---------------------------------------------------------------------
  // [11] LIVROS  (Status + Excluir)
  // ---------------------------------------------------------------------
  async function loadLivros() {
    const list = await api("GET", "/livros");
    const tbody = $("#bookTable tbody");
    if (!tbody) return;
    tbody.innerHTML =
      list
        .map(
          (l) => `
      <tr>
        <td>${l.id}</td>
        <td>${l.titulo}</td>
        <td>${l.autor}</td>
        <td>—</td>
        <td>${l.ano}</td>
        <td>${l.categoria}</td>
        <td>—</td>
        <td>
          <button class="btn btn--ghost"  data-action="status-book" data-id="${l.id}">Status</button>
          <button class="btn btn--danger" data-action="del-book"   data-id="${l.id}">Excluir</button>
        </td>
      </tr>`
        )
        .join("") || '<tr><td colspan="8">Nenhum livro.</td></tr>';
  }

  function initLivrosPage() {
    const form = $("#bookForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btnSubmit = form.querySelector('button[type="submit"]');
        const payload = {
          titulo: $("#titulo")?.value.trim(),
          autor: $("#autor")?.value.trim(),
          categoria: $("#categoria")?.value.trim(),
          ano: Number($("#ano")?.value),
        };
        if (!payload.titulo || !payload.autor || !payload.categoria)
          return alert("Título, Autor e Categoria são obrigatórios.");
        if (
          !Number.isInteger(payload.ano) ||
          payload.ano < 0 ||
          payload.ano > 2100
        )
          return alert("Ano inválido (0–2100).");
        try {
          if (btnSubmit) btnSubmit.disabled = true;
          await api("POST", "/livros", payload);
          alert("Livro salvo!");
          form.reset();
          await loadLivros();
        } catch (err) {
          alert("Erro: " + err.message);
        } finally {
          if (btnSubmit) btnSubmit.disabled = false;
        }
      });
    }

    const table = $("#bookTable");
    if (table) {
      table.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        if (!id) return alert("ID inválido.");

        if (action === "status-book") {
          try {
            btn.disabled = true;
            const r = await api("GET", `/livros/${id}/resumo-emprestimos`);
            const linhas = [
              `Livro #${id} — RESUMO DE EMPRÉSTIMOS:`,
              `• Ativos: ${r.Ativo}`,
              `• Atrasados: ${r.Atrasado}`,
              `• Devolvidos: ${r.Devolvido}`,
              `• Total: ${r.total}`,
              "",
              r.pode_excluir
                ? "→ Este livro não possui empréstimos vinculados (poderia ser excluído)."
                : "→ Este livro possui empréstimos vinculados (exclusão bloqueada).",
            ];
            alert(linhas.join("\n"));
          } catch (err) {
            alert("Erro ao consultar status: " + (err.message || err));
          } finally {
            btn.disabled = false;
          }
          return;
        }

        if (action === "del-book") {
          if (!confirm(`Excluir livro #${id}?`)) return;
          try {
            btn.disabled = true;
            const res = await fetch(`${API}/livros/${id}`, {
              method: "DELETE",
            });

            if (res.status === 409) {
              const j = await res.json().catch(() => ({}));
              return alert(j.error || "Livro com empréstimos vinculados.");
            }
            if (!res.ok) {
              let msg = "Falha ao excluir";
              try {
                const j = await res.json();
                msg = j.error || j.detail || msg;
              } catch {}
              throw new Error(msg);
            }

            await loadLivros();
          } catch (err) {
            alert("Erro: " + (err.message || err));
          } finally {
            btn.disabled = false;
          }
        }
      });
    }

    loadLivros();
  }

  // ---------------------------------------------------------------------
  // [12] NOVO EMPRÉSTIMO (preenche selects e mensagem da data)
  // ---------------------------------------------------------------------
  async function fillEmprestimoSelects() {
    const [usuarios, livros] = await Promise.all([
      api("GET", "/usuarios"),
      api("GET", "/livros"),
    ]);
    const su = $("#usuario"),
      sl = $("#livro");
    if (su)
      su.innerHTML =
        '<option value="">Selecione...</option>' +
        usuarios
          .map((u) => `<option value="${u.id}">${u.nome}</option>`)
          .join("");
    if (sl)
      sl.innerHTML =
        '<option value="">Selecione...</option>' +
        livros
          .map(
            (l) => `<option value="${l.id}">${l.titulo} (${l.autor})</option>`
          )
          .join("");
  }

  function diasEntre(aISO, bISO) {
    const a = new Date(aISO + "T00:00:00"),
      b = new Date(bISO + "T00:00:00");
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  }
  function wireInfoDevolucao() {
    const input = $("#devolucao");
    if (!input) return;
    let info = $("#devolucao-info");
    if (!info) {
      info = document.createElement("small");
      info.id = "devolucao-info";
      info.style.display = "block";
      info.style.opacity = "0.8";
      input.insertAdjacentElement("afterend", info);
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const update = () => {
      const val = input.value || hoje;
      const d = diasEntre(hoje, val);
      info.textContent =
        d >= 0
          ? `Devolver em ${val} (faltam ${d} dia(s))`
          : `Data no passado (${Math.abs(d)} dia(s))`;
    };
    input.addEventListener("change", update);
    update();
  }

  function initNovoEmprestimoIntegrado() {
    fillEmprestimoSelects().catch((err) =>
      alert("Erro ao carregar listas: " + err.message)
    );
    wireInfoDevolucao(); // só exibe info; o input date já existe no seu formulário

    const form = $("#loanForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const usuario_id = $("#usuario")?.value;
        const livro_id = $("#livro")?.value;
        const data_prevista = $("#devolucao")?.value;
        if (!usuario_id || !livro_id || !data_prevista)
          return alert("Escolha usuário, livro e a data prevista.");
        try {
          await api("POST", "/emprestimos", {
            usuario_id,
            livro_id,
            data_prevista,
          });
          alert("Empréstimo registrado!");
          form.reset();
          initNovoEmprestimo();
          await fillEmprestimoSelects();
        } catch (err) {
          alert("Erro: " + err.message);
        }
      });
    }
  }

  // ---------------------------------------------------------------------
  // [13] GERENCIAR EMPRÉSTIMOS (dias + reagendar calendário)
  // ---------------------------------------------------------------------
  // mini-modal simples para escolher uma data
  function pickDateDialog(valorInicial) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "modal-pickdate";
      wrap.innerHTML = `
        <div class="modal-pickdate__box">
          <h3>Escolher nova data prevista</h3>
          <input type="date" id="pickdate-input" />
          <div class="modal-pickdate__actions">
            <button id="pickdate-ok" class="btn">OK</button>
            <button id="pickdate-cancel" class="btn btn--ghost">Cancelar</button>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
      const inp = wrap.querySelector("#pickdate-input");
      inp.value = valorInicial || new Date().toISOString().slice(0, 10);
      inp.focus();
      const close = (val) => {
        wrap.remove();
        resolve(val);
      };
      wrap.querySelector("#pickdate-ok").onclick = () => close(inp.value);
      wrap.querySelector("#pickdate-cancel").onclick = () => close(null);
      wrap.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close(null);
      });
    });
  }

  async function loadEmprestimos(status = "") {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const list = await api("GET", "/emprestimos" + qs);
    const tbody = $("#loanTable tbody");
    if (!tbody) return;
    tbody.innerHTML =
      list
        .map((e) => {
          const restTxt =
            e.dias_restantes > 0
              ? `${e.dias_restantes}d restantes`
              : e.dias_restantes === 0
              ? "vence hoje"
              : `${Math.abs(e.dias_restantes)}d em atraso`;
          return `
        <tr>
          <td>${e.id}</td>
          <td>${e.usuario_nome}</td>
          <td>${e.livro_titulo}</td>
          <td>${e.data_emprestimo}</td>
          <td>${e.data_prevista}${
            e.data_devolucao
              ? `<br><small>devolvido em ${e.data_devolucao}</small>`
              : ""
          }</td>
          <td>
            ${e.status}
            <br><small>${e.dias_corridos}d corridos · ${restTxt}</small>
          </td>
          <td>
            <button class="btn btn--ghost" data-action="devolver"  data-id="${
              e.id
            }">Marcar Devolvido</button>
            <button class="btn btn--ghost" data-action="renovar"   data-id="${
              e.id
            }">Renovar (+7)</button>
            <button class="btn btn--ghost" data-action="reagendar" data-id="${
              e.id
            }" data-prev="${e.data_prevista}">Reagendar data</button>
          </td>
        </tr>
      `;
        })
        .join("") || '<tr><td colspan="7">Nenhum empréstimo.</td></tr>';
  }

  function initEmprestimosPage() {
    const select = $("#status");
    if (select)
      select.addEventListener("change", () => loadEmprestimos(select.value));
    const table = $("#loanTable");
    if (table) {
      table.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("button[data-action]");
        if (!btn) return;
        const id = btn.getAttribute("data-id");
        const action = btn.getAttribute("data-action");

        try {
          if (action === "devolver") {
            await api("PATCH", `/emprestimos/${id}`, { action: "devolver" });
          } else if (action === "renovar") {
            await api("PATCH", `/emprestimos/${id}`, {
              action: "renovar",
              days: 7,
            });
          } else if (action === "reagendar") {
            const prev = btn.getAttribute("data-prev");
            const nova = await pickDateDialog(prev);
            if (!nova) return;
            await api("PATCH", `/emprestimos/${id}`, {
              action: "reagendar",
              nova_data: nova,
            });
          }
          await loadEmprestimos(select?.value || "");
        } catch (err) {
          alert("Erro: " + err.message);
        }
      });
    }
    loadEmprestimos(select?.value || "");
  }
})();
