/* ---------- Storage ---------- */
const STORAGE_KEY = 'kidChecklistData_v2';
const LEGACY_KEY = 'kidChecklistData_v1';
const DAY_NAMES = ['CN','T2','T3','T4','T5','T6','T7'];
const DAY_NAMES_FULL = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
const AVATAR_CHOICES = ['🧒','👦','👧','👶','🐱','🐶','🦁','🐰','🦄','🐻','🐼','🦊'];

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
    logs: {},      // { 'YYYY-MM-DD': { taskId: true } }
    starDays: {},  // { 'YYYY-MM-DD': true } -> a star was earned that day
    stars: 0,
  };
}
function defaultAppData(){
  const p = newProfile('Bé 1', '🧒');
  return { profiles: [p], activeProfileId: p.id };
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
      };
      return { profiles: [p], activeProfileId: p.id };
    }
    return defaultAppData();
  }catch(e){ return defaultAppData(); }
}

function saveAppData(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); }

let appData = loadAppData();

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
function nextReward(){
  const p = activeProfile();
  const sorted = [...p.rewards].sort((a,b)=>a.threshold-b.threshold);
  return sorted.find(r => p.stars < r.threshold) || null;
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
    saveAppData();
    renderAll();
    celebrate();
  } else if(hadStarBefore && !(total>0 && done===total)){
    // un-did a task after already earning the star today -> revoke
    delete p.starDays[key];
    p.stars = Math.max(0, p.stars - 1);
    saveAppData();
    renderAll();
  } else {
    saveAppData();
    renderAll();
  }
}

function celebrate(){
  const p = activeProfile();
  const nr = nextReward();
  const modal = document.getElementById('celebrateModal');
  const msg = document.getElementById('celebrateMsg');
  msg.innerHTML = `${escapeHtml(p.name)} vừa hoàn thành hết việc hôm nay!<br><b>+1 ⭐ (tổng ${p.stars} sao)</b>` +
    (nr ? `<br><span style="font-size:13px;color:var(--muted)">Còn ${Math.max(0, nr.threshold-p.stars)} sao nữa để nhận "${nr.emoji} ${nr.title}"</span>` : `<br><span style="font-size:13px;color:var(--muted)">Đã đạt hết các mốc thưởng! 🎉</span>`);
  modal.classList.add('open');
  spawnConfetti();
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

/* ---------- Render: Settings ---------- */
const EMOJI_CHOICES_TASK = ['🪥','🛏️','📚','📖','🧹','🍎','🚿','🧦','🎒','🐶','🥦','⏰','💧','🎹','⚽️','🖍️'];
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
  if(name==='settings') renderSettings();
  if(name==='picker') renderPicker();
}

/* ---------- Init ---------- */
function renderAll(){
  renderToday();
  const activePage = document.querySelector('.page.active');
  if(activePage && activePage.id === 'page-stats') renderStats();
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

  // Register service worker for offline/installable support
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
});
