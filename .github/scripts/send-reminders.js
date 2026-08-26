// Gửi thông báo nhắc nhở checklist qua Firebase Cloud Messaging.
// Được chạy bởi GitHub Actions theo lịch — xem .github/workflows/send-reminders.yml
//
// Mỗi gia đình (mã đồng bộ) có 1 document trong collection "families" trên Firestore,
// chứa: json (toàn bộ dữ liệu app), notifyTokens (danh sách thiết bị đã bật thông báo),
// notifySchedule (giờ ngẫu nhiên đã chọn cho hôm nay + đã gửi chưa).
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

  const snap = await db.collection('families').get();
  let sentCount = 0, skippedAllDone = 0, tooEarly = 0, alreadySent = 0;

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

    if (slot.sent && !FORCE) { alreadySent++; continue; }
    if (!FORCE && minuteOfDay < slot.targetMinute) {
      tooEarly++;
      // Lưu lại ngay để giờ ngẫu nhiên hôm nay không bị đổi lại ở lần kiểm tra sau.
      await doc.ref.set({ notifySchedule: schedule }, { merge: true });
      continue;
    }

    let appData = null;
    try { appData = data.json ? JSON.parse(data.json) : null; } catch (e) { appData = null; }
    if (!appData) { continue; }

    const statuses = getProfileStatuses(appData, dateKey, wd);
    const allDone = statuses.length > 0 && statuses.every(s => s.done);

    // Nếu tất cả bé đã xong hết: chỉ khen 1 lần duy nhất vào buổi TỐI, sáng cuối tuần và
    // buổi chiều bỏ qua (tránh khen 2-3 lần/ngày khi bé xong việc sớm).
    if (allDone && (WINDOW === 'weekend_morning' || WINDOW === 'afternoon')) {
      skippedAllDone++;
      slot.sent = true;
      await doc.ref.set({ notifySchedule: schedule }, { merge: true });
      continue;
    }

    const body = allDone ? buildAllDoneBody(statuses) : buildMixedBody(statuses);
    if (!body) { continue; }

    try {
      const resp = await admin.messaging().sendEachForMulticast({
        tokens,
        // title để chuỗi rỗng thay vì bỏ hẳn key: nếu thiếu hẳn field title, một số trình
        // duyệt (qua firebase-messaging-compat ở sw.js) gọi showNotification(undefined,...)
        // và hiển thị chữ "undefined" làm tiêu đề — chuỗi rỗng mới thực sự ẩn được tiêu đề.
        notification: { title: '', body },
      });
      const badTokens = [];
      resp.responses.forEach((r, i) => {
        const code = r.error && r.error.code;
        if (!r.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token')) {
          badTokens.push(tokens[i]);
        }
      });
      const cleanTokens = badTokens.length ? tokens.filter(t => !badTokens.includes(t)) : tokens;
      slot.sent = true;
      await doc.ref.set({ notifySchedule: schedule, notifyTokens: cleanTokens }, { merge: true });
      sentCount++;
    } catch (e) {
      console.error('Gửi lỗi cho family', doc.id, e.message);
    }
  }

  console.log(`[${WINDOW}${FORCE ? ' (FORCE test)' : ''}] Đã gửi: ${sentCount}, bỏ qua (chiều đã xong hết): ${skippedAllDone}, chưa tới giờ: ${tooEarly}, đã gửi từ trước: ${alreadySent}`);
}

run().catch(e => { console.error(e); process.exit(1); });
