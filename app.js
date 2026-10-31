// Site de aprovação e postagem (HIST ANIMADAS) — gerado pelo _BASE/PUBLICAR/postagem.py; não editar aqui.
// Uma página por canal (#/<CANAL>/aprovar · #/<CANAL>/postar): todos os vídeos que faltam, de todos os lotes, numa fila
// só e em ordem (o lote é só uma etiqueta no cartão). Dados de cada lote: <CANAL>/<LOTE>/dados.json (o postagem.py
// publica). Marcações (aprovado, alterar, postado): estado/<CANAL>-<LOTE>.json no próprio repositório, gravado pela API
// do GitHub com a chave de quem entrou (fica só neste aparelho). Sem chave, a marcação fica neste aparelho e o
// "Copiar pedido" leva ao chat. Vídeo postado em todas as redes sai do site (prévia e arquivo; os textos ficam).
// O vídeo longo e os cortes dele são UM cartão (pedido do dono, 2026-10-23): embaixo do longo, as ideias dos cortes e,
// depois de feitos, os cortes para aprovar e postar; o cartão só sai do site quando o longo e todos os cortes foram postados.
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
  // desde 2026-10-27 aprova-se e posta-se no OMS (o app do dono); esta página fica de reserva e é o depósito que o OMS lê
  const avisoOms = () => SITE.oms ? el('div', { class: 'aviso-topo' }, el('b', {}, 'Agora é no OMS: '),
    'aprovar, pedir alteração e postar ficam no app do dono (Revisar → Animação, Postar). ', el('a', { href: SITE.oms }, 'Abrir o OMS')) : null;

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
  const cheia = a => (a && a.length ? a : null);     // lista vazia (ninguém escolheu ainda) = sem escolha, não "nenhuma"
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

  const numLote = l => parseInt(String(l).replace(/\D/g, ''), 10) || 0;
  async function lotesDoSite() { try { return await json(`lotes.json?t=${Date.now()}`); } catch (e) { return []; } }
  const H = () => ({ Authorization: `Bearer ${chave()}`, Accept: 'application/vnd.github+json' });
  const dataBR = d => String(d || '').slice(0, 10).split('-').reverse().join('/');

  // ---------------------------------------------------------------- página inicial: os canais
  async function inicio() {
    const lotes = await lotesDoSite();
    const canais = {};
    for (const l of lotes) (canais[l.canal] = canais[l.canal] || { nome: l.nome || l.canal, lotes: [] }).lotes.push(l);
    const dados = await Promise.all(lotes.map(l => json(`${l.canal}/${l.lote}/dados.json?t=${Date.now()}`).catch(() => ({ videos: [] }))));
    lotes.forEach((l, i) => { l._videos = dados[i].videos || []; });
    app.replaceChildren(
      el('div', { class: 'topo' }, el('h1', {}, 'Vídeos para aprovar e postar')), avisoOms(),
      el('div', { class: 'lista' }, Object.keys(canais).length ? Object.entries(canais).map(([id, c]) => {
        const vs = c.lotes.flatMap(l => l._videos);
        const vivos = vs.filter(v => !v.removido);
        const aprovados = vivos.filter(v => v.revisao === 'aprovado').length;
        return el('a', { class: 'linha', href: `#/${id}/${aprovados ? 'postar' : 'aprovar'}` },
          el('span', {}, el('b', {}, c.nome), c.lotes.some(l => l.formato === 'longo+cortes') ? ' · YouTube + cortes' : ''),
          el('span', { class: 'selo' }, `${vivos.length - aprovados} para aprovar · ${aprovados} para postar · ${vs.length - vivos.length} postados`));
      }) : el('p', { class: 'vazio' }, 'Nenhum vídeo publicado ainda.')));
  }

  // ---------------------------------------------------------------- a página de um canal
  async function canal(canalId, aba) {
    const lotes = (await lotesDoSite()).filter(l => l.canal === canalId).sort((a, b) => numLote(a.lote) - numLote(b.lote));
    if (!lotes.length) { app.replaceChildren(el('p', { class: 'vazio' }, 'Canal não encontrado. ', el('a', { href: '#/' }, 'Voltar'))); return; }
    // um contexto por lote: onde moram os dados, as marcações e o que falta gravar
    const ctxs = await Promise.all(lotes.map(async l => {
      const c = { lote: l.lote, base: `${canalId}/${l.lote}/`, arq: `estado/${canalId}-${l.lote}.json`, LOCAL: `site-${canalId}-${l.lote}`,
                  pendentes: new Set(), timer: null };
      c.D = await json(`${c.base}dados.json?t=${Date.now()}`).catch(() => ({ videos: [], canal: { nome: l.nome } }));
      c.E = (await lerEstado(c.arq)).dados;
      c.local = guarda.ler(c.LOCAL, { videos: {} });
      if (!chave()) c.E = { ...c.E, videos: { ...(c.E.videos || {}), ...c.local.videos } };
      c.E.videos = c.E.videos || {};
      return c;
    }));
    const nome = ((ctxs.find(c => c.D.canal) || {}).D || {}).canal?.nome || canalId;
    const videos = ctxs.flatMap(c => (c.D.videos || []).map(v => Object.assign(v, { _c: c })));

    const marcaDe = v => v._c.E.videos[v.id] || {};
    const parteValida = (v, p) => { const m = marcaDe(v).partes || {}; return m[p] && m[p].v === (v.v || {})[p] ? m[p] : null; };
    // vídeo já aprovado cuja embalagem foi refeita (postagem.py embalagem): o vídeo segue aprovado, o resto volta a aprovar
    const parteJaAprovada = (v, p) => v.revisao === 'aprovado' && (!v.embalagem_pendente || p === 'video');
    function aprovado(v) {
      if (v.revisao === 'aprovado' && !v.embalagem_pendente) return true;
      const ps = Object.keys(v.v || {});
      return ps.length > 0 && ps.every(p => (parteValida(v, p) || {}).acao === 'aprovado' || (!parteValida(v, p) && parteJaAprovada(v, p)));
    }
    // ---- a família do vídeo longo: os cortes dele (mesmo lote, `de` = o longo) moram no cartão dele
    const cortesDe = L => videos.filter(v => v.tipo === 'corte' && v._c === L._c && (v.de || 'V01') === L.id).sort((a, b) => (a.corte || 0) - (b.corte || 0));
    const longoDe = v => v.tipo === 'corte' ? videos.find(L => L.tipo === 'longo' && L._c === v._c && L.id === (v.de || 'V01')) || null : null;
    const temFamilia = L => !!L && L.tipo === 'longo' && ((L.cortes_plano || []).length > 0 || cortesDe(L).length > 0);
    const platsDe = v => v.tipo === 'longo' ? ['youtube'] : [...new Set((v.plataformas || ['tiktok', 'instagram', 'youtube']).map(p => p === 'shorts' ? 'youtube' : p))];
    const postadoEm = v => { const m = marcaDe(v); return !!v.removido || !!m.concluido || platsDe(v).every(p => (m.postado || {})[p]); };
    const familiaPostada = L => postadoEm(L) && cortesDe(L).length >= (L.cortes_plano || []).length && cortesDe(L).every(postadoEm);
    async function gravarPendentes(c) {
      const ids = [...c.pendentes]; c.pendentes.clear();
      if (!ids.length) return true;
      try {
        const novo = await gravarEstado(c.arq, d => { for (const i of ids) d.videos[i] = c.E.videos[i]; });
        c.E = novo; c.E.videos = c.E.videos || {}; msg('salvo ✓'); return true;
      } catch (e) { msg(`não salvou: ${e.message}`, true); ids.forEach(i => c.pendentes.add(i)); return false; }
    }
    function salvar(v, mudar, agora) {
      const c = v._c;
      c.E.videos[v.id] = c.E.videos[v.id] || {}; mudar(c.E.videos[v.id]);
      if (!chave()) { c.local.videos[v.id] = c.E.videos[v.id]; guarda.gravar(c.LOCAL, c.local); msg('marcado neste aparelho'); return Promise.resolve(false); }
      c.pendentes.add(v.id); msg('salvando…');
      clearTimeout(c.timer);
      if (agora) return gravarPendentes(c);
      c.timer = setTimeout(() => gravarPendentes(c), 1200);
      return Promise.resolve(true);
    }

    // ---- tirar do site o vídeo já postado (pedido do dono: não fica pesando). O original fica no computador de quem fez.
    async function apagarArquivo(caminho) {
      const r = await fetch(`${api(caminho)}?ref=${RAMO}`, { headers: H(), cache: 'no-store' });
      if (!r.ok) return;
      const { sha } = await r.json();
      await fetch(api(caminho), { method: 'DELETE', headers: H(), body: JSON.stringify({ message: `postado: tira ${caminho}`, sha, branch: RAMO }) });
    }
    async function editarDados(c, mudar, tentativa = 1) {
      const caminho = `${c.base}dados.json`;
      const r = await fetch(`${api(caminho)}?ref=${RAMO}`, { headers: H(), cache: 'no-store' });
      if (!r.ok) throw new Error(`não li ${caminho} (${r.status})`);
      const j = await r.json(), d = JSON.parse(b64.de(j.content));
      mudar(d);
      const w = await fetch(api(caminho), { method: 'PUT', headers: H(), body: JSON.stringify({ message: `postado: ${canalId} ${c.lote}`, content: b64.para(JSON.stringify(d, null, 1)), sha: j.sha, branch: RAMO }) });
      if ((w.status === 409 || w.status === 422) && tentativa < 3) return editarDados(c, mudar, tentativa + 1);
      if (!w.ok) throw new Error(`o GitHub respondeu ${w.status}`);
    }
    async function tirarDoSite(v) {
      if (!chave()) { msg('Para o vídeo sair do site, toque em Entrar (com a chave).', true); return; }
      const c = v._c, tag = `${canalId}-${c.lote}`;
      msg(`tirando ${c.lote} ${v.id} do site…`);
      try {
        const r = await fetch(`https://api.github.com/repos/${SITE.repo}/releases/tags/${tag}`, { headers: H() });
        if (r.ok) {
          const rel = await r.json();
          const ativos = await (await fetch(`https://api.github.com/repos/${SITE.repo}/releases/${rel.id}/assets?per_page=100`, { headers: H() })).json();
          for (const a of ativos) if (a.name.startsWith(`${tag}-${v.id}-`))
            await fetch(`https://api.github.com/repos/${SITE.repo}/releases/assets/${a.id}`, { method: 'DELETE', headers: H() });
        }
        for (const arq of [v.previa, v.capa, ...(v.thumbs || []).map(x => x.arquivo)].filter(Boolean)) await apagarArquivo(c.base + arq);
        const hoje = new Date().toISOString().slice(0, 10);
        await editarDados(c, d => { const x = (d.videos || []).find(y => y.id === v.id);
          if (x) { Object.assign(x, { removido: hoje, previa: null, capa: null, download: null }); (x.thumbs || []).forEach(y => { y.arquivo = null; }); } });
        Object.assign(v, { removido: hoje, previa: null, capa: null, download: null });
        desenhar(); msg(`${c.lote} ${v.id} saiu do site ✓`);
      } catch (e) { msg(`não tirei do site: ${e.message} (o assistente tira depois)`, true); }
    }

    function copiar(rotulo, texto) {
      const b = el('button', { class: 'copiar', onclick: async () => {
        try { await navigator.clipboard.writeText(texto); }
        catch (e) { const t2 = el('textarea', {}, texto); t2.style.display = 'block'; document.body.append(t2); t2.select(); document.execCommand('copy'); t2.remove(); }
        b.textContent = 'Copiado ✓'; b.classList.add('feito'); setTimeout(() => { b.textContent = 'Copiar'; b.classList.remove('feito'); }, 1800);
      } }, 'Copiar');
      return el('div', { class: 'texto' }, el('div', { class: 'rotulo' }, el('span', {}, rotulo), b), el('pre', {}, texto));
    }
    function player(v) {
      if (v.removido) return el('p', { class: 'vazio' }, `postado — o vídeo saiu do site em ${dataBR(v.removido)}`);
      return v.previa ? el('video', { src: v._c.base + v.previa, poster: v.capa ? v._c.base + v.capa : null, controls: true, preload: 'metadata', playsinline: true })
                      : el('p', { class: 'vazio' }, 'sem vídeo ainda');
    }
    const numero = v => v.numero ? `nº ${String(v.numero).padStart(3, '0')} · ` : '';          // o mesmo do arquivo em PRONTOS/
    const rotuloVideo = v => numero(v) + (v.tipo === 'longo' ? `${v.id} · vídeo do YouTube` : v.tipo === 'corte' ? `${v.id} · corte ${v.corte} de ${v.de}` : v.id);

    // ---- aba Aprovar
    function cartaoAprovar(v) {
      const m = marcaDe(v);
      const card = el('article', { class: `card${v.tipo === 'longo' ? ' longo' : ''}${v.tipo === 'corte' && longoDe(v) ? ' sub' : ''}`, dataset: { id: v.id } });
      const estadoCard = () => {
        const es = [...card.querySelectorAll(':scope > .parte')].map(p => p.dataset.estado || 'pendente');   // só as do cartão (os cortes têm as deles)
        card.dataset.estado = es.includes('alterar') ? 'alterar' : es.length && es.every(e => e === 'aprovado') ? 'aprovado' : 'pendente';
      };
      const registrar = () => {
        estadoCard();
        salvar(v, x => {
          x.versao = v.versao; x.partes = {};
          card.querySelectorAll(':scope > .parte').forEach(p => { x.partes[p.dataset.parte] = { acao: p.dataset.estado || 'pendente', pedido: p.querySelector('textarea').value.trim(), v: (v.v || {})[p.dataset.parte] }; });
          x.acao = card.dataset.estado;
          const alt = Object.entries(x.partes).filter(([, y]) => y.acao === 'alterar');
          x.pedido = alt.map(([k, y]) => (Object.keys(x.partes).length > 1 ? PARTES[k] + ': ' : '') + y.pedido).join(' · ');
          const tt = card.querySelector(':scope > .parte input[type=radio]:checked'); if (tt) x.titulo = +tt.value;
          if (card.querySelector(':scope > .parte input.teste')) x.titulos_teste = [...card.querySelectorAll(':scope > .parte input.teste:checked')].map(c2 => +c2.value);
          if (card.querySelector(':scope > .parte .thumbs input[type=checkbox]')) x.thumbs = [...card.querySelectorAll(':scope > .parte .thumbs input[type=checkbox]:checked')].map(c2 => +c2.value);
          x.quando = new Date().toISOString();
        });
        contar();
      };
      const parte = (nomeParte, titulo, conteudo, dica) => {
        const ja = parteValida(v, nomeParte) || (parteJaAprovada(v, nomeParte) ? { acao: 'aprovado', pedido: '' } : null);
        const ta = el('textarea', { placeholder: dica }, ja ? ja.pedido || '' : '');
        const p = el('div', { class: 'parte', dataset: { parte: nomeParte, estado: ja ? ja.acao : 'pendente' } },
          titulo && el('h4', {}, ...titulo), conteudo,
          el('div', { class: 'botoes' },
            el('button', { class: 'ok', onclick: () => { p.dataset.estado = p.dataset.estado === 'aprovado' ? 'pendente' : 'aprovado'; registrar(); } }, '✅ Aprovar'),
            el('button', { class: 'alt', onclick: () => { p.dataset.estado = p.dataset.estado === 'alterar' ? 'pendente' : 'alterar'; registrar(); if (p.dataset.estado === 'alterar') ta.focus(); } }, '✏️ Alterar')),
          ta);
        ta.addEventListener('input', registrar);
        return p;
      };
      card.append(el('header', {}, el('b', {}, rotuloVideo(v)), el('span', {}, el('span', { class: 'selo' }, v._c.lote), ` ${v.versao} · ${mmss(v.duracao)}`)));
      if (v.tipo === 'longo' && temFamilia(v)) card.append(passos(v));
      if (v.embalagem_pendente) card.append(el('p', { class: 'post destaque' }, '🔁 Título, thumbnails e descrição refeitos — o vídeo continua aprovado: aprove o que mudou.'));
      card.append(player(v));
      if (v.tipo !== 'longo') {
        card.append(el('h3', {}, v.titulo || ''), el('p', { class: 'post' }, v.legenda || ''),
          parte('video', null, null, 'O que mudar neste vídeo? (ex.: o personagem some no fim)'));
      } else {
        card.append(parte('video', ['Vídeo'], null, 'O que mudar no vídeo? (diga o minuto)'));
        const nThumbs = (v.thumbs || []).filter(x => x.arquivo).length;
        if (!v.removido && nThumbs < 3) card.append(el('p', { class: 'post' }, `⚠ ${nThumbs ? `só ${nThumbs} de 3 thumbnails` : 'sem as 3 thumbnails'} — o assistente faz antes de postar (/animar).`));
        if (v.titulos && v.titulos.length) {
          const esc = m.titulo || v.titulos.indexOf(v.titulo_escolhido) + 1 || 1;
          // mais de 3 opções: o principal (●) + até 2 para o Testar e comparar do YouTube (☑), que testa até 3 títulos
          const muitos = v.titulos.length > 3;
          const teste0 = m.titulos_teste || v.titulos_teste || v.titulos.map((_, k) => k + 1).filter(k => k !== esc).slice(0, 2);
          const tits = v.titulos.map((tt, k) => el('div', { class: 'tit' },
            el('label', { class: 'tit-l' }, el('input', { type: 'radio', name: `t-${v._c.lote}-${v.id}`, value: k + 1, checked: esc === k + 1, onchange: e => {
              const b = e.target.closest('.tit').querySelector('input.teste'); if (b) b.checked = false;
              registrar(); } }),
              el('span', {}, tt, ' ', el('small', {}, `${tt.length} caracteres`))),
            muitos ? el('label', { class: 'teste-l' }, el('input', { type: 'checkbox', class: 'teste', value: k + 1, checked: teste0.includes(k + 1) && esc !== k + 1, onchange: e => {
              const marcados = card.querySelectorAll(':scope > .parte input.teste:checked');
              const radio = e.target.closest('.tit').querySelector('input[type=radio]');
              if (e.target.checked && (marcados.length > 2 || radio.checked)) { e.target.checked = false; msg(radio.checked ? 'esse já é o principal' : 'o teste do YouTube leva o principal + 2', true); return; }
              registrar(); } }), ' no teste') : null));
          card.append(parte('titulo', ['Título ', el('small', {}, muitos ? '● o principal · ☑ até 2 para o Testar e comparar' : 'escolha 1 — os outros vão para o Testar e comparar')], tits, 'O que mudar no título?'));
          const marcadas = m.thumbs || cheia(v.thumbs_escolhidas) || (v.thumbs || []).map(x => x.n);
          const ths = el('div', { class: 'thumbs' }, (v.thumbs || []).filter(x => x.arquivo).map(x => el('figure', {}, el('img', { src: v._c.base + x.arquivo, alt: `thumb ${x.n}`, loading: 'lazy' }),
            el('figcaption', {}, el('label', {}, el('input', { type: 'checkbox', value: x.n, checked: marcadas.includes(x.n), onchange: registrar }), ' no teste A/B'),
              `· ${x.texto || ''} · `, el('a', { href: v._c.base + x.arquivo, download: '' }, 'baixar')))));
          card.append(parte('thumbs', ['Thumbnails ', el('small', {}, 'a 1ª marcada é a principal')], ths, 'O que mudar nas thumbnails? (diga qual: 1, 2 ou 3)'));
          card.append(parte('descricao', ['Descrição, tags e comentário fixado'],
            [copiar('Descrição', v.descricao || ''), copiar('Tags', v.tags || ''), copiar('Comentário fixado', v.comentario || '')], 'O que mudar na descrição, nas tags ou no comentário?'));
        }
        if (temFamilia(v)) card.append(secaoCortes(v, 'aprovar'));
      }
      estadoCard();
      return card;
    }

    // ---- os passos do vídeo longo com cortes: aprovar o longo → os cortes são feitos → aprovar os cortes → postar tudo
    function passos(L) {
      const cs = cortesDe(L), plano = (L.cortes_plano || []).length, total = Math.max(plano, cs.length);
      const okL = aprovado(L), okC = cs.length >= plano && cs.length > 0 && cs.every(aprovado);
      const passo = (feito, agora, txt) => el('li', { class: feito ? 'feito' : agora ? 'agora' : '' }, (feito ? '✓ ' : '') + txt);
      return el('ol', { class: 'passos' },
        passo(okL, !okL, 'Aprovar o vídeo longo'),
        passo(cs.length >= plano && cs.length > 0, okL && cs.length < plano, cs.length ? `Cortes feitos (${cs.length} de ${total})` : `Fazer os ${total} cortes (o assistente, depois da aprovação)`),
        passo(okC, okL && cs.length > 0 && !okC, 'Aprovar os cortes'),
        passo(familiaPostada(L), okL && okC, 'Postar tudo — aí o cartão sai do site'));
    }

    // ---- embaixo do longo: cada corte planejado (a ideia) ou feito (o vídeo, para aprovar ou postar)
    function secaoCortes(L, modo) {
      const cs = cortesDe(L), plano = L.cortes_plano || [];
      const ns = [...new Set([...plano.map(x => x.n), ...cs.map(c => c.corte)])].filter(x => x != null).sort((a, b) => a - b);
      const itens = ns.map(n => {
        const c = cs.find(x => x.corte === n), ideia = plano.find(x => x.n === n);
        if (c && !c.removido && modo === 'aprovar') return cartaoAprovar(c);
        if (c && modo === 'postar' && aprovado(c)) return cartaoPostar(c);
        const quando = ideia && ideia.inicio != null ? ` · ${mmss(ideia.inicio)}–${mmss(ideia.fim)} do longo` : '';
        const estado = c ? (c.removido ? 'postado ✓' : 'feito — falta aprovar (aba Aprovar)') : (aprovado(L) ? 'o assistente faz agora (/cortes)' : 'feito depois que o longo for aprovado');
        return el('div', { class: 'ideia' },
          el('b', {}, `Corte ${n}${quando}`), el('span', { class: 'selo' }, estado),
          ideia && ideia.ideia ? el('p', {}, ideia.ideia) : null,
          ideia && ideia.gancho ? el('p', { class: 'gancho' }, `Abre com: “${ideia.gancho}”`) : null);
      });
      return el('section', { class: 'cortes-secao' },
        el('h4', {}, 'Cortes para TikTok, Instagram e Shorts ', el('small', {}, `${ns.length} · cada um é um vídeo vertical de 61–75 s`)),
        el('div', { class: 'cortes' }, itens));
    }

    // ---- aba Postar (a fila: o mais antigo primeiro)
    function cartaoPostar(v, ordem, total) {
      const m = marcaDe(v);
      const postado = m.postado || {};
      const tits = v.titulos || [];
      const tit = v.tipo === 'longo' ? tits[(m.titulo || tits.indexOf(v.titulo_escolhido) + 1 || 1) - 1] || v.titulo : v.titulo;
      const card = el('article', { class: `card${v.tipo === 'longo' ? ' longo' : ''}${v.tipo === 'corte' && longoDe(v) ? ' sub' : ''}`, dataset: { estado: Object.values(postado).some(Boolean) ? 'aprovado' : 'pendente' } },
        el('header', {}, el('b', {}, ordem ? `${ordem} de ${total} · ` : '', rotuloVideo(v)), el('span', {}, el('span', { class: 'selo' }, v._c.lote), ` ${mmss(v.duracao)}`)),
        player(v),
        el('div', { class: 'botoes' }, v.download ? el('a', { class: 'botao primario', href: v.download, download: '' }, '⬇️ Baixar vídeo') : el('span', { class: 'selo' }, 'sem arquivo para baixar')),
        el('p', { class: 'post' }, 'No iPhone: Baixar → toque na setinha de downloads → abra o vídeo → Compartilhar → Salvar vídeo (vai para as Fotos).'));
      if (v.tipo === 'longo') {
        const ths = cheia(m.thumbs) || cheia(v.thumbs_escolhidas) || (v.thumbs || []).map(x => x.n);
        const iTit = (m.titulo || tits.indexOf(v.titulo_escolhido) + 1 || 1);
        const teste = (cheia(m.titulos_teste) || cheia(v.titulos_teste) || tits.map((_, k) => k + 1).filter(k => k !== iTit).slice(0, 2)).filter(k => k !== iTit).map(k => tits[k - 1]).filter(Boolean);
        card.append(copiar('Título', tit || ''), teste.length ? copiar('Títulos do Testar e comparar (YouTube Studio)', teste.join('\n')) : null, copiar('Descrição', v.descricao || ''), copiar('Tags', v.tags || ''), copiar('Comentário fixado', v.comentario || ''),
          el('div', { class: 'thumbs' }, (v.thumbs || []).filter(x => x.arquivo && ths.includes(x.n)).map((x, k) => el('figure', {}, el('img', { src: v._c.base + x.arquivo, alt: '' }),
            el('figcaption', {}, el('a', { href: v._c.base + x.arquivo, download: '' }, k ? `baixar thumb do teste ${k + 1}` : 'baixar thumb principal'))))),
          el('p', { class: 'post' }, 'YouTube Studio → Detalhes: título, descrição, tags, thumbnail principal. "Não é para crianças". Depois: Testar e comparar com as outras thumbs/títulos.'));
      } else {
        card.append(copiar('Título (YouTube Shorts)', tit || ''), copiar('Legenda (TikTok)', v.legenda_tiktok || ''), copiar('Legenda (Instagram)', v.legenda_instagram || ''));
      }
      const plats = platsDe(v);
      const L = v.tipo === 'longo' ? v : longoDe(v), familia = temFamilia(L);
      const marcar = async (p, sim) => {
        const ok = await salvar(v, x => { x.postado = { ...(x.postado || {}), [p]: sim ? new Date().toISOString().slice(0, 10) : null }; }, true);
        if (ok) depoisDePostar(v);
      };
      const rotuloTudo = familia ? `✅ Postei ${v.tipo === 'longo' ? 'o vídeo longo' : 'este corte'} em tudo` : '✅ Postei em tudo — tirar do site';
      let confirmar = false;
      const tudoBotao = el('button', { onclick: async () => {
        if (!familia && !confirmar) { confirmar = true; tudoBotao.textContent = 'Toque de novo para tirar do site'; setTimeout(() => { confirmar = false; tudoBotao.textContent = rotuloTudo; }, 4000); return; }
        if (await salvar(v, x => { x.concluido = new Date().toISOString().slice(0, 10); }, true)) depoisDePostar(v);
      } }, rotuloTudo);
      card.append(el('div', { class: 'postado' }, plats.map(p => el('label', {},
        el('input', { type: 'checkbox', checked: !!postado[p], onchange: e => marcar(p, e.target.checked) }),
        el('span', {}, `postado no ${PLATS[p] || p}`)))),
        el('div', { class: 'botoes' }, tudoBotao),
        el('p', { class: 'post' }, familia
          ? 'O cartão inteiro (o longo e todos os cortes) sai do site sozinho quando tudo estiver postado. Os textos ficam.'
          : 'Marcou todas as redes (ou tocou em "Postei em tudo"): o vídeo sai do site sozinho, para não pesar. Os textos ficam.'));
      if (v.tipo === 'longo' && familia) card.append(secaoCortes(v, 'postar'));
      return card;
    }

    // postado: sozinho sai na hora; na família do longo, só quando o longo e todos os cortes foram postados
    async function depoisDePostar(v) {
      const L = v.tipo === 'longo' ? v : longoDe(v);
      if (temFamilia(L)) {
        if (!familiaPostada(L)) { desenhar(); msg('marcado ✓ — o cartão sai do site quando o longo e todos os cortes forem postados'); return; }
        for (const x of [L, ...cortesDe(L)]) if (!x.removido) await tirarDoSite(x);
        return;
      }
      if (postadoEm(v)) tirarDoSite(v);
    }

    // um cartão por vídeo solto e um por família (o longo + os cortes dele); o corte da família não tem cartão próprio
    function grupos() {
      const soltos = videos.filter(v => !(v.tipo === 'corte' && longoDe(v)));
      const vivo = v => temFamilia(v) ? !familiaPostada(v) || [v, ...cortesDe(v)].some(x => !x.removido) : !v.removido;
      const membros = v => temFamilia(v) ? [v, ...cortesDe(v)] : [v];
      const cartoes = soltos.filter(vivo);
      return {
        paraAprovar: cartoes.filter(v => membros(v).some(x => !x.removido && !aprovado(x))),
        paraPostar: cartoes.filter(aprovado),            // na família, o longo aprovado abre o cartão; os cortes entram quando aprovados
        esperandoCortes: cartoes.filter(v => temFamilia(v) && aprovado(v) && cortesDe(v).length < (v.cortes_plano || []).length),
        postados: videos.filter(v => v.removido),
      };
    }
    function contar() {
      const g = grupos(), c = document.getElementById('conta');
      if (c) c.textContent = `${g.paraAprovar.length} para aprovar · ${g.paraPostar.length} para postar · ${g.postados.length} postados`;
    }
    function desenhar() {
      const g = grupos();
      const botoesTopo = [];
      if (aba === 'aprovar' && !chave()) botoesTopo.push(el('button', { onclick: () => copiarPedido() }, 'Copiar pedido'));
      botoesTopo.push(chave() ? el('button', { onclick: () => { guarda.apagar('site-chave'); canal(canalId, aba); } }, 'Sair')
                             : el('button', { onclick: () => dialogoEntrar(() => canal(canalId, aba)) }, 'Entrar'));
      const ir = a => () => { location.hash = `#/${canalId}/${a}`; };
      app.replaceChildren(
        el('div', { class: 'topo' },
          el('h1', {}, el('a', { href: '#/' }, '‹ '), `${nome} `, el('small', { id: 'conta' })),
          el('div', { class: 'abas' },
            el('button', { 'aria-pressed': aba === 'aprovar', onclick: ir('aprovar') }, `Aprovar (${g.paraAprovar.length})`),
            el('button', { 'aria-pressed': aba === 'postar', onclick: ir('postar') }, `Postar (${g.paraPostar.length})`)),
          el('span', { id: 'msg' }), ...botoesTopo),
        el('main', {}, avisoOms(),
          !chave() && el('div', { class: 'aviso-topo' }, aba === 'aprovar'
            ? 'Sem entrar, o que você marca fica só neste aparelho: depois toque em "Copiar pedido" e cole no chat do canal (/ajustes). Entrando, fica salvo no site na hora.'
            : 'Sem entrar, o "postado" fica só neste aparelho e o vídeo não sai do site. Toque em Entrar (a chave o dono manda).'),
          aba === 'postar'
            ? [g.paraPostar.length ? g.paraPostar.map((v, k) => cartaoPostar(v, k + 1, g.paraPostar.length))
                                   : el('p', { class: 'vazio' }, g.postados.length ? 'Tudo postado ✓' : 'Nenhum vídeo aprovado ainda.'),
               g.postados.length ? el('div', { class: 'aviso-topo' }, el('b', {}, `Já postados (${g.postados.length}) — saíram do site: `),
                 g.postados.map(v => `${v._c.lote} ${v.id} ${v.titulo || ''}`).join(' · ')) : null]
            : [g.paraAprovar.length ? g.paraAprovar.map(cartaoAprovar) : el('p', { class: 'vazio' }, 'Nada esperando aprovação ✓'),
               g.esperandoCortes.length ? el('div', { class: 'aviso-topo' }, `${g.esperandoCortes.length} vídeo(s) longo(s) aprovado(s) esperando os cortes — o assistente faz (/cortes) e eles aparecem aqui, embaixo do longo.`) : null,
               g.paraPostar.length ? el('div', { class: 'aviso-topo' }, `${g.paraPostar.length} aprovado(s) esperando postagem — aba Postar.`) : null]));
      contar();
    }

    async function copiarPedido() {
      const linhas = ctxs.map(c => {
        const vs = (c.D.videos || []).map(v => [v, marcaDe(v)]).filter(([v, x]) => ['aprovado', 'alterar'].includes(x.acao) && x.versao === v.versao)
          .map(([v, x]) => ({ id: v.id, acao: x.acao, ...(x.acao === 'alterar' ? { pedido: x.pedido } : {}),
            ...(Object.keys(x.partes || {}).length > 1 ? { partes: Object.fromEntries(Object.entries(x.partes).filter(([, y]) => y.acao === 'alterar').map(([k, y]) => [k, y.pedido])) } : {}),
            ...(x.titulo ? { titulo: x.titulo } : {}), ...(x.titulos_teste ? { titulos_teste: x.titulos_teste } : {}), ...(x.thumbs ? { thumbs: x.thumbs } : {}) }));
        return vs.length ? '/ajustes ' + JSON.stringify({ lote: c.lote, videos: vs }) : null;
      }).filter(Boolean);
      if (!linhas.length) { msg('nada marcado ainda', true); return; }
      try { await navigator.clipboard.writeText(linhas.join('\n')); msg('Copiado! Cole no chat do canal.'); } catch (e) { msg('não consegui copiar: toque e segure para copiar', true); }
    }

    desenhar();
  }

  // #/<CANAL>/aprovar · #/<CANAL>/postar (os links antigos #/<CANAL>/LOTE-NN/… abrem a página do canal)
  function rota() {
    const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    if (!partes.length) { inicio(); return; }
    canal(partes[0], partes.includes('postar') ? 'postar' : 'aprovar');
  }
  window.addEventListener('hashchange', rota);
  rota();
})();
