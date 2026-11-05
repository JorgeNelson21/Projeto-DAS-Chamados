'use strict';

/* =====================================================================
   Sistema de Chamados – front-end
   Telas conforme o mapa de telas do guia: Dashboard, Clientes,
   Categorias, Técnicos, Chamados (lista/filtros/novo) e Detalhe do
   Chamado (status, técnico e comentários).
   ===================================================================== */

const STATUS = {
  ABERTO: 'Aberto',
  EM_ATENDIMENTO: 'Em atendimento',
  AGUARDANDO_CLIENTE: 'Aguardando cliente',
  FECHADO: 'Fechado'
};
const PRIORIDADE = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' };
const PERFIL = { ADMIN: 'Administrador', TECNICO: 'Técnico' };

const ORDENACOES = {
  'dataAbertura,desc': 'Mais recentes',
  'dataAbertura,asc': 'Mais antigos',
  'titulo,asc': 'Título (A–Z)',
  'titulo,desc': 'Título (Z–A)'
};

/* ---------------------------------------------------------------------
   Utilitários
   --------------------------------------------------------------------- */
const $view = () => document.getElementById('view');

function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmtData(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (isNaN(d)) return esc(valor);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const badgeStatus = s => `<span class="badge status-${esc(s)}">${esc(STATUS[s] || s)}</span>`;
const badgePrioridade = p => `<span class="badge prio-${esc(p)}">${esc(PRIORIDADE[p] || p)}</span>`;
const badgePerfil = p => `<span class="badge perfil-${esc(p)}">${esc(PERFIL[p] || p)}</span>`;

function opcoes(mapa, selecionado, textoVazio) {
  const vazio = textoVazio !== undefined ? `<option value="">${esc(textoVazio)}</option>` : '';
  return vazio + Object.entries(mapa).map(([valor, texto]) =>
    `<option value="${esc(valor)}" ${String(valor) === String(selecionado ?? '') ? 'selected' : ''}>${esc(texto)}</option>`
  ).join('');
}

function lista(itens, chave, rotulo) {
  return Object.fromEntries(itens.map(i => [i[chave], rotulo(i)]));
}

/** Navega alterando o hash; parâmetros vazios são omitidos. */
function irPara(caminho, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  ).toString();
  const destino = '#' + caminho + (qs ? '?' + qs : '');
  if (location.hash === destino) rotear(); else location.hash = destino;
}

/* ---------------------------------------------------------------------
   Notificações (toasts)
   --------------------------------------------------------------------- */
function toast(mensagem, tipo = 'ok') {
  const area = document.getElementById('toasts');
  while (area.children.length >= 3) area.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = mensagem;
  area.appendChild(el);
  setTimeout(() => el.classList.add('saindo'), 3200);
  setTimeout(() => el.remove(), 3600);
}

/* ---------------------------------------------------------------------
   Formulários: leitura e exibição dos erros da API
   --------------------------------------------------------------------- */
function lerForm(form) {
  const dados = {};
  for (const [campo, valor] of new FormData(form)) {
    const texto = typeof valor === 'string' ? valor.trim() : valor;
    dados[campo] = texto === '' ? null : texto;
  }
  form.querySelectorAll('[data-num]').forEach(el => {
    if (dados[el.name] !== null && dados[el.name] !== undefined) dados[el.name] = Number(dados[el.name]);
  });
  return dados;
}

function limparErros(form) {
  form.querySelectorAll('.invalido').forEach(el => el.classList.remove('invalido'));
  form.querySelectorAll('.field-erro').forEach(el => { el.textContent = ''; });
  const caixa = form.querySelector('.form-erro');
  if (caixa) { caixa.hidden = true; caixa.innerHTML = ''; }
}

/**
 * Erros de validação chegam como "campo: mensagem" em detalhes[].
 * Cada um é exibido embaixo do campo correspondente; o restante vai
 * para a caixa de erro do formulário.
 */
function mostrarErros(form, erro) {
  const soltos = [];
  for (const detalhe of erro.detalhes || []) {
    const [campo, ...resto] = String(detalhe).split(':');
    const input = form.querySelector(`[name="${CSS.escape(campo.trim())}"]`);
    const alvo = input && input.closest('.field') && input.closest('.field').querySelector('.field-erro');
    if (alvo) {
      input.classList.add('invalido');
      alvo.textContent = resto.join(':').trim();
    } else {
      soltos.push(detalhe);
    }
  }
  const caixa = form.querySelector('.form-erro');
  if (!caixa) { toast(erro.message, 'erro'); return; }
  const mostrarTitulo = !(erro.detalhes || []).length || soltos.length;
  if (mostrarTitulo || soltos.length) {
    caixa.innerHTML = `<strong>${esc(erro.message)}</strong>` +
      (soltos.length ? `<ul>${soltos.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '');
    caixa.hidden = false;
  }
}

/** Liga um formulário à API: desabilita o botão, limpa e mostra erros. */
function aoEnviar(form, acao) {
  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    const botao = form.querySelector('[type="submit"]');
    if (botao) botao.disabled = true;
    limparErros(form);
    try {
      await acao(lerForm(form));
    } catch (erro) {
      mostrarErros(form, erro);
    } finally {
      if (botao && botao.isConnected) botao.disabled = false;
    }
  });
}

function campo(def, valor) {
  const v = valor ?? '';
  const id = `f-${def.name}`;
  const obrigatorio = def.obrigatorio ? ' <span class="req">*</span>' : '';
  const max = def.max ? `maxlength="${def.max}"` : '';
  let entrada;
  if (def.tipo === 'textarea') {
    entrada = `<textarea id="${id}" name="${def.name}" rows="${def.linhas || 3}" ${max}>${esc(v)}</textarea>`;
  } else if (def.tipo === 'select') {
    entrada = `<select id="${id}" name="${def.name}" ${def.numero ? 'data-num' : ''}>
      ${opcoes(def.opcoes, v, 'Selecione…')}
    </select>`;
  } else {
    entrada = `<input id="${id}" name="${def.name}" type="${def.tipo || 'text'}" value="${esc(v)}" ${max}
      ${def.placeholder ? `placeholder="${esc(def.placeholder)}"` : ''}>`;
  }
  return `<div class="field ${def.largo ? 'field-largo' : ''}">
    <label for="${id}">${esc(def.label)}${obrigatorio}</label>
    ${entrada}
    <small class="field-erro"></small>
  </div>`;
}

/* ---------------------------------------------------------------------
   Modal
   --------------------------------------------------------------------- */
function abrirModal({ titulo, corpo, textoBotao = 'Salvar', classeBotao = 'btn-primary', aoConfirmar }) {
  const raiz = document.getElementById('modal-root');
  raiz.innerHTML = `
    <div class="modal-fundo">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <form novalidate>
          <header class="modal-topo">
            <h2 id="modal-titulo">${esc(titulo)}</h2>
            <button type="button" class="btn-icone" data-fechar aria-label="Fechar">×</button>
          </header>
          <div class="modal-corpo">
            ${corpo}
            <div class="form-erro" hidden></div>
          </div>
          <footer class="modal-rodape">
            <button type="button" class="btn" data-fechar>Cancelar</button>
            <button type="submit" class="btn ${classeBotao}">${esc(textoBotao)}</button>
          </footer>
        </form>
      </div>
    </div>`;

  const form = raiz.querySelector('form');
  const aoTeclar = e => { if (e.key === 'Escape') fechar(); };
  function fechar() {
    raiz.innerHTML = '';
    document.removeEventListener('keydown', aoTeclar);
  }
  document.addEventListener('keydown', aoTeclar);
  raiz.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', fechar));
  raiz.querySelector('.modal-fundo').addEventListener('mousedown', e => {
    if (e.target.classList.contains('modal-fundo')) fechar();
  });
  aoEnviar(form, async dados => {
    await aoConfirmar(dados);
    fechar();
  });
  setTimeout(() => {
    const primeiro = form.querySelector('.modal-corpo input, .modal-corpo textarea, .modal-corpo select');
    (primeiro || form.querySelector('[type="submit"]')).focus();
  }, 0);
}

/** Confirmação de exclusão: erros da API (ex.: 409) aparecem dentro do modal. */
function confirmarExclusao({ titulo, mensagem, acao }) {
  abrirModal({
    titulo,
    corpo: `<p class="confirmacao">${mensagem}</p>`,
    textoBotao: 'Excluir',
    classeBotao: 'btn-perigo',
    aoConfirmar: acao
  });
}

/* ---------------------------------------------------------------------
   Componentes
   --------------------------------------------------------------------- */
function cabecalho(titulo, subtitulo = '', acoes = '') {
  return `<header class="cabecalho">
    <div>
      <h1>${titulo}</h1>
      ${subtitulo ? `<p class="subtitulo">${subtitulo}</p>` : ''}
    </div>
    <div class="cabecalho-acoes">${acoes}</div>
  </header>`;
}

function paginacao(pagina) {
  const { number, totalPages, totalElements } = pagina;
  const total = `${totalElements} ${totalElements === 1 ? 'registro' : 'registros'}`;
  if (totalPages <= 1) return `<div class="paginacao"><span>${total}</span></div>`;
  return `<div class="paginacao">
    <span>Página ${number + 1} de ${totalPages} · ${total}</span>
    <div class="paginacao-botoes">
      <button class="btn btn-sm" data-pagina="${number - 1}" ${number === 0 ? 'disabled' : ''}>‹ Anterior</button>
      <button class="btn btn-sm" data-pagina="${number + 1}" ${number + 1 >= totalPages ? 'disabled' : ''}>Próxima ›</button>
    </div>
  </div>`;
}

function vazio(mensagem, acao = '') {
  return `<div class="vazio"><p>${mensagem}</p>${acao}</div>`;
}

function tabelaChamados(chamados, { mostrarCliente = true } = {}) {
  if (!chamados.length) return vazio('Nenhum chamado encontrado.');
  return `<div class="tabela-wrap"><table class="tabela tabela-clicavel">
    <thead><tr>
      <th>#</th><th>Título</th>${mostrarCliente ? '<th>Cliente</th>' : ''}
      <th>Categoria</th><th>Prioridade</th><th>Status</th><th>Técnico</th><th>Abertura</th>
    </tr></thead>
    <tbody>
      ${chamados.map(c => `
        <tr data-href="#/chamados/${c.id}">
          <td class="mono">${c.id}</td>
          <td><a href="#/chamados/${c.id}" class="link-forte">${esc(c.titulo)}</a></td>
          ${mostrarCliente ? `<td>${esc(c.clienteNome)}</td>` : ''}
          <td>${esc(c.categoriaNome)}</td>
          <td>${badgePrioridade(c.prioridade)}</td>
          <td>${badgeStatus(c.status)}</td>
          <td>${c.tecnicoNome ? esc(c.tecnicoNome) : '<span class="muted">—</span>'}</td>
          <td class="nowrap">${fmtData(c.dataAbertura)}</td>
        </tr>`).join('')}
    </tbody>
  </table></div>`;
}

/* ---------------------------------------------------------------------
   Tela: Dashboard
   --------------------------------------------------------------------- */
async function telaDashboard() {
  const contar = filtro => Api.get(`/chamados?size=1${filtro}`).then(r => r.page.totalElements);
  const [total, porStatus, porPrioridade, recentes] = await Promise.all([
    contar(''),
    Promise.all(Object.keys(STATUS).map(s => contar(`&status=${s}`))),
    Promise.all(Object.keys(PRIORIDADE).map(p => contar(`&prioridade=${p}`))),
    Api.get('/chamados?size=5&sort=dataAbertura,desc')
  ]);

  const cards = Object.keys(STATUS).map((s, i) => `
    <a class="card-numero status-borda-${s}" href="#/chamados?status=${s}">
      <span class="card-rotulo">${STATUS[s]}</span>
      <strong>${porStatus[i]}</strong>
    </a>`).join('');

  const barras = Object.keys(PRIORIDADE).map((p, i) => {
    const pct = porPrioridade[i] ? Math.max(2, Math.round((porPrioridade[i] / total) * 100)) : 0;
    return `<a class="barra-linha" href="#/chamados?prioridade=${p}">
      <span class="barra-rotulo">${PRIORIDADE[p]}</span>
      <span class="barra-trilho"><span class="barra prio-fundo-${p}" style="width:${pct}%"></span></span>
      <span class="barra-valor">${porPrioridade[i]}</span>
    </a>`;
  }).join('');

  $view().innerHTML = `
    ${cabecalho('Dashboard', 'Visão geral dos chamados',
      '<a class="btn btn-primary" href="#/chamados/novo">+ Novo chamado</a>')}
    <section class="cards">
      <a class="card-numero card-total" href="#/chamados">
        <span class="card-rotulo">Total</span><strong>${total}</strong>
      </a>
      ${cards}
    </section>
    <section class="grade-2">
      <div class="painel">
        <h2>Por prioridade</h2>
        ${total ? `<div class="barras">${barras}</div>` : vazio('Sem chamados ainda.')}
      </div>
      <div class="painel">
        <div class="painel-topo"><h2>Chamados recentes</h2><a href="#/chamados">Ver todos</a></div>
        ${recentes.content.length
          ? `<ul class="recentes">${recentes.content.map(c => `
              <li><a href="#/chamados/${c.id}">
                <span class="recente-titulo">${esc(c.titulo)}</span>
                <span class="recente-meta">${esc(c.clienteNome)} · ${fmtData(c.dataAbertura)}</span>
                <span class="recente-badges">${badgePrioridade(c.prioridade)} ${badgeStatus(c.status)}</span>
              </a></li>`).join('')}</ul>`
          : vazio('Nenhum chamado aberto ainda.', '<a class="btn btn-primary" href="#/chamados/novo">Abrir o primeiro chamado</a>')}
      </div>
    </section>`;
}

/* ---------------------------------------------------------------------
   Tela: Chamados (lista + filtros + paginação)
   --------------------------------------------------------------------- */
async function telaChamados(params) {
  const filtros = {
    status: params.get('status') || '',
    prioridade: params.get('prioridade') || '',
    clienteId: params.get('clienteId') || '',
    sort: params.get('sort') || 'dataAbertura,desc'
  };
  const pagina = Number(params.get('page') || 0);

  const consulta = new URLSearchParams({ page: pagina, size: 10, sort: filtros.sort });
  ['status', 'prioridade', 'clienteId'].forEach(k => { if (filtros[k]) consulta.set(k, filtros[k]); });

  const [resultado, clientes] = await Promise.all([
    Api.get(`/chamados?${consulta}`),
    Api.get('/clientes')
  ]);

  const temFiltro = filtros.status || filtros.prioridade || filtros.clienteId;

  $view().innerHTML = `
    ${cabecalho('Chamados', 'Filtre, ordene e acompanhe os chamados',
      '<a class="btn btn-primary" href="#/chamados/novo">+ Novo chamado</a>')}
    <form class="filtros" id="filtros">
      <label>Status
        <select name="status">${opcoes(STATUS, filtros.status, 'Todos')}</select>
      </label>
      <label>Prioridade
        <select name="prioridade">${opcoes(PRIORIDADE, filtros.prioridade, 'Todas')}</select>
      </label>
      <label>Cliente
        <select name="clienteId">${opcoes(lista(clientes, 'id', c => c.nome), filtros.clienteId, 'Todos')}</select>
      </label>
      <label>Ordenar por
        <select name="sort">${opcoes(ORDENACOES, filtros.sort)}</select>
      </label>
      ${temFiltro ? '<button type="button" class="btn btn-link" id="limpar">Limpar filtros</button>' : ''}
    </form>
    <div class="painel painel-tabela">
      ${tabelaChamados(resultado.content)}
      ${paginacao(resultado.page)}
    </div>`;

  const form = document.getElementById('filtros');
  form.addEventListener('change', () => {
    const dados = Object.fromEntries(new FormData(form));
    irPara('/chamados', { ...dados, sort: dados.sort === 'dataAbertura,desc' ? '' : dados.sort });
  });
  const limpar = document.getElementById('limpar');
  if (limpar) limpar.addEventListener('click', () => irPara('/chamados'));
  $view().querySelectorAll('[data-pagina]').forEach(b => b.addEventListener('click', () => {
    irPara('/chamados', { ...filtros, sort: filtros.sort === 'dataAbertura,desc' ? '' : filtros.sort, page: b.dataset.pagina });
  }));
}

/* ---------------------------------------------------------------------
   Tela: Novo / Editar chamado
   --------------------------------------------------------------------- */
async function telaChamadoForm(params, id) {
  const [clientes, categorias, detalhe] = await Promise.all([
    Api.get('/clientes'),
    Api.get('/categorias'),
    id ? Api.get(`/chamados/${id}`) : Promise.resolve(null)
  ]);
  const c = detalhe ? detalhe.chamado : null;
  const titulo = c ? `Editar chamado #${c.id}` : 'Novo chamado';
  const voltar = c ? `#/chamados/${c.id}` : '#/chamados';

  if (c && c.status === 'FECHADO') {
    $view().innerHTML = `${cabecalho(titulo)}
      ${vazio('Este chamado está fechado e não pode ser alterado.', `<a class="btn" href="${voltar}">Voltar ao chamado</a>`)}`;
    return;
  }
  if (!clientes.length || !categorias.length) {
    $view().innerHTML = `${cabecalho(titulo)}
      ${vazio('Para abrir um chamado é preciso ter pelo menos um cliente e uma categoria cadastrados.',
        `<a class="btn" href="#/clientes">Cadastrar cliente</a> <a class="btn" href="#/categorias">Cadastrar categoria</a>`)}`;
    return;
  }

  const valores = c || { clienteId: params.get('clienteId') || '' };

  $view().innerHTML = `
    ${cabecalho(titulo, c ? 'Status, técnico e datas são alterados pelas ações do chamado.' : 'O chamado nasce com status Aberto e data de abertura automática.')}
    <form class="painel form" id="form-chamado" novalidate>
      <div class="form-grade">
        ${campo({ name: 'titulo', label: 'Título', obrigatorio: true, max: 120, largo: true, placeholder: 'Ex.: Impressora não liga' }, valores.titulo)}
        ${campo({ name: 'descricao', label: 'Descrição', tipo: 'textarea', linhas: 5, obrigatorio: true, max: 1000, largo: true }, valores.descricao)}
        ${campo({ name: 'prioridade', label: 'Prioridade', tipo: 'select', opcoes: PRIORIDADE, obrigatorio: true }, valores.prioridade)}
        ${campo({ name: 'clienteId', label: 'Cliente', tipo: 'select', numero: true, opcoes: lista(clientes, 'id', x => `${x.nome} (${x.email})`), obrigatorio: true }, valores.clienteId)}
        ${campo({ name: 'categoriaId', label: 'Categoria', tipo: 'select', numero: true, opcoes: lista(categorias, 'id', x => x.nome), obrigatorio: true }, valores.categoriaId)}
      </div>
      <div class="form-erro" hidden></div>
      <div class="form-acoes">
        <a class="btn" href="${voltar}">Cancelar</a>
        <button type="submit" class="btn btn-primary">${c ? 'Salvar alterações' : 'Abrir chamado'}</button>
      </div>
    </form>`;

  aoEnviar(document.getElementById('form-chamado'), async dados => {
    const salvo = c
      ? await Api.put(`/chamados/${c.id}`, dados)
      : await Api.post('/chamados', dados);
    toast(c ? 'Chamado atualizado.' : `Chamado #${salvo.id} aberto.`);
    location.hash = `#/chamados/${salvo.id}`;
  });
}

/* ---------------------------------------------------------------------
   Tela: Detalhe do chamado (status, técnico, comentários)
   --------------------------------------------------------------------- */
async function telaChamadoDetalhe(params, id) {
  const [detalhe, tecnicos] = await Promise.all([
    Api.get(`/chamados/${id}`),
    Api.get('/tecnicos')
  ]);
  const c = detalhe.chamado;
  const comentarios = detalhe.comentarios;
  const fechado = c.status === 'FECHADO';

  // Próximos status permitidos pelas regras da API (não volta para ABERTO, não repete o atual).
  const proximos = Object.fromEntries(
    Object.entries(STATUS).filter(([s]) => s !== c.status && s !== 'ABERTO')
  );

  $view().innerHTML = `
    <a class="voltar" href="#/chamados">‹ Chamados</a>
    ${cabecalho(`#${c.id} · ${esc(c.titulo)}`, `${badgeStatus(c.status)} ${badgePrioridade(c.prioridade)}`,
      fechado ? '' : `<a class="btn" href="#/chamados/${c.id}/editar">Editar</a>
       <button class="btn btn-perigo-contorno" id="excluir">Excluir</button>`)}

    ${fechado ? `<div class="aviso">Chamado fechado em ${fmtData(c.dataFechamento)}. Não aceita alterações nem novos comentários.</div>` : ''}

    <div class="grade-detalhe">
      <div class="coluna">
        <section class="painel">
          <h2>Descrição</h2>
          <p class="descricao">${esc(c.descricao)}</p>
          <dl class="dados">
            <div><dt>Cliente</dt><dd><a href="#/clientes/${c.clienteId}">${esc(c.clienteNome)}</a></dd></div>
            <div><dt>Categoria</dt><dd>${esc(c.categoriaNome)}</dd></div>
            <div><dt>Técnico</dt><dd>${c.tecnicoNome ? esc(c.tecnicoNome) : '<span class="muted">Não atribuído</span>'}</dd></div>
            <div><dt>Abertura</dt><dd>${fmtData(c.dataAbertura)}</dd></div>
            <div><dt>Fechamento</dt><dd>${fmtData(c.dataFechamento)}</dd></div>
          </dl>
        </section>

        <section class="painel">
          <h2>Comentários <span class="contador">${comentarios.length}</span></h2>
          ${comentarios.length
            ? `<ol class="linha-tempo">${comentarios.map(m => `
                <li>
                  <div class="comentario-topo"><strong>${esc(m.autor)}</strong><span>${fmtData(m.data)}</span></div>
                  <p>${esc(m.texto)}</p>
                </li>`).join('')}</ol>`
            : '<p class="muted">Nenhum comentário ainda.</p>'}
          ${fechado ? '' : `
            <form id="form-comentario" class="form-comentario" novalidate>
              ${campo({ name: 'autor', label: 'Autor', obrigatorio: true, max: 100, placeholder: 'Seu nome' })}
              ${campo({ name: 'texto', label: 'Comentário', tipo: 'textarea', obrigatorio: true, max: 1000, linhas: 3 })}
              <div class="form-erro" hidden></div>
              <div class="form-acoes"><button type="submit" class="btn btn-primary">Comentar</button></div>
            </form>`}
        </section>
      </div>

      <aside class="coluna">
        <section class="painel">
          <h2>Técnico responsável</h2>
          ${fechado
            ? `<p>${c.tecnicoNome ? esc(c.tecnicoNome) : '<span class="muted">Não atribuído</span>'}</p>`
            : tecnicos.length
              ? `<form id="form-tecnico" novalidate>
                   ${campo({ name: 'tecnicoId', label: c.tecnicoId ? 'Trocar técnico' : 'Atribuir técnico', tipo: 'select', numero: true, opcoes: lista(tecnicos, 'id', t => `${t.nome} · ${PERFIL[t.perfil] || t.perfil}`) }, c.tecnicoId)}
                   ${c.status === 'ABERTO' ? '<p class="dica">Ao atribuir, o chamado passa para <b>Em atendimento</b>.</p>' : ''}
                   <div class="form-erro" hidden></div>
                   <button type="submit" class="btn btn-primary btn-bloco">Atribuir</button>
                 </form>`
              : vazio('Nenhum técnico cadastrado.', '<a class="btn btn-sm" href="#/tecnicos">Cadastrar técnico</a>')}
        </section>

        <section class="painel">
          <h2>Status</h2>
          <p>Atual: ${badgeStatus(c.status)}</p>
          ${fechado ? '' : `
            <form id="form-status" novalidate>
              ${campo({ name: 'status', label: 'Alterar para', tipo: 'select', opcoes: proximos })}
              ${!c.tecnicoId ? '<p class="dica">Para ir para <b>Em atendimento</b> é preciso ter técnico atribuído.</p>' : ''}
              <div class="form-erro" hidden></div>
              <button type="submit" class="btn btn-primary btn-bloco">Alterar status</button>
            </form>`}
        </section>
      </aside>
    </div>`;

  if (fechado) return;

  aoEnviar(document.getElementById('form-comentario'), async dados => {
    await Api.post(`/chamados/${c.id}/comentarios`, dados);
    toast('Comentário adicionado.');
    rotear();
  });

  const formTecnico = document.getElementById('form-tecnico');
  if (formTecnico) {
    aoEnviar(formTecnico, async dados => {
      await Api.patch(`/chamados/${c.id}/atribuir`, dados);
      toast('Técnico atribuído.');
      rotear();
    });
  }

  aoEnviar(document.getElementById('form-status'), async dados => {
    const atualizado = await Api.patch(`/chamados/${c.id}/status`, dados);
    toast(`Status alterado para ${STATUS[atualizado.status]}.`);
    rotear();
  });

  document.getElementById('excluir').addEventListener('click', () => confirmarExclusao({
    titulo: 'Excluir chamado',
    mensagem: `Excluir o chamado <b>#${c.id} · ${esc(c.titulo)}</b>? Os comentários também serão excluídos.`,
    acao: async () => {
      await Api.del(`/chamados/${c.id}`);
      toast('Chamado excluído.');
      location.hash = '#/chamados';
    }
  }));
}

/* ---------------------------------------------------------------------
   Cadastros simples (Clientes, Categorias, Técnicos)
   --------------------------------------------------------------------- */
const CADASTROS = {
  clientes: {
    url: '/clientes',
    titulo: 'Clientes',
    subtitulo: 'Quem abre os chamados',
    nome: 'Cliente', genero: 'o',
    rotulo: x => x.nome,
    colunas: [
      ['Nome', x => `<a href="#/clientes/${x.id}" class="link-forte">${esc(x.nome)}</a>`],
      ['E-mail', x => esc(x.email)],
      ['Telefone', x => x.telefone ? esc(x.telefone) : '<span class="muted">—</span>']
    ],
    campos: () => [
      { name: 'nome', label: 'Nome', obrigatorio: true, max: 100 },
      { name: 'email', label: 'E-mail', tipo: 'email', obrigatorio: true, max: 120 },
      { name: 'telefone', label: 'Telefone', max: 20, placeholder: '47999999999' }
    ],
    acoesExtras: x => `<a class="btn btn-sm" href="#/clientes/${x.id}">Chamados</a>`
  },
  categorias: {
    url: '/categorias',
    titulo: 'Categorias',
    subtitulo: 'Tipos de chamado (o nome é único)',
    nome: 'Categoria', genero: 'a',
    rotulo: x => x.nome,
    colunas: [
      ['Nome', x => `<strong>${esc(x.nome)}</strong>`],
      ['Descrição', x => x.descricao ? esc(x.descricao) : '<span class="muted">—</span>']
    ],
    campos: () => [
      { name: 'nome', label: 'Nome', obrigatorio: true, max: 60 },
      { name: 'descricao', label: 'Descrição', tipo: 'textarea', max: 255 }
    ]
  },
  tecnicos: {
    url: '/tecnicos',
    titulo: 'Técnicos',
    subtitulo: 'Quem atende os chamados',
    nome: 'Técnico', genero: 'o',
    rotulo: x => x.nome,
    colunas: [
      ['Nome', x => `<strong>${esc(x.nome)}</strong>`],
      ['E-mail', x => esc(x.email)],
      ['Perfil', x => badgePerfil(x.perfil)]
    ],
    campos: () => [
      { name: 'nome', label: 'Nome', obrigatorio: true, max: 100 },
      { name: 'email', label: 'E-mail', tipo: 'email', obrigatorio: true, max: 120 },
      { name: 'perfil', label: 'Perfil', tipo: 'select', opcoes: PERFIL, obrigatorio: true }
    ]
  }
};

function formCadastro(cfg, item) {
  abrirModal({
    titulo: item ? `Editar ${cfg.nome.toLowerCase()}` : `Nov${cfg.genero} ${cfg.nome.toLowerCase()}`,
    corpo: cfg.campos().map(def => campo(def, item ? item[def.name] : '')).join(''),
    textoBotao: item ? 'Salvar' : 'Cadastrar',
    aoConfirmar: async dados => {
      if (item) await Api.put(`${cfg.url}/${item.id}`, dados);
      else await Api.post(cfg.url, dados);
      toast(`${cfg.nome} ${item ? 'atualizad' : 'cadastrad'}${cfg.genero}.`);
      rotear();
    }
  });
}

function excluirCadastro(cfg, item, depois = () => rotear()) {
  confirmarExclusao({
    titulo: `Excluir ${cfg.nome.toLowerCase()}`,
    mensagem: `Excluir <b>${esc(cfg.rotulo(item))}</b>? Esta ação não pode ser desfeita.`,
    acao: async () => {
      await Api.del(`${cfg.url}/${item.id}`);
      toast(`${cfg.nome} excluíd${cfg.genero}.`);
      depois();
    }
  });
}

async function telaCadastro(chave) {
  const cfg = CADASTROS[chave];
  const itens = await Api.get(cfg.url);
  const porId = new Map(itens.map(i => [String(i.id), i]));

  $view().innerHTML = `
    ${cabecalho(cfg.titulo, cfg.subtitulo, `<button class="btn btn-primary" id="novo">+ Nov${cfg.genero} ${cfg.nome.toLowerCase()}</button>`)}
    <div class="painel painel-tabela">
      ${itens.length ? `<div class="tabela-wrap"><table class="tabela">
        <thead><tr><th>#</th>${cfg.colunas.map(([t]) => `<th>${t}</th>`).join('')}<th class="col-acoes">Ações</th></tr></thead>
        <tbody>${itens.map(x => `
          <tr>
            <td class="mono">${x.id}</td>
            ${cfg.colunas.map(([, fn]) => `<td>${fn(x)}</td>`).join('')}
            <td class="col-acoes">
              ${cfg.acoesExtras ? cfg.acoesExtras(x) : ''}
              <button class="btn btn-sm" data-editar="${x.id}">Editar</button>
              <button class="btn btn-sm btn-perigo-contorno" data-excluir="${x.id}">Excluir</button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>
        <div class="paginacao"><span>${itens.length} ${itens.length === 1 ? 'registro' : 'registros'}</span></div>`
      : vazio(`Nenhum${cfg.genero === 'a' ? 'a' : ''} ${cfg.nome.toLowerCase()} cadastrad${cfg.genero}.`)}
    </div>`;

  document.getElementById('novo').addEventListener('click', () => formCadastro(cfg));
  $view().querySelectorAll('[data-editar]').forEach(b =>
    b.addEventListener('click', () => formCadastro(cfg, porId.get(b.dataset.editar))));
  $view().querySelectorAll('[data-excluir]').forEach(b =>
    b.addEventListener('click', () => excluirCadastro(cfg, porId.get(b.dataset.excluir))));
}

/* ---------------------------------------------------------------------
   Tela: Detalhe do cliente (dados + chamados do cliente)
   --------------------------------------------------------------------- */
async function telaClienteDetalhe(params, id) {
  const pagina = Number(params.get('page') || 0);
  const [cliente, chamados] = await Promise.all([
    Api.get(`/clientes/${id}`),
    Api.get(`/clientes/${id}/chamados?page=${pagina}&size=10`)
  ]);
  const cfg = CADASTROS.clientes;

  $view().innerHTML = `
    <a class="voltar" href="#/clientes">‹ Clientes</a>
    ${cabecalho(esc(cliente.nome), esc(cliente.email) + (cliente.telefone ? ` · ${esc(cliente.telefone)}` : ''), `
      <button class="btn" id="editar">Editar</button>
      <button class="btn btn-perigo-contorno" id="excluir">Excluir</button>
      <a class="btn btn-primary" href="#/chamados/novo?clienteId=${cliente.id}">+ Novo chamado</a>`)}
    <div class="painel painel-tabela">
      <div class="painel-topo"><h2>Chamados do cliente</h2></div>
      ${tabelaChamados(chamados.content, { mostrarCliente: false })}
      ${paginacao(chamados.page)}
    </div>`;

  document.getElementById('editar').addEventListener('click', () => formCadastro(cfg, cliente));
  document.getElementById('excluir').addEventListener('click', () =>
    excluirCadastro(cfg, cliente, () => { location.hash = '#/clientes'; }));
  $view().querySelectorAll('[data-pagina]').forEach(b =>
    b.addEventListener('click', () => irPara(`/clientes/${id}`, { page: b.dataset.pagina })));
}

/* ---------------------------------------------------------------------
   Roteamento por hash (#/chamados, #/chamados/1 ...)
   --------------------------------------------------------------------- */
const ROTAS = [
  [/^\/$/, telaDashboard, 'dashboard'],
  [/^\/chamados$/, telaChamados, 'chamados'],
  [/^\/chamados\/novo$/, telaChamadoForm, 'chamados'],
  [/^\/chamados\/(\d+)$/, telaChamadoDetalhe, 'chamados'],
  [/^\/chamados\/(\d+)\/editar$/, telaChamadoForm, 'chamados'],
  [/^\/clientes$/, () => telaCadastro('clientes'), 'clientes'],
  [/^\/clientes\/(\d+)$/, telaClienteDetalhe, 'clientes'],
  [/^\/categorias$/, () => telaCadastro('categorias'), 'categorias'],
  [/^\/tecnicos$/, () => telaCadastro('tecnicos'), 'tecnicos']
];

let renderAtual = 0;

async function rotear() {
  const [caminho, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs || '');
  const execucao = ++renderAtual;

  document.getElementById('modal-root').innerHTML = '';

  for (const [regex, tela, nav] of ROTAS) {
    const m = caminho.match(regex);
    if (!m) continue;
    document.querySelectorAll('[data-nav]').forEach(a =>
      a.classList.toggle('ativo', a.dataset.nav === nav));
    if (!$view().children.length) $view().innerHTML = '<div class="carregando">Carregando…</div>';
    try {
      await tela(params, ...m.slice(1));
    } catch (erro) {
      if (execucao !== renderAtual) return;
      $view().innerHTML = `
        ${cabecalho('Ops!')}
        <div class="painel erro-tela">
          <p><strong>${esc(erro.message)}</strong></p>
          ${erro.status ? `<p class="muted">HTTP ${erro.status}</p>` : ''}
          <a class="btn" href="#/">Voltar ao dashboard</a>
        </div>`;
    }
    return;
  }
  $view().innerHTML = `${cabecalho('Página não encontrada')}<a class="btn" href="#/">Voltar ao dashboard</a>`;
}

// Linhas de tabela clicáveis
document.addEventListener('click', e => {
  const linha = e.target.closest('tr[data-href]');
  if (linha && !e.target.closest('a, button')) location.hash = linha.dataset.href;
});

window.addEventListener('hashchange', rotear);
rotear();
