/* KJ Credit Analyst v2 — Simulation Engine + 승인신청서 출력 모달
 * 변경점 (vs script.js):
 *   1. 좌측에 입력자료 + 참고자료(분리) 동시 렌더
 *   2. Stage 8 완료 시 "최종 산출물" 배너 + 승인신청서 출력 버튼 활성화
 *   3. 모달에 광주은행 표준 승인신청서 HTML 양식 렌더링 (인쇄 가능)
 */
'use strict';

const state = {
  agents: null, stages: null, data: null,
  running: false, selectedStage: null,
  stageStates: {}, stageProgress: {}, fileStates: {},
  aiOpinion: {
    expanded: false,
    editing: false,
    original: null,  // AI가 처음 생성한 의견
    current: null,   // 현재 보존 중인 텍스트 (사용자 수정 후 저장된 값 포함)
    modified: false, // 사용자 수정 여부
  },
};
const SPEED = 1;

// ─────────────────────────────────────────────────────────────────
async function boot() {
  try {
    if (location.protocol === 'file:' && window.__KJ_DATA) {
      const b = window.__KJ_DATA;
      state.agents = b.agents;
      state.stages = b.stages.stages;
      state.data = b.dataset;
    } else {
      const [a, s, d] = await Promise.all([
        fetch('data/agents.json').then(r => r.json()),
        fetch('data/stages.json').then(r => r.json()),
        fetch('data/hst_dataset.json').then(r => r.json()),
      ]);
      state.agents = a; state.stages = s.stages; state.data = d;
    }
  } catch (e) {
    if (window.__KJ_DATA) {
      const b = window.__KJ_DATA;
      state.agents = b.agents;
      state.stages = b.stages.stages;
      state.data = b.dataset;
    } else {
      document.body.innerHTML = `<div style="padding:40px;color:#b71c1c;">
        <h2>⚠ 데이터 로드 실패</h2><p>로컬 웹서버 필요: <code>python3 -m http.server 8000</code></p>
        <p>에러: ${e.message}</p></div>`;
      return;
    }
  }

  state.stages.forEach(s => state.stageStates[s.no] = 'wait');

  renderFiles();
  renderRefFiles();
  renderPipeline();

  document.getElementById('btn-start').addEventListener('click', startSimulation);
  document.getElementById('btn-reset').addEventListener('click', resetAll);
  document.getElementById('btn-print-app').addEventListener('click', openModal);
  document.getElementById('btn-print-bottom').addEventListener('click', openModal);
  document.getElementById('btn-modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-modal-print').addEventListener('click', () => window.print());
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !state.running) { e.preventDefault(); startSimulation(); }
    if (e.code === 'Escape') {
      if (!document.getElementById('modal-overlay').classList.contains('hidden')) closeModal();
      else resetAll();
    }
    if (e.code >= 'Digit1' && e.code <= 'Digit8') {
      const n = parseInt(e.code.replace('Digit', ''));
      if (state.stageStates[n] === 'done') selectStage(n);
    }
    if (e.code === 'KeyP' && (e.metaKey || e.ctrlKey) === false &&
        !document.getElementById('btn-print-app').disabled) {
      openModal();
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// LEFT — 입력 자료 트리
// ─────────────────────────────────────────────────────────────────
function renderFiles() {
  const tree = document.getElementById('file-tree');
  tree.innerHTML = '';
  const cats = state.data.files;
  let total = 0;
  Object.entries(cats).forEach(([catName, files]) => {
    total += files.length;
    const catEl = document.createElement('div');
    catEl.className = 'file-cat';
    catEl.innerHTML = `
      <div class="file-cat-head">
        <span>${catName}</span>
        <span class="file-cat-count">${files.length}</span>
      </div>
      <ul class="file-list">
        ${files.map(f => {
          state.fileStates[f.name] = 'wait';
          return `<li class="file-item ${f.highlight ? 'highlight' : ''}" data-file="${cssEscape(f.name)}">
            <span class="fname">${f.name}</span>
            <span class="fsize">${f.size_mb}MB</span>
          </li>`;
        }).join('')}
      </ul>`;
    tree.appendChild(catEl);
  });
  document.getElementById('files-progress').textContent = `0 / ${total}`;
}

// LEFT — 참고자료 (입력 X, 학습/검증용)
function renderRefFiles() {
  const tree = document.getElementById('ref-tree');
  tree.innerHTML = '';
  const refs = state.data.reference_files || {};
  Object.entries(refs).forEach(([catName, files]) => {
    const head = document.createElement('div');
    head.style.fontSize = '10px';
    head.style.color = '#5d4037';
    head.style.marginBottom = '4px';
    head.style.padding = '2px 6px';
    head.textContent = catName;
    tree.appendChild(head);
    files.forEach(f => {
      const li = document.createElement('div');
      li.className = 'ref-item';
      li.innerHTML = `
        <div style="flex:1;">
          <div class="fname">${f.name}</div>
          ${f.type ? `<span class="fnote">${f.type}</span>` : ''}
        </div>
        <span class="fsize">${f.size_mb}MB</span>`;
      tree.appendChild(li);
    });
  });
}

function setFileState(fname, st) {
  state.fileStates[fname] = st;
  const el = document.querySelector(`[data-file="${cssEscape(fname)}"]`);
  if (el) {
    el.classList.remove('processing', 'done');
    if (st === 'processing') el.classList.add('processing');
    if (st === 'done') el.classList.add('done');
  }
}
function cssEscape(s) { return s.replace(/(["\\])/g, '\\$1'); }
function updateFilesProgress() {
  const total = Object.keys(state.fileStates).length;
  const done = Object.values(state.fileStates).filter(v => v === 'done').length;
  document.getElementById('files-progress').textContent = `${done} / ${total}`;
}

// ─────────────────────────────────────────────────────────────────
// CENTER — Pipeline (script.js와 동일)
// ─────────────────────────────────────────────────────────────────
function renderPipeline() {
  const pl = document.getElementById('pipeline');
  pl.innerHTML = '';
  const stages = state.stages;
  pl.appendChild(stageCardEl(stages.find(s => s.no === 1)));

  const lbl1 = document.createElement('div');
  lbl1.className = 'parallel-label';
  lbl1.textContent = '↓  Stage 2-5 병렬 처리  ↓';
  pl.appendChild(lbl1);

  const grid = document.createElement('div');
  grid.className = 'parallel-grid';
  [2, 3, 4, 5].forEach(n => grid.appendChild(stageCardEl(stages.find(s => s.no === n))));
  pl.appendChild(grid);

  const lbl2 = document.createElement('div');
  lbl2.className = 'parallel-label';
  lbl2.textContent = '↓  Stage 6: ★ 동일차주 합산 (Killer)  ↓';
  pl.appendChild(lbl2);

  [6, 7, 8].forEach(n => pl.appendChild(stageCardEl(stages.find(s => s.no === n))));
}

function stageCardEl(stage) {
  const a = stage.agent === 'Synth' ? state.agents.synthesis : state.agents.agents.find(x => x.id === stage.agent);
  const card = document.createElement('div');
  card.className = `stage-card ${stage.killer ? 'killer' : ''}`;
  card.dataset.stage = stage.no;
  card.innerHTML = `
    <div class="stage-no">${stage.no}</div>
    <div class="stage-info">
      <div class="stage-title-row">
        <span class="stage-title">${stage.title}</span>
        <span class="stage-agent-tag">${a.icon || ''} ${a.id} · ${a.kor}</span>
      </div>
      <div class="stage-summary">${a.description || ''}</div>
      <div class="progress"><div class="progress-bar" data-bar="${stage.no}"></div></div>
    </div>
    <div class="stage-status status-wait" data-status="${stage.no}">대기</div>
  `;
  card.addEventListener('click', () => {
    if (state.stageStates[stage.no] === 'done' || state.stageStates[stage.no] === 'run') {
      selectStage(stage.no);
    }
  });
  return card;
}

function setStageState(n, st) {
  state.stageStates[n] = st;
  const card = document.querySelector(`.stage-card[data-stage="${n}"]`);
  if (!card) return;
  card.classList.remove('processing', 'done', 'selected');
  if (st === 'run') card.classList.add('processing');
  if (st === 'done') card.classList.add('done');
  if (state.selectedStage === n) card.classList.add('selected');

  const stEl = card.querySelector(`[data-status="${n}"]`);
  if (stEl) {
    stEl.classList.remove('status-wait', 'status-run', 'status-done', 'status-alert');
    if (st === 'wait') { stEl.className = 'stage-status status-wait'; stEl.textContent = '대기'; }
    else if (st === 'run') { stEl.className = 'stage-status status-run'; stEl.textContent = '진행 중'; }
    else if (st === 'done') {
      const stage = state.stages.find(s => s.no === n);
      if (stage.killer) { stEl.className = 'stage-status status-alert'; stEl.textContent = '★ 검출'; }
      else { stEl.className = 'stage-status status-done'; stEl.textContent = '완료'; }
    }
  }
}
function setStageProgress(n, pct) {
  state.stageProgress[n] = pct;
  const bar = document.querySelector(`[data-bar="${n}"]`);
  if (bar) bar.style.width = `${pct}%`;
}
function setPipelineStatus(text, alert = false) {
  const el = document.getElementById('pipeline-status');
  el.textContent = text;
  el.style.color = alert ? 'var(--red)' : 'var(--muted)';
  el.style.fontWeight = alert ? '700' : '400';
}

// ─────────────────────────────────────────────────────────────────
// Simulation
// ─────────────────────────────────────────────────────────────────
async function startSimulation() {
  if (state.running) return;
  state.running = true;
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-start').textContent = '▶ 진행 중...';

  await runStage(1, async (tick) => {
    const filesToProcess = Object.keys(state.fileStates);
    for (let i = 0; i < filesToProcess.length; i++) {
      setFileState(filesToProcess[i], 'processing');
      await sleep(60 * SPEED);
      setFileState(filesToProcess[i], 'done');
      updateFilesProgress();
      tick(((i + 1) / filesToProcess.length) * 100);
    }
  });
  selectStage(1, true);

  setPipelineStatus('Stage 2-5 병렬 분석 진행 중 (재무·매출채권·타행여신·담보)');
  await Promise.all([2, 3, 4, 5].map(n => runStage(n, defaultProgress(n))));
  selectStage(5, true);

  setPipelineStatus('★ Stage 6: 관계회사 자동 검출 중...', true);
  await runStage(6, async (tick) => {
    for (let i = 0; i <= 100; i += 4) {
      tick(i);
      await sleep(60 * SPEED);
    }
  });
  selectStage(6, true);
  setPipelineStatus('⚠ ★ 동일차주 합산 70.5억 검출! 신청 17.1억의 4배 그룹 익스포저', true);
  await sleep(1500 * SPEED);

  setPipelineStatus('Stage 7: 위험 종합 분석 — 가중치 산출 중');
  await runStage(7, defaultProgress(7));

  setPipelineStatus('Stage 8: 광주은행 표준 승인신청서 + 해설서 작성 중');
  await runStage(8, defaultProgress(8));
  selectStage(8, true);

  fillMetrics();
  setPipelineStatus('✅ 8-Stage 심사 완료 — 우상단 📋 승인신청서 출력 버튼 활성화');

  // 최종 산출물 배너 표시 + 출력 버튼 활성화
  const finalEl = document.getElementById('final-output');
  finalEl.classList.remove('hidden');
  finalEl.classList.add('fade-in');
  document.getElementById('btn-print-app').disabled = false;
  document.getElementById('btn-print-app').title = '클릭하여 승인신청서 HTML 출력';

  state.running = false;
  document.getElementById('btn-start').textContent = '✓ 완료';
}

function defaultProgress(n) {
  return async (tick) => {
    const stage = state.stages.find(s => s.no === n);
    const total = (stage.duration_sec || 4) * 1000 * SPEED;
    const steps = 40;
    for (let i = 1; i <= steps; i++) {
      tick((i / steps) * 100);
      await sleep(total / steps);
    }
  };
}
async function runStage(n, work) {
  setStageState(n, 'run');
  await work((pct) => setStageProgress(n, pct));
  setStageState(n, 'done');
  setStageProgress(n, 100);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────────────────────────
// RIGHT — Stage Detail (script.js와 동일하나 main 양식 미리보기는 모달로 이전)
// ─────────────────────────────────────────────────────────────────
function selectStage(n, scroll = false) {
  if (state.stageStates[n] !== 'done' && state.stageStates[n] !== 'run') return;
  state.selectedStage = n;
  document.querySelectorAll('.stage-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`.stage-card[data-stage="${n}"]`);
  if (card) {
    card.classList.add('selected');
    if (scroll) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  document.getElementById('detail-stage').textContent = `Stage ${n}`;
  renderDetail(n);
}

function renderDetail(n) {
  const detail = document.getElementById('detail');
  const result = state.data.stage_results[String(n)];
  if (!result) { detail.innerHTML = `<div class="detail-empty">결과 없음</div>`; return; }

  let html = `<div class="fade-in">`;
  html += `<h3>${result.title}</h3>`;
  html += `<div class="summary-box ${result.killer ? 'alert' : ''}">${result.summary}</div>`;

  if (result.kpis?.length) {
    html += `<div class="kpis">`;
    result.kpis.forEach(k => {
      html += `<div class="kpi ${k.alert ? 'alert' : ''}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}<span class="kpi-unit"> ${k.unit || ''}</span></div>
      </div>`;
    });
    html += `</div>`;
  }

  if (n === 2 && result.trend) {
    const max = Math.max(...result.trend.revenue);
    html += `<div class="section-title">3개년 매출 추세</div><div class="trend-chart"><div class="bars">`;
    result.trend.years.forEach((y, i) => {
      const v = result.trend.revenue[i];
      const h = Math.round((v / max) * 100);
      const isAlert = i === result.trend.years.length - 1;
      html += `<div class="bar-col"><div class="bar ${isAlert ? 'alert' : ''}" style="height:${h}%;">${v}억</div><div class="bar-label">${y}</div></div>`;
    });
    html += `</div></div>`;
  }
  if (n === 3 && result.concentration) {
    html += `<div class="section-title">매출 거래처 집중도</div><table class="tbl"><thead><tr><th>거래처</th><th>금액</th><th>비중</th></tr></thead><tbody>`;
    result.concentration.forEach(c => html += `<tr><td>${c.name}</td><td class="num">${c.amount_ok}억</td><td class="num">${c.pct}%</td></tr>`);
    html += `</tbody></table>`;
  }
  if (n === 4 && result.loans) {
    html += `<div class="section-title">타행 여신 통합</div><table class="tbl"><thead><tr><th>은행</th><th>잔액</th><th>유형</th><th>연체</th></tr></thead><tbody>`;
    result.loans.forEach(l => html += `<tr><td>${l.bank}</td><td class="num">${l.balance_ok != null ? l.balance_ok + '억' : '—'}</td><td>${l.type}</td><td class="num">${l.delay}건</td></tr>`);
    html += `</tbody></table>`;
  }
  if (n === 5 && result.collateral) {
    html += `<div class="section-title">담보 자산 평가</div><table class="tbl"><thead><tr><th>자산</th><th>감정가</th><th>담보가</th><th>근저당</th></tr></thead><tbody>`;
    result.collateral.forEach(c => html += `<tr><td>${c.asset}</td><td class="num">${c.appraisal_ok != null ? c.appraisal_ok + '억' : '—'}</td><td class="num">${c.collateral_ok != null ? c.collateral_ok + '억' : '—'}</td><td class="num">${c.mortgage_ok != null ? c.mortgage_ok + '억' : '—'}</td></tr>`);
    html += `</tbody></table>`;
  }
  if (n === 6) {
    html += `<div class="section-title">★ 관계회사 그래프 자동 검출</div><div class="kj-graph">${renderRelatedPartiesSVG(result.graph)}</div>`;
    if (result.exposure) {
      html += `<div class="section-title">계열 익스포저 합산</div><div class="exposure-list">`;
      let total = 0;
      result.exposure.forEach(e => {
        if (e.highlight) total += e.amount_ok;
        html += `<div class="exposure-row ${e.highlight ? 'highlight' : ''}">
          <span>${e.label}</span><span class="exposure-amount">${e.amount_ok}억</span><span class="exposure-kind">${e.kind}</span></div>`;
      });
      html += `<div class="exposure-total"><span>★ 동일차주 합산 (단기대여)</span><span>${total.toFixed(1)}억</span></div></div>`;
    }
  }
  if (n === 7 && result.weights) {
    html += `<div class="section-title">위험요인 가중치</div><div class="weights">`;
    result.weights.forEach(w => {
      html += `<div class="weight-row"><div class="weight-label"><span>${w.factor}</span><b>${w.weight.toFixed(2)} <span style="color:var(--muted);font-size:10px;">(${w.evidence})</span></b></div>
        <div class="weight-bar"><div class="weight-bar-fill" style="width:${w.weight * 100}%;"></div></div></div>`;
    });
    html += `</div>`;
  }
  if (n === 8 && result.form_sections) {
    html += `<div class="section-title">광주은행 표준 양식 (자동 작성 초안)</div>`;
    html += `<div class="form-preview" id="form-preview"></div>`;
    html += `<div style="margin-top:12px; padding:12px; background:linear-gradient(135deg,#fff8e1 0%,#ffe082 100%); border-radius:6px; text-align:center;">
      <div style="font-size:11px; color:#5d4037; margin-bottom:6px;">전체 양식은 출력 버튼으로 확인</div>
      <button id="btn-print-detail" type="button" style="background:var(--navy); color:#fff; border:none; padding:8px 18px; border-radius:5px; font-weight:700; cursor:pointer;">📋 승인신청서 출력 →</button>
    </div>`;
  }

  if (result.flags?.length) {
    html += `<div class="section-title">플래그</div><div class="flags">`;
    result.flags.forEach(f => {
      const icon = f.level === 'ALERT' ? '🚨' : f.level === 'WARN' ? '⚠️' : 'ℹ️';
      html += `<div class="flag ${f.level}">${icon} ${f.msg}</div>`;
    });
    html += `</div>`;
  }
  if (result.facts?.length) {
    html += `<div class="section-title">사실·근거 자료 인용</div><div class="facts">`;
    result.facts.forEach(f => {
      html += `<div class="fact ${f.highlight ? 'highlight' : ''}">
        <span class="fact-text">${f.text}</span>
        <span class="fact-source">📄 ${f.source}</span></div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;
  detail.innerHTML = html;

  if (n === 8 && result.form_sections) {
    typeFormSections(result.form_sections);
    const btn = document.getElementById('btn-print-detail');
    if (btn) btn.addEventListener('click', openModal);
  }
}

// ─────────────────────────────────────────────────────────────────
// Stage 6 SVG (script.js와 동일)
// ─────────────────────────────────────────────────────────────────
function renderRelatedPartiesSVG(graph) {
  const positions = {
    hst:    { x: 180, y: 100, r: 40, fill: '#b71c1c', label: '(주)HST\n신청 17.1억' },
    doowon: { x:  60, y: 200, r: 34, fill: '#0d47a1', label: '(주)두원건설\n100% 자회사\n단기대여 37.3억' },
    stconst:{ x: 300, y: 200, r: 34, fill: '#0d47a1', label: '(주)에스티건설\n동일대표\n단기대여 33.2억' },
    ceo:    { x: 180, y:  20, r: 26, fill: '#fb8c00', label: '황성태\n대표 (40%)' },
  };
  const W = 360, H = 240;
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#666"/></marker></defs>`;
  graph.edges.forEach(e => {
    const a = positions[e.from], b = positions[e.to]; if (!a || !b) return;
    const isAlert = e.label.includes('단기대여');
    svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${isAlert ? '#b71c1c' : '#888'}" stroke-width="${isAlert ? 2.5 : 1.5}" stroke-dasharray="${isAlert ? '0' : '4,3'}" marker-end="url(#arr)"/>`;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    svg += `<text x="${mx}" y="${my}" font-size="9" fill="${isAlert ? '#b71c1c' : '#666'}" text-anchor="middle" font-weight="${isAlert ? '700' : '400'}">${e.label}</text>`;
  });
  graph.nodes.forEach(n => {
    const p = positions[n.id]; if (!p) return;
    svg += `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.fill}" stroke="#fff" stroke-width="2"/>`;
    const lines = p.label.split('\n'), lh = 11, startY = p.y - ((lines.length - 1) * lh) / 2 + 3;
    lines.forEach((ln, i) => {
      svg += `<text x="${p.x}" y="${startY + i * lh}" font-size="10" fill="#fff" text-anchor="middle" font-weight="${i === 0 ? '700' : '400'}">${ln}</text>`;
    });
  });
  svg += `</svg>`;
  return svg;
}

async function typeFormSections(sections) {
  const target = document.getElementById('form-preview');
  if (!target) return;
  target.innerHTML = '';
  for (const sec of sections) {
    const secEl = document.createElement('div');
    secEl.className = `form-section ${sec.highlight ? 'highlight' : ''}`;
    const lblEl = document.createElement('div');
    lblEl.className = 'form-label';
    lblEl.textContent = `▸ ${sec.section}`;
    const contentEl = document.createElement('div');
    contentEl.className = 'form-content cursor';
    secEl.appendChild(lblEl);
    secEl.appendChild(contentEl);
    target.appendChild(secEl);
    const text = sec.content;
    const speed = 6 * SPEED;
    for (let i = 0; i <= text.length; i += 2) {
      contentEl.textContent = text.substring(0, i);
      target.scrollTop = target.scrollHeight;
      await sleep(speed);
    }
    contentEl.textContent = text;
    contentEl.classList.remove('cursor');
    if (sec.source) {
      const srcEl = document.createElement('span');
      srcEl.className = 'form-source';
      srcEl.textContent = `📄 출처: ${sec.source}`;
      secEl.appendChild(srcEl);
    }
    await sleep(120 * SPEED);
  }
}

// ─────────────────────────────────────────────────────────────────
// MODAL — 승인신청서 HTML 양식 렌더링
// ─────────────────────────────────────────────────────────────────
function openModal() {
  const formEl = document.getElementById('approval-form');
  formEl.innerHTML = renderApprovalForm();
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.scrollTop = 0;
  // AI 의견 섹션 핸들러 부착
  setupAIOpinionHandlers();
}
function closeModal() {
  // 편집 중이면 자동 저장 (사용자 수정 손실 방지)
  if (state.aiOpinion.editing) {
    const el = document.getElementById('ai-opinion-text');
    if (el) {
      const newText = el.innerText.replace(/ /g, ' ').trim();
      state.aiOpinion.current = newText;
      state.aiOpinion.modified = (newText !== (state.aiOpinion.original || '').trim());
    }
    state.aiOpinion.editing = false;
  }
  document.getElementById('modal-overlay').classList.add('hidden');
}

function renderApprovalForm() {
  const d = state.data;
  const today = new Date().toISOString().slice(0, 10);
  const docNo = `KJ-${today.replace(/-/g, '')}-001`;

  const r1 = d.stage_results['1'];
  const r2 = d.stage_results['2'];
  const r3 = d.stage_results['3'];
  const r4 = d.stage_results['4'];
  const r5 = d.stage_results['5'];
  const r6 = d.stage_results['6'];
  const r7 = d.stage_results['7'];

  let html = '';

  // Header
  html += `<div class="af-header">
    <div class="af-bank">광주은행 / KWANGJU BANK</div>
    <div class="af-doctitle">기 업 여 신 승 인 신 청 서</div>
    <div class="af-meta">
      <span>문서번호: ${docNo}</span>
      <span class="af-stamp">초 안</span>
      <span>작성일: ${today}</span>
    </div>
  </div>`;

  // 1. 신청 요지
  html += `<div class="af-section">
    <div class="af-section-title">1. 신청 요지</div>
    <table class="af-tbl">
      <tr><th>차주</th><td><b>${d.borrower.name}</b> (사업자번호 ${d.borrower.biz_no})</td></tr>
      <tr><th>대표이사</th><td>${d.borrower.ceo}</td></tr>
      <tr><th>지점</th><td>${d.application.branch}</td></tr>
      <tr><th>상품</th><td>${d.application.product}</td></tr>
      <tr><th>신청금액</th><td class="num"><b>${d.application.amount_ok.toLocaleString()}백만원 (17.1억원)</b></td></tr>
      <tr><th>기간 / 금리</th><td>${d.application.term_months}개월 / 연 ${d.application.rate_pct}%</td></tr>
      <tr><th>자금용도</th><td>${d.application.purpose}</td></tr>
    </table>
  </div>`;

  // 2. 차주 개요
  html += `<div class="af-section">
    <div class="af-section-title">2. 차주 개요</div>
    <table class="af-tbl">
      <tr><th>법인명</th><td>${d.borrower.name}</td></tr>
      <tr><th>사업자번호</th><td>${d.borrower.biz_no}</td></tr>
      <tr><th>업종</th><td>${d.borrower.industry}</td></tr>
      <tr><th>본점 / 사업장</th><td>${d.borrower.address}</td></tr>
      <tr><th>설립일</th><td>${d.borrower.established}</td></tr>
      <tr><th>인력 규모</th><td>${d.borrower.employees}명</td></tr>
      <tr><th>주요 인증</th><td>${d.borrower.certifications.join(' · ')}</td></tr>
    </table>
    <div class="af-source">출처: 1.사업자등록증외인증서.pdf · 2.주주명부.pdf · 3.정관(마스킹).pdf · 4.원천징수이행상황신고서.pdf</div>
  </div>`;

  // 3. 재무 현황
  html += `<div class="af-section">
    <div class="af-section-title">3. 재무 현황 (3개년)</div>
    <table class="af-tbl">
      <tr><th>구분</th><th>2021년</th><th>2022년</th><th>2023년</th></tr>
      <tr><th>매출액</th>
        <td class="num">163.78억</td>
        <td class="num">92.64억</td>
        <td class="num" style="color:var(--red); font-weight:700;">78.78억 (-52% ↓)</td></tr>
      <tr><th>영업이익</th><td class="num">11.2억</td><td class="num">7.0억</td><td class="num">6.0억</td></tr>
      <tr><th>영업이익률</th><td class="num">6.8%</td><td class="num">7.6%</td><td class="num">7.6%</td></tr>
      <tr><th>자기자본</th><td colspan="3" class="num">10.3억 (2023년말)</td></tr>
    </table>
    <div class="af-narrative">
      <b>★ 매출 -52% 급감 추세 감지.</b> 2021년 163.78억에서 2023년 78.78억으로 3년간 매출 절반 이하로 축소.
      영업이익률은 7.6%로 안정적이나, 매출 감소에 따른 영업현금흐름 악화 우려.
      재무제표 매출 89.2억 vs 부가세 89.5억 vs 매입매출 89.2억 — <b>3중 cross-check 일치 (편차 0.3% PASS)</b>.
    </div>
    <div class="af-source">출처: 5.23년재무제표(감사).pdf · 6.재무제표부속명세서.pdf · 7.부가세과세표준증명원.pdf · 8.매입매출세금계산서합계표.pdf</div>
  </div>`;

  // 4. 신용 평가
  html += `<div class="af-section">
    <div class="af-section-title">4. 신용 평가</div>
    <table class="af-tbl">
      <tr><th>당행 신용등급</th><td><b>${d.credit_rating.internal}</b> (기업모형 A · ${d.credit_rating.internal_date})</td></tr>
      <tr><th>외부 평가 (KCB)</th><td>${d.credit_rating.kcb}점</td></tr>
      <tr><th>외부 평가 (NICE)</th><td>${d.credit_rating.nice}점</td></tr>
    </table>
    <div class="af-narrative">
      당행 BB+ / KCB 818 / NICE 841 — <b>외부 등급 BB+ 구간 일치</b>. 매출 감소·동일차주 합산 등 위험요인 반영하여 BB+ 유지가 합리적.
    </div>
    <div class="af-source">출처: (주)에이치에스티_크레탑_총괄.pdf · 크레탑_재무제표.pdf · 당행 기업모형 A</div>
  </div>`;

  // 5. 매출채권·운전자금
  html += `<div class="af-section">
    <div class="af-section-title">5. 매출채권 · 운전자금</div>
    <table class="af-tbl">
      <tr><th>외상매출 잔액 (2023말)</th><td class="num">42.9억</td></tr>
      <tr><th>회전기간</th><td class="num" style="color:var(--red);">116일 (업계 평균 75일 +55% ⚠)</td></tr>
      <tr><th>상위 3 거래처 집중도</th><td class="num">55.4%</td></tr>
      <tr><th>대손충당금 비율</th><td class="num">1.2% (보수적)</td></tr>
    </table>
    <div class="af-narrative">
      한국전력공사(7.15억, 16.7%) · 솔라윅스(3.78억, 8.8%) 등 우량 거래처. 단 회전기간 116일은 업계 평균 대비 +55%로 운전자금 부담 요인.
    </div>
    <div class="af-source">출처: 매출채권명세서22년23년.pdf · 거래처원장.pdf · 대손충당금 설정·회수내역.pdf</div>
  </div>`;

  // 6. 타행 여신 (통합 익스포저)
  html += `<div class="af-section">
    <div class="af-section-title">6. 타행 여신 통합</div>
    <table class="af-tbl">
      <tr><th>은행</th><th>잔액</th><th>유형</th><th>금리</th></tr>
      <tr><td>신한은행</td><td class="num">28.1억</td><td>시설·운전자금</td><td class="num">5.45%</td></tr>
      <tr><td>KDB 산업은행</td><td class="num">65.0억</td><td>시설운영자금 (6건, 정책자금)</td><td class="num">4.20%</td></tr>
      <tr><td>국민은행</td><td class="num">(미상)</td><td>거래확인 필요</td><td class="num">—</td></tr>
      <tr style="background:#f0f3f8;"><th>합계</th><th class="num">≈ 93+억</th><th colspan="2">연체 0건 / 모두 정상거래</th></tr>
    </table>
    <div class="af-source">출처: 10.타행금융거래확인서신한국민산업.pdf · 11.운전자금상환내역.pdf · 신한B대출거래내역서.pdf</div>
  </div>`;

  // 7. 담보 평가
  html += `<div class="af-section">
    <div class="af-section-title">7. 담보 평가</div>
    <table class="af-tbl">
      <tr><th>담보 자산</th><td>나주 혁신산단 1·2공장 (전라남도 나주시)</td></tr>
      <tr><th>감정가 / 담보가</th><td class="num">50.3억 / 25.06억</td></tr>
      <tr><th>1순위 근저당 설정</th><td class="num">33.72억 (광주은행)</td></tr>
      <tr><th>LTV</th><td class="num">49.8% (안전 범위)</td></tr>
      <tr><th>부수자산</th><td>태양광 발전소 6개호 (1,274kW)</td></tr>
    </table>
    <div class="af-source">출처: 14.담보물건등기부등본.pdf · 15.소유부동산등기부등본.pdf</div>
  </div>`;

  // 8. ★ 동일차주 합산 (Killer)
  html += `<div class="af-section">
    <div class="af-section-title alert">8. ★ 동일차주 합산 검토</div>
    <table class="af-tbl">
      <tr><th>관계회사 1</th><td><b>(주)두원건설</b> — HST 100% 자회사 (60,000주, 자본금 3억) · 강원도 속초 본점</td></tr>
      <tr><th>관계회사 2</th><td><b>(주)에스티건설</b> — 황성태 동일대표</td></tr>
      <tr class="highlight"><th>HST → 두원건설 단기대여</th><td class="num"><b>37.3억</b></td></tr>
      <tr class="highlight"><th>HST → 에스티건설 단기대여</th><td class="num"><b>33.2억</b></td></tr>
      <tr class="highlight"><th>★ 동일차주 합산 (단기대여)</th><td class="num"><b style="font-size:14px;">70.5억 (신청 17.1억의 4.1배)</b></td></tr>
      <tr class="highlight"><th>그룹 총 외부 여신 (추정)</th><td class="num"><b>약 180억 (자기자본 10.3억의 17배)</b></td></tr>
    </table>
    <div class="af-narrative alert">
      <b>⚠ 자료 30종 cross-reference 자동 검출.</b> HST 신청 17.1억 단독 평가 시 누락되는 그룹 익스포저가 존재.
      두원건설은 100% 자회사이며, 에스티건설은 황성태 대표를 공유하는 관계회사. 두 회사로 흘러가는 단기대여 70.5억은 HST 자기자본의 6.8배에 해당.
      <b>한도 검토 시 본 합산 금액을 기반으로 동일차주 한도(자기자본 25%) 별도 검증 필요.</b>
    </div>
    <div class="af-source">출처: 6.재무제표부속명세서.pdf p.5 · 16.에스티건설관련자료.pdf · 17.두원건설관련자료.pdf · 단기대여금거래처원장.pdf</div>
  </div>`;

  // 9. 위험요인 종합
  html += `<div class="af-section">
    <div class="af-section-title">9. 위험요인 종합</div>
    <table class="af-tbl">
      <tr><th>순위</th><th>위험요인</th><th>가중치</th><th>근거</th></tr>`;
  r7.weights.forEach((w, i) => {
    html += `<tr><td class="num">${i + 1}</td><td>${w.factor}</td><td class="num"><b>${w.weight.toFixed(2)}</b></td><td style="font-size:10px;">${w.evidence}</td></tr>`;
  });
  html += `</table>
    <div class="af-narrative">
      <b>정량 위험점수 0.68 (BB+ 구간)</b>. 매출 감소 (0.42) · 동일차주 합산 (0.31)이 핵심 위험. 담보 LTV 49.8%는 안전 범위.
    </div>
  </div>`;

  // 10. 심사 의견 (조건부 승인)
  html += `<div class="af-decision">
    <div class="af-decision-label">심 사 의 견 (초안)</div>
    <div class="af-decision-value">조 건 부 승 인 권 고</div>
  </div>`;

  html += `<div class="af-section">
    <div class="af-section-title">11. 승인 조건 (보완 사항)</div>
    <ol class="af-conditions">
      <li>동일차주 합산 한도 별도 검토 — (주)두원건설 + (주)에스티건설 외부 차입 추가 조회 후 한도 산정</li>
      <li>매출 -52% 급감 사유 분기별 모니터링 및 차주 사업계획 보완 자료 제출</li>
      <li>관계회사 단기대여 70.5억 회수 계획 분기별 보고 (운전자금 잠김 해소)</li>
      <li>KDB 정책자금 65억 차환 시점 영향 평가서 제출 (정책자금 의존도 39.7%)</li>
      <li>매출채권 회전기간 116일 → 90일 이하 단축 계획 제출</li>
    </ol>
  </div>`;

  // 12. 서명 (결재선)
  html += `<div class="af-signature">
    <div class="af-sign-box"><div class="lbl">담당 심사역</div><div class="body">_____________</div></div>
    <div class="af-sign-box"><div class="lbl">지점장</div><div class="body">_____________</div></div>
    <div class="af-sign-box"><div class="lbl">본부 심사부장</div><div class="body">_____________</div></div>
    <div class="af-sign-box"><div class="lbl">여신위원회</div><div class="body">_____________</div></div>
  </div>`;

  // AI 보조 작성 인터랙티브 섹션
  html += renderAIOpinionSection();

  // Footer
  html += `<div class="af-footer">
    <span>본 문서는 KJ Credit Analyst v1 (HCX-007 Thinking) 자동 작성 초안 — 최종 결재는 심사역의 책임</span>
    <span class="ai-mark">🤖 AI 보조 작성</span>
  </div>`;

  return html;
}

// ─────────────────────────────────────────────────────────────────
// AI 보조 작성 — 심사 의견 (인터랙티브)
// ─────────────────────────────────────────────────────────────────
function generateAIOpinion() {
  return `[심사의견 — KJ Credit Analyst (HCX-007 Thinking) 자동 작성]

(주)에이치에스티 비즈니스파트너론 17.1억 신청 건에 대한 심사 의견입니다.

▸ 종합 결론
조건부 승인 권고 (BB+ 등급 / 17.1억 / 36개월 / 5.83%)

▸ 주요 근거
1. 차주 신용 양호 — 당행 BB+, KCB 818점, NICE 841점으로 외부 등급 일치
2. 담보 충분 — 나주 혁신산단 1·2공장 LTV 49.8% (안전 범위)
3. 매출 안정성 우려 — 2021 163.78억 → 2023 78.78억 (-52% 급감) 추세 반영 필요
4. ★ 동일차주 합산 검출 — 관계회사 단기대여 70.5억 (두원건설 37.3 + 에스티건설 33.2). 신청 17.1억의 4.1배
5. 매출채권 회전기간 116일 (업계 평균 +55%) — 운전자금 부담 요인

▸ 승인 조건 (5건 의무 보완)
① 동일차주 합산 한도 별도 산정 (자기자본 25% 기준 검토)
② 매출 -52% 감소 사유 분기별 모니터링 보고
③ 관계회사 단기대여 70.5억 회수 계획 분기 보고
④ KDB 정책자금 65억 차환 시점 영향 평가서 제출
⑤ 매출채권 회전기간 116일 → 90일 이하 단축 계획

▸ 심사역 검토 필요 사항
본 의견은 KJ Credit Analyst의 자동 작성 초안입니다. 다음 항목은 심사역의 직접 검토가 필요합니다.
- 두원건설·에스티건설 외부 차입 추가 조회 (그룹 익스포저 정확 산정)
- 차주 매출 감소 회복 가능성에 대한 정성 평가
- 광주은행 내규 한도 위반 여부 최종 확인

추론 근거 자료 28건 인용 · TTFT 35분 · 토큰 비용 $3.2`;
}

function renderAIOpinionSection() {
  if (state.aiOpinion.original === null) {
    state.aiOpinion.original = generateAIOpinion();
  }
  const text = state.aiOpinion.current || state.aiOpinion.original;
  const { expanded, editing, modified } = state.aiOpinion;

  let html = `<div class="af-ai-section" id="af-ai-section">`;
  html += `<div class="af-ai-header">
    <button class="ai-toggle-btn ${expanded ? 'expanded' : ''}" id="ai-toggle" type="button">🤖 AI 보조 작성</button>`;
  if (expanded && !editing) {
    html += `<button class="ai-edit-btn" id="ai-edit" type="button">✏️ 수정</button>`;
    if (modified) {
      html += `<button class="ai-revert-btn" id="ai-revert" type="button" title="AI 원본으로 되돌리기">↺ 원본 복원</button>`;
    }
  }
  if (editing) {
    html += `<button class="ai-save-btn" id="ai-save" type="button">✓ 저장</button>
             <button class="ai-cancel-btn" id="ai-cancel" type="button">✗ 취소</button>`;
  }
  if (expanded && modified && !editing) {
    html += `<span class="ai-edit-status modified">사용자 수정됨</span>`;
  } else if (expanded && !editing) {
    html += `<span class="ai-edit-status">자동 작성 — 수정 가능</span>`;
  } else if (editing) {
    html += `<span class="ai-edit-status editing">편집 중 · 직접 입력</span>`;
  }
  html += `</div>`;

  if (expanded) {
    html += `<div class="af-ai-body">
      <div class="ai-opinion ${editing ? 'editing' : ''}" id="ai-opinion-text"
           contenteditable="${editing ? 'true' : 'false'}"
           ${editing ? 'spellcheck="false"' : ''}>${escapeHtml(text)}</div>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function setupAIOpinionHandlers() {
  const t = document.getElementById('ai-toggle');
  if (t) t.addEventListener('click', handleAIToggle);
  const e = document.getElementById('ai-edit');
  if (e) e.addEventListener('click', handleAIEdit);
  const s = document.getElementById('ai-save');
  if (s) s.addEventListener('click', handleAISave);
  const c = document.getElementById('ai-cancel');
  if (c) c.addEventListener('click', handleAICancel);
  const r = document.getElementById('ai-revert');
  if (r) r.addEventListener('click', handleAIRevert);
}

function handleAIToggle() {
  state.aiOpinion.expanded = !state.aiOpinion.expanded;
  if (!state.aiOpinion.expanded) state.aiOpinion.editing = false;
  refreshAISection();
  if (state.aiOpinion.expanded) {
    // 펼쳤을 때 부드러운 스크롤
    setTimeout(() => {
      const sec = document.getElementById('af-ai-section');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }
}

function handleAIEdit() {
  state.aiOpinion.editing = true;
  refreshAISection();
  // 포커스 + 커서를 끝으로
  setTimeout(() => {
    const el = document.getElementById('ai-opinion-text');
    if (!el) return;
    el.focus();
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* ignore */ }
  }, 50);
}

function handleAISave() {
  const el = document.getElementById('ai-opinion-text');
  if (el) {
    const newText = el.innerText.replace(/ /g, ' ').trim();
    state.aiOpinion.current = newText;
    state.aiOpinion.modified = (newText !== state.aiOpinion.original.trim());
  }
  state.aiOpinion.editing = false;
  refreshAISection();
}

function handleAICancel() {
  state.aiOpinion.editing = false;
  refreshAISection();
}

function handleAIRevert() {
  if (!confirm('사용자 수정 내용을 버리고 AI 원본으로 되돌릴까요?')) return;
  state.aiOpinion.current = null;
  state.aiOpinion.modified = false;
  state.aiOpinion.editing = false;
  refreshAISection();
}

function refreshAISection() {
  const sec = document.getElementById('af-ai-section');
  if (!sec) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = renderAIOpinionSection();
  const newSec = tmp.firstElementChild;
  sec.parentNode.replaceChild(newSec, sec);
  setupAIOpinionHandlers();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────
function fillMetrics() {
  const m = state.data.metrics;
  setMetric('m-ttft', `${m.ttft_minutes}분`, 'ok');
  setMetric('m-match', `${m.form_match_pct}%`, 'ok');
  setMetric('m-related', `${m.related_party_detected}건`, 'alert');
  setMetric('m-evidence', `${m.evidence_refs}건`, 'ok');
  setMetric('m-cost', `$${m.estimated_cost_usd}`, 'ok');
}
function setMetric(id, val, kind) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('alert', 'ok');
  el.classList.add(kind);
  el.textContent = val;
}

function resetAll() {
  if (state.running) return;
  state.stages.forEach(s => { setStageState(s.no, 'wait'); setStageProgress(s.no, 0); });
  Object.keys(state.fileStates).forEach(k => state.fileStates[k] = 'wait');
  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('processing', 'done'));
  updateFilesProgress();
  state.selectedStage = null;
  state.aiOpinion = { expanded: false, editing: false, original: null, current: null, modified: false };
  document.querySelectorAll('.stage-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('detail-stage').textContent = '—';
  document.getElementById('final-output').classList.add('hidden');
  document.getElementById('btn-print-app').disabled = true;
  document.getElementById('btn-print-app').title = 'Stage 8 완료 후 활성화';

  document.getElementById('detail').innerHTML = `
    <div class="detail-empty">
      ▶ 심사 시작 후<br>각 Stage 카드를 클릭하면<br>상세 결과·근거·플래그가 표시됩니다.
      <br><br>
      <div style="text-align:left; font-size:11px; padding: 12px; background: var(--gray-1); border-radius: 6px; line-height: 1.5;">
        <b>v2 변경 사항</b><br>
        · 좌측: 입력 자료 ↔ 참고자료 분리<br>
        · 최종 산출물: HST 승인신청서<br>
        · 📋 승인신청서 출력 버튼 (Stage 8 완료 시 활성화)
        <br><br>
        <b>시연 키 포인트</b><br>
        · 8-Stage 자동 진행 (총 ~40초)<br>
        · ★ Stage 6: 동일차주 합산 70.5억<br>
        · Stage 8: 광주은행 표준 양식 자동 작성<br>
        · 출력 버튼 → HTML 양식 모달
      </div>
    </div>`;
  ['m-ttft', 'm-match', 'm-related', 'm-evidence', 'm-cost'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('alert', 'ok');
    el.textContent = '—';
  });
  setPipelineStatus('대기 중 — 우상단 ▶ 심사 시작 클릭');
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-start').textContent = '▶ 심사 시작';
}

boot();
