/* KJ Credit Analyst — Simulation Engine
 * 시뮬레이션 엔진 (실제 LLM 호출 X)
 * 의존성 0 — 단일 HTML 더블클릭으로 실행
 */
'use strict';

// ─────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────
const state = {
  agents: null,
  stages: null,
  data: null,
  running: false,
  selectedStage: null,
  stageStates: {}, // { 1: 'wait'|'run'|'done', ... }
  stageProgress: {},
  fileStates: {}, // { filename: 'wait'|'processing'|'done' }
};

const SPEED = 1; // 1.0 = 정상, 0.5 = 2배 빠름

// ─────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────
async function boot() {
  try {
    const [a, s, d] = await Promise.all([
      fetch('data/agents.json').then(r => r.json()),
      fetch('data/stages.json').then(r => r.json()),
      fetch('data/hst_dataset.json').then(r => r.json()),
    ]);
    state.agents = a;
    state.stages = s.stages;
    state.data = d;
  } catch (e) {
    document.body.innerHTML = `
      <div style="padding:40px; font-family:sans-serif; color:#b71c1c;">
        <h2>⚠ 데이터 로드 실패</h2>
        <p>이 데모는 <code>file://</code> 프로토콜의 fetch 제한 때문에 로컬 웹 서버가 필요합니다.</p>
        <pre style="background:#f5f5f5; padding:12px; border-radius:4px;">cd ${location.pathname.split('/').slice(0, -1).join('/')}
python3 -m http.server 8000
# 그 다음 http://localhost:8000 열기</pre>
        <p><b>또는</b> Chrome을 다음 옵션으로 실행: <code>--allow-file-access-from-files</code></p>
        <p style="color:#666; font-size:12px;">에러: ${e.message}</p>
      </div>`;
    return;
  }

  // 초기 모든 Stage = wait
  state.stages.forEach(s => state.stageStates[s.no] = 'wait');

  renderFiles();
  renderPipeline();
  renderDetailEmpty();

  document.getElementById('btn-start').addEventListener('click', startSimulation);
  document.getElementById('btn-reset').addEventListener('click', resetAll);

  // 키보드 단축키
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !state.running) { e.preventDefault(); startSimulation(); }
    if (e.code === 'Escape') resetAll();
    if (e.code >= 'Digit1' && e.code <= 'Digit8') {
      const n = parseInt(e.code.replace('Digit', ''));
      if (state.stageStates[n] === 'done') selectStage(n);
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// LEFT — 자료 트리 렌더
// ─────────────────────────────────────────────────────────────────
function renderFiles() {
  const tree = document.getElementById('file-tree');
  tree.innerHTML = '';
  const cats = state.data.files;
  let total = 0;
  let processed = 0;
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
          const fname = f.name;
          const cls = f.highlight ? 'highlight' : '';
          state.fileStates[fname] = state.fileStates[fname] || 'wait';
          return `<li class="file-item ${cls}" data-file="${fname}">
            <span class="fname">${fname}</span>
            <span class="fsize">${f.size_mb}MB</span>
          </li>`;
        }).join('')}
      </ul>`;
    tree.appendChild(catEl);
  });
  document.getElementById('files-progress').textContent = `${processed} / ${total}`;
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
// CENTER — Pipeline 렌더
// ─────────────────────────────────────────────────────────────────
function renderPipeline() {
  const pl = document.getElementById('pipeline');
  pl.innerHTML = '';

  const stages = state.stages;

  // Stage 1
  pl.appendChild(stageCardEl(stages.find(s => s.no === 1)));

  // 병렬 라벨
  const lbl1 = document.createElement('div');
  lbl1.className = 'parallel-label';
  lbl1.textContent = '↓  Stage 2-5 병렬 처리  ↓';
  pl.appendChild(lbl1);

  // Stage 2-5 grid
  const grid = document.createElement('div');
  grid.className = 'parallel-grid';
  [2, 3, 4, 5].forEach(n => grid.appendChild(stageCardEl(stages.find(s => s.no === n))));
  pl.appendChild(grid);

  // 라벨
  const lbl2 = document.createElement('div');
  lbl2.className = 'parallel-label';
  lbl2.textContent = '↓  Stage 6: ★ 동일차주 합산 (Killer)  ↓';
  pl.appendChild(lbl2);

  // Stage 6, 7, 8
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

// ─────────────────────────────────────────────────────────────────
// Pipeline 상단 status text
// ─────────────────────────────────────────────────────────────────
function setPipelineStatus(text, alert = false) {
  const el = document.getElementById('pipeline-status');
  el.textContent = text;
  el.style.color = alert ? 'var(--red)' : 'var(--muted)';
  el.style.fontWeight = alert ? '700' : '400';
}

// ─────────────────────────────────────────────────────────────────
// Simulation Engine
// ─────────────────────────────────────────────────────────────────
async function startSimulation() {
  if (state.running) return;
  state.running = true;
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-start').textContent = '▶ 진행 중...';

  // Stage 1
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

  // Stage 2-5 병렬
  setPipelineStatus('Stage 2-5 병렬 분석 진행 중 (재무·매출채권·타행여신·담보)');
  await Promise.all([2, 3, 4, 5].map(n => runStage(n, defaultProgress(n))));
  selectStage(5, true);

  // Stage 6 — Killer
  setPipelineStatus('★ Stage 6: 관계회사 자동 검출 중...', true);
  await runStage(6, async (tick) => {
    // 점진 진행
    for (let i = 0; i <= 100; i += 4) {
      tick(i);
      await sleep(60 * SPEED);
    }
  });
  selectStage(6, true);
  // 알람 텍스트
  setPipelineStatus('⚠ ★ 동일차주 합산 70.5억 검출! 신청 17.1억의 4배 그룹 익스포저', true);
  await sleep(1500 * SPEED);

  // Stage 7
  setPipelineStatus('Stage 7: 위험 종합 분석 — 가중치 산출 중');
  await runStage(7, defaultProgress(7));

  // Stage 8
  setPipelineStatus('Stage 8: 광주은행 표준 승인신청서 + 해설서 작성 중');
  await runStage(8, defaultProgress(8));
  selectStage(8, true);

  // 메트릭 업데이트
  fillMetrics();
  setPipelineStatus('✅ 8-Stage 심사 완료 — 우측 패널의 표준 양식 미리보기 확인');

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
// RIGHT — Stage Detail
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

function renderDetailEmpty() {
  // already in HTML
}

function renderDetail(n) {
  const detail = document.getElementById('detail');
  const result = state.data.stage_results[String(n)];
  if (!result) {
    detail.innerHTML = `<div class="detail-empty">Stage ${n} 결과 데이터 없음</div>`;
    return;
  }

  let html = `<div class="fade-in">`;
  html += `<h3>${result.title}</h3>`;
  html += `<div class="summary-box ${result.killer ? 'alert' : ''}">${result.summary}</div>`;

  // KPIs
  if (result.kpis && result.kpis.length) {
    html += `<div class="kpis">`;
    result.kpis.forEach(k => {
      const cls = k.alert ? 'alert' : '';
      html += `<div class="kpi ${cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}<span class="kpi-unit"> ${k.unit || ''}</span></div>
      </div>`;
    });
    html += `</div>`;
  }

  // Stage 2: trend chart
  if (n === 2 && result.trend) {
    const max = Math.max(...result.trend.revenue);
    html += `<div class="section-title">3개년 매출 추세</div>`;
    html += `<div class="trend-chart"><div class="bars">`;
    result.trend.years.forEach((y, i) => {
      const v = result.trend.revenue[i];
      const h = Math.round((v / max) * 100);
      const isAlert = i === result.trend.years.length - 1;
      html += `<div class="bar-col">
        <div class="bar ${isAlert ? 'alert' : ''}" style="height:${h}%;">${v}억</div>
        <div class="bar-label">${y}</div>
      </div>`;
    });
    html += `</div></div>`;
  }

  // Stage 3: concentration
  if (n === 3 && result.concentration) {
    html += `<div class="section-title">매출 거래처 집중도</div>`;
    html += `<table class="tbl">
      <thead><tr><th>거래처</th><th>금액</th><th>비중</th></tr></thead>
      <tbody>`;
    result.concentration.forEach(c => {
      html += `<tr><td>${c.name}</td><td class="num">${c.amount_ok}억</td><td class="num">${c.pct}%</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  // Stage 4: loans
  if (n === 4 && result.loans) {
    html += `<div class="section-title">타행 여신 통합</div>`;
    html += `<table class="tbl">
      <thead><tr><th>은행</th><th>잔액</th><th>유형</th><th>연체</th></tr></thead>
      <tbody>`;
    result.loans.forEach(l => {
      html += `<tr><td>${l.bank}</td><td class="num">${l.balance_ok != null ? l.balance_ok + '억' : '—'}</td><td>${l.type}</td><td class="num">${l.delay}건</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  // Stage 5: collateral
  if (n === 5 && result.collateral) {
    html += `<div class="section-title">담보 자산 평가</div>`;
    html += `<table class="tbl">
      <thead><tr><th>자산</th><th>감정가</th><th>담보가</th><th>근저당</th></tr></thead>
      <tbody>`;
    result.collateral.forEach(c => {
      html += `<tr>
        <td>${c.asset}</td>
        <td class="num">${c.appraisal_ok != null ? c.appraisal_ok + '억' : '—'}</td>
        <td class="num">${c.collateral_ok != null ? c.collateral_ok + '억' : '—'}</td>
        <td class="num">${c.mortgage_ok != null ? c.mortgage_ok + '억' : '—'}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }

  // Stage 6: graph + exposure
  if (n === 6) {
    html += `<div class="section-title">★ 관계회사 그래프 자동 검출</div>`;
    html += `<div class="kj-graph">${renderRelatedPartiesSVG(result.graph)}</div>`;
    if (result.exposure) {
      html += `<div class="section-title">계열 익스포저 합산</div>`;
      html += `<div class="exposure-list">`;
      let total = 0;
      result.exposure.forEach(e => {
        if (e.highlight) total += e.amount_ok;
        const cls = e.highlight ? 'highlight' : '';
        html += `<div class="exposure-row ${cls}">
          <span>${e.label}</span>
          <span class="exposure-amount">${e.amount_ok}억</span>
          <span class="exposure-kind">${e.kind}</span>
        </div>`;
      });
      html += `<div class="exposure-total">
        <span>★ 동일차주 합산 (단기대여)</span>
        <span>${total.toFixed(1)}억</span>
      </div>`;
      html += `</div>`;
    }
  }

  // Stage 7: weights
  if (n === 7 && result.weights) {
    html += `<div class="section-title">위험요인 가중치</div>`;
    html += `<div class="weights">`;
    result.weights.forEach(w => {
      html += `<div class="weight-row">
        <div class="weight-label"><span>${w.factor}</span><b>${w.weight.toFixed(2)} <span style="color:var(--muted);font-size:10px;">(${w.evidence})</span></b></div>
        <div class="weight-bar"><div class="weight-bar-fill" style="width:${w.weight * 100}%;"></div></div>
      </div>`;
    });
    html += `</div>`;
  }

  // Stage 8: form preview
  if (n === 8 && result.form_sections) {
    html += `<div class="section-title">광주은행 표준 승인신청서 (자동 작성 초안)</div>`;
    html += `<div class="form-preview" id="form-preview"></div>`;
    html += `<div class="hitl-actions">
      <button class="hitl-btn approve" type="button">✓ 승인</button>
      <button class="hitl-btn cond" type="button">⚠ 조건부</button>
      <button class="hitl-btn reject" type="button">✗ 반려</button>
    </div>`;
    html += `<div style="margin-top:8px; font-size:10px; color:var(--muted); text-align:center;">
      ⓘ 최종 결재는 심사역 (HITL Mandatory)
    </div>`;
  }

  // Flags
  if (result.flags && result.flags.length) {
    html += `<div class="section-title">플래그</div>`;
    html += `<div class="flags">`;
    result.flags.forEach(f => {
      const icon = f.level === 'ALERT' ? '🚨' : f.level === 'WARN' ? '⚠️' : 'ℹ️';
      html += `<div class="flag ${f.level}">${icon} ${f.msg}</div>`;
    });
    html += `</div>`;
  }

  // Facts (출처 인용)
  if (result.facts && result.facts.length) {
    html += `<div class="section-title">사실·근거 자료 인용</div>`;
    html += `<div class="facts">`;
    result.facts.forEach(f => {
      const cls = f.highlight ? 'highlight' : '';
      html += `<div class="fact ${cls}">
        <span class="fact-text">${f.text}</span>
        <span class="fact-source">📄 ${f.source}</span>
      </div>`;
    });
    html += `</div>`;
  }

  html += `</div>`;
  detail.innerHTML = html;

  // Stage 8: 타이핑 애니메이션
  if (n === 8 && result.form_sections) {
    typeFormSections(result.form_sections);
  }
}

// ─────────────────────────────────────────────────────────────────
// Stage 6: 관계회사 그래프 SVG (자체 렌더링)
// ─────────────────────────────────────────────────────────────────
function renderRelatedPartiesSVG(graph) {
  // 노드 좌표 수동 배치
  const positions = {
    hst:    { x: 180, y: 100, r: 40, fill: '#b71c1c', label: '(주)HST\n신청 17.1억' },
    doowon: { x:  60, y: 200, r: 34, fill: '#0d47a1', label: '(주)두원건설\n100% 자회사\n단기대여 37.3억' },
    stconst:{ x: 300, y: 200, r: 34, fill: '#0d47a1', label: '(주)에스티건설\n동일대표\n단기대여 33.2억' },
    ceo:    { x: 180, y:  20, r: 26, fill: '#fb8c00', label: '황성태\n대표 (40%)' },
  };
  const W = 360, H = 240;
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  // edges
  svg += `<defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#666"/>
    </marker>
  </defs>`;
  graph.edges.forEach(e => {
    const a = positions[e.from], b = positions[e.to];
    if (!a || !b) return;
    const isAlert = e.label.includes('단기대여');
    svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
      stroke="${isAlert ? '#b71c1c' : '#888'}" stroke-width="${isAlert ? 2.5 : 1.5}"
      stroke-dasharray="${isAlert ? '0' : '4,3'}" marker-end="url(#arr)"/>`;
    // edge label
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    svg += `<text x="${mx}" y="${my}" font-size="9" fill="${isAlert ? '#b71c1c' : '#666'}" text-anchor="middle"
      font-weight="${isAlert ? '700' : '400'}">${e.label}</text>`;
  });
  // nodes
  graph.nodes.forEach(n => {
    const p = positions[n.id];
    if (!p) return;
    svg += `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.fill}" stroke="#fff" stroke-width="2"/>`;
    const lines = p.label.split('\n');
    const lh = 11;
    const startY = p.y - ((lines.length - 1) * lh) / 2 + 3;
    lines.forEach((ln, i) => {
      svg += `<text x="${p.x}" y="${startY + i * lh}" font-size="10" fill="#fff" text-anchor="middle" font-weight="${i === 0 ? '700' : '400'}">${ln}</text>`;
    });
  });
  svg += `</svg>`;
  return svg;
}

// ─────────────────────────────────────────────────────────────────
// Stage 8: 타이핑 애니메이션
// ─────────────────────────────────────────────────────────────────
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

    // 타이핑
    const text = sec.content;
    const speed = 6 * SPEED; // 글자당 ms
    for (let i = 0; i <= text.length; i += 2) {
      contentEl.textContent = text.substring(0, i);
      target.scrollTop = target.scrollHeight;
      await sleep(speed);
    }
    contentEl.textContent = text;
    contentEl.classList.remove('cursor');

    // 출처
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
// Footer Metrics
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

// ─────────────────────────────────────────────────────────────────
// Reset
// ─────────────────────────────────────────────────────────────────
function resetAll() {
  if (state.running) return;
  state.stages.forEach(s => {
    setStageState(s.no, 'wait');
    setStageProgress(s.no, 0);
  });
  Object.keys(state.fileStates).forEach(k => state.fileStates[k] = 'wait');
  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('processing', 'done'));
  updateFilesProgress();
  state.selectedStage = null;
  document.querySelectorAll('.stage-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('detail-stage').textContent = '—';
  document.getElementById('detail').innerHTML = `
    <div class="detail-empty">
      ▶ 심사 시작 후<br>각 Stage 카드를 클릭하면<br>상세 결과·근거·플래그가 표시됩니다.
      <br><br>
      <div style="text-align:left; font-size:11px; padding: 12px; background: var(--gray-1); border-radius: 6px; line-height: 1.5;">
        <b>시연 키 포인트</b><br>
        · 8-Stage 자동 진행 (총 ~40초)<br>
        · ★ Stage 6: 동일차주 합산 70.5억<br>
        · Stage 8: 광주은행 표준 양식 자동 작성<br>
        · 모든 결론에 출처 자료 인용
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

// ─────────────────────────────────────────────────────────────────
boot();
