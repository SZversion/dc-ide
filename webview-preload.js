// Runs inside every <webview> (dcinside / reddit; popups get an empty skin) (sandboxed, isolated world).
const { ipcRenderer } = require('electron');

const CSS = ipcRenderer.sendSync('get-skin-css', location.hostname);

// ---- 1. inject the skin as early as possible to avoid a flash of the original theme
function injectSkin() {
  if (document.getElementById('__ide_skin')) return true;
  const root = document.head || document.documentElement;
  if (!root) return false;
  const s = document.createElement('style');
  s.id = '__ide_skin';
  s.textContent = CSS;
  root.appendChild(s);
  return true;
}
if (!injectSkin()) {
  const mo = new MutationObserver(() => { if (injectSkin()) mo.disconnect(); });
  mo.observe(document, { childList: true, subtree: true });
}
// some pages rebuild <head>; re-check once the DOM is ready
document.addEventListener('DOMContentLoaded', injectSkin);
// reddit: drop the subreddit's own stylesheet (header banner, flair icons) before it paints
if (/(^|\.)reddit\.com$/.test(location.hostname)) {
  const dropSrCss = () => document.querySelectorAll('[title="applied_subreddit_stylesheet"]').forEach((l) => l.remove());
  const srObs = new MutationObserver(dropSrCss);
  srObs.observe(document, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => { dropSrCss(); srObs.disconnect(); });
}

// ---- 2. settings from the host (dim images etc.)
// Dimming lives in its own <style> so the page resetting <html class> can't undo it.
const DIM_CSS = `
img, video, .write_div iframe, .img_box, .thumb_img {
  opacity: .1 !important; filter: grayscale(1) !important; transition: opacity .15s, filter .15s !important; }
img:hover, video:hover, .write_div iframe:hover, a:hover img, .img_box:hover, .thumb_img:hover {
  opacity: 1 !important; filter: none !important; }
.sp_img img, .icon_img img, img[width="12"], img[width="14"], img[height="12"], img.written_dccon:hover { opacity: .8 !important; }`;
let settings = null;
// settings.media: 'dim' (dim everything) | 'fold' (fold post media + dccons, dim the rest) | 'raw' (as is)
function applySettings() {
  if (!settings || !document.documentElement) return;
  const dim = settings.media === 'dim' || settings.media === 'fold';
  let s = document.getElementById('__ide_dim');
  if (dim && !s) {
    s = document.createElement('style');
    s.id = '__ide_dim';
    s.textContent = DIM_CSS;
    (document.head || document.documentElement).appendChild(s);
  } else if (!dim && s) {
    s.remove();
  }
  let f = document.getElementById('__ide_fold');
  if (settings.media === 'fold' && !f) {
    f = document.createElement('style');
    f.id = '__ide_fold';
    f.textContent = FOLD_CSS;
    (document.head || document.documentElement).appendChild(f);
  } else if (settings.media !== 'fold' && f) {
    f.remove();
  }
  if (settings.media === 'fold') foldMedia(); else unfoldAll();
}
// fold mode only: drop the site's per-image comment buttons ("댓글 열기", hover "이미지 댓글 ON"); the comment box stays
// media not yet turned into a fold marker stays hidden, so nothing shows while the page is still loading
const FOLD_CSS = `.btn_imgcmtopen, .btn_imgcmt, .img_comment_toggle,
.write_div img:not(.ide-foldable), .write_div video:not(.ide-foldable), .write_div iframe:not(.ide-foldable),
.view_comment .written_dccon:not(.ide-foldable), .view_comment .coment_dccon_img img:not(.ide-foldable),
.view_comment .coment_dccon_img video:not(.ide-foldable),
.thing.link .expando img:not(.ide-foldable), .thing.link .expando video:not(.ide-foldable), .thing.link .expando iframe:not(.ide-foldable),
.thing.link .usertext-body img:not(.ide-foldable), .thing.link .usertext-body video:not(.ide-foldable),
.commentarea .usertext-body img:not(.ide-foldable), .commentarea .usertext-body video:not(.ide-foldable) { display: none !important; }`;

// ---- 2b. fold mode: each media becomes a one-line "<<<<<<< HEAD:image_1.png" button.
// Button click → media shown as the site shows it; media click → folded again.
// Embedded players (YouTube iframes) swallow clicks, so their button stays visible and toggles instead.
const FOLD_AREAS = [
  ['.write_div', 'img, video, iframe'],
  ['.view_comment', '.written_dccon, .coment_dccon_img img, .coment_dccon_img video'],
  ['.thing.link .expando', 'img, video, iframe'],
  ['.thing.link .usertext-body', 'img, video'],
  ['.commentarea .usertext-body', 'img, video'],
];
function foldMedia() {
  if (!settings || settings.media !== 'fold') return;
  for (const [areaSel, sel] of FOLD_AREAS) for (const area of document.querySelectorAll(areaSel)) {
    for (const el of area.querySelectorAll(sel)) {
      if (el.classList.contains('ide-foldable') || (el.tagName !== 'VIDEO' && el.closest('video'))) continue;
      const kind = el.matches('.written_dccon, .coment_dccon_img *') ? 'dccon' : el.tagName === 'VIDEO' || el.tagName === 'IFRAME' ? 'video' : 'image';
      // shortcut: dcinside image URLs carry no extension, so only an explicit .gif is detected
      const ext = el.tagName === 'IFRAME' ? 'embed' : el.tagName === 'VIDEO' ? 'mp4' : /\.gif\b/i.test((el.currentSrc || el.src || '') + (el.alt || '')) ? 'gif' : 'png';
      const n = area.querySelectorAll(`.ide-fold[data-kind="${kind}"]`).length + 1;
      const btn = document.createElement('span');
      btn.className = 'ide-fold';
      btn.dataset.kind = kind;
      btn.setAttribute('role', 'button');
      btn.tabIndex = 0;
      if (el.tagName === 'IFRAME') btn.dataset.frame = '1';
      btn.innerHTML = '<b class="ide-m">&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD:</b><b class="ide-f"></b> <i class="ide-h">(click to resolve)</i>';
      btn.querySelector('.ide-f').textContent = `${kind}_${n}.${ext}`;
      el.classList.add('ide-foldable');
      el.parentNode.insertBefore(btn, el);
      setFolded(el, true);
    }
  }
}
function setFolded(el, folded) {
  el.classList.toggle('ide-folded', folded);
  const btn = el.previousElementSibling;
  const wasOpen = btn && btn.classList.contains('ide-open');
  if (btn && btn.classList.contains('ide-fold')) btn.classList.toggle('ide-open', !folded);
  if (el.tagName === 'VIDEO') { if (folded) el.pause(); else if (el.autoplay || el.loop) el.play().catch(() => {}); }
  // a hidden iframe keeps playing; reloading it stops playback (only if the user had opened it)
  if (el.tagName === 'IFRAME' && folded && wasOpen) el.src = el.src;
}
function unfoldAll() {
  document.querySelectorAll('.ide-fold').forEach((b) => b.remove());
  document.querySelectorAll('.ide-foldable').forEach((el) => {
    el.classList.remove('ide-foldable', 'ide-folded');
    if (el.tagName === 'VIDEO' && (el.autoplay || el.loop)) el.play().catch(() => {});
  });
}
// capture phase so the site's own handlers (image pop-up, links) never see these clicks
function onFoldClick(e) {
  const t = e.target;
  if (!t || !t.closest) return;
  const btn = t.closest('.ide-fold');
  const media = btn ? btn.nextElementSibling : t.closest('.ide-foldable');
  if (!media || !media.classList.contains('ide-foldable')) return;
  if (e.type === 'keydown' && !(btn && (e.key === 'Enter' || e.key === ' '))) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  setFolded(media, btn ? btn.classList.contains('ide-open') : true);
}
window.addEventListener('click', onFoldClick, true);
window.addEventListener('keydown', onFoldClick, true);
ipcRenderer.on('settings', (_e, s) => {
  settings = s || {};
  try { localStorage.setItem('__ide_media', settings.media || ''); } catch { /* storage blocked */ }
  applySettings();
});
ipcRenderer.sendToHost('need-settings');
// Host settings arrive async; until then use the last mode (cached in this origin's storage) from the first paint.
try { settings = { media: localStorage.getItem('__ide_media') || 'fold' }; } catch { settings = { media: 'fold' }; }
if (document.documentElement) applySettings();
else {
  const early = new MutationObserver(() => { if (document.documentElement) { early.disconnect(); applySettings(); } });
  early.observe(document, { childList: true });
}
document.addEventListener('DOMContentLoaded', applySettings);

// ---- 3. capture the site's own alarm pop-ups (comment / reply alerts on my posts)
// dcinside polls /ajax/alarm_ajax/polling every ~60s and renders results into
// .alarmPopup as .one_notice_txt items. We forward them to the IDE and hide the original.
const seen = new Set();
function harvest(root) {
  const box = root.closest ? root.closest('.alarmPopup') : null;
  const scope = box || document.querySelector('.alarmPopup');
  if (!scope) return;
  scope.querySelectorAll('.one_notice_txt').forEach((n) => {
    const text = (n.textContent || '').replace(/\s+/g, ' ').replace(/^NEW\s*/, '').trim();
    const href = n.href || '';
    const key = text + '|' + href;
    if (!text || seen.has(key)) return;
    seen.add(key);
    ipcRenderer.sendToHost('alarm', { text, href });
  });
}
function watchAlarms() {
  const box = document.querySelector('.alarmPopup');
  if (box) {
    harvest(box);
    new MutationObserver(() => harvest(box)).observe(box, { childList: true, subtree: true });
  }
  // the dcinside main page appends alarm boxes directly to <body>
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && (n.matches('.alarmPopup, .one_noticewrap') || n.querySelector('.one_notice_txt'))) {
        n.querySelectorAll('.one_notice_txt').forEach((x) => {
          const text = (x.textContent || '').replace(/\s+/g, ' ').replace(/^NEW\s*/, '').trim();
          const key = text + '|' + (x.href || '');
          if (text && !seen.has(key) && !x.closest('.rtbAlarmPopup')) { seen.add(key); ipcRenderer.sendToHost('alarm', { text, href: x.href || '' }); }
        });
      }
    }
  }).observe(document.body, { childList: true });
}

// ---- 4. metadata for the tree (real gallery name shown only as tooltip)
function sendMeta() {
  const el = document.querySelector('.page_head .fl h2 a, .page_head h2 a, .gall_tit_wrap h2 a');
  const name = el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  if (name) ipcRenderer.sendToHost('meta', { galleryName: name });
}

// ---- 4b. gallery list → Git Log: rewrite the texts CSS can't change
const LABELS = {
  '전체글': 'All commits', '개념글': 'Starred', '공지': 'Pinned', '동영상': 'Media',
  '글쓰기': 'Commit…', '추천': 'Star', '갤러리 설정': 'Settings',
};
const shortHash = (n) => {
  // stable fake commit hash from the post number
  let h = (Number(n) * 2654435761) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0;
  return h.toString(16).padStart(8, '0').slice(0, 7);
};
const pad = (n) => String(n).padStart(2, '0');
function fmtDate(td) {
  const full = td.getAttribute('title') || '';           // "2026-11-06 15:49:54"
  const m = full.match(/^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/);
  if (!m) return null;
  return fmtStamp(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
}
function fmtStamp(d) {
  const now = new Date();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today - day) / 864e5);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (diff === 0) return `Today ${hm}`;
  if (diff === 1) return `Yesterday ${hm}`;
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}, ${hm}`;
}

// ---- commit graph: lanes that fork and merge, drawn as one SVG per row.
// Deterministic per page (seeded from the first post number) so it doesn't change on re-render.
const GRAPH_COLORS = ['#5fb865', '#56a8f5', '#c77dbb', '#e5c07b', '#2aacb8', '#e06c75', '#a68cf0'];
const ROW_H = 26, MID = 13, LANE_W = 12, MAX_LANES = 5, GRAPH_W = 8 + LANE_W * MAX_LANES;
const laneX = (i) => 8 + i * LANE_W;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function drawGraph(rows, seed, place) {
  const rand = rng(seed);
  let colorSeq = 0;
  const newLane = () => ({ color: GRAPH_COLORS[colorSeq++ % GRAPH_COLORS.length] });
  // start with a main line plus 1–2 feature branches already in flight
  let lanes = [newLane()];
  for (let i = 0, n = 1 + Math.floor(rand() * 2); i < n; i++) lanes.push(newLane());

  const NS = 'http://www.w3.org/2000/svg';
  const curve = (x1, y1, x2, y2) => `M${x1} ${y1} C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`;

  for (const tr of rows) {
    const top = lanes.slice();
    // which lane gets this commit: mostly main / recent branches
    const r = rand();
    const cIdx = r < 0.35 ? 0 : Math.min(top.length - 1, Math.floor(rand() * top.length));
    const commit = top[cIdx];

    // keep ~2-4 lanes alive: merge more when crowded, fork more when sparse
    const n = top.length;
    const pMerge = [0, 0, 0.1, 0.18, 0.3, 0.45][n] ?? 0.45;
    const pFork = [0, 0.55, 0.3, 0.16, 0.06, 0][n] ?? 0;

    // merge: another lane ends in this commit
    let merged = null;
    if (n > 1 && rand() < pMerge) {
      const others = top.filter((l) => l !== commit);
      merged = others[Math.floor(rand() * others.length)];
    }
    let bottom = top.filter((l) => l !== merged);
    // fork: a new branch starts from this commit (git log is newest-first, so it "opens" below)
    let forked = null;
    if (!merged && bottom.length < MAX_LANES && rand() < pFork) {
      forked = newLane();
      bottom = bottom.concat(forked);
    }

    const xc = laneX(cIdx);
    const paths = [];
    for (const l of top) {
      const xt = laneX(top.indexOf(l));
      if (l === merged) paths.push([curve(xt, 0, xc, MID), l.color]);
      else if (l === commit) paths.push([`M${xt} 0 L${xc} ${MID}`, l.color]);
      else paths.push([curve(xt, 0, laneX(bottom.indexOf(l)), ROW_H), l.color]);
    }
    paths.push([curve(xc, MID, laneX(bottom.indexOf(commit)), ROW_H), commit.color]);
    if (forked) paths.push([curve(xc, MID, laneX(bottom.indexOf(forked)), ROW_H), forked.color]);

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', GRAPH_W);
    svg.setAttribute('height', ROW_H);
    svg.setAttribute('viewBox', `0 0 ${GRAPH_W} ${ROW_H}`);
    for (const [d, color] of paths) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('stroke', color);
      p.setAttribute('stroke-width', '2');
      p.setAttribute('fill', 'none');
      svg.appendChild(p);
    }
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', xc); dot.setAttribute('cy', MID); dot.setAttribute('r', merged ? 4.5 : 4);
    dot.setAttribute('fill', merged ? '#1e1f22' : commit.color);
    dot.setAttribute('stroke', commit.color); dot.setAttribute('stroke-width', merged ? 2 : 0);
    svg.appendChild(dot);

    place(tr, svg);
    lanes = bottom;
  }
}

function disguiseList() {
  const table = document.querySelector('table.gall_list');
  if (!table) return;
  for (const tr of table.querySelectorAll('tbody tr')) {
    if (tr.dataset.ide) continue;
    tr.dataset.ide = '1';
    const num = tr.querySelector('td.gall_num');
    const raw = num ? num.textContent.trim() : '';
    if (/^\d+$/.test(raw)) {
      num.textContent = shortHash(raw);
      num.title = raw;
    } else if (raw === '공지' || tr.dataset.type === 'icon_notice') {
      tr.classList.add('ide-pinned');
    } else {
      tr.classList.add('ide-ad');                         // AD, 설문, etc.
    }
    // minor galleries mark notices with a numbered row + "공지" subject head
    const subj = tr.querySelector('td.gall_subject');
    if (subj && subj.textContent.trim() === '공지') tr.classList.add('ide-pinned');
    const date = tr.querySelector('td.gall_date');
    const f = date && fmtDate(date);
    if (f) date.textContent = f;
    const rn = tr.querySelector('.reply_num');
    if (rn) rn.textContent = rn.textContent.replace(/\[(\d+)(?:\/(\d+))?\]/, (_, a) => `(#${a})`);
  }
  // On the "공지" tab, show pinned rows (otherwise they'd all be hidden)
  const onNotice = /exception_mode=notice/.test(location.search);
  if (onNotice) table.querySelectorAll('tr.ide-pinned').forEach((tr) => tr.classList.remove('ide-pinned'));

  const rows = [...table.querySelectorAll('tbody tr')]
    .filter((tr) => !tr.classList.contains('ide-pinned') && !tr.classList.contains('ide-ad'));
  if (rows.length && !rows[0].querySelector('td.ide-graph')) {
    drawGraph(rows, Number(rows[0].dataset.no) || 7, (tr, svg) => {
      const td = document.createElement('td');
      td.className = 'ide-graph';
      td.appendChild(svg);
      tr.insertBefore(td, tr.firstChild);
    });
  }

  // tab / button labels
  document.querySelectorAll('.list_array_option button, .list_array_option a, .list_bottom_btnbox button, .list_bottom_btnbox a, .btn_write')
    .forEach((el) => {
      if (el.children.length && !el.classList.contains('btn_write')) return;
      const t = el.textContent.trim();
      if (LABELS[t]) { el.title = t; el.textContent = LABELS[t]; }
    });
  document.querySelectorAll('.select_area a').forEach((a) => {
    const n = a.firstChild;
    if (n && n.nodeType === 3) n.textContent = n.textContent.replace('개', ' rows');
  });

  // header: "프로그래밍 갤러리" → "Log: origin/programming"
  const h = document.querySelector('.page_head h2 a');
  if (h && !h.dataset.ide) {
    h.dataset.ide = '1';
    const id = new URLSearchParams(location.search).get('id') || 'main';
    h.title = h.textContent.trim();
    h.textContent = `Log: origin/${id}`;
  }
}

// ---- 4c. post view → commit details + code review
const VIEW_LABELS = {
  '전체 댓글': 'Review comments', '등록순': 'Oldest', '최신순': 'Newest', '답글순': 'Threads',
  '등록': 'Comment', '등록+추천': 'Comment & approve', '디시콘': 'Emoji', '글자콘': 'Snippets',
  '삭제': 'Delete', '수정': 'Amend', '답글': 'Reply', '본문 보기': 'Back to top',
  '댓글닫기': 'Collapse', '댓글 등록': 'Add comment', '새로고침': 'Refresh', '전체글': 'All commits', '개념글': 'Starred',
  '글쓰기': 'Commit…', '목록': 'Log', '이전글': 'Prev', '다음글': 'Next',
};

function relabel(root, map) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits = [];
  for (let n; (n = walker.nextNode());) {
    const t = n.nodeValue.trim();
    if (t && map[t]) hits.push(n);
  }
  for (const n of hits) {
    const t = n.nodeValue.trim();
    if (n.parentElement && !n.parentElement.title) n.parentElement.title = t;
    n.nodeValue = n.nodeValue.replace(t, map[t]);
  }
}


function disguiseComments() {
  const box = document.querySelector('.view_comment');
  if (!box) return;
  box.querySelectorAll('.cmt_list li.ub-content, .reply_list li.ub-content').forEach((li) => {
    if (li.dataset.ide) return;
    li.dataset.ide = '1';
    const dt = li.querySelector('.date_time');
    if (dt) dt.textContent = dt.textContent.replace(/^(\d\d)\.(\d\d) (\d\d:\d\d):\d\d$/, '$1/$2 $3');
  });
  // the "전체 댓글 12개" header: drop the trailing "개"
  const nb = box.querySelector('.comment_count .num_box');
  if (nb) for (const n of nb.childNodes) if (n.nodeType === 3 && n.nodeValue.trim() === '개') n.nodeValue = '';
  relabel(box, VIEW_LABELS);
  const ta = box.querySelector('.cmt_write textarea');
  if (ta && !ta.placeholder) ta.placeholder = 'Leave a review comment…  (Shift+Enter: new line)';
  box.querySelectorAll('input[placeholder="닉네임"]').forEach((i) => (i.placeholder = 'Author'));
  box.querySelectorAll('input[placeholder="비밀번호"]').forEach((i) => (i.placeholder = 'Password'));
}

function disguiseView() {
  const head = document.querySelector('.gallview_head');
  if (!head || head.dataset.ide) return;
  head.dataset.ide = '1';
  const p = new URLSearchParams(location.search);
  const no = p.get('no') || '0';
  const id = p.get('id') || 'main';

  // "commit 3ec6845d…  origin/programming"
  const meta = document.createElement('div');
  meta.className = 'ide-commit-meta';
  const full = shortHash(no) + shortHash(Number(no) + 7919) + shortHash(Number(no) + 104729);
  meta.innerHTML = '<span class="k">commit</span> <span class="h"></span> <span class="ref"></span>';
  meta.querySelector('.h').textContent = full.slice(0, 20);
  meta.querySelector('.h').title = 'No. ' + no;
  meta.querySelector('.ref').textContent = 'origin/' + id;
  head.insertBefore(meta, head.firstChild);

  // Author / Date lines
  const writer = head.querySelector('.gall_writer');
  if (writer) {
    const d = writer.querySelector('.gall_date');
    if (d) d.textContent = 'Date: ' + (d.getAttribute('title') || d.textContent).replace(/\./g, '-').replace(/:\d\d$/, '');
    // stats: 조회 183 / 추천 0 / 댓글 12 → +183  ★0  12 comments
    const swap = (sel, re, fmt) => {
      const el = writer.querySelector(sel);
      if (!el) return;
      const target = el.querySelector('a') || el;
      const m = target.textContent.match(re);
      if (m) { el.title = target.textContent.trim(); target.textContent = fmt(m[1]); }
    };
    swap('.gall_count', /(\d[\d,]*)/, (n) => `+${n}`);
    swap('.gall_reply_num', /(\d[\d,]*)/, (n) => `★ ${n}`);
    swap('.gall_comment', /(\d[\d,]*)/, (n) => `${n} comments`);
  }

  const bottom = document.querySelector('.view_bottom_btnbox');
  if (bottom) relabel(bottom, VIEW_LABELS);

  disguiseComments();
  const cbox = document.querySelector('.view_comment');
  if (cbox) {
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; disguiseComments(); foldMedia(); });
    }).observe(cbox, { childList: true, subtree: true });
  }
}

// ---- 4d. login page → IDE "GitLab 계정" dialog
// Dialog shell shared by dc and reddit; callers fill the data-slot elements (id, pw, save, sso, buttons).
function buildLoginDialog({ onCancel, onGenerate }) {
  const dlg = document.createElement('div');
  dlg.className = 'ide-dialog';
  dlg.innerHTML = `
    <div class="ide-dlg-title"><span class="ide-dlg-logo">IJ</span><span>GitLab 계정 로그인</span><button type="button" class="ide-dlg-x" title="닫기">✕</button></div>
    <div class="ide-dlg-body">
      <label class="ide-dlg-label">서버:</label>
      <div class="ide-dlg-field"><input class="ide-dlg-server" value="https://gitlab.workspace.dev" disabled></div>
      <label class="ide-dlg-label" for="id">사용자:</label>
      <div class="ide-dlg-field" data-slot="id"></div>
      <label class="ide-dlg-label" for="pw">토큰:</label>
      <div class="ide-dlg-field ide-dlg-row" data-slot="pw"><button type="button" class="ide-dlg-btn ide-dlg-gen">생성...</button></div>
      <div></div>
      <div class="ide-dlg-hint">액세스 토큰에 다음 범위가 허가되어야 합니다. [api, read_user]</div>
      <div></div>
      <div class="ide-dlg-field" data-slot="save"></div>
    </div>
    <div data-slot="sso"></div>
    <div class="ide-dlg-footer" data-slot="buttons"><button type="button" class="ide-dlg-btn ide-dlg-cancel">취소</button></div>`;
  dlg.querySelector('.ide-dlg-cancel').addEventListener('click', onCancel);
  dlg.querySelector('.ide-dlg-x').addEventListener('click', onCancel);
  dlg.querySelector('.ide-dlg-gen').addEventListener('click', onGenerate);
  dlg.querySelector('.ide-dlg-gen').title = '비밀번호 찾기';
  return dlg;
}

// Re-arranges the real form controls (same inputs, same submit) inside an IDE-style dialog.
function disguiseLogin() {
  if (!/sign\.dcinside\.com$/.test(location.hostname) || !/^\/login/.test(location.pathname)) return;
  const form = document.querySelector('form[name="login"]');
  const id = document.getElementById('id');
  const pw = document.getElementById('pw');
  const submit = form && form.querySelector('button[type="submit"]');
  if (!form || !id || !pw || !submit || form.querySelector('.ide-dialog')) return;

  const leave = () => {
    const back = new URLSearchParams(location.search).get('s_url');
    let u = 'https://gall.dcinside.com/';
    try { if (back && /^https:\/\/([a-z0-9-]+\.)*dcinside\.com\//.test(decodeURIComponent(back))) u = decodeURIComponent(back); } catch { /* keep default */ }
    location.href = u;
  };
  // "생성..." → 비밀번호 찾기 (only account-recovery link kept)
  const dlg = buildLoginDialog({ onCancel: leave, onGenerate: () => { location.href = 'https://sign.dcinside.com/myinfo/reset_pwd'; } });
  const slot = (n) => dlg.querySelector(`[data-slot="${n}"]`);
  id.placeholder = '';
  pw.placeholder = '';
  slot('id').appendChild(id);
  slot('pw').insertBefore(pw, slot('pw').firstChild);
  const save = form.querySelector('#checksaveid')?.closest('.checkbox');
  if (save) {
    const lbl = save.querySelector('label');
    if (lbl) lbl.textContent = '사용자 이름 기억';
    slot('save').appendChild(save);
  }
  submit.textContent = '로그인';
  submit.className = 'ide-dlg-btn ide-dlg-primary';
  slot('buttons').insertBefore(submit, slot('buttons').firstChild);

  form.insertBefore(dlg, form.querySelector('fieldset') || form.firstChild);
  document.documentElement.classList.add('ide-login');
  document.title = 'GitLab 계정 로그인';
  setTimeout(() => id.focus(), 50);
}

// ---- 4e. right-side account box (gallery pages) → "GitLab account" panel
const ACCOUNT_LABELS = {
  '로그아웃': 'Log out', '로그인': 'Sign in', '로그인해 주세요.': 'Sign in to GitLab…',
  '갤로그': 'Profile', '즐겨찾기': 'Favorites', '운영': 'Admin', '스크랩': 'Stash', '알림': 'Notifications',
  '고정닉 신청': 'Register', '글': 'Commits', '댓글': 'Comments', '방명록': 'Discussions',
};
function stripHonorific(root) {
  // "99님" → "99". The 님 may sit in its own text node or element, so find the deepest
  // element whose whole text is "<nick>님" and clean the text nodes inside it.
  // Returns { nick, el } or null.
  const cands = [...root.querySelectorAll('*')].filter((e) => /^\s*\S.{0,30}?\s*님\s*$/.test(e.textContent));
  const el = cands.find((e) => ![...e.children].some((c) => cands.includes(c)));
  if (!el) return null;
  const nick = el.textContent.trim().replace(/\s*님$/, '').trim();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n; (n = walker.nextNode());) nodes.push(n);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (!n.nodeValue.trim()) continue;
    if (n.nodeValue.trim() === '님') { n.nodeValue = ''; break; }
    if (/님\s*$/.test(n.nodeValue)) { n.nodeValue = n.nodeValue.replace(/\s*님(\s*)$/, '$1'); break; }
    break;
  }
  return { nick, el };
}
function dropSeparators(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seps = [];
  for (let n; (n = walker.nextNode());) if (/^\s*[|ㅣ]\s*$/.test(n.nodeValue)) seps.push(n);
  seps.forEach((n) => { n.nodeValue = ' '; });
}
function disguiseAccountBox() {
  const box = document.getElementById('login_box');
  if (!box || box.dataset.ide) return;
  box.dataset.ide = '1';
  const found = stripHonorific(box);
  dropSeparators(box);
  relabel(box, ACCOUNT_LABELS);
  const head = document.createElement('div');
  head.className = 'ide-account-head';
  head.innerHTML = '<span class="ide-account-title">GitLab</span><span class="ide-account-host">gitlab.workspace.dev</span>';
  box.insertBefore(head, box.firstChild);
  if (found) {
    // keep the site's own nickname element (it opens the user menu)
    found.el.classList.add('ide-nick-host');
    box.classList.add('ide-logged-in');
  }
}

// ---- 4f. gallog (profile) → IDE account / activity view
const GALLOG_LABELS = {
  '홈': 'Overview', '게시물': 'Commits', '댓글': 'Review comments', '스크랩': 'Stash', '방명록': 'Discussions',
  '전체': 'All', '갤러리': 'Main', '마이너갤': 'Minor', '미니갤': 'Mini', '인물갤': 'Person',
  '일부공개': 'partial', '비공개': 'private', '전체공개': 'public', '공개': 'public', '전체 보기': 'All',
  '게시물이 없습니다.': 'No commits.', '댓글이 없습니다.': 'No comments.', '스크랩에 글이 없습니다.': 'Stash is empty.',
  '방명록이 없습니다.': 'No discussions.', '더보기': 'More', '삭제': 'Delete', '수정': 'Edit', '등록': 'Post',
};
// Each gallog list item → one table-like row: message | gallery (as ref label) | date.
// Original nodes are kept (links, checkboxes, delete buttons keep working); only classes/text change.
function normalizeGallogRows() {
  document.querySelectorAll('.gallog_cont .cont_listbox > li').forEach((li) => {
    if (li.dataset.ide) return;
    li.dataset.ide = '1';
    const tit = li.querySelector('.galltit');
    const meta = li.querySelector('.nameday');
    if (!tit) return;
    tit.parentElement.classList.add('ide-rowbox');
    tit.classList.add('ide-col-msg');
    if (meta) {
      meta.classList.add('ide-col-meta');
      dropSeparators(meta);
      // first text-bearing child of meta = gallery name → ref label
      const parts = [...meta.querySelectorAll('*')].filter((e) => !e.children.length && e.textContent.trim());
      const date = parts.find((e) => /^\d{4}\.\d\d\.\d\d/.test(e.textContent.trim()));
      if (date) date.classList.add('ide-col-date');
      const gal = parts.find((e) => e !== date && !e.closest('.writer_nikcon'));
      if (gal && !li.closest('.gstbook')) gal.classList.add('ide-ref');
    }
    // " - dc App" suffix on comments written from the app
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      if (/\s-\s*dc\s*App\s*$/i.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\s-\s*dc\s*App\s*$/i, '');
    }
    // remaining blocks in the row (e.g. the parent post title on comments) → dim trailing column
    [...tit.parentElement.children].forEach((c) => {
      if (c !== tit && c !== meta) c.classList.add('ide-col-extra');
    });
  });
}

function disguiseGallog() {
  if (!/gallog\.dcinside\.com$/.test(location.hostname)) return;
  const wrap = document.querySelector('.gallog_wrap');
  if (!wrap || wrap.dataset.ide) return;
  wrap.dataset.ide = '1';
  const nickEl = document.querySelector('.galler_info .nick_name');
  const nick = nickEl ? nickEl.textContent.trim() : '';
  const info = document.querySelector('.galler_info');
  if (info) {
    for (const n of info.childNodes) if (n.nodeType === 3 && /갤로그/.test(n.nodeValue)) n.nodeValue = '';
    const sub = document.createElement('div');
    sub.className = 'ide-profile-sub';
    sub.textContent = '@' + (location.pathname.split('/')[1] || 'user') + ' · gitlab.workspace.dev';
    info.appendChild(sub);
  }
  relabel(document.querySelector('#container') || document.body, GALLOG_LABELS);
  normalizeGallogRows();
  const lists = document.querySelector('.wrap_right');
  if (lists) {
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; normalizeGallogRows(); });
    }).observe(lists, { childList: true, subtree: true });
  }
  document.querySelectorAll('input[placeholder*="검색"]').forEach((i) => (i.placeholder = 'Search commits…'));
  document.querySelectorAll('input[placeholder="닉네임"]').forEach((i) => (i.placeholder = 'Author'));
  document.querySelectorAll('input[placeholder="비밀번호"]').forEach((i) => (i.placeholder = 'Password'));
  document.title = (nick || 'Profile') + ' – GitLab';
}

// ---- 5. forward IDE shortcuts that would otherwise be swallowed by the page
let lastShift = 0;
window.addEventListener('keydown', (e) => {
  // double Shift → Search Everywhere (any other key in between cancels, so typing capitals is safe)
  if (e.key === 'Shift') {
    if (!e.repeat) {
      const now = Date.now();
      if (now - lastShift < 400) { lastShift = 0; ipcRenderer.sendToHost('key', { key: 'SearchEverywhere' }); }
      else lastShift = now;
    }
    return;
  }
  lastShift = 0;
  const k = e.key;
  const forward =
    k === 'Escape' || k === 'F5' ||
    (e.ctrlKey && /^(w|t|l|r|n|Tab)$/i.test(k)) ||
    (e.altKey && /^(1|ArrowLeft|ArrowRight)$/.test(k));
  if (!forward) return;
  ipcRenderer.sendToHost('key', { key: k, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey });
  if (k !== 'Escape') { e.preventDefault(); e.stopPropagation(); }
}, true);

// ---- reddit (old.reddit.com r/pathofexile) list → Git Log. Skin: skin/reddit-skin.css
const isRd = /(^|\.)reddit\.com$/.test(location.hostname);
const rdHash = (id36) => shortHash(parseInt(id36, 36));
const rdDate = (iso) => fmtStamp(new Date(iso));

function rdList() {
  const all = [...document.querySelectorAll('#siteTable > .thing.link')];
  if (!all.length || /\/comments\//.test(location.pathname)) return;
  const rows = [];
  for (const row of all) {
    if (row.dataset.ide) continue;
    row.dataset.ide = '1';
    if (row.dataset.promoted === 'true') { row.remove(); continue; }
    row.classList.add('ide-rd-row');
    if (row.classList.contains('stickied')) row.classList.add('ide-pinned'); else rows.push(row);

    const id = (row.dataset.fullname || '').replace(/^t3_/, '');
    const title = row.querySelector('p.title');
    const mk = (cls, text, tip) => {
      const e = document.createElement('span');
      e.className = cls; e.textContent = text; if (tip) e.title = tip;
      title.insertBefore(e, title.firstChild);
    };
    const flair = row.querySelector('.linkflairlabel');
    if (flair) flair.classList.add('ide-ref');
    const dom = row.dataset.domain || '';
    const xb = row.querySelector('.expando-button');
    const label = row.dataset.isGallery === 'true' || dom === 'i.redd.it' ? 'assets'
      : dom === 'v.redd.it' || /^(youtu|(www\.|m\.)?youtube)/.test(dom) || (xb && xb.classList.contains('video')) ? 'media' : '';
    if (label) mk('ide-ref', label);
    mk('ide-rd-hash', rdHash(id), id);

    const time = row.querySelector('time[datetime]');
    if (time) { time.classList.remove('live-timestamp'); time.textContent = rdDate(time.getAttribute('datetime')); }  // page JS rewrites live ones
    const tag = row.querySelector('.tagline');           // "submitted … by" → just date + author
    if (tag) for (const n of tag.childNodes) if (n.nodeType === 3) n.nodeValue = '';
    const c = row.querySelector('a.comments');
    if (c) c.textContent = `(#${row.dataset.commentsCount || parseInt(c.textContent, 10) || 0})`;
    const a = row.querySelector('a.title');
    if (a && row.dataset.permalink) a.setAttribute('href', row.dataset.permalink);
  }

  // tabs: hot → All commits, top → Starred, plus Pinned
  const tabs = document.querySelector('#header .tabmenu');
  if (tabs) {
    for (const a of tabs.querySelectorAll('a.choice')) {
      const top = /\/top\/?$/.test(new URL(a.href).pathname);
      if (top) a.href = a.href.split('?')[0] + '?t=week';
      a.title = a.textContent.trim();
      a.textContent = top ? 'Starred' : 'All commits';
    }
    const hot = [...tabs.querySelectorAll('a.choice')].find((a) => a.textContent === 'All commits');
    if (hot) {
      const li = hot.parentElement.cloneNode(true);
      li.classList.remove('selected');
      const pa = li.querySelector('a');
      pa.href = hot.href.split('#')[0] + '#pinned'; pa.textContent = 'Pinned';
      tabs.appendChild(li);
    }
  }
  const setMode = () => {
    const pinned = location.hash === '#pinned';
    document.documentElement.classList.toggle('ide-rd-pinned-mode', pinned);
    if (!tabs) return;
    const lis = [...tabs.querySelectorAll('li')];
    const pin = lis.find((li) => li.textContent.trim() === 'Pinned');
    if (!pin) return;
    if (pinned) lis.forEach((li) => li.classList.remove('selected'));
    pin.classList.toggle('selected', pinned);
  };
  setMode();
  window.addEventListener('hashchange', setMode);

  const pn = document.querySelector('#header .pagename a');
  if (pn) {
    const name = pn.textContent.trim();
    pn.title = `r/${name}`;
    pn.textContent = `Log: origin/Rd${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  }
  for (const [sel, txt] of [['.next-button a', 'Older ›'], ['.prev-button a', '‹ Newer']]) {
    const a = document.querySelector(`.nav-buttons .nextprev ${sel}`);
    if (a) a.textContent = txt;
  }

  if (rows.length) {
    drawGraph(rows, parseInt(rows[0].dataset.fullname.replace(/^t3_/, ''), 36), (row, svg) => {
      const g = document.createElement('div');
      g.className = 'ide-graph';
      g.appendChild(svg);
      row.insertBefore(g, row.firstChild);
    });
  }
}

// old reddit post → commit details (+ review comments below)
const rdStamp = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function rdView() {
  const post = document.querySelector('#siteTable > .thing');
  if (!post || post.dataset.ide || !/\/comments\//.test(location.pathname)) return;
  post.dataset.ide = '1';
  const id = (post.dataset.fullname || '').replace(/^t3_/, '');
  const meta = document.createElement('div');
  meta.className = 'ide-commit-meta';
  meta.innerHTML = '<span class="k">commit</span> <span class="h"></span> <span class="ref">origin/RdPathofexile</span>';
  const n = parseInt(id, 36);
  meta.querySelector('.h').textContent = (rdHash(id) + shortHash(n + 7919) + shortHash(n + 104729)).slice(0, 20);
  meta.querySelector('.h').title = id;
  post.parentNode.insertBefore(meta, post);

  // Author / Date / stats lines (tagline text nodes — "submitted", "by" — are dropped)
  const tag = post.querySelector('.tagline');
  if (tag) {
    for (const t of tag.childNodes) if (t.nodeType === 3) t.nodeValue = '';
    const au = document.createElement('div');
    const a = tag.querySelector('a.author') || document.createElement('span');
    if (!a.parentNode) a.textContent = post.dataset.author || '[deleted]';
    au.append('Author: ', a, ...tag.querySelectorAll('.userattrs, .flair'));
    tag.insertBefore(au, tag.firstChild);
    const time = tag.querySelector('time[datetime]');
    if (time) { time.classList.remove('live-timestamp'); time.textContent = 'Date: ' + rdStamp(time.getAttribute('datetime')); }
    const st = document.createElement('div');
    st.textContent = `★ ${post.dataset.score || 0} · ${post.dataset.commentsCount || 0} comments`;
    tag.append(st);
  }

  // external link post: title is plain text, the address is shown (selectable, not clickable)
  const dom = post.dataset.domain || '';
  const a = post.querySelector('p.title a.title');
  if (a && !/^self\./.test(dom) && !/^(i\.redd\.it|v\.redd\.it|(.*\.)?reddit\.com)$/.test(dom) && post.dataset.url) {
    const s = document.createElement('span');
    s.className = 'title';
    s.textContent = a.textContent;
    a.replaceWith(s);
    const u = document.createElement('div');
    u.className = 'ide-link-url';
    u.textContent = post.dataset.url;
    s.closest('p.title').after(u);
  }
  post.querySelector('.expando')?.classList.add('ide-rd-body');
}

function rdComments() {
  const area = document.querySelector('.commentarea');
  if (!area) return;
  for (const c of area.querySelectorAll('.thing.comment')) {
    if (c.dataset.ide) continue;
    c.dataset.ide = '1';
    const tag = c.querySelector(':scope > .entry > .tagline');
    if (!tag) continue;
    const time = tag.querySelector('time[datetime]');
    if (time) {
      const d = new Date(time.getAttribute('datetime'));
      time.classList.remove('live-timestamp');
      time.textContent = `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
  const total = document.querySelector('#siteTable > .thing')?.dataset.commentsCount || area.querySelectorAll('.thing.comment').length;
  const h = area.querySelector('.panestack-title .title');
  if (h && h.textContent !== `Review comments (${total})`) h.textContent = `Review comments (${total})`;
  const menu = area.querySelector('.menuarea');
  if (menu) relabel(menu, { 'best (suggested)': 'Suggested', best: 'Suggested', top: 'Top', new: 'Newest', old: 'Oldest' });
  area.querySelectorAll('.morecomments a.button').forEach((b) => relabel(b, { 'load more comments': 'Load more…' }));
}

// reddit sign-in (new-reddit markup) → same dialog. Its own inputs collect the values; on submit they are
// copied into reddit's shadow-DOM inputs and reddit's own 로그인 button is clicked.
function rdLogin() {
  if (!/^\/login/.test(location.pathname)) return;
  const find = () => {
    const login = document.querySelector('auth-flow-login');
    const btn = login && [...login.querySelectorAll('button')].find((b) => /^(로그인|Log In)$/i.test(b.textContent.trim()));
    const user = document.querySelector('faceplate-text-input#login-username')?.shadowRoot?.querySelector('input');
    const pass = document.querySelector('faceplate-text-input#login-password')?.shadowRoot?.querySelector('input');
    const mgr = document.querySelector('auth-flow-manager');
    return btn && user && pass && mgr ? { btn, user, pass, mgr } : null;
  };
  // faceplate components hydrate after DOMContentLoaded and their shadow roots are not seen by a document
  // MutationObserver, so poll; give up after 10 s and leave reddit's own screen.
  const t0 = Date.now();
  const timer = setInterval(() => {
    const els = find();
    if (!els && Date.now() - t0 < 10000) return;
    clearInterval(timer);
    if (els) build(els.mgr);
  }, 200);

  function build(mgr) {
    const dest = new URLSearchParams(location.search).get('dest');
    const dlg = buildLoginDialog({
      onCancel: () => { location.href = /^https:\/\/old\.reddit\.com\//.test(dest || '') ? dest : 'https://old.reddit.com/r/pathofexile/'; },
      onGenerate: () => { location.href = 'https://www.reddit.com/password'; },
    });
    const slot = (n) => dlg.querySelector(`[data-slot="${n}"]`);
    const id = Object.assign(document.createElement('input'), { type: 'text', id: 'id', autocomplete: 'username' });
    const pw = Object.assign(document.createElement('input'), { type: 'password', id: 'pw', autocomplete: 'current-password' });
    slot('id').appendChild(id);
    slot('pw').insertBefore(pw, slot('pw').firstChild);
    const sso = document.querySelector('auth-flow-sso-buttons');
    const ssoHome = sso && [sso.parentNode, sso.nextSibling];
    if (sso) slot('sso').appendChild(sso);
    const submit = Object.assign(document.createElement('button'), { type: 'button', className: 'ide-dlg-btn ide-dlg-primary', textContent: '로그인' });
    slot('buttons').insertBefore(submit, slot('buttons').firstChild);

    // Errors (wrong password, rate limit, …) render in reddit's hidden form, so when a submit doesn't leave the
    // login step, drop the disguise for good and let reddit's own screen and message show.
    let dropped = false;
    let busy = false;
    const drop = () => {
      dropped = true;
      dlg.hidden = true;
      document.documentElement.classList.remove('ide-rd-login');
      if (sso) ssoHome[0].insertBefore(sso, ssoHome[1]?.parentNode === ssoHome[0] ? ssoHome[1] : null);  // social sign-in back on reddit's own screen
    };
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const send = () => {
      const els = find();
      if (!els || busy) return;
      busy = true;
      for (const [input, v] of [[els.user, id.value], [els.pass, pw.value]]) {
        setValue.call(input, v);
        for (const t of ['input', 'change']) input.dispatchEvent(new Event(t, { bubbles: true, composed: true }));
      }
      // reddit validates (debounced) and only then enables its button; give up after 3 s
      const t1 = Date.now();
      const go = () => {
        const b = find()?.btn;
        if (b && !b.disabled) {
          b.click();
          setTimeout(() => { busy = false; if (mgr.getAttribute('step-name') === 'login') drop(); }, 5000);
        } else if (Date.now() - t1 < 3000) setTimeout(go, 50);
        else drop();
      };
      go();
    };
    submit.addEventListener('click', send);
    dlg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') send(); });

    document.body.appendChild(dlg);
    document.title = 'GitLab 계정 로그인';
    // captcha / 2FA / email-code steps: hide the dialog and show reddit's own screen
    const sync = () => {
      if (dropped) return;
      const on = mgr.getAttribute('step-name') === 'login';
      dlg.hidden = !on;
      document.documentElement.classList.toggle('ide-rd-login', on);
    };
    sync();
    new MutationObserver(sync).observe(mgr, { attributes: true, attributeFilter: ['step-name'] });
    setTimeout(() => id.focus(), 50);
  }
}

// ---- reddit Shift+T: translate titles / post body / comments to Korean (text nodes only, so markup and links stay)
const TR_SEL = '#siteTable .thing.link a.title, #siteTable .thing.link span.title, #siteTable .usertext-body .md, .commentarea .usertext-body .md';
const trOrig = new Map();   // text node → original text
const trCache = new Map();  // original text → translation
let trOn = false;
let trBusy = false;
let trAgain = false;  // comments arrived while a batch was in flight → run once more after it
async function translatePage() {
  if (!trOn) return;
  if (trBusy) { trAgain = true; return; }
  const nodes = [];
  for (const el of document.querySelectorAll(TR_SEL)) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      if (!n.nodeValue.trim() || trOrig.has(n) || n.parentElement.closest('.ide-fold')) continue;
      nodes.push(n);
    }
  }
  const todo = [...new Set(nodes.map((n) => n.nodeValue).filter((t) => !trCache.has(t)))];
  trBusy = true;
  try {
    if (todo.length) {
      const res = await ipcRenderer.invoke('translate', todo);
      todo.forEach((t, i) => trCache.set(t, res[i]));
    }
    if (!trOn) return;
    for (const n of nodes) { trOrig.set(n, n.nodeValue); n.nodeValue = trCache.get(n.nodeValue) ?? n.nodeValue; }
  } catch (err) {
    console.warn('[ide] translate failed:', err && err.message);
  } finally {
    trBusy = false;
    if (trAgain) { trAgain = false; translatePage(); }
  }
}
function untranslatePage() {
  for (const [n, t] of trOrig) n.nodeValue = t;
  trOrig.clear();
}
if (isRd) {
  window.addEventListener('keydown', (e) => {
    if (!(e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyT')) return;
    // Shift+T is a capital T while typing — leave text fields alone
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault(); e.stopPropagation();
    trOn = !trOn;
    document.documentElement.classList.toggle('ide-translated', trOn);
    if (trOn) translatePage(); else untranslatePage();
  }, true);
}

document.addEventListener('DOMContentLoaded', () => {
  injectSkin();
  watchAlarms();
  if (isRd) {
    rdLogin();
    rdList(); rdView(); rdComments();
    const ca = document.querySelector('.commentarea');
    if (ca) {
      let pending = false;
      const obs = new MutationObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; rdComments(); foldMedia(); translatePage(); });
      });
      obs.observe(ca, { childList: true, subtree: true });
      // page JS can inject the post's media (.expando) after load
      obs.observe(document.querySelector('#siteTable > .thing') || ca, { childList: true, subtree: true });
    }
  }
  sendMeta();          // must read the real gallery name before disguiseList() renames it
  disguiseList();
  disguiseView();
  disguiseLogin();
  disguiseAccountBox();
  disguiseGallog();
  const tbody = document.querySelector('table.gall_list tbody');
  if (tbody) new MutationObserver(disguiseList).observe(tbody, { childList: true });
});
