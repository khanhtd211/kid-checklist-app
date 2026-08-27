// Gửi thông báo nhắc nhở checklist + bài tập về nhà qua Firebase Cloud Messaging.
// Được chạy bởi GitHub Actions theo lịch — xem .github/workflows/send-reminders.yml
//
// Mỗi gia đình (mã đồng bộ) có 1 document trong collection "families" trên Firestore,
// chứa: json (toàn bộ dữ liệu app), notifyTokens (danh sách thiết bị đã bật thông báo),
// notifySchedule (giờ ngẫu nhiên đã chọn cho hôm nay + đã gửi chưa, dùng chung cho cả
// nhắc checklist và nhắc bài tập).
//
// Nhắc bài tập về nhà: báo cho các bài CHƯA làm xong, còn 2 ngày / 1 ngày / ngay hôm nay
// là hạn nộp. Ngày thường chỉ báo vào khung "evening" (buổi tối) cho bé dễ theo dõi;
// thứ 7/chủ nhật báo ở bất kỳ khung nào trong 3 khung (khung nào tới trước trong ngày thì
// gửi), tối đa 1 lần/ngày — không lặp lại ở các khung sau cùng ngày.
const admin = require('firebase-admin');

const WINDOW = process.env.NOTIFY_WINDOW; // 'weekend_morning' | 'afternoon' | 'evening'
const FORCE = process.env.FORCE_SEND === 'true'; // chỉ dùng khi test thủ công (workflow_dispatch)

if (WINDOW !== 'weekend_morning' && WINDOW !== 'afternoon' && WINDOW !== 'evening') {
  console.error('Thiếu hoặc sai biến NOTIFY_WINDOW (weekend_morning | afternoon | evening)');
  process.exit(1);
}

const WINDOWS = {
  // Chỉ thực sự được kích hoạt vào thứ 7/CN — do cron trong send-reminders.yml chỉ chạy
  // window này 2 ngày đó. Không cần tự kiểm tra thứ ở đây vì đã được lọc từ tầng cron.
  weekend_morning: { startMin: 10 * 60, endMin: 11 * 60 },
  afternoon: { startMin: 15 * 60, endMin: 17 * 60 },
  evening: { startMin: 19 * 60, endMin: 20 * 60 },
};

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min));
}

// Giờ/ngày hiện tại theo múi giờ Việt Nam, không phụ thuộc múi giờ máy chủ chạy job.
function vnParts() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    y: +parts.year, mo: +parts.month, d: +parts.day,
    minuteOfDay: (+parts.hour) * 60 + (+parts.minute),
  };
}

// 0 Chủ nhật .. 6 Thứ 7 — giống weekdayOf() trong app.js
function weekdayOf(y, mo, d) {
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

// Số ngày từ dateKeyA đến dateKeyB (B - A), cả 2 dạng 'YYYY-MM-DD'.
function daysBetween(dateKeyA, dateKeyB) {
  const [ay, am, ad] = dateKeyA.split('-').map(Number);
  const [by, bm, bd] = dateKeyB.split('-').map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86400000);
}

// Giữ đồng bộ nội dung với SUBJECT_CHOICES trong app.js (không có module chung để import).
const SUBJECT_MAP = {
  toan: { name: 'Toán', emoji: '🧮' },
  tviet: { name: 'Tiếng Việt', emoji: '📖' },
  tanh: { name: 'Tiếng Anh', emoji: '🔤' },
  khoahoc: { name: 'Khoa học', emoji: '🔬' },
  vatly: { name: 'Vật lý', emoji: '⚛️' },
  hoahoc: { name: 'Hoá học', emoji: '🧪' },
  sinhhoc: { name: 'Sinh học', emoji: '🧬' },
  mythuat: { name: 'Mỹ thuật', emoji: '🎨' },
  amnhac: { name: 'Âm nhạc', emoji: '🎵' },
  tinhoc: { name: 'Tin học', emoji: '💻' },
  hocthem: { name: 'Học thêm', emoji: '🏫' },
  khac: { name: 'Khác', emoji: '📚' },
};

// Với mỗi bé: lấy các bài tập CHƯA làm xong, hạn nộp còn 0/1/2 ngày nữa (đã tự loại bài
// quá hạn — dueDate < hôm nay — phòng trường hợp máy bé lâu chưa mở app để dọn lại).
function getHomeworkAlerts(appData, dateKey) {
  const profiles = appData.profiles || [];
  return profiles
    .map(p => {
      const items = (p.homework || [])
        .filter(h => h.status !== 'done' && h.dueDate >= dateKey)
        .map(h => Object.assign({}, h, { daysLeft: daysBetween(dateKey, h.dueDate) }))
        .filter(h => h.daysLeft === 0 || h.daysLeft === 1 || h.daysLeft === 2)
        .sort((a, b) => a.daysLeft - b.daysLeft);
      return { name: p.name || 'Bé', items };
    })
    .filter(p => p.items.length > 0);
}

function homeworkItemLabel(h) {
  const s = SUBJECT_MAP[h.subject] || { name: 'Bài tập', emoji: '📚' };
  const when = h.daysLeft === 0 ? 'hạn hôm nay' : h.daysLeft === 1 ? 'hạn ngày mai' : 'còn 2 ngày nữa tới hạn';
  return `${s.emoji} ${s.name} (${when})`;
}

function buildHomeworkBody(alerts) {
  if (alerts.length === 1) {
    return `📖 ${alerts[0].name} có bài tập cần làm: ${alerts[0].items.map(homeworkItemLabel).join(', ')}`;
  }
  return alerts.map(a => `📖 ${a.name}: ${a.items.map(homeworkItemLabel).join(', ')}`).join('\n');
}

// Tính trạng thái checklist hôm nay của từng bé: đã xong hết chưa, còn thiếu bao nhiêu việc.
function getProfileStatuses(appData, dateKey, wd) {
  const profiles = appData.profiles || [];
  return profiles.map(p => {
    const tasks = (p.tasks || []).filter(t => t.onceDate ? t.onceDate === dateKey : (t.days || []).includes(wd));
    const log = (p.logs && p.logs[dateKey]) || {};
    const doneCount = tasks.filter(t => !!log[t.id]).length;
    const missing = tasks.length - doneCount;
    return { name: p.name || 'Bé', done: missing <= 0, missing };
  });
}

// Khi TẤT CẢ bé đã xong hết: gộp chung 1 dòng liệt kê tên (nếu nhiều bé), thay vì mỗi bé 1 dòng.
function buildAllDoneBody(statuses) {
  if (statuses.length > 1) {
    const names = statuses.map(s => s.name).join(', ');
    return `${names} đã xong hết việc, giỏi quá! 🎉`;
  }
  return '🎉 Xong hết việc rồi, giỏi quá!';
}

// Khi CHƯA phải tất cả đã xong: nhóm các bé đã xong thành 1 dòng khen, các bé còn
// thiếu việc gộp chung 1 dòng nhắc (mỗi bé kèm số việc còn thiếu, chỉ nói "làm nốt
// nhé!" một lần ở cuối) — tránh lặp câu nhắc nhiều lần khi nhà đông bé.
function buildMixedBody(statuses) {
  if (statuses.length === 1) {
    const s = statuses[0];
    return s.done
      ? '🎉 Xong hết việc rồi, giỏi quá!'
      : `⏰ Còn ${s.missing} việc chưa xong, làm nốt nhé!`;
  }
  const lines = [];
  const doneNames = statuses.filter(s => s.done).map(s => s.name);
  const notDone = statuses.filter(s => !s.done);
  if (doneNames.length) lines.push(`🎉 ${doneNames.join(', ')} xong hết rồi!`);
  if (notDone.length) {
    const parts = notDone.map(s => `${s.name} còn ${s.missing} việc`).join(', ');
    lines.push(`⏰ ${parts}, làm nốt nhé!`);
  }
  return lines.join('\n');
}

async function run() {
  const { dateKey, minuteOfDay, y, mo, d } = vnParts();
  const wd = weekdayOf(y, mo, d);
  const win = WINDOWS[WINDOW];

  const isWeekend = (wd === 0 || wd === 6);
  // Ngày thường: bài tập chỉ báo vào khung tối. Cuối tuần: báo được ở cả 3 khung
  // (khung nào tới trước trong ngày thì gửi, xem schedule.homeworkSent bên dưới).
  const homeworkWindowAllowed = isWeekend || WINDOW === 'evening';

  const snap = await db.collection('families').get();
  let sentCount = 0, skippedAllDone = 0, tooEarly = 0, alreadySent = 0, homeworkSentCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const tokens = Array.isArray(data.notifyTokens) ? data.notifyTokens : [];
    if (!tokens.length) continue;

    let schedule = data.notifySchedule;
    if (!schedule || schedule.dateKey !== dateKey) {
      schedule = { dateKey };
    }
    // Khởi tạo riêng từng slot nếu thiếu (thay vì tạo cả 3 cùng lúc) — tránh lỗi
    // "slot undefined" cho gia đình có notifySchedule hôm nay được tạo trước khi
    // thêm khung mới này, và giúp thêm khung sau này không cần sửa lại đoạn tạo mới.
    if (!schedule[WINDOW]) {
      schedule[WINDOW] = { targetMinute: randInt(win.startMin, win.endMin), sent: false };
    }
    const slot = schedule[WINDOW];

    if (slot.sent && !FORCE && (schedule.homeworkSent || !homeworkWindowAllowed)) { alreadySent++; continue; }
    if (!FORCE && minuteOfDay < slot.targetMinute) {
      tooEarly++;
      // Lưu lại ngay để giờ ngẫu nhiên hôm nay không bị đổi lại ở lần kiểm tra sau.
      await doc.ref.set({ notifySchedule: schedule }, { merge: true });
      continue;
    }

    let appData = null;
    try { appData = data.json ? JSON.parse(data.json) : null; } catch (e) { appData = null; }
    if (!appData) { continue; }

    // ----- Phần checklist (giữ nguyên hành vi cũ) -----
    let checklistBody = null;
    if (slot.sent && !FORCE) {
      // Đã gửi phần checklist ở khung này rồi — chỉ còn xét phần bài tập bên dưới.
    } else {
      const statuses = getProfileStatuses(appData, dateKey, wd);
      const allDone = statuses.length > 0 && statuses.every(s => s.done);
      // Nếu tất cả bé đã xong hết: chỉ khen 1 lần duy nhất vào buổi TỐI, sáng cuối tuần và
      // buổi chiều bỏ qua (tránh khen 2-3 lần/ngày khi bé xong việc sớm).
      if (allDone && (WINDOW === 'weekend_morning' || WINDOW === 'afternoon')) {
        skippedAllDone++;
        slot.sent = true;
      } else {
        checklistBody = allDone ? buildAllDoneBody(statuses) : buildMixedBody(statuses);
      }
    }

    // ----- Phần bài tập về nhà -----
    let homeworkBody = null;
    if (homeworkWindowAllowed && (FORCE || !schedule.homeworkSent)) {
      const alerts = getHomeworkAlerts(appData, dateKey);
      if (alerts.length) homeworkBody = buildHomeworkBody(alerts);
    }

    const bodyParts = [checklistBody, homeworkBody].filter(Boolean);
    if (!bodyParts.length) {
      await doc.ref.set({ notifySchedule: schedule }, { merge: true });
      continue;
    }
    const body = bodyParts.join('\n\n');

    try {
      const resp = await admin.messaging().sendEachForMulticast({
        tokens,
        // Có title thật (không để rỗng): nếu để title:'' hoặc bỏ hẳn field, Android/
        // Chrome coi đây là thông báo web "ẩn danh" và tự chèn thêm dòng phụ kiểu
        // "Checklist / from Checklist" (lấy theo short_name trong manifest.json) để
        // chống giả mạo — không tắt được dòng này bằng cách nào khác ngoài việc tự
        // cung cấp title thật. Dùng đúng tên app (name trong manifest.json) để nếu
        // trình duyệt có tự thêm nhãn nguồn gửi ở đâu đó thì cũng khớp, không lặp/lạ.
        notification: { title: 'Checklist Của Con', body },
      });
      const badTokens = [];
      resp.responses.forEach((r, i) => {
        const code = r.error && r.error.code;
        if (!r.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token')) {
          badTokens.push(tokens[i]);
        }
      });
      const cleanTokens = badTokens.length ? tokens.filter(t => !badTokens.includes(t)) : tokens;
      if (checklistBody) slot.sent = true;
      if (homeworkBody) { schedule.homeworkSent = true; homeworkSentCount++; }
      await doc.ref.set({ notifySchedule: schedule, notifyTokens: cleanTokens }, { merge: true });
      sentCount++;
    } catch (e) {
      console.error('Gửi lỗi cho family', doc.id, e.message);
    }
  }

  console.log(`[${WINDOW}${FORCE ? ' (FORCE test)' : ''}] Đã gửi: ${sentCount} (bài tập: ${homeworkSentCount}), bỏ qua (chiều đã xong hết): ${skippedAllDone}, chưa tới giờ: ${tooEarly}, đã gửi từ trước: ${alreadySent}`);
}

run().catch(e => { console.error(e); process.exit(1); });
