// Site de aprovação e postagem (HIST ANIMADAS) — gerado pelo _BASE/PUBLICAR/postagem.py; não editar aqui.
// Dados de cada lote: <CANAL>/<LOTE>/dados.json (o postagem.py publica). Marcações (aprovado, alterar, postado):
// estado/<CANAL>-<LOTE>.json no próprio repositório, gravado pela API do GitHub com a chave de quem entrou como
// dono/postador (fica só neste aparelho). Sem chave, a marcação fica neste aparelho e o "Copiar pedido" leva ao chat.
(() => {
  'use strict';
  const SITE = window.SITE || {};
  const RAMO = SITE.ramo || 'main';
  const PARTES = { video: 'Vídeo', titulo: 'Título', thumbs: 'Thumbnails', descricao: 'Descrição, tags e comentário' };
  const PLATS = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' };
  const app = document.getElementById('app');
  const guarda = {
    ler(k, pad) { try { const v = localStorage.getItem(k); return v == null ? pad : JSON.parse(v); } catch (e) { return pad; } },
    gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* aba anônima: segue sem guardar */ } },
    apagar(k) { try { localStorage.removeItem(k); } catch (e) { /* idem */ } },
  };
  const chave = () => guarda.ler('site-chave', '');

  function el(tag, at = {}, ...filhos) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(at || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos.flat(Infinity)) if (f != null && f !== false) n.append(f.nodeType ? f : document.createTextNode(String(f)));
    return n;
  }
  const mmss = s => { s = Math.round(+s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const b64 = { para: t => btoa(String.fromCharCode(...new TextEncoder().encode(t))),
                de: t => new TextDecoder().decode(Uint8Array.from(atob(t.replace(/\n/g, '')), c => c.charCodeAt(0))) };
  function msg(t, erro) { const m = document.getElementById('msg'); if (m) { m.textContent = t; m.className = erro ? 'erro' : ''; } }

  async function json(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); }

  // ---------------------------------------------------------------- estado no repositório
  const api = p => `https://api.github.com/repos/${SITE.repo}/contents/${p}`;
  async function lerEstado(arq) {
    const h = chave() ? { Authorization: `Bearer ${chave()}` } : {};
    try {
      const r = await fetch(`${api(arq)}?ref=${RAMO}`, { headers: { Accept: 'application/vnd.github+json', ...h }, cache: 'no-store' });
      if (r.status === 404) return { dados: { videos: {} }, sha: null };
      if (r.ok) { const j = await r.json(); return { dados: JSON.parse(b64.de(j.content)), sha: j.sha }; }
    } catch (e) { /* sem rede para a API: tenta o arquivo do próprio site */ }
    try { return { dados: await json(`${arq}?t=${Date.now()}`), sha: null }; } catch (e) { return { dados: { videos: {} }, sha: null }; }
  }
  async function gravarEstado(arq, mudar, tentativa = 1) {
    const atual = await lerEstado(arq);
    const dados = atual.dados || { videos: {} };
    dados.videos = dados.videos || {};
    mudar(dados);
    dados.atualizado = new Date().toISOString();
    const r = await fetch(api(arq), { method: 'PUT', headers: { Authorization: `Bearer ${chave()}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ message: `marcações ${arq}`, content: b64.para(JSON.stringify(dados, null, 1)), branch: RAMO, ...(atual.sha ? { sha: atual.sha } : {}) }) });
    if ((r.status === 409 || r.status === 422) && tentativa < 3) return gravarEstado(arq, mudar, tentativa + 1);
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'a chave não tem permissão (entre de novo)' : `o GitHub respondeu ${r.status}`);
    return dados;
  }

  // ---------------------------------------------------------------- entrar (a chave do GitHub)
  function dialogoEntrar(depois) {
    const inp = el('input', { type: 'password', placeholder: 'github_pat_…', autocomplete: 'off' });
    const d = el('dialog', {},
      el('h3', {}, 'Entrar para marcar'),
      el('p', {}, 'Com a chave, o que você marca (aprovar, alterar, postado) fica salvo no site para todo mundo ver, e o vídeo postado sai do site. Ela fica só neste aparelho. Quem posta: peça a chave ao dono e cole aqui.'),
      el('ol', {},
        el('li', {}, 'Abra ', el('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'github.com → criar chave'), ' (entre na sua conta).'),
        el('li', {}, `Repository access: Only select repositories → ${SITE.repo}.`),
        el('li', {}, 'Permissions → Repository permissions → Contents: Read and write. Expiration: 1 year.'),
        el('li', {}, 'Generate token, copie e cole aqui.')),
      inp,
      el('div', { class: 'botoes' },
        el('button', { onclick: () => d.close() }, 'Cancelar'),
        el('button', { class: 'primario', onclick: async () => {
          const t = inp.value.trim(); if (!t) return;
          const r = await fetch(`https://api.github.com/repos/${SITE.repo}`, { headers: { Authorization: `Bearer ${t}` } }).catch(() => null);
          const j = r && r.ok ? await r.json() : null;
          if (!j || !(j.permissions && j.permissions.push)) { inp.value = ''; inp.placeholder = 'essa chave não pode gravar neste site — confira o passo 2 e 3'; return; }
          guarda.gravar('site-chave', t); d.close(); depois && depois();
        } }, 'Entrar')));
    document.body.append(d); d.showModal();
  }

  // ---------------------------------------------------------------- página inicial: os lotes
  async function inicio() {
    let lotes = [];
    try { lotes = await json(`lotes.json?t=${Date.now()}`); } catch (e) { /* nenhum ainda */ }
    const porCanal = {};
    for (const l of lotes) (porCanal[l.nome || l.canal] = porCanal[l.nome || l.canal] || []).push(l);
    app.replaceChildren(
      el('div', { class: 'topo' }, el('h1', {}, 'Vídeos para aprovar e postar')),
      el('div', { class: 'lista' }, lotes.length ? Object.entries(porCanal).map(([nome, ls]) => [
        el('h2', {}, nome),
        ls.sort((a, b) => String(b.gerado).localeCompare(String(a.gerado))).map(l => el('a', { class: 'linha', href: `#/${l.canal}/${l.lote}` },
          el('span', {}, el('b', {}, l.lote), ` · ${l.videos} vídeo(s)${l.formato === 'longo+cortes' ? ' · YouTube + cortes' : ''}`),
          el('span', { class: 'selo' }, `atualizado ${String(l.gerado || '').slice(0, 10).split('-').reverse().join('/')}`)))])
        : el('p', { class: 'vazio' }, 'Nenhum lote publicado ainda.')));
  }

  // ---------------------------------------------------------------- um lote
  async function lote(canalId, loteId, aba) {
    const base = `${canalId}/${loteId}/`;
    const arqEstado = `estado/${canalId}-${loteId}.json`;
    const LOCAL = `site-${canalId}-${loteId}`;
    let D;
    try { D = await json(`${base}dados.json?t=${Date.now()}`); } catch (e) { app.replaceChildren(el('p', { class: 'vazio' }, 'Lote não encontrado. ', el('a', { href: '#/' }, 'Voltar'))); return; }
    let E = (await lerEstado(arqEstado)).dados;
    const local = guarda.ler(LOCAL, { videos: {} });
    if (!chave()) E = { ...E, videos: { ...E.videos, ...local.videos } };
    let timer = null;
    const pendentes = new Set();

    function marcaDe(v) { return (E.videos || {})[v.id] || {}; }
    function parteValida(v, p) { const m = marcaDe(v).partes || {}; return m[p] && m[p].v === v.v[p] ? m[p] : null; }
    function aprovado(v) {
      if (v.revisao === 'aprovado') return true;
      const ps = Object.keys(v.v); return ps.length > 0 && ps.every(p => (parteValida(v, p) || {}).acao === 'aprovado');
    }
    async function gravarPendentes() {
      const ids = [...pendentes]; pendentes.clear();
      if (!ids.length) return true;
      try {
        const novo = await gravarEstado(arqEstado, d => { for (const i of ids) d.videos[i] = E.videos[i]; });
        E = novo; msg('salvo ✓'); return true;
      } catch (e) { msg(`não salvou: ${e.message}`, true); ids.forEach(i => pendentes.add(i)); return false; }
    }
    function salvar(id, mudar, agora) {
      E.videos[id] = E.videos[id] || {}; mudar(E.videos[id]);
      if (!chave()) { local.videos[id] = E.videos[id]; guarda.gravar(LOCAL, local); msg('marcado neste aparelho'); return Promise.resolve(false); }
      pendentes.add(id); msg('salvando…');
      clearTimeout(timer);
      if (agora) return gravarPendentes();
      timer = setTimeout(gravarPendentes, 1200);
      return Promise.resolve(true);
    }

    // ---- tirar do site o vídeo já postado (pedido do dono: não fica pesando). O original fica no computador de quem fez.
    const H = () => ({ Authorization: `Bearer ${chave()}`, Accept: 'application/vnd.github+json' });
    async function apagarArquivo(caminho) {
      const r = await fetch(`${api(caminho)}?ref=${RAMO}`, { headers: H(), cache: 'no-store' });
      if (!r.ok) return;
      const { sha } = await r.json();
      await fetch(api(caminho), { method: 'DELETE', headers: H(), body: JSON.stringify({ message: `postado: tira ${caminho}`, sha, branch: RAMO }) });
    }
    async function editarDados(mudar, tentativa = 1) {
      const caminho = `${base}dados.json`;
      const r = await fetch(`${api(caminho)}?ref=${RAMO}`, { headers: H(), cache: 'no-store' });
      if (!r.ok) throw new Error(`não li ${caminho} (${r.status})`);
      const j = await r.json(), d = JSON.parse(b64.de(j.content));
      mudar(d);
      const w = await fetch(api(caminho), { method: 'PUT', headers: H(), body: JSON.stringify({ message: `postado: ${D.lote}`, content: b64.para(JSON.stringify(d, null, 1)), sha: j.sha, branch: RAMO }) });
      if ((w.status === 409 || w.status === 422) && tentativa < 3) return editarDados(mudar, tentativa + 1);
      if (!w.ok) throw new Error(`o GitHub respondeu ${w.status}`);
    }
    async function tirarDoSite(v) {
      if (!chave()) { msg('Para o vídeo sair do site, toque em Entrar (com a chave).', true); return; }
      msg(`tirando ${v.id} do site…`);
      try {
        const tag = `${canalId}-${loteId}`;
        const r = await fetch(`https://api.github.com/repos/${SITE.repo}/releases/tags/${tag}`, { headers: H() });
        if (r.ok) {
          const rel = await r.json();
          const ativos = await (await fetch(`https://api.github.com/repos/${SITE.repo}/releases/${rel.id}/assets?per_page=100`, { headers: H() })).json();
          for (const a of ativos) if (a.name.startsWith(`${tag}-${v.id}-`))
            await fetch(`https://api.github.com/repos/${SITE.repo}/releases/assets/${a.id}`, { method: 'DELETE', headers: H() });
        }
        for (const arq of [v.previa, v.capa, ...(v.thumbs || []).map(x => x.arquivo)].filter(Boolean)) await apagarArquivo(base + arq);
        const hoje = new Date().toISOString().slice(0, 10);
        await editarDados(d => { const x = (d.videos || []).find(y => y.id === v.id);
          if (x) { Object.assign(x, { removido: hoje, previa: null, capa: null, download: null }); (x.thumbs || []).forEach(y => { y.arquivo = null; }); } });
        Object.assign(v, { removido: hoje, previa: null, capa: null, download: null });
        desenhar(); msg(`${v.id} saiu do site ✓`);
      } catch (e) { msg(`não tirei do site: ${e.message} (o assistente tira depois)`, true); }
    }

    function copiar(rotulo, texto) {
      const b = el('button', { class: 'copiar', onclick: async () => {
        try { await navigator.clipboard.writeText(texto); }
        catch (e) { const t = el('textarea', {}, texto); t.style.display = 'block'; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
        b.textContent = 'Copiado ✓'; b.classList.add('feito'); setTimeout(() => { b.textContent = 'Copiar'; b.classList.remove('feito'); }, 1800);
      } }, 'Copiar');
      return el('div', { class: 'texto' }, el('div', { class: 'rotulo' }, el('span', {}, rotulo), b), el('pre', {}, texto));
    }

    function player(v) {
      if (v.removido) return el('p', { class: 'vazio' }, `postado — o vídeo saiu do site em ${String(v.removido).split('-').reverse().join('/')}`);
      return v.previa ? el('video', { src: base + v.previa, poster: v.capa ? base + v.capa : null, controls: true, preload: 'metadata', playsinline: true }) : el('p', { class: 'vazio' }, 'sem vídeo ainda');
    }

    // ---- aba Aprovar
    function cartaoAprovar(v) {
      const m = marcaDe(v);
      const card = el('article', { class: `card${v.tipo === 'longo' ? ' longo' : ''}`, dataset: { id: v.id } });
      const estadoCard = () => {
        const es = [...card.querySelectorAll('.parte')].map(p => p.dataset.estado || 'pendente');
        card.dataset.estado = es.includes('alterar') ? 'alterar' : es.length && es.every(e => e === 'aprovado') ? 'aprovado' : 'pendente';
      };
      const registrar = () => {
        estadoCard();
        salvar(v.id, x => {
          x.versao = v.versao; x.partes = {};
          card.querySelectorAll('.parte').forEach(p => { x.partes[p.dataset.parte] = { acao: p.dataset.estado || 'pendente', pedido: p.querySelector('textarea').value.trim(), v: v.v[p.dataset.parte] }; });
          x.acao = card.dataset.estado;
          const alt = Object.entries(x.partes).filter(([, y]) => y.acao === 'alterar');
          x.pedido = alt.map(([k, y]) => (Object.keys(x.partes).length > 1 ? PARTES[k] + ': ' : '') + y.pedido).join(' · ');
          const t = card.querySelector('input[type=radio]:checked'); if (t) x.titulo = +t.value;
          if (card.querySelector('input[type=checkbox]')) x.thumbs = [...card.querySelectorAll('input[type=checkbox]:checked')].map(c => +c.value);
          x.quando = new Date().toISOString();
        });
      };
      const parte = (nome, titulo, conteudo, dica) => {
        const ja = parteValida(v, nome) || (v.revisao === 'aprovado' ? { acao: 'aprovado', pedido: '' } : null);
        const ta = el('textarea', { placeholder: dica }, ja ? ja.pedido || '' : '');
        const p = el('div', { class: 'parte', dataset: { parte: nome, estado: ja ? ja.acao : 'pendente' } },
          titulo && el('h4', {}, ...titulo), conteudo,
          el('div', { class: 'botoes' },
            el('button', { class: 'ok', onclick: () => { p.dataset.estado = p.dataset.estado === 'aprovado' ? 'pendente' : 'aprovado'; registrar(); } }, '✅ Aprovar'),
            el('button', { class: 'alt', onclick: () => { p.dataset.estado = p.dataset.estado === 'alterar' ? 'pendente' : 'alterar'; registrar(); if (p.dataset.estado === 'alterar') ta.focus(); } }, '✏️ Alterar')),
          ta);
        ta.addEventListener('input', registrar);
        return p;
      };
      card.append(el('header', {}, el('b', {}, v.tipo === 'longo' ? `${v.id} · vídeo do YouTube` : v.tipo === 'corte' ? `${v.id} · corte ${v.corte} de ${v.de}` : v.id),
        el('span', {}, `${v.versao} · ${mmss(v.duracao)}`)), player(v));
      if (v.tipo !== 'longo') {
        card.append(el('h3', {}, v.titulo || ''), el('p', { class: 'post' }, v.legenda || ''),
          parte('video', null, null, 'O que mudar neste vídeo? (ex.: o personagem some no fim)'));
      } else {
        card.append(parte('video', ['Vídeo'], null, 'O que mudar no vídeo? (diga o minuto)'));
        if (v.titulos && v.titulos.length) {
          const esc = m.titulo || v.titulos.indexOf(v.titulo_escolhido) + 1 || 1;
          const tits = v.titulos.map((t, i) => el('label', { class: 'tit' },
            el('input', { type: 'radio', name: `t-${v.id}`, value: i + 1, checked: esc === i + 1, onchange: registrar }), el('span', {}, t, ' ', el('small', {}, `${t.length} caracteres`))));
          card.append(parte('titulo', ['Título ', el('small', {}, 'escolha 1 — os outros vão para o Testar e comparar')], tits, 'O que mudar no título?'));
          const marcadas = m.thumbs || v.thumbs_escolhidas || (v.thumbs || []).map(x => x.n);
          const ths = el('div', { class: 'thumbs' }, (v.thumbs || []).map(x => el('figure', {}, el('img', { src: base + x.arquivo, alt: `thumb ${x.n}`, loading: 'lazy' }),
            el('figcaption', {}, el('label', {}, el('input', { type: 'checkbox', value: x.n, checked: marcadas.includes(x.n), onchange: registrar }), ' no teste A/B'), `· ${x.texto || ''}`))));
          card.append(parte('thumbs', ['Thumbnails ', el('small', {}, 'a 1ª marcada é a principal')], ths, 'O que mudar nas thumbnails? (diga qual: 1, 2 ou 3)'));
          card.append(parte('descricao', ['Descrição, tags e comentário fixado'],
            [copiar('Descrição', v.descricao || ''), copiar('Tags', v.tags || ''), copiar('Comentário fixado', v.comentario || '')], 'O que mudar na descrição, nas tags ou no comentário?'));
        }
      }
      estadoCard();
      return card;
    }

    // ---- aba Postar
    function cartaoPostar(v) {
      const m = marcaDe(v);
      const postado = m.postado || {};
      const tits = v.titulos || [];
      const tit = v.tipo === 'longo' ? tits[(m.titulo || tits.indexOf(v.titulo_escolhido) + 1 || 1) - 1] || v.titulo : v.titulo;
      const card = el('article', { class: `card${v.tipo === 'longo' ? ' longo' : ''}`, dataset: { estado: Object.values(postado).some(Boolean) ? 'aprovado' : 'pendente' } },
        el('header', {}, el('b', {}, v.tipo === 'corte' ? `${v.id} · corte ${v.corte}` : v.id), el('span', {}, mmss(v.duracao))),
        player(v),
        el('div', { class: 'botoes' }, v.download ? el('a', { class: 'botao primario', href: v.download, download: '' }, '⬇️ Baixar vídeo') : el('span', { class: 'selo' }, 'sem arquivo para baixar')),
        el('p', { class: 'post' }, 'No iPhone: Baixar → toque na setinha de downloads → abra o vídeo → Compartilhar → Salvar vídeo (vai para as Fotos).'));
      if (v.tipo === 'longo') {
        const ths = m.thumbs || v.thumbs_escolhidas || (v.thumbs || []).map(x => x.n);
        card.append(copiar('Título', tit || ''), copiar('Descrição', v.descricao || ''), copiar('Tags', v.tags || ''), copiar('Comentário fixado', v.comentario || ''),
          el('div', { class: 'thumbs' }, (v.thumbs || []).filter(x => ths.includes(x.n)).map((x, i) => el('figure', {}, el('img', { src: base + x.arquivo, alt: '' }),
            el('figcaption', {}, el('a', { href: base + x.arquivo, download: '' }, i ? `baixar thumb do teste ${i + 1}` : 'baixar thumb principal'))))),
          el('p', { class: 'post' }, 'YouTube Studio → Detalhes: título, descrição, tags, thumbnail principal. "Não é para crianças". Depois: Testar e comparar com as outras thumbs/títulos.'));
      } else {
        card.append(copiar('Título (YouTube Shorts)', tit || ''), copiar('Legenda (TikTok)', v.legenda_tiktok || ''), copiar('Legenda (Instagram)', v.legenda_instagram || ''));
      }
      const plats = v.tipo === 'longo' ? ['youtube'] : [...new Set((v.plataformas || ['tiktok', 'instagram', 'youtube']).map(p => p === 'shorts' ? 'youtube' : p))];
      const marcar = async (p, sim) => {
        const ok = await salvar(v.id, x => { x.postado = { ...(x.postado || {}), [p]: sim ? new Date().toISOString().slice(0, 10) : null }; }, true);
        const tudo = plats.every(q => (marcaDe(v).postado || {})[q]);
        if (tudo && ok) tirarDoSite(v);                                  // postado em todas as redes: sai do site
      };
      let confirmar = false;
      const tudoBotao = el('button', { onclick: async () => {
        if (!confirmar) { confirmar = true; tudoBotao.textContent = 'Toque de novo para tirar do site'; setTimeout(() => { confirmar = false; tudoBotao.textContent = '✅ Postei em tudo — tirar do site'; }, 4000); return; }
        if (await salvar(v.id, x => { x.concluido = new Date().toISOString().slice(0, 10); }, true)) tirarDoSite(v);
      } }, '✅ Postei em tudo — tirar do site');
      card.append(el('div', { class: 'postado' }, plats.map(p => el('label', {},
        el('input', { type: 'checkbox', checked: !!postado[p], onchange: e => marcar(p, e.target.checked) }),
        el('span', {}, `postado no ${PLATS[p] || p}`)))),
        el('div', { class: 'botoes' }, tudoBotao),
        el('p', { class: 'post' }, 'Marcou todas as redes (ou tocou em "Postei em tudo"): o vídeo sai do site sozinho, para não pesar. Os textos ficam.'));
      return card;
    }

    function desenhar() {
      const lista = D.videos || [];
      const ok = lista.filter(aprovado);
      const paraPostar = ok.filter(v => !v.removido), jaPostados = ok.filter(v => v.removido);
      const botoesTopo = [];
      if (aba === 'aprovar' && !chave()) botoesTopo.push(el('button', { onclick: () => copiarPedido() }, 'Copiar pedido'));
      botoesTopo.push(chave() ? el('button', { onclick: () => { guarda.apagar('site-chave'); desenhar(); } }, 'Sair')
                             : el('button', { onclick: () => dialogoEntrar(() => lote(canalId, loteId, aba)) }, 'Entrar'));
      app.replaceChildren(
        el('div', { class: 'topo' },
          el('h1', {}, el('a', { href: '#/' }, '‹ '), `${D.canal.nome} · ${D.lote} `, el('small', {}, `${ok.length}/${lista.length} aprovado(s)`)),
          el('div', { class: 'abas' },
            el('button', { 'aria-pressed': aba === 'aprovar', onclick: () => { location.hash = `#/${canalId}/${loteId}/aprovar`; } }, 'Aprovar'),
            el('button', { 'aria-pressed': aba === 'postar', onclick: () => { location.hash = `#/${canalId}/${loteId}/postar`; } }, `Postar (${paraPostar.length})`)),
          el('span', { id: 'msg' }), ...botoesTopo),
        el('main', {},
          !chave() && el('div', { class: 'aviso-topo' }, aba === 'aprovar'
            ? 'Sem entrar, o que você marca fica só neste aparelho: depois toque em "Copiar pedido" e cole no chat do canal (/ajustes). Entrando, fica salvo no site na hora.'
            : 'Sem entrar, o "postado" fica só neste aparelho e o vídeo não sai do site. Toque em Entrar (a chave o dono manda).'),
          aba === 'postar'
            ? [paraPostar.length ? paraPostar.map(cartaoPostar) : el('p', { class: 'vazio' }, jaPostados.length ? 'Tudo postado ✓' : 'Nenhum vídeo aprovado ainda.'),
               jaPostados.length ? el('div', { class: 'aviso-topo' }, el('b', {}, `Já postados (${jaPostados.length}) — saíram do site: `),
                 jaPostados.map(v => `${v.id} ${v.titulo || ''}`).join(' · ')) : null]
            : lista.map(cartaoAprovar)));
    }

    async function copiarPedido() {
      const videos = (D.videos || []).map(v => [v, marcaDe(v)]).filter(([v, x]) => ['aprovado', 'alterar'].includes(x.acao) && x.versao === v.versao)
        .map(([v, x]) => ({ id: v.id, acao: x.acao, ...(x.acao === 'alterar' ? { pedido: x.pedido } : {}),
          ...(Object.keys(x.partes || {}).length > 1 ? { partes: Object.fromEntries(Object.entries(x.partes).filter(([, y]) => y.acao === 'alterar').map(([k, y]) => [k, y.pedido])) } : {}),
          ...(x.titulo ? { titulo: x.titulo } : {}), ...(x.thumbs ? { thumbs: x.thumbs } : {}) }));
      const txt = '/ajustes ' + JSON.stringify({ lote: D.lote, videos });
      try { await navigator.clipboard.writeText(txt); msg('Copiado! Cole no chat do canal.'); } catch (e) { msg('não consegui copiar: toque e segure para copiar', true); }
    }

    desenhar();
  }

  function rota() {
    const [canalId, loteId, aba] = location.hash.replace(/^#\/?/, '').split('/');
    if (canalId && loteId) lote(decodeURIComponent(canalId), decodeURIComponent(loteId), aba === 'postar' ? 'postar' : 'aprovar');
    else inicio();
  }
  window.addEventListener('hashchange', rota);
  rota();
})();
