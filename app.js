/* ---------- Storage ---------- */
const STORAGE_KEY = 'kidChecklistData_v2';
const LEGACY_KEY = 'kidChecklistData_v1';
const DAY_NAMES = ['CN','T2','T3','T4','T5','T6','T7'];
const DAY_NAMES_FULL = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
const AVATAR_CHOICES = ['🧒','👦','👧','👶','🐱','🐶','🦁','🐰','🦄','🐻','🐼','🦊','🐸','🐵','🐹','🐨','🐷','🦖','🦕','🐙','🦋','🐢','🤖','🥷'];
const SUBJECT_CHOICES = [
  { key:'toan', name:'Toán', emoji:'🧮' },
  { key:'tviet', name:'Tiếng Việt', emoji:'📖' },
  { key:'tanh', name:'Tiếng Anh', emoji:'🔤' },
  { key:'khoahoc', name:'Khoa học', emoji:'🔬' },
  { key:'daoduc', name:'Đạo đức', emoji:'💛' },
  { key:'thedu', name:'Thể dục', emoji:'🏃' },
  { key:'mythuat', name:'Mỹ thuật', emoji:'🎨' },
  { key:'amnhac', name:'Âm nhạc', emoji:'🎵' },
  { key:'tinhoc', name:'Tin học', emoji:'💻' },
  { key:'khac', name:'Khác', emoji:'📚' },
];
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
function defaultTodos(){
  return [
    { id: uid(), title: 'Uống thuốc', emoji: '💊', days:[0,1,2,3,4,5,6] },
    { id: uid(), title: 'Uống sữa', emoji: '🥛', days:[0,1,2,3,4,5,6] },
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
    todos: defaultTodos(),  // việc nên làm, không bắt buộc, không tính sao
    todoLogs: {},           // { 'YYYY-MM-DD': { todoId: true } }
    todoCompleteDays: {},   // { 'YYYY-MM-DD': true|false } -> chốt lại NGAY khi ngày đó có
                             // tương tác, để sau này sửa/xoá to-do không làm đổi lại kết quả
                             // của các ngày cũ (tránh tính streak sai hồi tố)
    todoBadges: [],         // [3, 7, 14, ...] mốc chuỗi ngày đã mở khoá, không liên quan sao
    vouchers: [],           // [{ id, title, emoji, cost, status:'unused'|'used', redeemedAt, usedAt }]
    homework: [],           // bài tập về nhà: [{ id, subject, title, dueDate:'YYYY-MM-DD',
                             // note, status:'pending'|'done', createdAt, doneAt }]
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
        todos: [],
        todoLogs: {},
      };
      return { profiles: [p], activeProfileId: p.id, parentPin: null };
    }
    return defaultAppData();
  }catch(e){ return defaultAppData(); }
}

function saveAppData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  if(getSyncCode()) schedulePush();
}

function normalizeAppData(){
// Migrate/normalize fields for data saved before the PIN & star-history feature existed
if(typeof appData.parentPin === 'undefined') appData.parentPin = null;
(appData.profiles || []).forEach(p=>{
  if(!Array.isArray(p.todos)) p.todos = [];
  if(!p.todoLogs || typeof p.todoLogs !== 'object') p.todoLogs = {};
  if(!p.todoCompleteDays || typeof p.todoCompleteDays !== 'object') p.todoCompleteDays = {};
  if(!Array.isArray(p.todoBadges)) p.todoBadges = [];
  if(!Array.isArray(p.homework)) p.homework = [];
  // Bài tập về nhà không cần theo dõi nhiều ngày: bài nào hạn nộp đã qua (dù đã
  // làm hay chưa) tự động bị dọn khỏi danh sách mỗi khi app mở lại vào ngày mới.
  p.homework = p.homework.filter(h => h.dueDate >= todayKey());
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
  if(!Array.isArray(p.vouchers)){
    // Tạo phiếu quà từ các lần đổi thưởng trước đây (khi chưa có hệ thống phiếu) — mặc định "chưa dùng"
    const vouchers = [];
    (p.starHistory || []).filter(h=>h.type==='redeem').forEach(h=>{
      vouchers.push({
        id: uid('v'),
        title: h.reason,
        emoji: h.emoji || '🎫',
        cost: Math.abs(h.amount),
        status: 'unused',
        redeemedAt: h.at || Date.now(),
        usedAt: null,
      });
    });
    p.vouchers = vouchers;
  }
  // Sửa dữ liệu cũ: các lần hoàn sao (huỷ phiếu) từng bị ghi nhầm loại 'gift',
  // khiến thống kê "Được Bố/Mẹ tặng" bị cộng nhầm — chuyển lại đúng về loại 'redeem'.
  (p.starHistory || []).forEach(h=>{
    if(h.type === 'gift' && typeof h.reason === 'string' && h.reason.indexOf('Hoàn sao (huỷ phiếu') === 0){
      h.type = 'redeem';
    }
  });
});
}

let appData = loadAppData();
normalizeAppData();

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
  const key = toKey(d);
  return activeProfile().tasks.filter(t => t.onceDate ? t.onceDate === key : t.days.includes(wd));
}
function taskScheduleLabel(t){
  if(t.onceDate) return `📅 ${fmtDateShort(t.onceDate)}`;
  return t.days.length===7 ? 'Hàng ngày' : t.days.map(d=>DAY_NAMES[d]).join(', ');
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

/* ---------- Core logic: To-do (không bắt buộc, không tính sao) ---------- */
function fmtDateShort(dateKey){
  const [y,m,d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}
function todoScheduleLabel(t){
  if(t.onceDate) return `📅 ${fmtDateShort(t.onceDate)}`;
  return t.days.length===7 ? 'Hàng ngày' : t.days.map(d=>DAY_NAMES[d]).join(', ');
}
function todosForDate(d){
  const wd = weekdayOf(d);
  const key = toKey(d);
  return activeProfile().todos.filter(t => t.onceDate ? t.onceDate === key : (t.days||[]).includes(wd));
}
function isTodoDone(dateKey, todoId){
  const p = activeProfile();
  return !!(p.todoLogs[dateKey] && p.todoLogs[dateKey][todoId]);
}
function setTodoDone(dateKey, todoId, val){
  const p = activeProfile();
  if(!p.todoLogs[dateKey]) p.todoLogs[dateKey] = {};
  if(val) p.todoLogs[dateKey][todoId] = true;
  else delete p.todoLogs[dateKey][todoId];
}
function toggleTodo(todoId){
  const key = todayKey();
  const wasDone = isTodoDone(key, todoId);
  setTodoDone(key, todoId, !wasDone);
  lockTodoDayComplete(key); // chốt lại kết quả hôm nay ngay lúc này, xem giải thích ở khai báo hàm
  saveAppData();
  const p = activeProfile();
  const streak = calcTodoStreak();
  checkTodoBadges(p, streak);
  renderTodoPage();
}

/* ---------- Chuỗi ngày & huy hiệu to-do (thúc đẩy, không liên quan sao) ---------- */
const TODO_STREAK_BADGES = [
  { days:3,   emoji:'🌱', title:'Mầm chăm chỉ' },
  { days:7,   emoji:'🔥', title:'Tuần lễ chăm chỉ' },
  { days:14,  emoji:'⭐', title:'Nửa tháng kiên trì' },
  { days:30,  emoji:'🏆', title:'Tháng vàng' },
  { days:60,  emoji:'💎', title:'Bền bỉ 60 ngày' },
  { days:100, emoji:'👑', title:'Huyền thoại 100 ngày' },
];

// Ghi lại (chốt) kết quả "ngày dateKey đã hoàn thành hết to-do chưa" NGAY tại thời
// điểm có tương tác trong ngày đó — dùng cho ngày hôm nay (ngày duy nhất còn tick
// được). Một khi ngày đó trôi qua, giá trị ghi lần cuối sẽ tự "đông cứng" vĩnh viễn:
// không còn tương tác nào ghi đè lên key ngày đó nữa, nên sau này thêm/sửa/xoá to-do
// sẽ KHÔNG làm đổi lại kết quả của các ngày cũ (né được bug tính streak sai hồi tố).
function lockTodoDayComplete(dateKey){
  const p = activeProfile();
  const list = todosForDate(dateFromKey(dateKey));
  p.todoCompleteDays = p.todoCompleteDays || {};
  p.todoCompleteDays[dateKey] = list.length > 0 && list.every(t=>isTodoDone(dateKey, t.id));
}

// Nguồn sự thật cho "ngày đó đã xong hết to-do chưa": ưu tiên bản ghi đã chốt
// (todoCompleteDays); nếu chưa có (dữ liệu cũ trước khi có tính năng này, hoặc
// ngày chưa từng tương tác) thì fallback tính theo lịch to-do hiện tại như cũ.
// Trả về true/false, hoặc null nếu ngày đó không có to-do nào được lên lịch.
function isTodoDayComplete(dateKey){
  const p = activeProfile();
  if(p.todoCompleteDays && typeof p.todoCompleteDays[dateKey] === 'boolean'){
    return p.todoCompleteDays[dateKey];
  }
  const list = todosForDate(dateFromKey(dateKey));
  if(list.length === 0) return null;
  return list.every(t=>isTodoDone(dateKey, t.id));
}

function calcTodoStreak(){
  let d = todayDate();
  const key0 = toKey(d);
  const todayComplete = isTodoDayComplete(key0) === true;
  if(!todayComplete) d = addDays(d, -1);

  let streak = 0;
  for(let i=0; i<1000; i++){
    const key = toKey(d);
    const status = isTodoDayComplete(key);
    if(status === null){ d = addDays(d, -1); continue; } // ngày đó không có to-do nào — bỏ qua, không phá chuỗi
    if(!status) break;
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}
function checkTodoBadges(p, streak){
  p.todoBadges = p.todoBadges || [];
  const newlyUnlocked = TODO_STREAK_BADGES.filter(b => streak >= b.days && !p.todoBadges.includes(b.days));
  if(newlyUnlocked.length){
    newlyUnlocked.forEach(b => p.todoBadges.push(b.days));
    saveAppData();
    const b = newlyUnlocked[newlyUnlocked.length - 1];
    showNotifyModal({
      icon: b.emoji,
      title: 'Mở khoá huy hiệu mới!',
      html: `${escapeHtml(p.name)} đã giữ chuỗi <b>${b.days} ngày</b> làm hết to-do!<br><span style="font-size:13px;color:var(--muted)">${b.emoji} ${escapeHtml(b.title)}</span>`,
      confetti: true,
    });
  }
}
function renderTodoBadges(p, streak){
  const el = document.getElementById('todoBadgeList');
  if(!el) return;
  const earned = p.todoBadges || [];
  el.innerHTML = TODO_STREAK_BADGES.map(b=>{
    const unlocked = earned.includes(b.days);
    const label = unlocked ? b.title : `Đạt chuỗi ${b.days} ngày để mở khoá "${b.title}"`;
    return `<div class="todo-badge-chip ${unlocked?'unlocked':'locked'}" title="${escapeHtml(label)}">
      <span class="todo-badge-emoji">${unlocked ? b.emoji : '🔒'}</span>
      <span class="todo-badge-days">${b.days} ngày</span>
    </div>`;
  }).join('');

  const badgeEl = document.getElementById('todoStreakBadge');
  if(streak > 0){
    badgeEl.textContent = `🔥 ${streak} ngày`;
    badgeEl.style.display = 'inline-flex';
  } else {
    badgeEl.style.display = 'none';
  }

  const hintEl = document.getElementById('todoBadgeHint');
  if(hintEl){
    const next = TODO_STREAK_BADGES.find(b => !earned.includes(b.days));
    if(next){
      const remain = next.days - streak;
      hintEl.textContent = remain > 0
        ? `Cố lên nào! Chỉ còn ${remain} ngày nữa là đạt mốc ${next.days} ngày, sẽ có phần quà bí mật từ Ba Mẹ đó nhé! 🎁`
        : `Sắp mở khoá huy hiệu ${next.emoji} ${next.title} rồi, cố lên nào! 🎁`;
    } else {
      hintEl.textContent = `Bé đã mở khoá hết tất cả huy hiệu, quá xuất sắc luôn! 👑✨`;
    }
  }
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
  const html = `${r.emoji} ${escapeHtml(p.name)} đã đổi <b>${r.threshold} ⭐</b> lấy phiếu <b>${escapeHtml(r.title)}</b>!<br><span style="font-size:13px;color:var(--muted)">Phiếu đã lưu vào tab 🎫 Phiếu quà, dùng khi nào cũng được.<br>Còn lại: ${p.stars} sao</span>`;
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

/* ---------- Core logic: Bài tập về nhà ---------- */
function subjectInfo(key){
  return SUBJECT_CHOICES.find(s=>s.key===key) || SUBJECT_CHOICES[SUBJECT_CHOICES.length-1];
}
function sortedHomework(p){
  p = p || activeProfile();
  const list = [...(p.homework || [])];
  // Chưa làm lên trước (theo hạn nộp gần nhất), đã xong xuống cuối
  list.sort((a,b)=>{
    if((a.status==='done') !== (b.status==='done')) return a.status==='done' ? 1 : -1;
    return (a.dueDate||'').localeCompare(b.dueDate||'');
  });
  return list;
}
function homeworkDueLabel(dueDate){
  const key = todayKey();
  // Bài quá hạn tự động bị dọn khỏi danh sách (xem normalizeAppData), nên ở đây
  // chỉ còn 2 trường hợp: hạn hôm nay, hoặc hạn 1 ngày sắp tới.
  if(dueDate === key) return { text:'Hạn nộp: Hôm nay', cls:'today' };
  if(dueDate === toKey(addDays(todayDate(),1))) return { text:'Hạn nộp: Ngày mai', cls:'soon' };
  return { text:`Hạn nộp: ${fmtDateShort(dueDate)}`, cls:'' };
}
// Dọn các bài đã qua hạn (an toàn thêm cho trường hợp app mở xuyên qua nửa đêm
// mà không tải lại trang — bình thường normalizeAppData() lúc khởi động đã lo việc này).
function purgeStaleHomework(p){
  p = p || activeProfile();
  const before = (p.homework||[]).length;
  p.homework = (p.homework||[]).filter(h => h.dueDate >= todayKey());
  return p.homework.length !== before;
}
function toggleHomeworkDone(id){
  const p = activeProfile();
  const hw = (p.homework||[]).find(h=>h.id===id);
  if(!hw) return;
  hw.status = hw.status==='done' ? 'pending' : 'done';
  hw.doneAt = hw.status==='done' ? Date.now() : null;
  saveAppData();
  renderHomeworkCard();
}
function deleteHomeworkItem(id){
  if(!confirm('Xoá bài tập này?')) return;
  const p = activeProfile();
  p.homework = p.homework.filter(h=>h.id!==id);
  saveAppData();
  renderHomeworkCard();
}

function renderHomeworkCard(){
  const el = document.getElementById('homeworkList');
  if(!el) return;
  const p = activeProfile();
  if(purgeStaleHomework(p)) saveAppData();
  const list = sortedHomework(p);
  const pendingCount = list.filter(h=>h.status!=='done').length;
  const summaryEl = document.getElementById('homeworkSummary');
  if(summaryEl){
    if(list.length===0) summaryEl.textContent = '';
    else if(pendingCount===0) summaryEl.textContent = 'Đã làm xong hết! 🎉';
    else summaryEl.textContent = `${pendingCount} bài chưa làm`;
  }
  if(list.length === 0){
    el.innerHTML = `<div class="empty-state"><span class="big">🎒</span>Chưa có bài tập nào được ghi lại.<br>Bấm "+ Thêm bài tập" để bắt đầu nhé!</div>`;
    return;
  }
  el.innerHTML = list.map(h=>{
    const s = subjectInfo(h.subject);
    const done = h.status === 'done';
    const due = homeworkDueLabel(h.dueDate);
    return `
      <div class="homework-item ${done?'done':''}">
        <div class="checkbox hw-checkbox ${done?'checked':''}" onclick="toggleHomeworkDone('${h.id}')">${done?'✓':''}</div>
        <div class="emoji">${s.emoji}</div>
        <div class="info">
          <div class="t ${done?'strike':''}">${escapeHtml(s.name)} — ${escapeHtml(h.title)}</div>
          ${h.note ? `<div class="hw-note">${escapeHtml(h.note)}</div>` : ''}
          <div class="hw-due ${done?'':due.cls}">${done ? '✅ Đã xong' : due.text}</div>
        </div>
        <button class="icon-btn" onclick="openHomeworkModal('${h.id}')">✏️</button>
        <button class="icon-btn danger" onclick="deleteHomeworkItem('${h.id}')">🗑️</button>
      </div>
    `;
  }).join('');
}

/* ---------- Homework modal ---------- */
let editingHomeworkId = null;
function renderSubjectPicker(containerId, selected, hiddenInputId){
  const el = document.getElementById(containerId);
  el.innerHTML = SUBJECT_CHOICES.map(s=>`<button type="button" class="subject-chip ${s.key===selected?'sel':''}" data-subject="${s.key}">${s.emoji} ${s.name}</button>`).join('');
  el.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      el.querySelectorAll('button').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel');
      document.getElementById(hiddenInputId).value = btn.dataset.subject;
    });
  });
}
function openHomeworkModal(id){
  editingHomeworkId = id || null;
  const p = activeProfile();
  const h = id ? p.homework.find(x=>x.id===id) : { subject: SUBJECT_CHOICES[0].key, title:'', dueDate: todayKey(), note:'' };
  document.getElementById('homeworkModalTitle').textContent = id ? 'Sửa bài tập' : 'Thêm bài tập mới';
  renderSubjectPicker('homeworkSubjectPicker', h.subject, 'homeworkSubjectInput');
  document.getElementById('homeworkSubjectInput').value = h.subject;
  document.getElementById('homeworkTitleInput').value = h.title;
  document.getElementById('homeworkNoteInput').value = h.note || '';
  setOnceDateValue('homeworkDueDateInput', 'homeworkDueDateBtn', h.dueDate || todayKey());
  document.getElementById('homeworkModal').classList.add('open');
}
function closeHomeworkModal(){ document.getElementById('homeworkModal').classList.remove('open'); }
function saveHomeworkModal(){
  const title = document.getElementById('homeworkTitleInput').value.trim();
  if(!title){ alert('Nhập nội dung bài tập nhé!'); return; }
  const subject = document.getElementById('homeworkSubjectInput').value || SUBJECT_CHOICES[0].key;
  const dueDate = document.getElementById('homeworkDueDateInput').value;
  if(!dueDate){ alert('Chọn hạn nộp nhé!'); return; }
  if(dueDate < todayKey()){ alert('Chỉ chọn được ngày hôm nay hoặc sau này thôi nhé!'); return; }
  const note = document.getElementById('homeworkNoteInput').value.trim();

  const p = activeProfile();
  if(editingHomeworkId){
    const h = p.homework.find(x=>x.id===editingHomeworkId);
    h.subject = subject; h.title = title; h.dueDate = dueDate; h.note = note;
  } else {
    p.homework.push({ id: uid('hw'), subject, title, dueDate, note, status:'pending', createdAt: Date.now(), doneAt: null });
  }
  saveAppData();
  closeHomeworkModal();
  renderHomeworkCard();
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

  renderHomeworkCard();
  updateTabBadges();
}

function updateTabBadges(){
  const key = todayKey();

  const { done: taskDone, total: taskTotal } = progressFor(todayDate());
  const todayBadge = document.getElementById('tabBadgeToday');
  if(taskTotal > 0){
    todayBadge.textContent = `${taskDone}/${taskTotal}`;
    todayBadge.style.display = 'inline-block';
  } else {
    todayBadge.style.display = 'none';
  }

  const todoList = todosForDate(todayDate());
  const todoDone = todoList.filter(t=>isTodoDone(key, t.id)).length;
  const todoTotal = todoList.length;
  const todoBadge = document.getElementById('tabBadgeTodo');
  if(todoTotal > 0){
    todoBadge.textContent = `${todoDone}/${todoTotal}`;
    todoBadge.style.display = 'inline-block';
  } else {
    todoBadge.style.display = 'none';
  }

  const p = activeProfile();
  const unusedVouchers = (p.vouchers || []).filter(v=>v.status!=='used').length;
  const voucherBadge = document.getElementById('tabBadgeVoucher');
  if(unusedVouchers > 0){
    voucherBadge.textContent = unusedVouchers;
    voucherBadge.style.display = 'inline-block';
  } else {
    voucherBadge.style.display = 'none';
  }
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ---------- Render: To-do (không bắt buộc) ---------- */
function renderTodoPage(){
  document.getElementById('todoDate').textContent = fmtHuman(todayDate());

  const list = todosForDate(todayDate());
  const key = todayKey();
  const done = list.filter(t=>isTodoDone(key, t.id)).length;
  const total = list.length;
  const pct = total ? Math.round(done/total*100) : 0;
  document.getElementById('todoProgressFill').style.width = pct + '%';
  document.getElementById('todoProgressLabel').textContent = `${done}/${total} việc đã làm`;
  document.getElementById('todoProgressPct').textContent = pct + '%';

  const listEl = document.getElementById('todoList');
  if(list.length === 0){
    listEl.innerHTML = `<div class="empty-state"><span class="big">📝</span>Hôm nay chưa có việc to-do nào.<br>Vào Cài đặt để thêm nhé!</div>`;
  } else {
    listEl.innerHTML = '';
    list.forEach(t=>{
      const d = isTodoDone(key, t.id);
      const row = document.createElement('div');
      row.className = 'task todo-item' + (d ? ' done' : '');
      row.innerHTML = `
        <div class="emoji">${t.emoji}</div>
        <div class="title ${d?'strike':''}">${escapeHtml(t.title)}</div>
        <div class="checkbox todo-checkbox ${d?'checked':''}">${d?'✓':''}</div>
      `;
      row.addEventListener('click', ()=> toggleTodo(t.id));
      listEl.appendChild(row);
    });
  }

  renderTodoBadges(activeProfile(), calcTodoStreak());
  renderTodoMonthCalendar();
  updateTabBadges();
}

function renderTodoMonthCalendar(){
  const today = todayDate();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11
  const todayKey_ = todayKey();

  document.getElementById('todoCalTitle').textContent = `🗓️ Lịch theo dõi tháng ${month + 1}/${year}`;

  const headEl = document.getElementById('todoCalHead');
  headEl.innerHTML = ['T2','T3','T4','T5','T6','T7','CN'].map(l=>`<div>${l}</div>`).join('');

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const wdFirst = weekdayOf(firstOfMonth); // 0=CN..6=T7
  const leadingBlanks = (wdFirst + 6) % 7; // convert to Monday-start offset

  const cells = [];
  for(let i=0; i<leadingBlanks; i++) cells.push(null);
  for(let day=1; day<=daysInMonth; day++) cells.push(new Date(year, month, day));

  const gridEl = document.getElementById('todoCalGrid');
  gridEl.innerHTML = cells.map(d=>{
    if(!d) return `<div class="month-cal-cell empty"></div>`;
    const key = toKey(d);
    const isFuture = d > today && key !== todayKey_;
    const isToday = key === todayKey_;
    const done = !isFuture && isTodoDayComplete(key) === true;
    let cls = 'month-cal-cell' + (isToday ? ' today' : '') + (done ? ' done' : '');
    return `<div class="${cls}" data-key="${key}" title="${pad(d.getDate())}/${pad(month+1)}">${done ? '✅' : d.getDate()}</div>`;
  }).join('');
  gridEl.querySelectorAll('[data-key]').forEach(cell=>{
    cell.addEventListener('click', ()=> openTodoDayDetail(cell.dataset.key));
  });
}

function dateFromKey(key){
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function openTodoDayDetail(key){
  const d = dateFromKey(key);
  const list = todosForDate(d);
  document.getElementById('todoDayDetailTitle').textContent = `📝 ${fmtHuman(d)}`;
  const listEl = document.getElementById('todoDayDetailList');
  if(list.length === 0){
    listEl.innerHTML = `<div class="empty-state" style="padding:12px 0">Ngày này không có to-do nào.</div>`;
  } else {
    listEl.innerHTML = list.map(t=>{
      const done = isTodoDone(key, t.id);
      return `<div class="task todo-item ${done?'done':''}" style="cursor:default">
        <div class="emoji">${t.emoji}</div>
        <div class="title ${done?'strike':''}">${escapeHtml(t.title)}</div>
        <div class="checkbox todo-checkbox ${done?'checked':''}">${done?'✓':''}</div>
      </div>`;
    }).join('');
  }
  document.getElementById('todoDayDetailModal').classList.add('open');
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
  const redeemTotal = Math.abs(hist.filter(h=>h.type==='redeem').reduce((s,h)=>s+h.amount,0));
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
const EMOJI_CHOICES_REWARD = ['🎬','🎡','🧸','🍦','🍕','🎮','🚲','🎪','📱','🏊','🎨','🍭','💵','💰'];

function renderSettings(){
  const p = activeProfile();
  document.getElementById('settingsProfileLabel').textContent = `Đang chỉnh sửa cho: ${p.avatar} ${p.name}`;
  document.getElementById('childNameInput').value = p.name;

  const taskListEl = document.getElementById('settingsTaskList');
  const taskItemHtml = (t) => `
    <div class="list-item">
      <div class="emoji">${t.emoji}</div>
      <div class="info">
        <div class="t">${escapeHtml(t.title)}</div>
        <div class="s">${taskScheduleLabel(t)}</div>
      </div>
      <button class="icon-btn" onclick="openTaskModal('${t.id}')">✏️</button>
      <button class="icon-btn danger" onclick="deleteTask('${t.id}')">🗑️</button>
    </div>
  `;
  const taskTodayK = todayKey();
  const activeTasks = p.tasks.filter(t => !t.onceDate || t.onceDate >= taskTodayK);
  taskListEl.innerHTML = activeTasks.map(taskItemHtml).join('') || `<div class="empty-state">Chưa có việc nào.</div>`;

  const todoListEl = document.getElementById('settingsTodoList');
  const todoItemHtml = (t) => `
    <div class="list-item">
      <div class="emoji">${t.emoji}</div>
      <div class="info">
        <div class="t">${escapeHtml(t.title)}</div>
        <div class="s">${todoScheduleLabel(t)}</div>
      </div>
      <button class="icon-btn" onclick="openTodoModal('${t.id}')">✏️</button>
      <button class="icon-btn danger" onclick="deleteTodoItem('${t.id}')">🗑️</button>
    </div>
  `;
  const todayK = todayKey();
  const activeTodos = p.todos.filter(t => !t.onceDate || t.onceDate >= todayK);
  todoListEl.innerHTML = activeTodos.map(todoItemHtml).join('') || `<div class="empty-state">Chưa có việc to-do nào.</div>`;

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

  const pinBtn = document.getElementById('managePinBtn');
  if(pinBtn){
    pinBtn.textContent = appData.parentPin ? '🔒' : '🔓';
    pinBtn.title = appData.parentPin
      ? 'Đã đặt mã PIN — bấm để đổi'
      : 'Chưa đặt mã PIN — bấm để đặt (nên đặt để chỉ Bố/Mẹ mới tặng/thu hồi/đổi sao được)';
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

/* ---------- Star Manage (Ba/Mẹ): Tặng sao / Thu hồi sao ---------- */
let starManageMode = 'gift'; // 'gift' | 'deduct'
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

function setStarManageMode(mode){
  starManageMode = mode;
  document.querySelectorAll('#starManageTabs .seg-btn').forEach(b=>b.classList.toggle('on', b.dataset.mode===mode));

  const titleEl = document.getElementById('starManageTitle');
  const amtLabel = document.getElementById('starAmountLabel');
  const saveBtn = document.getElementById('starManageSaveBtn');

  if(mode === 'deduct'){
    titleEl.textContent = '⚠️ Thu hồi sao';
    amtLabel.textContent = 'Số sao thu hồi';
    saveBtn.textContent = '⚠️ Thu hồi';
    starReasonList = DEDUCT_REASONS;
  } else {
    titleEl.textContent = '🎁 Tặng sao cho con';
    amtLabel.textContent = 'Số sao tặng';
    saveBtn.textContent = '🎉 Tặng sao';
    starReasonList = GIFT_REASONS;
  }

  starReasonIdx = 0;
  renderStarReasonPicker();
  document.getElementById('starCustomReasonWrap').style.display = 'none';
  document.getElementById('starCustomReasonInput').value = '';
  document.getElementById('starAmountInput').value = 1;
  document.querySelectorAll('#starAmountQuick .day-chip').forEach(c=>c.classList.toggle('on', c.dataset.amt==='1'));
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
  const p = activeProfile();
  const r = p.rewards.find(x=>x.id===rewardId);
  if(!r) return;
  if(p.stars < r.threshold){ alert('Bé chưa đủ sao để đổi phần thưởng này!'); return; }
  if(!confirm(`Xác nhận đổi ${r.threshold} sao lấy phiếu "${r.title}"?`)) return;
  p.stars -= r.threshold;
  addStarHistory(p, { type:'redeem', dateKey: todayKey(), amount: -r.threshold, reason: r.title, emoji: r.emoji });
  p.vouchers = p.vouchers || [];
  p.vouchers.unshift({ id: uid('v'), title: r.title, emoji: r.emoji, cost: r.threshold, status: 'unused', redeemedAt: Date.now(), usedAt: null });
  saveAppData();
  renderChildRedeemList();
  renderAll();
  celebrateRedeem(p, r);
}

/* ---------- Đổi thưởng do BÉ tự bấm (không cần mã PIN) ---------- */
function renderChildRedeemList(){
  const p = activeProfile();
  const starsEl = document.getElementById('childRedeemStars');
  if(starsEl) starsEl.textContent = `${p.stars} ⭐`;
  const el = document.getElementById('childRedeemList');
  if(!el) return;
  const sorted = [...(p.rewards || [])].sort((a,b)=>a.threshold-b.threshold);
  if(sorted.length === 0){
    el.innerHTML = `<div class="empty-state">Chưa có mốc thưởng nào. Nhờ Ba Mẹ vào Cài đặt thêm nhé!</div>`;
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

function openChildRedeemModal(){
  renderChildRedeemList();
  document.getElementById('childRedeemModal').classList.add('open');
}
function closeChildRedeemModal(){
  document.getElementById('childRedeemModal').classList.remove('open');
}

/* ---------- Vouchers (Kho phiếu quà) ---------- */
function fmtVoucherDate(ts){
  if(!ts) return '';
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
}

function markVoucherUsed(voucherId){
  const p = activeProfile();
  const v = (p.vouchers || []).find(x=>x.id===voucherId);
  if(!v || v.status === 'used') return;
  if(!confirm(`Xác nhận ${p.name} đã dùng phiếu "${v.title}"?`)) return;
  v.status = 'used';
  v.usedAt = Date.now();
  saveAppData();
  renderAll();
}

function deleteVoucher(voucherId){
  const p = activeProfile();
  const v = (p.vouchers || []).find(x=>x.id===voucherId);
  if(!v) return;
  if(!confirm(`Xoá phiếu "${v.title}" đã dùng khỏi danh sách?`)) return;
  p.vouchers = p.vouchers.filter(x=>x.id!==voucherId);
  saveAppData();
  renderAll();
}

function refundVoucher(voucherId){
  const p = activeProfile();
  const v = (p.vouchers || []).find(x=>x.id===voucherId);
  if(!v || v.status === 'used') return;
  if(v.cost > 0){
    if(!confirm(`Xoá phiếu "${v.title}" và hoàn lại ${v.cost} sao?`)) return;
    p.stars += v.cost;
    addStarHistory(p, { type:'redeem', dateKey: todayKey(), amount: v.cost, reason: `Hoàn sao (huỷ phiếu ${v.title})`, emoji: '↩️' });
  } else {
    if(!confirm(`Xoá phiếu "${v.title}" khỏi danh sách?`)) return;
  }
  p.vouchers = p.vouchers.filter(x=>x.id!==voucherId);
  saveAppData();
  renderAll();
}
function requestRefundVoucher(voucherId){
  const proceed = () => refundVoucher(voucherId);
  if(!appData.parentPin){ openPinSetupModal(proceed); } else { openPinVerifyModal(proceed); }
}

/* ---------- Tặng phiếu quà trực tiếp (không tốn sao) ---------- */
const EMOJI_CHOICES_VOUCHER = ['🎮','📖','🎬','🍦','🍿','🎨','⚽','🎧','🧩','🍕','🚲','🎪','💵','💰'];
function openGiftVoucherModal(){
  document.getElementById('giftVoucherTitleInput').value = '';
  renderEmojiPicker('giftVoucherEmojiPicker', EMOJI_CHOICES_VOUCHER, EMOJI_CHOICES_VOUCHER[0], 'giftVoucherEmojiInput');
  document.getElementById('giftVoucherEmojiInput').value = EMOJI_CHOICES_VOUCHER[0];
  document.getElementById('giftVoucherModal').classList.add('open');
}
function closeGiftVoucherModal(){
  document.getElementById('giftVoucherModal').classList.remove('open');
}
function saveGiftVoucherModal(){
  const p = activeProfile();
  const title = document.getElementById('giftVoucherTitleInput').value.trim();
  if(!title){ alert('Nhập nội dung phiếu quà nhé!'); return; }
  const emoji = document.getElementById('giftVoucherEmojiInput').value || EMOJI_CHOICES_VOUCHER[0];
  p.vouchers = p.vouchers || [];
  p.vouchers.unshift({ id: uid('v'), title, emoji, cost: 0, status: 'unused', redeemedAt: Date.now(), usedAt: null });
  saveAppData();
  closeGiftVoucherModal();
  renderAll();
  showNotifyModal({ icon: emoji, title: 'Đã tặng phiếu quà!', html: `Phiếu "<b>${escapeHtml(title)}</b>" đã được lưu vào tab 🎫 Phiếu quà của ${p.name}.`, confetti: true });
}

function renderVouchersPage(){
  const p = activeProfile();
  document.getElementById('voucherProfileName').textContent = `Kho phiếu quà tặng của ${p.name} ${p.avatar}`;

  const vouchers = (p.vouchers || []).slice().sort((a,b)=>(b.redeemedAt||0)-(a.redeemedAt||0));
  const unused = vouchers.filter(v=>v.status!=='used');
  const used = vouchers.filter(v=>v.status==='used');

  const unusedEl = document.getElementById('voucherUnusedList');
  if(unused.length === 0){
    unusedEl.innerHTML = `<div class="empty-state"><span class="big">🎫</span>Chưa có phiếu nào đang chờ dùng.<br>Vào nút ⭐ → Đổi thưởng để tạo phiếu nhé!</div>`;
  } else {
    unusedEl.innerHTML = unused.map(v=>`
      <div class="voucher-card unused">
        <div class="voucher-emoji">${v.emoji}</div>
        <div class="voucher-info">
          <div class="voucher-title">${escapeHtml(v.title)}</div>
          <div class="voucher-meta">${v.cost > 0 ? `Đổi ${v.cost} ⭐` : '🎁 Quà tặng từ bố mẹ'} · ${fmtVoucherDate(v.redeemedAt)}</div>
        </div>
        <div class="voucher-actions">
          <button type="button" class="voucher-use-btn" data-use-id="${v.id}">🎉 Dùng</button>
          <button type="button" class="voucher-refund-btn" data-refund-id="${v.id}" title="${v.cost>0 ? 'Hoàn sao, hủy phiếu' : 'Xoá phiếu này'}">${v.cost>0 ? '↩️ Hoàn sao' : '🗑️ Xoá phiếu'}</button>
        </div>
      </div>
    `).join('');
    unusedEl.querySelectorAll('[data-use-id]').forEach(btn=>{
      btn.addEventListener('click', ()=> markVoucherUsed(btn.dataset.useId));
    });
    unusedEl.querySelectorAll('[data-refund-id]').forEach(btn=>{
      btn.addEventListener('click', ()=> requestRefundVoucher(btn.dataset.refundId));
    });
  }

  const usedEl = document.getElementById('voucherUsedList');
  if(used.length === 0){
    usedEl.innerHTML = `<div class="empty-state" style="padding:12px 0">Chưa có phiếu nào đã dùng.</div>`;
  } else {
    usedEl.innerHTML = used.map(v=>`
      <div class="voucher-card used">
        <div class="voucher-emoji">${v.emoji}</div>
        <div class="voucher-info">
          <div class="voucher-title strike">${escapeHtml(v.title)}</div>
          <div class="voucher-meta">Đã dùng ${fmtVoucherDate(v.usedAt)}</div>
        </div>
        <button type="button" class="icon-btn danger" data-delete-id="${v.id}">🗑️</button>
      </div>
    `).join('');
    usedEl.querySelectorAll('[data-delete-id]').forEach(btn=>{
      btn.addEventListener('click', ()=> deleteVoucher(btn.dataset.deleteId));
    });
  }

  updateTabBadges();
}

/* ---------- Date picker (lịch dạng lưới thay cho input ngày native) ----------
   iOS Safari không tự khoá/làm mờ ngày quá khứ trên wheel picker của input
   type=date (chỉ báo lỗi lúc submit) nên bé vẫn kéo chọn được ngày quá khứ.
   Tự vẽ lịch dạng lưới (giống lịch theo dõi ở tab To-do) để disable hẳn được
   từng ô ngày quá khứ, không bấm được luôn — đồng nhất trên mọi thiết bị. */
let datePickerViewYear, datePickerViewMonth;
let datePickerMinKey = null;
let datePickerSelectedKey = null;
let datePickerOnSelect = null;

function openDatePicker(currentKey, minKey, onSelect){
  const base = dateFromKey(currentKey || minKey || todayKey());
  datePickerViewYear = base.getFullYear();
  datePickerViewMonth = base.getMonth();
  datePickerMinKey = minKey || null;
  datePickerSelectedKey = currentKey || null;
  datePickerOnSelect = onSelect;
  renderDatePickerGrid();
  document.getElementById('datePickerModal').classList.add('open');
}
function closeDatePicker(){
  document.getElementById('datePickerModal').classList.remove('open');
  datePickerOnSelect = null;
}
function shiftDatePickerMonth(delta){
  datePickerViewMonth += delta;
  if(datePickerViewMonth < 0){ datePickerViewMonth = 11; datePickerViewYear--; }
  else if(datePickerViewMonth > 11){ datePickerViewMonth = 0; datePickerViewYear++; }
  renderDatePickerGrid();
}
function renderDatePickerGrid(){
  document.getElementById('datePickerTitle').textContent = `Tháng ${datePickerViewMonth + 1}/${datePickerViewYear}`;
  document.getElementById('datePickerHead').innerHTML = ['T2','T3','T4','T5','T6','T7','CN'].map(l=>`<div>${l}</div>`).join('');

  const firstOfMonth = new Date(datePickerViewYear, datePickerViewMonth, 1);
  const daysInMonth = new Date(datePickerViewYear, datePickerViewMonth + 1, 0).getDate();
  const wdFirst = weekdayOf(firstOfMonth);
  const leadingBlanks = (wdFirst + 6) % 7; // convert to Monday-start offset

  const cells = [];
  for(let i=0; i<leadingBlanks; i++) cells.push(null);
  for(let day=1; day<=daysInMonth; day++) cells.push(new Date(datePickerViewYear, datePickerViewMonth, day));

  const gridEl = document.getElementById('datePickerGrid');
  gridEl.innerHTML = cells.map(d=>{
    if(!d) return `<div class="month-cal-cell empty"></div>`;
    const key = toKey(d);
    const disabled = !!(datePickerMinKey && key < datePickerMinKey);
    const isSelected = key === datePickerSelectedKey;
    const cls = 'month-cal-cell' + (disabled ? ' disabled' : '') + (isSelected ? ' selected' : '');
    return `<div class="${cls}" data-key="${key}">${d.getDate()}</div>`;
  }).join('');
  gridEl.querySelectorAll('.month-cal-cell:not(.empty):not(.disabled)').forEach(cell=>{
    cell.addEventListener('click', ()=>{
      const key = cell.dataset.key;
      const cb = datePickerOnSelect;
      closeDatePicker();
      if(cb) cb(key);
    });
  });
}

/* ---------- Task modal ---------- */
let editingTaskId = null;
let taskScheduleType = 'repeat'; // 'repeat' | 'once'

function setTaskScheduleType(type){
  taskScheduleType = type;
  document.querySelectorAll('#taskScheduleTypeTabs .seg-btn').forEach(b=>b.classList.toggle('on', b.dataset.type===type));
  document.getElementById('taskDaysField').style.display = type === 'repeat' ? 'block' : 'none';
  document.getElementById('taskOnceDateField').style.display = type === 'once' ? 'block' : 'none';
}

// Gán giá trị cho cặp (input ẩn giữ dateKey, nút hiển thị ngày đã format) dùng
// chung cho cả modal Việc và To-do "1 lần".
function setOnceDateValue(inputId, btnId, key){
  document.getElementById(inputId).value = key;
  document.getElementById(btnId).textContent = '📅 ' + fmtDateShort(key);
}

function openTaskModal(id){
  editingTaskId = id || null;
  const p = activeProfile();
  const t = id ? p.tasks.find(x=>x.id===id) : { title:'', emoji:EMOJI_CHOICES_TASK[0], days:[0,1,2,3,4,5,6] };
  document.getElementById('taskModalTitle').textContent = id ? 'Sửa việc' : 'Thêm việc mới';
  document.getElementById('taskTitleInput').value = t.title;
  renderEmojiPicker('taskEmojiPicker', EMOJI_CHOICES_TASK, t.emoji, 'taskEmojiInput');
  document.getElementById('taskEmojiInput').value = t.emoji;
  renderDaysPicker(t.days && t.days.length ? t.days : [0,1,2,3,4,5,6]);
  setOnceDateValue('taskOnceDateInput', 'taskOnceDateBtn', t.onceDate || todayKey());
  setTaskScheduleType(t.onceDate ? 'once' : 'repeat');
  document.getElementById('taskModal').classList.add('open');
}
function closeTaskModal(){ document.getElementById('taskModal').classList.remove('open'); }

function renderDaysPicker(selectedDays, containerId){
  const el = document.getElementById(containerId || 'daysRow');
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

  let days = [];
  let onceDate = null;
  if(taskScheduleType === 'once'){
    onceDate = document.getElementById('taskOnceDateInput').value;
    if(!onceDate){ alert('Chọn ngày cho việc này nhé!'); return; }
    if(onceDate < todayKey()){ alert('Chỉ chọn được ngày hôm nay hoặc sau này thôi nhé!'); return; }
  } else {
    days = [...document.querySelectorAll('#daysRow .day-chip.on')].map(c=>parseInt(c.dataset.day,10));
    if(days.length===0){ alert('Chọn ít nhất 1 ngày trong tuần!'); return; }
  }

  const p = activeProfile();
  if(editingTaskId){
    const t = p.tasks.find(x=>x.id===editingTaskId);
    t.title = title; t.emoji = emoji; t.days = days;
    if(onceDate) t.onceDate = onceDate; else delete t.onceDate;
  } else {
    const newTask = { id: uid(), title, emoji, days };
    if(onceDate) newTask.onceDate = onceDate;
    p.tasks.push(newTask);
  }
  saveAppData();
  closeTaskModal();
  renderAll();
}

/* ---------- Todo modal (không bắt buộc) ---------- */
let editingTodoId = null;
let todoScheduleType = 'repeat'; // 'repeat' | 'once'

function setTodoScheduleType(type){
  todoScheduleType = type;
  document.querySelectorAll('#todoScheduleTypeTabs .seg-btn').forEach(b=>b.classList.toggle('on', b.dataset.type===type));
  document.getElementById('todoDaysField').style.display = type === 'repeat' ? 'block' : 'none';
  document.getElementById('todoOnceDateField').style.display = type === 'once' ? 'block' : 'none';
}

function openTodoModal(id){
  editingTodoId = id || null;
  const p = activeProfile();
  const t = id ? p.todos.find(x=>x.id===id) : { title:'', emoji:EMOJI_CHOICES_TASK[0], days:[0,1,2,3,4,5,6] };
  document.getElementById('todoModalTitle').textContent = id ? 'Sửa việc to-do' : 'Thêm việc to-do mới';
  document.getElementById('todoTitleInput').value = t.title;
  renderEmojiPicker('todoEmojiPicker', EMOJI_CHOICES_TASK, t.emoji, 'todoEmojiInput');
  document.getElementById('todoEmojiInput').value = t.emoji;
  renderDaysPicker(t.days && t.days.length ? t.days : [0,1,2,3,4,5,6], 'todoDaysRow');
  setOnceDateValue('todoOnceDateInput', 'todoOnceDateBtn', t.onceDate || todayKey());
  setTodoScheduleType(t.onceDate ? 'once' : 'repeat');
  document.getElementById('todoModal').classList.add('open');
}
function closeTodoModal(){ document.getElementById('todoModal').classList.remove('open'); }
function saveTodoModal(){
  const title = document.getElementById('todoTitleInput').value.trim();
  if(!title){ alert('Nhập tên việc to-do nhé!'); return; }
  const emoji = document.getElementById('todoEmojiInput').value || EMOJI_CHOICES_TASK[0];

  let days = [];
  let onceDate = null;
  if(todoScheduleType === 'once'){
    onceDate = document.getElementById('todoOnceDateInput').value;
    if(!onceDate){ alert('Chọn ngày cho việc này nhé!'); return; }
    if(onceDate < todayKey()){ alert('Chỉ chọn được ngày hôm nay hoặc sau này thôi nhé!'); return; }
  } else {
    days = [...document.querySelectorAll('#todoDaysRow .day-chip.on')].map(c=>parseInt(c.dataset.day,10));
    if(days.length===0){ alert('Chọn ít nhất 1 ngày trong tuần!'); return; }
  }

  const p = activeProfile();
  if(editingTodoId){
    const t = p.todos.find(x=>x.id===editingTodoId);
    t.title = title; t.emoji = emoji; t.days = days;
    if(onceDate) t.onceDate = onceDate; else delete t.onceDate;
  } else {
    const newTodo = { id: uid(), title, emoji, days };
    if(onceDate) newTodo.onceDate = onceDate;
    p.todos.push(newTodo);
  }
  saveAppData();
  closeTodoModal();
  renderAll();
}
function deleteTodoItem(id){
  if(!confirm('Xoá việc to-do này?')) return;
  const p = activeProfile();
  p.todos = p.todos.filter(t=>t.id!==id);
  saveAppData(); renderAll();
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
  document.getElementById('tabbar').style.display = (name==='picker' || name==='datamanage' || name==='history') ? 'none' : 'flex';
  if(name==='today') renderToday();
  if(name==='todo') renderTodoPage();
  if(name==='stats') renderStats();
  if(name==='history') renderHistory();
  if(name==='voucher') renderVouchersPage();
  if(name==='settings') renderSettings();
  if(name==='picker') renderPicker();
  if(name==='datamanage'){ renderSyncSettings(); renderNotifyCard(); }
}

/* ---------- Init ---------- */
function renderAll(){
  renderToday();
  const activePage = document.querySelector('.page.active');
  if(activePage && activePage.id === 'page-todo') renderTodoPage();
  if(activePage && activePage.id === 'page-stats') renderStats();
  if(activePage && activePage.id === 'page-history') renderHistory();
  if(activePage && activePage.id === 'page-voucher') renderVouchersPage();
  if(activePage && activePage.id === 'page-settings') renderSettings();
  if(activePage && activePage.id === 'page-picker') renderPicker();
  if(activePage && activePage.id === 'page-datamanage'){ renderSyncSettings(); renderNotifyCard(); }
}

/* ---------- Đồng bộ nhiều thiết bị qua Firebase (tuỳ chọn) ---------- */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyADHMVXLZiiNt23HKygAZHfbVPE9BmdKHE",
  authDomain: "kid-checklist-14544.firebaseapp.com",
  projectId: "kid-checklist-14544",
  storageBucket: "kid-checklist-14544.firebasestorage.app",
  messagingSenderId: "638904549868",
  appId: "1:638904549868:web:700bb8b98ec82550c7c0c9"
};
const SYNC_CODE_KEY = 'kidChecklistSyncCode_v1';
let fbApp = null, fbDb = null, fbUnsub = null, syncPushTimer = null, syncApplyingRemote = false;

function getSyncCode(){ return localStorage.getItem(SYNC_CODE_KEY) || null; }
function setSyncCode(code){ localStorage.setItem(SYNC_CODE_KEY, code); }
function clearSyncCode(){ localStorage.removeItem(SYNC_CODE_KEY); }

function genSyncCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tránh ký tự dễ nhầm 0/O, 1/I/L
  let s = '';
  for(let i=0;i<10;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function initFirebase(){
  if(fbApp) return true;
  if(typeof firebase === 'undefined') return false;
  try{
    fbApp = firebase.initializeApp(FIREBASE_CONFIG);
    fbDb = firebase.firestore();
    try{ fbDb.enablePersistence({ synchronizeTabs: true }); }catch(e){ /* nhiều tab hoặc trình duyệt không hỗ trợ — bỏ qua */ }
    return true;
  }catch(e){ console.error('Firebase init lỗi', e); return false; }
}

function syncDocRef(){
  const code = getSyncCode();
  if(!code || !fbDb) return null;
  return fbDb.collection('families').doc(code);
}

function pushToCloud(){
  const ref = syncDocRef();
  if(!ref || syncApplyingRemote) return;
  appData.updatedAt = Date.now();
  // merge:true — không được ghi đè cả document, vì document còn chứa notifyTokens/notifySchedule
  // (dữ liệu thông báo) không thuộc về appData và không được phép bị xoá mỗi lần lưu.
  ref.set({ json: JSON.stringify(appData), updatedAt: appData.updatedAt }, { merge: true }).catch(err=>{
    console.error('Đồng bộ lên mây lỗi', err);
  });
}
function schedulePush(){
  clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(pushToCloud, 800);
}

function startSyncListener(){
  const ref = syncDocRef();
  if(!ref) return;
  maybeAutoBackup();
  if(fbUnsub){ fbUnsub(); fbUnsub = null; }
  fbUnsub = ref.onSnapshot(snap=>{
    if(!snap.exists) return;
    const remote = snap.data();
    if(!remote || !remote.json) return;
    if(remote.updatedAt && remote.updatedAt <= (appData.updatedAt || 0)) return;
    try{
      syncApplyingRemote = true;
      appData = JSON.parse(remote.json);
      normalizeAppData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
      renderAll();
    }catch(e){
      console.error('Không đọc được dữ liệu đồng bộ', e);
    }finally{
      syncApplyingRemote = false;
    }
  }, err=>{ console.error('Lỗi lắng nghe đồng bộ', err); });
}

function createSyncCodeFlow(){
  if(!confirm('Tạo mã đồng bộ mới? Toàn bộ dữ liệu hiện tại trên máy này sẽ được tải lên để chia sẻ với các thiết bị khác.')) return;
  if(!initFirebase()){ alert('Không tải được thư viện đồng bộ. Kiểm tra kết nối mạng rồi thử lại nhé.'); return; }
  const code = genSyncCode();
  setSyncCode(code);
  appData.updatedAt = Date.now();
  syncDocRef().set({ json: JSON.stringify(appData), updatedAt: appData.updatedAt })
    .then(()=>{
      startSyncListener();
      renderSyncSettings();
      alert(`Đã tạo mã đồng bộ: ${code}\n\nGhi lại mã này và nhập vào các thiết bị khác (trong Cài đặt → Đồng bộ nhiều thiết bị) để dùng chung dữ liệu nhé!`);
    })
    .catch(err=>{
      clearSyncCode();
      alert('Không tạo được đồng bộ, kiểm tra lại kết nối mạng. Lỗi: ' + err.message);
    });
}

function joinSyncCodeFlow(){
  const codeInput = document.getElementById('syncJoinInput');
  const code = (codeInput.value || '').trim().toUpperCase();
  if(!code){ alert('Nhập mã đồng bộ nhé!'); return; }
  if(!confirm('Kết nối sẽ TẢI dữ liệu từ mã này về và THAY THẾ toàn bộ dữ liệu hiện có trên máy này. Chắc chắn tiếp tục?')) return;
  if(!initFirebase()){ alert('Không tải được thư viện đồng bộ. Kiểm tra kết nối mạng rồi thử lại nhé.'); return; }
  fbDb.collection('families').doc(code).get().then(snap=>{
    if(!snap.exists || !snap.data() || !snap.data().json){
      alert('Không tìm thấy mã đồng bộ này. Kiểm tra lại mã nhé.');
      return;
    }
    try{
      appData = JSON.parse(snap.data().json);
      setSyncCode(code);
      normalizeAppData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
      startSyncListener();
      renderAll();
      renderSyncSettings();
      alert('Kết nối thành công! Dữ liệu đã được đồng bộ.');
    }catch(e){
      alert('Dữ liệu của mã này bị lỗi, không đọc được.');
    }
  }).catch(err=>{
    alert('Không kết nối được, kiểm tra mạng rồi thử lại. Lỗi: ' + err.message);
  });
}

function stopSyncFlow(){
  if(!confirm('Ngừng đồng bộ? Dữ liệu trên máy này vẫn được giữ nguyên, chỉ không còn tự động cập nhật qua các thiết bị khác nữa.')) return;
  if(fbUnsub){ fbUnsub(); fbUnsub = null; }
  clearSyncCode();
  renderSyncSettings();
}

/* ---------- Sao lưu tự động hàng tuần lên Firebase (khi đã bật đồng bộ) ---------- */
function currentWeekKey(){
  return toKey(startOfWeek(todayDate()));
}
function backupDocRef(){
  const code = getSyncCode();
  if(!code || !fbDb) return null;
  return fbDb.collection('backups').doc(code);
}
function fmtDateFull(ts){
  const d = new Date(ts);
  if(isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
}
function maybeAutoBackup(){
  const ref = backupDocRef();
  if(!ref) return;
  const weekKey = currentWeekKey();
  ref.get().then(snap=>{
    const data = snap.exists ? snap.data() : null;
    if(data && data.weekKey === weekKey) return; // tuần này đã sao lưu rồi
    // Ghi đè lên đúng 1 document — bản sao lưu mới thay thế bản cũ, không giữ lịch sử nhiều bản
    return ref.set({ weekKey, json: JSON.stringify(appData), createdAt: Date.now() });
  }).then(()=> renderSyncSettings())
    .catch(err=> console.error('Sao lưu tự động lên mây lỗi', err));
}

function restoreFromBackupFlow(){
  const ref = backupDocRef();
  if(!ref) return;
  ref.get().then(snap=>{
    if(!snap.exists || !snap.data() || !snap.data().json){
      alert('Chưa có bản sao lưu tự động nào trên mây.');
      return;
    }
    const data = snap.data();
    if(!confirm(`Khôi phục bản sao lưu ngày ${fmtDateFull(data.createdAt)}? Dữ liệu hiện tại trên máy này sẽ bị THAY THẾ.`)) return;
    try{
      appData = JSON.parse(data.json);
      normalizeAppData();
      saveAppData();
      renderAll();
      renderSyncSettings();
      alert('Đã khôi phục xong!');
    }catch(e){
      alert('Bản sao lưu bị lỗi, không đọc được.');
    }
  }).catch(err=>{
    alert('Không kết nối được, kiểm tra mạng rồi thử lại. Lỗi: ' + err.message);
  });
}
function requestRestoreFromBackup(){
  if(!appData.parentPin){ openPinSetupModal(restoreFromBackupFlow); } else { openPinVerifyModal(restoreFromBackupFlow); }
}

function renderSyncSettings(){
  const areaEl = document.getElementById('syncSetupArea');
  const statusEl = document.getElementById('syncStatusText');
  if(!areaEl || !statusEl) return;
  const code = getSyncCode();
  if(!code){
    statusEl.textContent = '⚪ Chưa bật đồng bộ — dữ liệu chỉ đang lưu trên máy này.';
    areaEl.innerHTML = `
      <button class="add-btn" id="syncCreateBtn" style="margin-bottom:14px">🆕 Tạo mã đồng bộ (thiết bị đầu tiên)</button>
      <div style="text-align:center;color:var(--muted);font-size:12px;margin:2px 0 10px">hoặc</div>
      <div class="field">
        <label>Nhập mã đồng bộ từ thiết bị khác</label>
        <input type="text" id="syncJoinInput" placeholder="VD: A1B2C3D4E5" style="text-transform:uppercase">
      </div>
      <button class="add-btn" id="syncJoinBtn">🔗 Kết nối</button>
    `;
    document.getElementById('syncCreateBtn').addEventListener('click', createSyncCodeFlow);
    document.getElementById('syncJoinBtn').addEventListener('click', ()=>{
      if(!appData.parentPin){ openPinSetupModal(joinSyncCodeFlow); } else { openPinVerifyModal(joinSyncCodeFlow); }
    });
  } else {
    statusEl.textContent = '🟢 Đã bật đồng bộ nhiều thiết bị.';
    areaEl.innerHTML = `
      <div class="field">
        <label>Mã đồng bộ của gia đình bạn (nhập mã này trên thiết bị khác)</label>
        <input type="text" id="syncCodeDisplay" value="${code}" readonly style="font-weight:800;letter-spacing:2px;text-align:center">
      </div>
      <button class="btn-secondary" id="syncCopyBtn" style="width:100%;margin-bottom:10px">📋 Sao chép mã</button>
      <div class="modal-hint" id="syncBackupStatus" style="margin-top:0">📦 Sao lưu tự động hàng tuần: đang kiểm tra…</div>
      <button class="btn-secondary" id="syncRestoreBtn" style="width:100%;margin-bottom:10px">🗄️ Khôi phục bản sao lưu tự động</button>
      <button class="btn-danger-outline" id="syncStopBtn" style="width:100%">🔌 Ngừng đồng bộ trên máy này</button>
    `;
    document.getElementById('syncCopyBtn').addEventListener('click', ()=>{
      const input = document.getElementById('syncCodeDisplay');
      input.select();
      if(navigator.clipboard) navigator.clipboard.writeText(code).catch(()=>{});
      alert('Đã sao chép mã: ' + code);
    });
    document.getElementById('syncRestoreBtn').addEventListener('click', requestRestoreFromBackup);
    document.getElementById('syncStopBtn').addEventListener('click', stopSyncFlow);

    const ref = backupDocRef();
    if(ref){
      ref.get().then(snap=>{
        const el = document.getElementById('syncBackupStatus');
        if(!el) return;
        if(snap.exists && snap.data() && snap.data().createdAt){
          el.textContent = `📦 Sao lưu tự động gần nhất: ${fmtDateFull(snap.data().createdAt)} (tuần trước sẽ tự bị thay khi có bản mới)`;
        } else {
          el.textContent = '📦 Chưa có bản sao lưu tự động nào (sẽ tạo trong lần mở app đầu tuần tới).';
        }
      }).catch(()=>{
        const el = document.getElementById('syncBackupStatus');
        if(el) el.textContent = '📦 Không kiểm tra được trạng thái sao lưu (kiểm tra mạng).';
      });
    }
  }
}

/* ---------- Thông báo nhắc nhở (đẩy qua Firebase Cloud Messaging) ----------
   Cần bật Đồng bộ nhiều thiết bị trước (dùng chung mã gia đình để biết gửi cho ai).
   Server gửi thông báo là 1 GitHub Actions chạy theo lịch, xem .github/workflows/send-reminders.yml */
const NOTIFY_VAPID_KEY = "BGT_c2_UxBqrlKiEd51rPv88WNck8-mE4bTxMFk7Tt46tu2y3A2rETHUtzqSQA84Ct0HDNfH_K_qCr8xwxtjDbQ";
const NOTIFY_ENABLED_KEY = 'kidChecklistNotifyEnabled_v1';
const NOTIFY_TOKEN_KEY = 'kidChecklistNotifyToken_v1';

function notifyEnabledLocally(){ return localStorage.getItem(NOTIFY_ENABLED_KEY) === '1'; }

function renderNotifyCard(){
  const statusEl = document.getElementById('notifyStatusText');
  const btnEl = document.getElementById('notifyEnableBtn');
  if(!statusEl || !btnEl) return;
  btnEl.style.width = '100%';
  if(!getSyncCode()){
    statusEl.textContent = '⚪ Cần bật "Đồng bộ nhiều thiết bị" ở trên trước nhé.';
    btnEl.disabled = true;
    btnEl.style.opacity = '0.5';
    btnEl.className = 'add-btn';
    btnEl.textContent = '🔔 Bật thông báo trên máy này';
    return;
  }
  btnEl.disabled = false;
  btnEl.style.opacity = '1';
  const perm = ('Notification' in window) ? Notification.permission : 'denied';
  const enabled = perm === 'granted' && notifyEnabledLocally();
  if(perm === 'denied' && notifyEnabledLocally()){
    statusEl.textContent = '🔴 Thông báo đang bị chặn — vào Cài đặt của máy (mục Thông báo cho app này) để bật lại.';
  } else if(enabled){
    statusEl.textContent = '🟢 Đã bật thông báo trên máy này.';
  } else {
    statusEl.textContent = '⚪ Chưa bật thông báo trên máy này.';
  }
  btnEl.className = enabled ? 'btn-danger-outline' : 'add-btn';
  btnEl.textContent = enabled ? '🔕 Tắt thông báo trên máy này' : '🔔 Bật thông báo trên máy này';
}

function toggleNotificationsFlow(){
  if(notifyEnabledLocally()) disableNotificationsFlow();
  else enableNotificationsFlow();
}

async function disableNotificationsFlow(){
  if(!confirm('Tắt thông báo nhắc nhở trên máy này?')) return;
  try{
    const token = localStorage.getItem(NOTIFY_TOKEN_KEY);
    const ref = syncDocRef();
    if(ref && token && typeof firebase !== 'undefined' && firebase.firestore){
      await ref.set({ notifyTokens: firebase.firestore.FieldValue.arrayRemove(token) }, { merge: true }).catch(()=>{});
    }
    // Cố huỷ đăng ký ở tầng trình duyệt luôn — không bắt buộc phải thành công.
    try{
      if(initFirebase() && typeof firebase.messaging === 'function'){
        await firebase.messaging().deleteToken().catch(()=>{});
      }
    }catch(e){ /* bỏ qua */ }
    localStorage.removeItem(NOTIFY_ENABLED_KEY);
    localStorage.removeItem(NOTIFY_TOKEN_KEY);
    renderNotifyCard();
    alert('Đã tắt thông báo trên máy này.');
  }catch(err){
    console.error('Tắt thông báo lỗi', err);
    alert('Không tắt được, kiểm tra mạng rồi thử lại. Lỗi: ' + (err && err.message ? err.message : err));
  }
}

function withTimeout(promise, ms, label){
  return Promise.race([
    promise,
    new Promise((_, reject)=> setTimeout(()=> reject(new Error(`Quá thời gian chờ (${label})`)), ms))
  ]);
}

async function enableNotificationsFlow(){
  try{
    if(!getSyncCode()){ alert('Cần bật "Đồng bộ nhiều thiết bị" trước khi bật thông báo nhé.'); return; }
    if(!('Notification' in window) || !('serviceWorker' in navigator)){
      alert('Máy/trình duyệt này không hỗ trợ thông báo đẩy.');
      return;
    }
    if(!initFirebase() || typeof firebase.messaging !== 'function'){
      alert('Không tải được thư viện thông báo. Kiểm tra kết nối mạng rồi thử lại nhé.');
      return;
    }

    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){
      alert('Bạn chưa cho phép gửi thông báo, nên app sẽ không nhắc được nhé. Có thể bật lại trong Cài đặt của máy.');
      renderNotifyCard();
      return;
    }

    const reg = await withTimeout(navigator.serviceWorker.ready, 8000, 'chờ service worker sẵn sàng');

    let messaging;
    try{
      messaging = firebase.messaging();
    }catch(e){
      alert('Thiết bị này chưa hỗ trợ thông báo đẩy qua Firebase. Lỗi: ' + (e && e.message ? e.message : e));
      return;
    }

    const token = await withTimeout(
      messaging.getToken({ vapidKey: NOTIFY_VAPID_KEY, serviceWorkerRegistration: reg }),
      15000, 'lấy mã thiết bị'
    );
    if(!token){ alert('Không lấy được mã thiết bị, thử lại nhé.'); return; }

    const ref = syncDocRef();
    if(!ref){ alert('Chưa bật đồng bộ.'); return; }

    await withTimeout(
      ref.set({ notifyTokens: firebase.firestore.FieldValue.arrayUnion(token) }, { merge: true }),
      10000, 'lưu lên máy chủ'
    );

    localStorage.setItem(NOTIFY_ENABLED_KEY, '1');
    localStorage.setItem(NOTIFY_TOKEN_KEY, token);
    renderNotifyCard();
    alert('Đã bật thông báo nhắc nhở trên máy này! 🔔');
  }catch(err){
    console.error('Bật thông báo lỗi', err);
    alert('Không bật được thông báo. Lỗi: ' + (err && (err.code || err.message) ? (err.code || err.message) : err));
  }
}

if(getSyncCode() && initFirebase()){
  startSyncListener();
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderToday();

  document.querySelectorAll('.tabbar button').forEach(b=>{
    b.addEventListener('click', ()=> switchTab(b.dataset.tab));
  });

  document.getElementById('switchAvatarToday').addEventListener('click', ()=> switchTab('picker'));
  document.getElementById('backFromPicker').addEventListener('click', ()=> switchTab('today'));
  document.getElementById('openDataManageBtn').addEventListener('click', ()=> switchTab('datamanage'));
  document.getElementById('backFromDataManage').addEventListener('click', ()=> switchTab('settings'));
  document.getElementById('statsStars').addEventListener('click', ()=> switchTab('history'));
  document.getElementById('backFromHistory').addEventListener('click', ()=> switchTab('stats'));
  document.getElementById('notifyEnableBtn').addEventListener('click', toggleNotificationsFlow);

  document.getElementById('childNameInput').addEventListener('change', (e)=>{
    activeProfile().name = e.target.value.trim() || 'Bé';
    saveAppData();
  });

  document.getElementById('datePickerPrevBtn').addEventListener('click', ()=> shiftDatePickerMonth(-1));
  document.getElementById('datePickerNextBtn').addEventListener('click', ()=> shiftDatePickerMonth(1));
  document.getElementById('datePickerCancelBtn').addEventListener('click', closeDatePicker);
  document.getElementById('taskOnceDateBtn').addEventListener('click', ()=>{
    openDatePicker(document.getElementById('taskOnceDateInput').value, todayKey(), (key)=>{
      setOnceDateValue('taskOnceDateInput', 'taskOnceDateBtn', key);
    });
  });
  document.getElementById('todoOnceDateBtn').addEventListener('click', ()=>{
    openDatePicker(document.getElementById('todoOnceDateInput').value, todayKey(), (key)=>{
      setOnceDateValue('todoOnceDateInput', 'todoOnceDateBtn', key);
    });
  });
  document.getElementById('homeworkDueDateBtn').addEventListener('click', ()=>{
    openDatePicker(document.getElementById('homeworkDueDateInput').value, todayKey(), (key)=>{
      setOnceDateValue('homeworkDueDateInput', 'homeworkDueDateBtn', key);
    });
  });

  document.getElementById('addTaskBtn').addEventListener('click', ()=>openTaskModal(null));
  document.getElementById('addTodoBtn').addEventListener('click', ()=>openTodoModal(null));
  document.getElementById('addHomeworkBtn').addEventListener('click', ()=>openHomeworkModal(null));
  document.getElementById('homeworkCancelBtn').addEventListener('click', closeHomeworkModal);
  document.getElementById('homeworkSaveBtn').addEventListener('click', saveHomeworkModal);
  document.getElementById('todoCancelBtn').addEventListener('click', closeTodoModal);
  document.getElementById('todoSaveBtn').addEventListener('click', saveTodoModal);
  document.querySelectorAll('#todoScheduleTypeTabs .seg-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> setTodoScheduleType(btn.dataset.type));
  });
  document.getElementById('addRewardBtn').addEventListener('click', ()=>openRewardModal(null));
  document.getElementById('taskCancelBtn').addEventListener('click', closeTaskModal);
  document.getElementById('taskSaveBtn').addEventListener('click', saveTaskModal);
  document.querySelectorAll('#taskScheduleTypeTabs .seg-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> setTaskScheduleType(btn.dataset.type));
  });
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
  document.getElementById('starsBadge').addEventListener('click', openChildRedeemModal);
  document.getElementById('childRedeemCloseBtn').addEventListener('click', closeChildRedeemModal);
  document.getElementById('giftVoucherBtn').addEventListener('click', ()=>{
    if(!appData.parentPin){
      openPinSetupModal(()=> openGiftVoucherModal());
    } else {
      openPinVerifyModal(()=> openGiftVoucherModal());
    }
  });
  document.getElementById('giftVoucherCancelBtn').addEventListener('click', closeGiftVoucherModal);
  document.getElementById('giftVoucherSaveBtn').addEventListener('click', saveGiftVoucherModal);

  document.getElementById('todoDayDetailCloseBtn').addEventListener('click', ()=>{
    document.getElementById('todoDayDetailModal').classList.remove('open');
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
