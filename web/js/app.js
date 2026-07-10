import * as fb from './firebase.js';

/* ============ estado + helpers ============ */
const $ = (s, r = document) => r.querySelector(s);
const state = { profile: null, pool: null, matches: [], preds: {}, unsub: null, tab: 'ranking' };

const DEFAULT_SETTINGS = {
  scoring: { exactScorePoints: 3, winnerPoints: 1, drawPoints: 1, qualifiedTeamPoints: 1 },
  modules: { overallRanking: true, league: false, cup: false, losersCup: false, longTermPredictions: false },
  league: { enabled: false, roundMode: 'matchBlock', matchesPerRound: 4, seedSource: 'manualOrGenerated' },
  cup: { enabled: false, startsAfterLeague: false, cutoffLeagueRound: 17, seedingMode: 'leagueStanding' },
  predictionsVisibility: { mode: 'hidden_until_kickoff' },
};

function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg, type = '') { const t = $('#toast'); t.className = ''; t.textContent = msg; requestAnimationFrame(() => { t.classList.add('show'); if (type) t.classList.add(type); }); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600); }
function openModal(html) { $('#modal-root').innerHTML = `<div class="modal-back" id="mb"><div class="modal">${html}</div></div>`; $('#mb').addEventListener('click', e => { if (e.target.id === 'mb') closeModal(); }); }
function closeModal() { $('#modal-root').innerHTML = ''; }
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); $(id).classList.add('active'); window.scrollTo(0, 0); }
function fmtDate(v) { const d = fb.toDate(v); if (!d) return 'A definir'; return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function spinner() { return '<div class="loading"><div class="spinner"></div></div>'; }
function isLocked(m) { if (m.status && m.status !== 'scheduled') return true; const s = fb.toDate(m.startTime)?.getTime() || 0; return s > 0 && s <= Date.now(); }

/* ============ AUTH ============ */
function renderAuth(mode = 'login') {
  const reg = mode === 'register';
  $('#auth-form').innerHTML = `
    ${reg ? `<div class="field"><label>Nome</label><input id="f-name" placeholder="Seu nome"></div>` : ''}
    <div class="field"><label>E-mail</label><input id="f-email" type="email" placeholder="voce@email.com" autocomplete="email"></div>
    <div class="field"><label>Senha</label><input id="f-pass" type="password" placeholder="••••••••" autocomplete="${reg ? 'new-password' : 'current-password'}"><div class="err" id="f-err"></div></div>
    ${!reg ? `<div style="text-align:right;margin:-6px 0 14px"><a class="auth-toggle" style="font-size:13px" id="f-forgot">Esqueci minha senha</a></div>` : ''}
    <button class="btn gold" id="f-submit">${reg ? 'Cadastrar' : 'Entrar'}</button>
    <div class="auth-toggle">${reg ? 'Já tem conta?' : 'Ainda não tem conta?'} <a id="f-toggle">${reg ? 'Entrar' : 'Criar conta'}</a></div>`;

  $('#f-toggle').onclick = () => renderAuth(reg ? 'login' : 'register');
  const forgot = $('#f-forgot'); if (forgot) forgot.onclick = async () => { const email = $('#f-email').value.trim(); if (!email) return toast('Digite seu e-mail primeiro', 'err'); try { await fb.resetPassword(email); toast('Enviamos um link de recuperação', 'ok'); } catch (e) { toast(fb.authErrorMessage(e), 'err'); } };
  $('#f-submit').onclick = async () => {
    const err = $('#f-err'); err.textContent = '';
    const email = $('#f-email').value.trim(), pass = $('#f-pass').value;
    const btn = $('#f-submit'); btn.disabled = true; btn.textContent = '...';
    try {
      if (reg) { const name = $('#f-name').value.trim(); if (name.length < 2) throw { message: 'Digite seu nome.' }; if (pass.length < 6) throw { message: 'Senha de ao menos 6 caracteres.' }; await fb.register(name, email, pass); }
      else { if (!email || !pass) throw { message: 'Preencha e-mail e senha.' }; await fb.login(email, pass); }
    } catch (e) { err.textContent = e.code ? fb.authErrorMessage(e) : (e.message || 'Erro'); btn.disabled = false; btn.textContent = reg ? 'Cadastrar' : 'Entrar'; }
  };
}

/* ============ HOME ============ */
async function renderHome() {
  show('#screen-home'); $('#pool-tabs').classList.add('hidden'); $('#header-sub').textContent = 'MEUS BOLÕES';
  const el = $('#screen-home');
  el.innerHTML = `
    <div class="btn-row" style="margin-bottom:16px">
      <button class="btn gold" id="h-create">+ Criar bolão</button>
      <button class="btn ghost" id="h-join">Entrar por código</button>
    </div>
    <div class="section-title">Meus bolões</div>
    <div id="h-mypools">${spinner()}</div>
    <div class="section-title" style="margin-top:22px">Bolões oficiais</div>
    <div id="h-official"></div>
    <div class="section-title" style="margin-top:22px">Explorar públicos</div>
    <div id="h-public"></div>`;
  $('#h-create').onclick = openCreatePool;
  $('#h-join').onclick = openJoin;

  const [mine, official, pub] = await Promise.all([
    fb.listMyPools(state.profile.id).catch(() => []),
    fb.listOfficialPools().catch(() => []),
    fb.listPublicPools().catch(() => []),
  ]);
  $('#h-mypools').innerHTML = mine.length ? mine.map(poolCard).join('') : emptyBox('🎯', 'Você ainda não está em nenhum bolão', 'Crie o seu ou entre por um código.');
  $('#h-official').innerHTML = official.length ? official.map(poolCard).join('') : `<p class="note">Nenhum bolão oficial ainda.</p>`;
  const pubOnly = pub.filter(p => !mine.some(m => m.id === p.id));
  $('#h-public').innerHTML = pubOnly.length ? pubOnly.map(poolCard).join('') : `<p class="note">Nenhum bolão público no momento.</p>`;
  el.querySelectorAll('[data-pool]').forEach(c => c.onclick = () => openPool(c.dataset.pool));
}
function poolCard(p) {
  const badge = p.createdByAdmin ? '<span class="badge gold">Oficial</span>' : `<span class="badge gray">${p.isPublic ? 'Público' : 'Privado'}</span>`;
  return `<div class="card pool-card" data-pool="${p.id}" style="cursor:pointer">
    <div class="pool-cover">${p.createdByAdmin ? '⭐' : '⚽'}</div>
    <div class="pool-info"><div class="pn">${esc(p.name)}</div><div class="pc">${esc(p.competitionName || 'Competição')}</div>
    <div class="badges"><span class="badge green">${p.memberCount || 1} 👥</span>${badge}${p.prize ? `<span class="badge gold">🏆 ${esc(p.prize)}</span>` : ''}</div></div></div>`;
}
function emptyBox(ic, t, sub) { return `<div class="empty"><div class="ic">${ic}</div><div class="t">${t}</div><p style="margin-top:6px">${sub || ''}</p></div>`; }

/* ============ CRIAR BOLÃO ============ */
async function openCreatePool() {
  openModal(`<div class="modal-head"><h3>Criar bolão</h3><button class="x" onclick="return false" id="cx">×</button></div><div id="cp-body">${spinner()}</div>`);
  $('#cx').onclick = closeModal;
  const comps = await fb.listCompetitions().catch(() => []);
  const compOptions = comps.map(c => `<option value="${c.id}">${esc(c.name)} ${c.season ? '· ' + esc(c.season) : ''}</option>`).join('');
  $('#cp-body').innerHTML = `
    <div class="field"><label>Nome do bolão</label><input id="cp-name" placeholder="Ex: Bolão da Firma"></div>
    <div class="field"><label>Competição</label>${comps.length ? `<select id="cp-comp">${compOptions}</select>` : `<p class="note" style="text-align:left">Nenhuma competição cadastrada. Peça ao admin para importar uma (painel do admin) ou cadastre pelo app.</p>`}</div>
    <div class="switch-row" style="margin-bottom:14px"><div><div class="st">Bolão público</div><div class="sh">Aparece no Explorar</div></div><input type="checkbox" id="cp-public" style="width:22px;height:22px"></div>
    <div class="field"><label>Pontos por placar exato</label><input id="cp-exact" type="number" value="3"></div>
    <div class="field"><label>Pontos por acertar o vencedor</label><input id="cp-win" type="number" value="1"></div>
    <div class="field"><label>Pontos por acertar o empate</label><input id="cp-draw" type="number" value="1"></div>
    <div class="field"><label>Premiação (opcional)</label><input id="cp-prize" placeholder="Ex: o último paga a pizza 🍕"></div>
    <button class="btn gold" id="cp-go" ${comps.length ? '' : 'disabled'}>Publicar bolão</button>`;
  if (!comps.length) return;
  $('#cp-go').onclick = async () => {
    const name = $('#cp-name').value.trim(); if (name.length < 3) return toast('Dê um nome com 3+ letras', 'err');
    const comp = comps.find(c => c.id === $('#cp-comp').value);
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    settings.scoring.exactScorePoints = Number($('#cp-exact').value) || 3;
    settings.scoring.winnerPoints = Number($('#cp-win').value) || 1;
    settings.scoring.drawPoints = Number($('#cp-draw').value) || 1;
    const btn = $('#cp-go'); btn.disabled = true; btn.textContent = '...';
    try {
      const pool = await fb.createPool(state.profile, { name, description: '', isPublic: $('#cp-public').checked, competitionId: comp.id, competitionName: comp.name, settings, prize: $('#cp-prize').value.trim() });
      closeModal(); toast('Bolão criado!', 'ok'); openPool(pool.id);
    } catch (e) { console.error(e); toast('Falha ao criar. As regras do Firestore estão publicadas?', 'err'); btn.disabled = false; btn.textContent = 'Publicar bolão'; }
  };
}

/* ============ ENTRAR POR CÓDIGO ============ */
function openJoin() {
  openModal(`<div class="modal-head"><h3>Entrar em um bolão</h3><button class="x" id="jx">×</button></div>
    <div class="field"><label>Código de convite</label><input id="j-code" placeholder="Ex: 7K2D9X" style="text-transform:uppercase"><div class="err" id="j-err"></div></div>
    <button class="btn gold" id="j-go">Entrar no bolão</button>`);
  $('#jx').onclick = closeModal;
  $('#j-go').onclick = async () => {
    const code = $('#j-code').value.trim(); const err = $('#j-err'); err.textContent = '';
    if (code.length < 4) { err.textContent = 'Digite o código completo.'; return; }
    const btn = $('#j-go'); btn.disabled = true; btn.textContent = '...';
    try {
      const pool = await fb.findPoolByInvite(code);
      if (!pool) { err.textContent = 'Bolão não encontrado.'; btn.disabled = false; btn.textContent = 'Entrar no bolão'; return; }
      await fb.joinPool(pool, state.profile); closeModal(); toast('Você entrou no bolão!', 'ok'); openPool(pool.id);
    } catch (e) { console.error(e); err.textContent = 'Não foi possível entrar.'; btn.disabled = false; btn.textContent = 'Entrar no bolão'; }
  };
}

/* ============ BOLÃO ============ */
const POOL_TABS = [
  { k: 'visao', t: 'Visão' }, { k: 'ranking', t: 'Ranking' }, { k: 'palpitar', t: 'Palpitar' },
  { k: 'aovivo', t: 'Ao Vivo' }, { k: 'meus', t: 'Meus Pontos' }, { k: 'regras', t: 'Regras' },
];
async function openPool(id) {
  if (state.unsub) { state.unsub(); state.unsub = null; }
  show('#screen-pool'); $('#screen-pool').innerHTML = spinner();
  const pool = await fb.getPool(id);
  if (!pool) { $('#screen-pool').innerHTML = emptyBox('❓', 'Bolão não encontrado'); return; }
  state.pool = pool; state.tab = 'ranking'; state.matches = []; state.preds = {};
  $('#header-sub').textContent = pool.name.toUpperCase().slice(0, 24);
  const tabs = $('#pool-tabs'); tabs.classList.remove('hidden');
  tabs.innerHTML = `<button data-back>‹ Bolões</button>` + POOL_TABS.map(x => `<button data-tab="${x.k}" class="${x.k === state.tab ? 'active' : ''}">${x.t}</button>`).join('');
  tabs.querySelector('[data-back]').onclick = () => { if (state.unsub) { state.unsub(); state.unsub = null; } renderHome(); };
  tabs.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => setPoolTab(b.dataset.tab));

  // assina jogos em tempo real
  state.unsub = fb.subscribeMatches(pool.competitionId, ms => { state.matches = ms; if (['palpitar', 'aovivo', 'meus'].includes(state.tab)) renderPoolTab(); }, () => {});
  // carrega meus palpites
  fb.listUserPredictions(pool.id, state.profile.id).then(list => { state.preds = {}; list.forEach(p => state.preds[p.matchId] = p); if (['palpitar', 'meus'].includes(state.tab)) renderPoolTab(); });
  renderPoolTab();
}
function setPoolTab(k) { state.tab = k; $('#pool-tabs').querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === k)); window.scrollTo(0, 0); renderPoolTab(); }

async function renderPoolTab() {
  const el = $('#screen-pool'); const p = state.pool;
  if (state.tab === 'visao') { el.innerHTML = renderVisao(p); wireVisao(p); return; }
  if (state.tab === 'regras') { el.innerHTML = renderRegras(p); return; }
  if (state.tab === 'ranking') {
    el.innerHTML = `<div class="prize-banner">🏆 Ranking geral</div><div id="rk">${spinner()}</div>`;
    const members = await fb.listPoolMembers(p.id).catch(() => []);
    $('#rk').innerHTML = members.length ? members.map((m, i) => rankRow(m, i)).join('') : emptyBox('📊', 'Sem participantes');
    return;
  }
  if (state.tab === 'palpitar') { el.innerHTML = renderPalpitar(); wirePalpitar(); return; }
  if (state.tab === 'aovivo') { el.innerHTML = renderAoVivo(); return; }
  if (state.tab === 'meus') { el.innerHTML = renderMeus(); return; }
}

function renderVisao(p) {
  return `<div class="card" style="text-align:center">
    <div class="pool-cover" style="width:90px;height:90px;font-size:40px;margin:0 auto 12px">${p.createdByAdmin ? '⭐' : '⚽'}</div>
    <div class="pn" style="font-size:24px;font-family:'Barlow Condensed';font-weight:800">${esc(p.name)}</div>
    <div class="pc" style="color:var(--muted);font-size:13px;margin-top:4px">${esc(p.competitionName || '')}</div>
    <div class="badges" style="justify-content:center;margin-top:10px"><span class="badge green">${p.memberCount || 1} participantes</span><span class="badge gray">${p.isPublic ? 'Público' : 'Privado'}</span></div>
  </div>
  <div class="card" style="display:flex;align-items:center;gap:12px">
    <div style="flex:1"><div style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:1px">Código de convite</div>
    <div style="font-family:'Barlow Condensed';font-weight:800;font-size:26px;color:var(--gold);letter-spacing:2px">${esc(p.inviteCode)}</div></div>
    <button class="btn gold" style="width:auto" id="v-share">Convidar</button>
  </div>
  ${p.prize ? `<div class="card"><div style="color:var(--muted);font-size:11px;text-transform:uppercase">🏆 Premiação</div><div style="margin-top:4px">${esc(p.prize)}</div></div>` : ''}`;
}
function wireVisao(p) {
  const b = $('#v-share'); if (!b) return;
  b.onclick = async () => {
    const text = `Bora pro meu bolão "${p.name}" no Bolão Flex! Código: ${p.inviteCode}`;
    try { if (navigator.share) await navigator.share({ title: 'Bolão Flex', text }); else { await navigator.clipboard.writeText(p.inviteCode); toast('Código copiado!', 'ok'); } }
    catch (e) { try { await navigator.clipboard.writeText(p.inviteCode); toast('Código copiado!', 'ok'); } catch { toast(p.inviteCode); } }
  };
}
function renderRegras(p) {
  const s = p.settings || DEFAULT_SETTINGS;
  const vis = { visible_before_kickoff: 'Palpites visíveis antes do jogo', hidden_until_kickoff: 'Palpites ocultos até o início', hidden_until_round_end: 'Palpites ocultos até o fim da rodada' };
  return `<div class="card"><div class="section-title">Pontuação</div>
    <p style="color:var(--muted);line-height:1.9">• Placar exato: <b style="color:var(--txt)">${s.scoring.exactScorePoints}</b> ponto(s)<br>
    • Acertar o vencedor: <b style="color:var(--txt)">${s.scoring.winnerPoints}</b><br>
    • Acertar o empate: <b style="color:var(--txt)">${s.scoring.drawPoints}</b></p></div>
    <div class="card"><div class="section-title">Regras gerais</div>
    <p style="color:var(--muted);line-height:1.9">• O palpite trava no horário de início do jogo.<br>• Depois disso, não dá pra editar.<br>• A pontuação é calculada com o resultado oficial.<br>• ${vis[s.predictionsVisibility.mode]}.</p></div>`;
}
function rankRow(m, i) {
  const me = m.userId === state.profile.id;
  return `<div class="rank-row ${i < 3 ? 'prize' : ''} ${me ? 'me' : ''}">
    <div class="pos">${i + 1}</div>
    <div class="avatar">${esc(fb.initials(m.userName))}</div>
    <div class="who"><div class="name">${esc(m.userName)}${me ? ' (você)' : ''}</div><div class="sub">${m.exactHits || 0} cravadas</div></div>
    <div class="pts"><span class="num">${m.totalPoints || 0}</span></div></div>`;
}

/* -------- palpitar -------- */
function crest(t) { return t.crestUrl && !/\.svg$/i.test(t.crestUrl) ? `<img class="crest" src="${esc(t.crestUrl)}" alt="">` : '<div class="crest-ph"></div>'; }
function renderPalpitar() {
  if (!state.matches.length) return `<div class="hint">💡 Palpites travam no apito inicial de cada jogo.</div>` + emptyBox('📅', 'Nenhum jogo ainda', 'Os jogos aparecem quando a competição é sincronizada.');
  const rows = state.matches.map(m => {
    const locked = isLocked(m); const saved = state.preds[m.id];
    const vh = saved ? saved.predictedHome : ''; const va = saved ? saved.predictedAway : '';
    const live = m.status === 'live';
    return `<div class="match-card">
      <div class="match-head"><span class="tag">${m.round ? 'Rodada ' + m.round : 'Jogo'}</span><span>${fmtDate(m.startTime)}</span></div>
      <div class="match-body">
        <div class="team">${crest(m.homeTeam)}<div class="tn">${esc(m.homeTeam.shortName || m.homeTeam.name)}</div></div>
        <div class="score-in"><input data-m="${m.id}" data-s="h" inputmode="numeric" maxlength="2" value="${vh}" ${locked ? 'disabled' : ''}><span class="score-x">×</span><input data-m="${m.id}" data-s="a" inputmode="numeric" maxlength="2" value="${va}" ${locked ? 'disabled' : ''}></div>
        <div class="team">${crest(m.awayTeam)}<div class="tn">${esc(m.awayTeam.shortName || m.awayTeam.name)}</div></div>
      </div>
      <div class="match-foot"><span class="lock">${locked ? '🔒 Fechado' : (saved ? '✅ Palpitado' : '🟡 Aberto')}</span>
      ${m.homeScore != null ? `<span class="real ${live ? 'live' : ''}">${live ? 'Parcial' : 'Resultado'}: ${m.homeScore} × ${m.awayScore}</span>` : ''}</div>
    </div>`;
  }).join('');
  return `<div class="hint">💡 Preencha os placares e toque em Salvar. Jogos que começaram ficam travados.</div>${rows}<button class="btn gold" id="pal-save">Salvar palpites</button>`;
}
function wirePalpitar() {
  document.querySelectorAll('#screen-pool .score-in input').forEach(inp => inp.oninput = () => { inp.value = inp.value.replace(/[^0-9]/g, '').slice(0, 2); });
  const b = $('#pal-save'); if (!b) return;
  b.onclick = async () => {
    const byId = {}; state.matches.forEach(m => byId[m.id] = m);
    const drafts = [];
    document.querySelectorAll('#screen-pool .score-in input[data-s="h"]').forEach(h => {
      const id = h.dataset.m; const a = document.querySelector(`#screen-pool .score-in input[data-m="${id}"][data-s="a"]`);
      if (h.value !== '' && a.value !== '') drafts.push({ matchId: id, predictedHome: h.value, predictedAway: a.value });
    });
    if (!drafts.length) return toast('Preencha ao menos um placar', 'err');
    b.disabled = true; b.textContent = '...';
    try {
      const res = await fb.submitPredictions(state.pool.id, state.profile.id, drafts, byId);
      const list = await fb.listUserPredictions(state.pool.id, state.profile.id); state.preds = {}; list.forEach(p => state.preds[p.matchId] = p);
      toast(`${res.saved} palpite(s) salvo(s)` + (res.skipped ? ` · ${res.skipped} ignorado(s)` : ''), 'ok');
      renderPoolTab();
    } catch (e) { console.error(e); toast('Falha ao salvar', 'err'); b.disabled = false; b.textContent = 'Salvar palpites'; }
  };
}

/* -------- ao vivo -------- */
function renderAoVivo() {
  const live = state.matches.filter(m => m.status === 'live');
  const done = state.matches.filter(m => m.status === 'finished').slice(-10).reverse();
  const upcoming = state.matches.filter(m => m.status === 'scheduled').slice(0, 6);
  const row = (m, box) => `<div class="result-row"><div class="rteam">${esc(m.homeTeam.shortName || m.homeTeam.name)}</div>
    <div style="text-align:center"><div class="rscore ${box}">${m.homeScore != null ? m.homeScore : '-'} × ${m.awayScore != null ? m.awayScore : '-'}</div>${m.status === 'live' ? '<div class="min-badge">AO VIVO</div>' : ''}</div>
    <div class="rteam right">${esc(m.awayTeam.shortName || m.awayTeam.name)}</div></div>`;
  let html = '';
  if (live.length) html += `<div class="section-title">🔴 Rolando agora</div>` + live.map(m => row(m, 'livebox')).join('');
  if (done.length) html += `<div class="section-title" style="margin-top:18px">Encerrados</div>` + done.map(m => row(m, '')).join('');
  if (upcoming.length) html += `<div class="section-title" style="margin-top:18px">Próximos</div>` + upcoming.map(m => row(m, '')).join('');
  return html || emptyBox('📺', 'Sem jogos ainda');
}

/* -------- meus pontos -------- */
function renderMeus() {
  const rules = (state.pool.settings || DEFAULT_SETTINGS).scoring;
  let total = 0, exact = 0, winner = 0, played = 0;
  const lines = [];
  for (const m of state.matches) {
    const pr = state.preds[m.id]; if (!pr) continue;
    if (m.status === 'finished' && m.homeScore != null) {
      played++;
      const pts = fb.calcPoints(pr, m.homeScore, m.awayScore, rules);
      total += pts;
      if (pr.predictedHome === m.homeScore && pr.predictedAway === m.awayScore) exact++;
      if (pts > 0) winner++;
      const cls = pts >= rules.exactScorePoints ? 'p3' : pts > 0 ? 'p1' : 'p0';
      lines.push(`<div class="guess-line ${pts > 0 ? 'hit' : ''}"><span class="gm">${esc(m.homeTeam.shortName || m.homeTeam.name)} × ${esc(m.awayTeam.shortName || m.awayTeam.name)}</span><span class="gg">${pr.predictedHome}×${pr.predictedAway} <span style="opacity:.6">(${m.homeScore}×${m.awayScore})</span></span><span class="gp ${cls}">${pts > 0 ? '+' + pts : '0'}</span></div>`);
    }
  }
  const aprov = played ? Math.round((winner / played) * 100) : 0;
  return `<div class="points-hero"><div class="big">${total}</div><div class="cap">seus pontos neste bolão</div>
    <div class="mini-stats"><div class="ms"><div class="v" style="color:var(--green)">${exact}</div><div class="k">Cravadas</div></div>
    <div class="ms"><div class="v" style="color:var(--gold)">${winner}</div><div class="k">Acertos</div></div>
    <div class="ms"><div class="v">${aprov}%</div><div class="k">Aproveit.</div></div></div></div>
    <div class="section-title">Seus palpites já pontuados</div>
    ${lines.length ? lines.reverse().join('') : `<p class="note">Ainda não há jogos encerrados com seus palpites. Palpite e volte depois que os jogos acabarem.</p>`}
    <p class="note">Regra: placar exato +${rules.exactScorePoints} · vencedor +${rules.winnerPoints} · empate +${rules.drawPoints}</p>`;
}

/* ============ BOOT ============ */
$('#btn-logout').onclick = () => fb.logout();
$('#btn-refresh').onclick = () => { if ($('#screen-pool').classList.contains('active')) renderPoolTab(); else renderHome(); };

fb.watchAuth(async (user) => {
  if (user) {
    try { state.profile = await fb.ensureProfile(user); } catch { state.profile = { id: user.uid, name: user.displayName || 'Você', email: user.email }; }
    $('#app-header').classList.remove('hidden');
    renderHome();
  } else {
    state.profile = null; if (state.unsub) { state.unsub(); state.unsub = null; }
    $('#app-header').classList.add('hidden'); $('#pool-tabs').classList.add('hidden');
    show('#screen-auth'); renderAuth('login');
  }
});
