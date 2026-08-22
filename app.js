/* ---------- Storage ---------- */
const STORAGE_KEY = 'kidChecklistData_v2';
const LEGACY_KEY = 'kidChecklistData_v1';
const DAY_NAMES = ['CN','T2','T3','T4','T5','T6','T7'];
const DAY_NAMES_FULL = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
const AVATAR_CHOICES = ['🧒','👦','👧','👶','🐱','🐶','🦁','🐰','🦄','🐻','🐼','🦊','🐸','🐵','🐹','🐨','🐷','🦖','🦕','🐙','🦋','🐢','🤖','🥷'];
const GIFT_REASONS = [
  { emoji:'🎓', text:'Đạt điểm cao' },
  { emoji:'🧹', text:'Làm việc nhà' },
  { emoji:'🤝', text:'Giúp đỡ người khác' },
  { emoji:'💖', text:'Ngoan, lễ phép' },
  { emoji:'🎁', text:'Khác' },
];
const DEDUCT_REASONS = [
  { emoji:'😤', text:'Không nghe lời' },
  { emoji:'🤥', text:'Nói dối' },
  { emoji:'😠', text:'Cãi lại, vô lễ' },
  { emoji:'👊', text:'Đánh/cắn bạn' },
  { emoji:'⚠️', text:'Khác' },
];

function uid(prefix){ return (prefix||'t') + Math.random().toString(36).slice(2,9); }

function defaultTasks(){
  return [
    { id: uid(), title: 'Đánh răng buổi sáng', emoji: '🪥', days:[0,1,2,3,4,5,6] },
    { id: uid(), title: 'Dọn giường', emoji: '🛏️', days:[0,1,2,3,4,5,6] },
    { id: uid(), title: 'Làm bài tập', emoji: '📚', days:[1,2,3,4,5] },
    { id: uid(), title: 'Đọc sách 15 phút', emoji: '📖', days:[0,1,2,3,4,5,6] },
  ];
}
function defaultRewards(){
  return [
    { id: uid(), threshold: 5, title: 'Xem phim hoạt hình', emoji: '🎬' },
    { id: uid(), threshold: 15, title: 'Đi công viên', emoji: '🎡' },
    { id: uid(), threshold: 30, title: 'Mua đồ chơi nhỏ', emoji: '🧸' },
  ];
}
function newProfile(name, avatar){
  return {
    id: uid('p'),
    name: name || 'Bé',
    avatar: avatar || AVATAR_CHOICES[0],
    tasks: defaultTasks(),
    rewards: defaultRewards(),
    logs: {},        // { 'YYYY-MM-DD': { taskId: true } }
    starDays: {},    // { 'YYYY-MM-DD': true } -> a star was earned that day
    stars: 0,
    starHistory: [], // [{ id, type:'complete'|'gift', dateKey, amount, reason, emoji, at }]
  };
}
function defaultAppData(){
  const p = newProfile('Bé 1', '🧒');
  return { profiles: [p], activeProfileId: p.id, parentPin: null };
}

function loadAppData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && Array.isArray(parsed.profiles) && parsed.profiles.length){
        return parsed;
      }
    }
    // Migrate from old single-profile schema if present
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if(legacyRaw){
      const l = JSON.parse(legacyRaw);
      const p = {
        id: uid('p'),
        name: l.childName || 'Bé 1',
        avatar: '🧒',
        tasks: l.tasks || defaultTasks(),
        rewards: l.rewards || defaultRewards(),
        logs: l.logs || {},
        starDays: l.starDays || {},
        stars: l.stars || 0,
        starHistory: [],
      };
      return { profiles: [p], activeProfileId: p.id, parentPin: null };
    }
    return defaultAppData();
  }catch(e){ return defaultAppData(); }
}

function saveAppData(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); }

let appData = loadAppData();
// Migrate/normalize fields for data saved before the PIN & star-history feature existed
if(typeof appData.parentPin === 'undefined') appData.parentPin = null;
(appData.profiles || []).forEach(p=>{
  if(!Array.isArray(p.starHistory)){
    const hist = [];
    Object.keys(p.starDays || {}).forEach(dateKey=>{
      if(p.starDays[dateKey]){
        const ts = new Date(dateKey + 'T12:00:00').getTime();
        hist.push({ id: uid('h'), type:'complete', dateKey, amount:1, reason:'Hoàn thành hết việc trong ngày', emoji:'✅', at: isNaN(ts) ? Date.now() : ts });
      }
    });
    (p.giftLogs || []).forEach(g=>{
      hist.push({ id: g.id || uid('h'), type:'gift', dateKey: g.dateKey, amount: g.amount, reason: g.reason, emoji: g.emoji || '🌟', at: g.at || Date.now() });
    });
    hist.sort((a,b)=>(b.at||0)-(a.at||0));
    p.starHistory = hist;
  }
});

function getProfile(id){ return appData.profiles.find(p=>p.id===id); }
function activeProfile(){ return getProfile(appData.activeProfileId) || appData.profiles[0]; }

/* ---------- Date helpers ---------- */
function pad(n){ return n<10?'0'+n:''+n; }
function toKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function todayDate(){ return new Date(); }
function todayKey(){ return toKey(todayDate()); }
function addDays(d, n){ const nd = new Date(d); nd.setDate(nd.getDate()+n); return nd; }
function weekdayOf(d){ return d.getDay(); } // 0 Sun .. 6 Sat
function startOfWeek(d){ // Monday as start
  const wd = weekdayOf(d);
  const diff = wd === 0 ? -6 : 1 - wd;
  return addDays(d, diff);
}
function fmtHuman(d){
  return `${DAY_NAMES_FULL[weekdayOf(d)]}, ${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
}

/* ---------- Core logic (scoped to active profile) ---------- */
function tasksForDate(d){
  const wd = weekdayOf(d);
  return activeProfile().tasks.filter(t => t.days.includes(wd));
}
function isDone(dateKey, taskId){
  const p = activeProfile();
  return !!(p.logs[dateKey] && p.logs[dateKey][taskId]);
}
function setDone(dateKey, taskId, val){
  const p = activeProfile();
  if(!p.logs[dateKey]) p.logs[dateKey] = {};
  if(val) p.logs[dateKey][taskId] = true;
  else delete p.logs[dateKey][taskId];
}
function progressFor(d){
  const key = toKey(d);
  const list = tasksForDate(d);
  const done = list.filter(t => isDone(key, t.id)).length;
  return { done, total: list.length };
}
function nextReward(p){
  p = p || activeProfile();
  const sorted = [...p.rewards].sort((a,b)=>a.threshold-b.threshold);
  return sorted.find(r => p.stars < r.threshold) || null;
}

function addStarHistory(p, entry){
  p.starHistory = p.starHistory || [];
  p.starHistory.unshift(Object.assign({ id: uid('h'), at: Date.now() }, entry));
}
function removeCompleteStarHistory(p, dateKey){
  p.starHistory = p.starHistory || [];
  const idx = p.starHistory.findIndex(h=>h.type==='complete' && h.dateKey===dateKey);
  if(idx > -1) p.starHistory.splice(idx, 1);
}

function toggleTask(taskId){
  const p = activeProfile();
  const key = todayKey();
  const wasDone = isDone(key, taskId);
  setDone(key, taskId, !wasDone);
  const { done, total } = progressFor(todayDate());
  const hadStarBefore = !!p.starDays[key];
  if(total > 0 && done === total && !hadStarBefore){
    p.starDays[key] = true;
    p.stars += 1;
    addStarHistory(p, { type:'complete', dateKey:key, amount:1, reason:'Hoàn thành hết việc trong ngày', emoji:'✅' });
    saveAppData();
    renderAll();
    celebrate();
  } else if(hadStarBefore && !(total>0 && done===total)){
    // un-did a task after already earning the star today -> revoke
    delete p.starDays[key];
    p.stars = Math.max(0, p.stars - 1);
    removeCompleteStarHistory(p, key);
    saveAppData();
    renderAll();
  } else {
    saveAppData();
    renderAll();
  }
}

function showNotifyModal(opts){
  document.getElementById('celebrateIcon').textContent = opts.icon || '🎉';
  document.getElementById('celebrateTitle').textContent = opts.title || 'Chúc mừng!';
  document.getElementById('celebrateMsg').innerHTML = opts.html || '';
  document.getElementById('celebrateModal').classList.add('open');
  if(opts.confetti) spawnConfetti();
}

function celebrate(){
  const p = activeProfile();
  const nr = nextReward();
  const html = `${escapeHtml(p.name)} vừa hoàn thành hết việc hôm nay!<br><b>+1 ⭐ (tổng ${p.stars} sao)</b>` +
    (nr ? `<br><span style="font-size:13px;color:var(--muted)">Còn ${Math.max(0, nr.threshold-p.stars)} sao nữa để nhận "${nr.emoji} ${nr.title}"</span>` : `<br><span style="font-size:13px;color:var(--muted)">Đã đạt hết các mốc thưởng! 🎉</span>`);
  showNotifyModal({ icon:'🎉', title:'Chúc mừng!', html, confetti:true });
}
function celebrateGift(p, amount, emoji, reason){
  const nr = nextReward(p);
  const html = `${emoji} ${escapeHtml(p.name)} được Bố/Mẹ tặng <b>${amount} ⭐</b>!<br>Lý do: <b>${escapeHtml(reason)}</b><br><b>Tổng: ${p.stars} sao</b>` +
    (nr ? `<br><span style="font-size:13px;color:var(--muted)">Còn ${Math.max(0, nr.threshold-p.stars)} sao nữa để nhận "${nr.emoji} ${nr.title}"</span>` : `<br><span style="font-size:13px;color:var(--muted)">Đã đạt hết các mốc thưởng! 🎉</span>`);
  showNotifyModal({ icon:'🎉', title:'Chúc mừng!', html, confetti:true });
}
function celebrateDeduct(p, amount, emoji, reason){
  const html = `${emoji} ${escapeHtml(p.name)} bị thu hồi <b>${amount} ⭐</b>.<br>Lý do: <b>${escapeHtml(reason)}</b><br><b>Còn lại: ${p.stars} sao</b>`;
  showNotifyModal({ icon:'📋', title:'Đã ghi nhận', html, confetti:false });
}
function celebrateRedeem(p, r){
  const html = `${r.emoji} ${escapeHtml(p.name)} đã đổi <b>${r.threshold} ⭐</b> lấy <b>${escapeHtml(r.title)}</b>!<br><span style="font-size:13px;color:var(--muted)">Còn lại: ${p.stars} sao</span>`;
  showNotifyModal({ icon:'🎉', title:'Đổi thưởng thành công!', html, confetti:true });
}
function spawnConfetti(){
  const wrap = document.getElementById('confettiWrap');
  wrap.innerHTML = '';
  const emojis = ['🎉','⭐','🎊','✨','🏆'];
  for(let i=0;i<24;i++){
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    el.style.left = Math.random()*100 + 'vw';
    el.style.animationDuration = (2 + Math.random()*1.5) + 's';
    el.style.animationDelay = (Math.random()*0.4) + 's';
    wrap.appendChild(el);
  }
  setTimeout(()=>{ wrap.innerHTML=''; }, 3200);
}

/* ---------- Render: Today ---------- */
function renderToday(){
  const p = activeProfile();
  document.getElementById('todayDate').textContent = fmtHuman(todayDate());
  document.getElementById('starsBadge').textContent = `⭐ ${p.stars}`;
  document.getElementById('greetText').textContent = `Chào ${p.name}! 👋`;
  document.getElementById('switchAvatarToday').textContent = p.avatar;

  const list = tasksForDate(todayDate());
  const key = todayKey();
  const { done, total } = progressFor(todayDate());
  const pct = total ? Math.round(done/total*100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent = `${done}/${total} việc đã xong`;
  document.getElementById('progressPct').textContent = pct + '%';

  const nr = nextReward();
  const nextRewardBox = document.getElementById('nextRewardBox');
  if(nr){
    nextRewardBox.innerHTML = `🎯 Còn <b>${Math.max(0, nr.threshold-p.stars)} sao</b> nữa để nhận <b>${nr.emoji} ${nr.title}</b>`;
  } else if(p.rewards.length){
    nextRewardBox.innerHTML = `🏆 Đã đạt hết các mốc thưởng hiện có!`;
  } else {
    nextRewardBox.innerHTML = `Chưa có mốc thưởng nào. Vào mục Cài đặt để thêm nhé!`;
  }

  const taskListEl = document.getElementById('taskList');
  taskListEl.innerHTML = '';
  if(list.length === 0){
    taskListEl.innerHTML = `<div class="empty-state"><span class="big">🌤️</span>Hôm nay không có việc nào trong danh sách.<br>Vào Cài đặt để thêm việc nhé!</div>`;
  } else {
    list.forEach(t=>{
      const d = isDone(key, t.id);
      const row = document.createElement('div');
      row.className = 'task' + (d ? ' done' : '');
      row.innerHTML = `
        <div class="emoji">${t.emoji}</div>
        <div class="title ${d?'strike':''}">${escapeHtml(t.title)}</div>
        <div class="checkbox ${d?'checked':''}">${d?'✓':''}</div>
      `;
      row.addEventListener('click', ()=> toggleTask(t.id));
      taskListEl.appendChild(row);
    });
  }

  if(total>0 && done===total){
    document.getElementById('doneCard').style.display = 'block';
  } else {
    document.getElementById('doneCard').style.display = 'none';
  }
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ---------- Render: Stats ---------- */
function renderStats(){
  const p = activeProfile();
  document.getElementById('statsProfileName').textContent = `Thống kê tuần của ${p.name} ${p.avatar}`;
  const today = todayDate();
  const weekStart = startOfWeek(today);
  const weekDays = [0,1,2,3,4,5,6].map(i => addDays(weekStart, i));

  // Week grid
  const theadRow = document.getElementById('weekHead');
  theadRow.innerHTML = '<th></th>' + weekDays.map(d=>`<th>${DAY_NAMES[weekdayOf(d)]}<br>${pad(d.getDate())}</th>`).join('');

  const tbody = document.getElementById('weekBody');
  tbody.innerHTML = '';
  p.tasks.forEach(t=>{
    const tr = document.createElement('tr');
    let cells = `<td class="taskname">${t.emoji} ${escapeHtml(t.title)}</td>`;
    weekDays.forEach(d=>{
      const wd = weekdayOf(d);
      const key = toKey(d);
      const isFuture = d > today;
      let mark = '';
      if(!t.days.includes(wd)){
        mark = '<span class="mark" style="color:#ccc">–</span>';
      } else if(isFuture && key !== todayKey()){
        mark = '<span class="mark" style="color:#ddd">·</span>';
      } else if(isDone(key, t.id)){
        mark = '<span class="mark">✅</span>';
      } else {
        mark = '<span class="mark">❌</span>';
      }
      cells += `<td>${mark}</td>`;
    });
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });

  // Missed days this week (days up to today with total>0 and done<total)
  const missDaysEl = document.getElementById('missDays');
  const missedDays = weekDays.filter(d => d <= today).filter(d=>{
    const { done, total } = progressFor(d);
    return total>0 && done<total;
  });
  if(missedDays.length===0){
    missDaysEl.innerHTML = `<div class="empty-state" style="padding:12px 0"><span class="big">🎉</span>Tuần này chưa có ngày nào bỏ sót!</div>`;
  } else {
    missDaysEl.innerHTML = missedDays.map(d=>{
      const { done, total } = progressFor(d);
      return `<div class="miss-item"><span>${fmtHuman(d)}</span><span class="count">${done}/${total}</span></div>`;
    }).join('');
  }

  // Việc còn thiếu trong tuần: per task, count of scheduled-but-missed days up to today
  const missTasksEl = document.getElementById('missTasks');
  const rows = p.tasks.map(t=>{
    let missed = 0;
    weekDays.filter(d=>d<=today).forEach(d=>{
      const wd = weekdayOf(d);
      if(t.days.includes(wd) && !isDone(toKey(d), t.id)) missed++;
    });
    return { t, missed };
  }).filter(r=>r.missed>0).sort((a,b)=>b.missed-a.missed);

  if(rows.length===0){
    missTasksEl.innerHTML = `<div class="empty-state" style="padding:12px 0"><span class="big">👏</span>Không còn việc nào thiếu trong tuần!</div>`;
  } else {
    missTasksEl.innerHTML = rows.map(r=>`
      <div class="miss-item"><span>${r.t.emoji} ${escapeHtml(r.t.title)}</span><span class="count">thiếu ${r.missed} ngày</span></div>
    `).join('');
  }

  document.getElementById('statsStars').textContent = `⭐ ${p.stars}`;
}

/* ---------- Render: History (Lịch sử nhận sao) ---------- */
function renderHistory(){
  const p = activeProfile();
  document.getElementById('historyProfileName').textContent = `Lịch sử nhận sao của ${p.name} ${p.avatar}`;
  document.getElementById('historyStars').textContent = `⭐ ${p.stars}`;

  const hist = (p.starHistory || []).slice().sort((a,b)=>(b.at||0)-(a.at||0));
  const completeTotal = hist.filter(h=>h.type==='complete').reduce((s,h)=>s+h.amount,0);
  const giftTotal = hist.filter(h=>h.type==='gift').reduce((s,h)=>s+h.amount,0);
  const deductTotal = hist.filter(h=>h.type==='deduct').reduce((s,h)=>s+Math.abs(h.amount),0);
  const redeemTotal = hist.filter(h=>h.type==='redeem').reduce((s,h)=>s+Math.abs(h.amount),0);
  document.getElementById('historySummary').innerHTML = `
    <div class="history-summary-item"><span>✅ Tự hoàn thành việc</span><b>${completeTotal} ⭐</b></div>
    <div class="history-summary-item"><span>🎁 Được Bố/Mẹ tặng</span><b>${giftTotal} ⭐</b></div>
    <div class="history-summary-item"><span>⚠️ Bị thu hồi</span><b>${deductTotal} ⭐</b></div>
    <div class="history-summary-item"><span>🏆 Đã đổi thưởng</span><b>${redeemTotal} ⭐</b></div>
  `;

  const listEl = document.getElementById('historyList');
  if(hist.length === 0){
    listEl.innerHTML = `<div class="empty-state"><span class="big">📜</span>Chưa có lịch sử nhận sao nào.</div>`;
  } else {
    listEl.innerHTML = hist.map(h=>{
      const dt = new Date(h.at || 0);
      const dateStr = isNaN(dt.getTime()) ? '' : `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}`;
      const badgeClassByType = { complete:'complete', gift:'complete', deduct:'deduct', redeem:'redeem' };
      const badgeClass = 'history-badge ' + (badgeClassByType[h.type] || 'complete');
      const defaultEmoji = { complete:'✅', gift:'🎁', deduct:'⚠️', redeem:'🏆' }[h.type] || '⭐';
      const sign = h.amount > 0 ? '+' : '';
      return `
        <div class="history-item">
          <div class="history-emoji">${h.emoji || defaultEmoji}</div>
          <div class="history-info">
            <div class="history-reason">${escapeHtml(h.reason || '')}</div>
            <div class="history-date">${dateStr}</div>
          </div>
          <div class="${badgeClass}">${sign}${h.amount} ⭐</div>
        </div>
      `;
    }).join('');
  }
}

/* ---------- Render: Settings ---------- */
const EMOJI_CHOICES_TASK = ['🪥','🛏️','📚','📖','🧹','🍎','🚿','🧦','🎒','🐶','🥦','⏰','💧','🎹','⚽️','🖍️','💊','🥛','🧮','🍳','🏃','🏀','🔤','🧼','😴','👕','🌱','📺','🎨','🚲'];
const EMOJI_CHOICES_REWARD = ['🎬','🎡','🧸','🍦','🍕','🎮','🚲','🎪','📱','🏊','🎨','🍭'];

function renderSettings(){
  const p = activeProfile();
  document.getElementById('settingsProfileLabel').textContent = `Đang chỉnh sửa cho: ${p.avatar} ${p.name}`;
  document.getElementById('childNameInput').value = p.name;

  const taskListEl = document.getElementById('settingsTaskList');
  taskListEl.innerHTML = p.tasks.map(t=>`
    <div class="list-item">
      <div class="emoji">${t.emoji}</div>
      <div class="info">
        <div class="t">${escapeHtml(t.title)}</div>
        <div class="s">${t.days.length===7 ? 'Hàng ngày' : t.days.map(d=>DAY_NAMES[d]).join(', ')}</div>
      </div>
      <button class="icon-btn" onclick="openTaskModal('${t.id}')">✏️</button>
      <button class="icon-btn danger" onclick="deleteTask('${t.id}')">🗑️</button>
    </div>
  `).join('') || `<div class="empty-state">Chưa có việc nào.</div>`;

  const rewardListEl = document.getElementById('settingsRewardList');
  rewardListEl.innerHTML = [...p.rewards].sort((a,b)=>a.threshold-b.threshold).map(r=>`
    <div class="list-item">
      <div class="emoji">${r.emoji}</div>
      <div class="info">
        <div class="t">${escapeHtml(r.title)}</div>
        <div class="s">Đạt ${r.threshold} ⭐</div>
      </div>
      <button class="icon-btn" onclick="openRewardModal('${r.id}')">✏️</button>
      <button class="icon-btn danger" onclick="deleteReward('${r.id}')">🗑️</button>
    </div>
  `).join('') || `<div class="empty-state">Chưa có mốc thưởng nào.</div>`;

  const pinStatusEl = document.getElementById('pinStatusText');
  if(pinStatusEl){
    pinStatusEl.textContent = appData.parentPin
      ? '🔒 Đã đặt mã PIN — cần nhập mã này mỗi khi tặng sao.'
      : '⚠️ Chưa đặt mã PIN — hãy đặt để chỉ Bố/Mẹ mới tặng sao được.';
  }
}

function deleteTask(id){
  if(!confirm('Xoá việc này?')) return;
  const p = activeProfile();
  p.tasks = p.tasks.filter(t=>t.id!==id);
  saveAppData(); renderAll();
}
function deleteReward(id){
  if(!confirm('Xoá mốc thưởng này?')) return;
  const p = activeProfile();
  p.rewards = p.rewards.filter(r=>r.id!==id);
  saveAppData(); renderAll();
}

/* ---------- Backup: Export / Import ---------- */
function exportData(){
  const dataStr = JSON.stringify(appData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kid-checklist-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

function importDataFile(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    let parsed;
    try{
      parsed = JSON.parse(e.target.result);
    }catch(err){
      alert('Không đọc được file. Hãy chắc chắn đây là file sao lưu hợp lệ (.json).');
      return;
    }
    if(!parsed || !Array.isArray(parsed.profiles) || !parsed.profiles.length){
      alert('File không đúng định dạng sao lưu của app này.');
      return;
    }
    if(!confirm('Nhập dữ liệu sẽ THAY THẾ TOÀN BỘ dữ liệu hiện tại trên máy này (việc, sao, lịch sử...). Bạn có chắc chắn?')) return;

    appData = parsed;
    if(typeof appData.parentPin === 'undefined') appData.parentPin = null;
    appData.profiles.forEach(p=>{ if(!Array.isArray(p.starHistory)) p.starHistory = []; });
    if(!appData.activeProfileId || !getProfile(appData.activeProfileId)){
      appData.activeProfileId = appData.profiles[0].id;
    }
    saveAppData();
    renderAll();
    alert('Đã nhập dữ liệu thành công!');
  };
  reader.readAsText(file);
}

/* ---------- Parent PIN ---------- */
let pinSuccessCallback = null;

function openPinSetupModal(onSuccess){
  pinSuccessCallback = onSuccess || null;
  document.getElementById('pinSetupNewInput').value = '';
  document.getElementById('pinSetupConfirmInput').value = '';
  document.getElementById('pinSetupError').textContent = '';
  document.getElementById('pinSetupModal').classList.add('open');
  setTimeout(()=>document.getElementById('pinSetupNewInput').focus(), 50);
}
function closePinSetupModal(){
  pinSuccessCallback = null;
  document.getElementById('pinSetupModal').classList.remove('open');
}
function savePinSetup(){
  const pin1 = document.getElementById('pinSetupNewInput').value.trim();
  const pin2 = document.getElementById('pinSetupConfirmInput').value.trim();
  const err = document.getElementById('pinSetupError');
  if(pin1.length < 4){ err.textContent = 'Mã PIN cần ít nhất 4 số.'; return; }
  if(pin1 !== pin2){ err.textContent = 'Hai mã PIN không khớp, nhập lại nhé.'; return; }
  appData.parentPin = pin1;
  saveAppData();
  document.getElementById('pinSetupModal').classList.remove('open');
  renderSettings();
  const cb = pinSuccessCallback; pinSuccessCallback = null;
  if(cb) cb();
}

function openPinVerifyModal(onSuccess){
  pinSuccessCallback = onSuccess || null;
  document.getElementById('pinVerifyInput').value = '';
  document.getElementById('pinVerifyError').textContent = '';
  document.getElementById('pinVerifyModal').classList.add('open');
  setTimeout(()=>document.getElementById('pinVerifyInput').focus(), 50);
}
function closePinVerifyModal(){
  pinSuccessCallback = null;
  document.getElementById('pinVerifyModal').classList.remove('open');
}
function submitPinVerify(){
  const val = document.getElementById('pinVerifyInput').value.trim();
  const err = document.getElementById('pinVerifyError');
  if(!appData.parentPin || val !== appData.parentPin){
    err.textContent = 'Mã PIN không đúng, thử lại nhé.';
    document.getElementById('pinVerifyInput').value = '';
    document.getElementById('pinVerifyInput').focus();
    return;
  }
  document.getElementById('pinVerifyModal').classList.remove('open');
  const cb = pinSuccessCallback; pinSuccessCallback = null;
  if(cb) cb();
}

/* ---------- Star Manage (Tặng sao / Thu hồi sao / Đổi thưởng) ---------- */
let starManageMode = 'gift'; // 'gift' | 'deduct' | 'redeem'
let starReasonList = GIFT_REASONS;
let starReasonIdx = 0;

function renderStarReasonPicker(){
  const el = document.getElementById('starReasonRow');
  el.innerHTML = starReasonList.map((r,i)=>`<button type="button" class="day-chip ${i===starReasonIdx?'on':''}" data-idx="${i}">${r.emoji} ${r.text}</button>`).join('');
  el.querySelectorAll('.day-chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      el.querySelectorAll('.day-chip').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');
      starReasonIdx = parseInt(btn.dataset.idx, 10);
      const isCustom = starReasonList[starReasonIdx].text === 'Khác';
      document.getElementById('starCustomReasonWrap').style.display = isCustom ? 'block' : 'none';
    });
  });
}

function currentStarManageProfile(){
  return getProfile(document.getElementById('starManageProfileSelect').value) || activeProfile();
}

function renderRedeemList(){
  const p = currentStarManageProfile();
  const el = document.getElementById('redeemRewardList');
  const sorted = [...p.rewards].sort((a,b)=>a.threshold-b.threshold);
  if(sorted.length === 0){
    el.innerHTML = `<div class="empty-state">Chưa có mốc thưởng nào. Vào Cài đặt để thêm nhé!</div>`;
    return;
  }
  el.innerHTML = sorted.map(r=>{
    const eligible = p.stars >= r.threshold;
    const need = Math.max(0, r.threshold - p.stars);
    return `
      <div class="list-item">
        <div class="emoji">${r.emoji}</div>
        <div class="info">
          <div class="t">${escapeHtml(r.title)}</div>
          <div class="s">${r.threshold} ⭐${eligible ? '' : ` · cần thêm ${need} sao`}</div>
        </div>
        <button type="button" class="redeem-btn ${eligible?'':'disabled'}" data-reward-id="${r.id}" ${eligible?'':'disabled'}>Đổi</button>
      </div>
    `;
  }).join('');
  el.querySelectorAll('.redeem-btn:not(.disabled)').forEach(btn=>{
    btn.addEventListener('click', ()=> redeemReward(btn.dataset.rewardId));
  });
}

function setStarManageMode(mode){
  starManageMode = mode;
  document.querySelectorAll('#starManageTabs .seg-btn').forEach(b=>b.classList.toggle('on', b.dataset.mode===mode));
  const isRedeem = mode === 'redeem';
  document.getElementById('starManageReasonSection').style.display = isRedeem ? 'none' : 'block';
  document.getElementById('starRedeemSection').style.display = isRedeem ? 'block' : 'none';
  document.getElementById('starManageSaveBtn').style.display = isRedeem ? 'none' : 'block';
  document.getElementById('starManageCancelBtn').textContent = isRedeem ? 'Đóng' : 'Huỷ';

  const titleEl = document.getElementById('starManageTitle');
  const amtLabel = document.getElementById('starAmountLabel');
  const saveBtn = document.getElementById('starManageSaveBtn');

  if(mode === 'gift'){
    titleEl.textContent = '🎁 Tặng sao cho con';
    amtLabel.textContent = 'Số sao tặng';
    saveBtn.textContent = '🎉 Tặng sao';
    starReasonList = GIFT_REASONS;
  } else if(mode === 'deduct'){
    titleEl.textContent = '⚠️ Thu hồi sao';
    amtLabel.textContent = 'Số sao thu hồi';
    saveBtn.textContent = '⚠️ Thu hồi';
    starReasonList = DEDUCT_REASONS;
  } else {
    titleEl.textContent = '🏆 Đổi phần thưởng';
    renderRedeemList();
  }

  if(mode !== 'redeem'){
    starReasonIdx = 0;
    renderStarReasonPicker();
    document.getElementById('starCustomReasonWrap').style.display = 'none';
    document.getElementById('starCustomReasonInput').value = '';
    document.getElementById('starAmountInput').value = 1;
    document.querySelectorAll('#starAmountQuick .day-chip').forEach(c=>c.classList.toggle('on', c.dataset.amt==='1'));
  }
}

function openStarManageModal(mode){
  const sel = document.getElementById('starManageProfileSelect');
  sel.innerHTML = appData.profiles.map(p=>`<option value="${p.id}">${p.avatar} ${escapeHtml(p.name)}</option>`).join('');
  sel.value = appData.activeProfileId;
  setStarManageMode(mode || 'gift');
  document.getElementById('starManageModal').classList.add('open');
}
function closeStarManageModal(){
  document.getElementById('starManageModal').classList.remove('open');
}

function submitStarManage(){
  const p = currentStarManageProfile();
  if(!p){ return; }

  const chosen = starReasonList[starReasonIdx];
  let reasonEmoji = chosen ? chosen.emoji : (starManageMode==='deduct' ? '⚠️' : '🌟');
  let reasonText = chosen ? chosen.text : '';
  if(reasonText === 'Khác'){
    const custom = document.getElementById('starCustomReasonInput').value.trim();
    if(!custom){ alert('Nhập lý do nhé!'); return; }
    reasonText = custom;
    reasonEmoji = starManageMode === 'deduct' ? '⚠️' : '🌟';
  }

  const amount = parseInt(document.getElementById('starAmountInput').value, 10);
  if(!amount || amount < 1){ alert('Nhập số sao hợp lệ (từ 1 trở lên)!'); return; }

  if(starManageMode === 'gift'){
    p.stars += amount;
    addStarHistory(p, { type:'gift', dateKey: todayKey(), amount, reason: reasonText, emoji: reasonEmoji });
    saveAppData();
    closeStarManageModal();
    renderAll();
    celebrateGift(p, amount, reasonEmoji, reasonText);
  } else if(starManageMode === 'deduct'){
    p.stars = Math.max(0, p.stars - amount);
    addStarHistory(p, { type:'deduct', dateKey: todayKey(), amount: -amount, reason: reasonText, emoji: reasonEmoji });
    saveAppData();
    closeStarManageModal();
    renderAll();
    celebrateDeduct(p, amount, reasonEmoji, reasonText);
  }
}

function redeemReward(rewardId){
  const p = currentStarManageProfile();
  const r = p.rewards.find(x=>x.id===rewardId);
  if(!r) return;
  if(p.stars < r.threshold){ alert('Bé chưa đủ sao để đổi phần thưởng này!'); return; }
  if(!confirm(`Xác nhận đổi ${r.threshold} sao lấy "${r.title}"?`)) return;
  p.stars -= r.threshold;
  addStarHistory(p, { type:'redeem', dateKey: todayKey(), amount: -r.threshold, reason: r.title, emoji: r.emoji });
  saveAppData();
  closeStarManageModal();
  renderAll();
  celebrateRedeem(p, r);
}

/* ---------- Task modal ---------- */
let editingTaskId = null;
function openTaskModal(id){
  editingTaskId = id || null;
  const p = activeProfile();
  const t = id ? p.tasks.find(x=>x.id===id) : { title:'', emoji:EMOJI_CHOICES_TASK[0], days:[0,1,2,3,4,5,6] };
  document.getElementById('taskModalTitle').textContent = id ? 'Sửa việc' : 'Thêm việc mới';
  document.getElementById('taskTitleInput').value = t.title;
  renderEmojiPicker('taskEmojiPicker', EMOJI_CHOICES_TASK, t.emoji, 'taskEmojiInput');
  document.getElementById('taskEmojiInput').value = t.emoji;
  renderDaysPicker(t.days);
  document.getElementById('taskModal').classList.add('open');
}
function closeTaskModal(){ document.getElementById('taskModal').classList.remove('open'); }

function renderDaysPicker(selectedDays){
  const el = document.getElementById('daysRow');
  el.innerHTML = DAY_NAMES.map((name,i)=>`<button type="button" class="day-chip ${selectedDays.includes(i)?'on':''}" data-day="${i}">${name}</button>`).join('');
  el.querySelectorAll('.day-chip').forEach(chip=>{
    chip.addEventListener('click', ()=> chip.classList.toggle('on'));
  });
}
function renderEmojiPicker(containerId, choices, selected, hiddenInputId){
  const el = document.getElementById(containerId);
  el.innerHTML = choices.map(e=>`<button type="button" class="emoji-choice ${e===selected?'sel':''}" data-emoji="${e}">${e}</button>`).join('');
  el.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      el.querySelectorAll('button').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel');
      document.getElementById(hiddenInputId).value = btn.dataset.emoji;
    });
  });
}

function saveTaskModal(){
  const title = document.getElementById('taskTitleInput').value.trim();
  if(!title){ alert('Nhập tên việc cần làm nhé!'); return; }
  const emoji = document.getElementById('taskEmojiInput').value || EMOJI_CHOICES_TASK[0];
  const days = [...document.querySelectorAll('#daysRow .day-chip.on')].map(c=>parseInt(c.dataset.day,10));
  if(days.length===0){ alert('Chọn ít nhất 1 ngày trong tuần!'); return; }

  const p = activeProfile();
  if(editingTaskId){
    const t = p.tasks.find(x=>x.id===editingTaskId);
    t.title = title; t.emoji = emoji; t.days = days;
  } else {
    p.tasks.push({ id: uid(), title, emoji, days });
  }
  saveAppData();
  closeTaskModal();
  renderAll();
}

/* ---------- Reward modal ---------- */
let editingRewardId = null;
function openRewardModal(id){
  editingRewardId = id || null;
  const p = activeProfile();
  const r = id ? p.rewards.find(x=>x.id===id) : { title:'', emoji:EMOJI_CHOICES_REWARD[0], threshold:5 };
  document.getElementById('rewardModalTitle').textContent = id ? 'Sửa phần thưởng' : 'Thêm phần thưởng';
  document.getElementById('rewardTitleInput').value = r.title;
  document.getElementById('rewardThresholdInput').value = r.threshold;
  renderEmojiPicker('rewardEmojiPicker', EMOJI_CHOICES_REWARD, r.emoji, 'rewardEmojiInput');
  document.getElementById('rewardEmojiInput').value = r.emoji;
  document.getElementById('rewardModal').classList.add('open');
}
function closeRewardModal(){ document.getElementById('rewardModal').classList.remove('open'); }
function saveRewardModal(){
  const title = document.getElementById('rewardTitleInput').value.trim();
  const threshold = parseInt(document.getElementById('rewardThresholdInput').value, 10);
  if(!title){ alert('Nhập tên phần thưởng nhé!'); return; }
  if(!threshold || threshold<1){ alert('Nhập số sao hợp lệ!'); return; }
  const emoji = document.getElementById('rewardEmojiInput').value || EMOJI_CHOICES_REWARD[0];

  const p = activeProfile();
  if(editingRewardId){
    const r = p.rewards.find(x=>x.id===editingRewardId);
    r.title = title; r.threshold = threshold; r.emoji = emoji;
  } else {
    p.rewards.push({ id: uid(), title, threshold, emoji });
  }
  saveAppData();
  closeRewardModal();
  renderAll();
}

/* ---------- Profile picker ---------- */
function renderPicker(){
  const grid = document.getElementById('profileGrid');
  grid.innerHTML = appData.profiles.map(p=>`
    <div class="profile-tile" data-id="${p.id}">
      <button type="button" class="profile-tile-main" data-id="${p.id}">
        <div class="profile-avatar">${p.avatar}</div>
        <div class="profile-name">${escapeHtml(p.name)}</div>
        <div class="profile-stars">⭐ ${p.stars}</div>
      </button>
      <button type="button" class="profile-edit-btn" data-id="${p.id}">✏️</button>
      ${appData.profiles.length>1 ? `<button type="button" class="profile-del-btn" data-id="${p.id}">🗑️</button>` : ''}
    </div>
  `).join('') + `
    <button type="button" class="profile-tile add-tile" id="addProfileTile">
      <div class="profile-avatar">➕</div>
      <div class="profile-name">Thêm bé</div>
    </button>
  `;

  grid.querySelectorAll('.profile-tile-main').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      appData.activeProfileId = btn.dataset.id;
      saveAppData();
      switchTab('today');
    });
  });
  grid.querySelectorAll('.profile-edit-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{ e.stopPropagation(); openProfileModal(btn.dataset.id); });
  });
  grid.querySelectorAll('.profile-del-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const p = getProfile(btn.dataset.id);
      if(!confirm(`Xoá hồ sơ của "${p.name}"? Toàn bộ dữ liệu (việc, sao, thống kê) sẽ mất.`)) return;
      appData.profiles = appData.profiles.filter(x=>x.id!==btn.dataset.id);
      if(appData.activeProfileId === btn.dataset.id){
        appData.activeProfileId = appData.profiles[0].id;
      }
      saveAppData();
      renderPicker();
    });
  });
  document.getElementById('addProfileTile').addEventListener('click', ()=> openProfileModal(null));
}

let editingProfileId = null;
function openProfileModal(id){
  editingProfileId = id || null;
  const p = id ? getProfile(id) : { name:'', avatar: AVATAR_CHOICES[appData.profiles.length % AVATAR_CHOICES.length] };
  document.getElementById('profileModalTitle').textContent = id ? 'Sửa hồ sơ' : 'Thêm bé mới';
  document.getElementById('profileNameInput').value = p.name;
  renderEmojiPicker('profileAvatarPicker', AVATAR_CHOICES, p.avatar, 'profileAvatarInput');
  document.getElementById('profileAvatarInput').value = p.avatar;
  document.getElementById('profileModal').classList.add('open');
}
function closeProfileModal(){ document.getElementById('profileModal').classList.remove('open'); }
function saveProfileModal(){
  const name = document.getElementById('profileNameInput').value.trim();
  if(!name){ alert('Nhập tên bé nhé!'); return; }
  const avatar = document.getElementById('profileAvatarInput').value || AVATAR_CHOICES[0];

  if(editingProfileId){
    const p = getProfile(editingProfileId);
    p.name = name; p.avatar = avatar;
  } else {
    const p = newProfile(name, avatar);
    appData.profiles.push(p);
    appData.activeProfileId = p.id;
  }
  saveAppData();
  closeProfileModal();
  renderPicker();
  if(document.getElementById('page-picker').classList.contains('active')) renderPicker();
}

/* ---------- Tabs ---------- */
function switchTab(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  document.getElementById('tabbar').style.display = (name==='picker') ? 'none' : 'flex';
  if(name==='today') renderToday();
  if(name==='stats') renderStats();
  if(name==='history') renderHistory();
  if(name==='settings') renderSettings();
  if(name==='picker') renderPicker();
}

/* ---------- Init ---------- */
function renderAll(){
  renderToday();
  const activePage = document.querySelector('.page.active');
  if(activePage && activePage.id === 'page-stats') renderStats();
  if(activePage && activePage.id === 'page-history') renderHistory();
  if(activePage && activePage.id === 'page-settings') renderSettings();
  if(activePage && activePage.id === 'page-picker') renderPicker();
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderToday();

  document.querySelectorAll('.tabbar button').forEach(b=>{
    b.addEventListener('click', ()=> switchTab(b.dataset.tab));
  });

  document.getElementById('switchAvatarToday').addEventListener('click', ()=> switchTab('picker'));
  document.getElementById('backFromPicker').addEventListener('click', ()=> switchTab('today'));

  document.getElementById('childNameInput').addEventListener('change', (e)=>{
    activeProfile().name = e.target.value.trim() || 'Bé';
    saveAppData();
  });

  document.getElementById('addTaskBtn').addEventListener('click', ()=>openTaskModal(null));
  document.getElementById('addRewardBtn').addEventListener('click', ()=>openRewardModal(null));
  document.getElementById('taskCancelBtn').addEventListener('click', closeTaskModal);
  document.getElementById('taskSaveBtn').addEventListener('click', saveTaskModal);
  document.getElementById('rewardCancelBtn').addEventListener('click', closeRewardModal);
  document.getElementById('rewardSaveBtn').addEventListener('click', saveRewardModal);
  document.getElementById('profileCancelBtn').addEventListener('click', closeProfileModal);
  document.getElementById('profileSaveBtn').addEventListener('click', saveProfileModal);
  document.getElementById('celebrateCloseBtn').addEventListener('click', ()=>{
    document.getElementById('celebrateModal').classList.remove('open');
  });

  // Quản lý sao (Bố/Mẹ) — Tặng / Thu hồi / Đổi thưởng — yêu cầu mã PIN
  document.getElementById('starManageBtn').addEventListener('click', ()=>{
    if(!appData.parentPin){
      openPinSetupModal(()=> openStarManageModal('gift'));
    } else {
      openPinVerifyModal(()=> openStarManageModal('gift'));
    }
  });
  document.getElementById('managePinBtn').addEventListener('click', ()=>{
    if(appData.parentPin){
      openPinVerifyModal(()=> openPinSetupModal(null));
    } else {
      openPinSetupModal(null);
    }
  });

  // Sao lưu dữ liệu: xuất không cần PIN (chỉ đọc), nhập cần PIN vì sẽ ghi đè toàn bộ data
  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click', ()=>{
    const openPicker = ()=> document.getElementById('importFileInput').click();
    if(!appData.parentPin){
      openPinSetupModal(openPicker);
    } else {
      openPinVerifyModal(openPicker);
    }
  });
  document.getElementById('importFileInput').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(file) importDataFile(file);
    e.target.value = '';
  });

  document.getElementById('pinSetupCancelBtn').addEventListener('click', closePinSetupModal);
  document.getElementById('pinSetupSaveBtn').addEventListener('click', savePinSetup);
  document.getElementById('pinSetupConfirmInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter') savePinSetup(); });

  document.getElementById('pinVerifyCancelBtn').addEventListener('click', closePinVerifyModal);
  document.getElementById('pinVerifySubmitBtn').addEventListener('click', submitPinVerify);
  document.getElementById('pinVerifyInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter') submitPinVerify(); });

  document.getElementById('starManageCancelBtn').addEventListener('click', closeStarManageModal);
  document.getElementById('starManageSaveBtn').addEventListener('click', submitStarManage);
  document.getElementById('starManageProfileSelect').addEventListener('change', ()=>{
    if(starManageMode === 'redeem') renderRedeemList();
  });
  document.querySelectorAll('#starManageTabs .seg-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> setStarManageMode(btn.dataset.mode));
  });
  document.querySelectorAll('#starAmountQuick .day-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      document.querySelectorAll('#starAmountQuick .day-chip').forEach(c=>c.classList.remove('on'));
      chip.classList.add('on');
      document.getElementById('starAmountInput').value = chip.dataset.amt;
    });
  });

  // Register service worker for offline/installable support
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
});
