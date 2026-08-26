# Kid Checklist — Checklist Của Con

## Mục đích

PWA (Progressive Web App) giúp quản lý checklist việc cần làm hàng ngày cho con,
có hệ thống sao thưởng, đổi phiếu quà, to-do không bắt buộc kèm chuỗi ngày (streak)
+ huy hiệu, và đồng bộ dữ liệu giữa nhiều thiết bị trong gia đình qua Firebase.
Giao diện 100% tiếng Việt, tối ưu cho điện thoại (đặc biệt dùng nhiều trên iPhone,
cài vào Home Screen như app native).

## Tech stack

- **Vanilla JS thuần** — không framework (React/Vue...), không build tool, không
  bundler. Một file `app.js` duy nhất chứa toàn bộ logic.
- **HTML/CSS thuần** — 1 file `index.html` chứa toàn bộ UI (nhiều "page" ẩn/hiện
  bằng class `.active`) + tất cả modal (overlay `.sheet`).
- **Firebase (CDN, SDK compat v10.14.1)**:
  - `firebase-firestore-compat.js` — đồng bộ dữ liệu nhiều thiết bị (collection
    `families/{syncCode}`) + auto backup hàng tuần (collection `backups/{syncCode}`).
  - `firebase-messaging-compat.js` — push notification (FCM) nhắc nhở khi bé
    chưa hoàn thành checklist.
  - Config Firebase client (`FIREBASE_CONFIG`) nhúng thẳng trong `app.js` và
    `sw.js` — đây là config public phía client, không phải secret.
- **Service Worker** (`sw.js`) — cache offline + nhận push notification khi app
  đã đóng.
- **GitHub Actions** — cron job gửi push notification 2 khung giờ/ngày (chiều
  15h-17h, tối 19h-20h giờ VN), chạy script Node dùng `firebase-admin` (cần
  secret `FIREBASE_SERVICE_ACCOUNT`, không có trong repo).
- **Hosting**: khả năng deploy qua GitHub Pages (dự trên cấu trúc file tĩnh +
  service worker dùng đường dẫn tương đối `./`).

## Cấu trúc thư mục chính

```
index.html                     Toàn bộ UI: các "page" chính trong tabbar (today/
                                todo/voucher/stats/settings) + page phụ không nằm
                                trong tabbar, mở qua nút riêng (history — bấm vào
                                nút sao #statsStars ở đầu trang stats; datamanage —
                                mở từ nút ở trang settings) + picker + tất cả modal
app.js                         Toàn bộ logic JS (~2000 dòng, 1 file, không module)
style.css                      Style, dùng CSS variables (--pink, --green...) +
                                dark mode qua @media (prefers-color-scheme: dark)
sw.js                          Service worker — nhớ bump CACHE_NAME mỗi khi sửa
                                core files (xem mục Quy ước bên dưới)
manifest.json                  PWA manifest (tên app, icon, theme color...)
icons/                         Icon app (icon-192, icon-512, apple-touch-icon)

.github/workflows/
  send-reminders.yml           Cron: gọi .github/scripts/send-reminders.js
.github/scripts/
  send-reminders.js            Script Node — quét families/{code} có notifyTokens,
                                kiểm tra checklist + bài tập về nhà chưa xong, gửi FCM
  package.json                 Dependency: firebase-admin
```

## Quy ước code

- **Ngôn ngữ**: toàn bộ text UI, comment trong code, commit message đều bằng
  **tiếng Việt** — giữ nguyên convention này khi thêm code mới.
- **Không có build step**: sửa trực tiếp `app.js`/`index.html`/`style.css` là
  xong, không cần compile/transpile gì cả.
- **⚠️ Bump cache mỗi khi sửa core file**: mỗi lần sửa `index.html`, `app.js`,
  hoặc `style.css`, PHẢI tăng số `CACHE_NAME` trong `sw.js` (ví dụ
  `'kid-checklist-v46'` → `'kid-checklist-v47'`). Service worker dùng chiến
  lược network-first + `cache:'no-store'` cho core file để né HTTP cache của
  Safari/iOS, nhưng vẫn cần bump version để trigger `activate` event xoá cache
  cũ — nếu quên, máy test (đặc biệt iPhone mở từ Home Screen) dễ bị kẹt bản cũ.
- **Data model**: lưu ở `localStorage` key `kidChecklistData_v2`
  (`STORAGE_KEY`), có migrate từ schema cũ `kidChecklistData_v1`. Mọi field
  mới thêm vào object `profile` phải được khởi tạo an toàn trong
  `normalizeAppData()` để tương thích ngược với data cũ đã lưu trên máy user.
- **State toàn cục**: biến `appData` (object global) là single source of
  truth, gọi `saveAppData()` sau mỗi thay đổi để lưu localStorage + đẩy sync
  lên Firebase (nếu đã bật). Gọi `renderAll()` hoặc hàm render riêng của từng
  page sau khi đổi state.
- **UI pattern**: modal dùng class `.overlay` + `.overlay.open` để hiện/ẩn,
  không dùng `<dialog>` native. Emoji picker, day-picker (Thứ trong tuần), và
  lịch chọn ngày (`month-cal-grid`) đều là component tái dùng nhiều chỗ
  (settings task/todo, todo streak calendar, date picker cho lịch "1 lần").
- **Tránh input native khi cần custom validation**: KHÔNG dùng
  `<input type="date">` — iOS Safari có bug không tự khoá ngày quá khứ trên
  wheel picker theo `min`. App đã có sẵn component lịch dạng lưới custom
  (`openDatePicker()` trong `app.js`) để disable hẳn được từng ô ngày, dùng
  lại pattern này nếu cần thêm chỗ chọn ngày khác trong tương lai.

## Lệnh thường dùng

- **Chạy thử app**: mở trực tiếp `index.html` bằng trình duyệt, HOẶC (khuyến
  nghị hơn để test đúng service worker/fetch) chạy local server rồi mở qua
  `http://localhost:<port>`:
  ```bash
  cd kid-checklist
  python -m http.server 8080
  # rồi mở http://localhost:8080/index.html
  ```
  Mở trực tiếp qua `file://` có thể khiến 1 số tool preview không load đúng
  CSS/JS (não đã gặp trong phiên làm việc trước).
- **Script gửi thông báo** (test thủ công, không phải chạy hàng ngày — do
  GitHub Actions cron lo):
  ```bash
  cd .github/scripts
  npm install
  node send-reminders.js
  ```
  Cần biến môi trường `FIREBASE_SERVICE_ACCOUNT` (JSON service account) để
  chạy được — bình thường chỉ GitHub Actions mới có secret này.
- **Không có bước build/deploy đặc biệt** — deploy = push code lên nhánh mà
  hosting (GitHub Pages) đang theo dõi.

## Ghi chú môi trường đa máy

- Máy hiện tại: **Windows** (path dạng `C:\Users\User\Downloads\Claude\kid-checklist`).
- `python` mặc định trên Windows này là alias Microsoft Store (không chạy
  được nếu chưa cài Python thật). Python thật nằm ở:
  `C:\Users\User\AppData\Local\Programs\Python\Python314\python.exe` — cần
  gọi full path này nếu alias `python`/`python3` báo "not found".
- Repo git remote: `https://github.com/khanhtd211/kid-checklist-app.git`.
- Chưa phát hiện khác biệt về đường dẫn/line-ending gây lỗi thật sự giữa các
  máy, nhưng Git có cảnh báo tự động convert LF↔CRLF khi commit trên Windows —
  không phải vấn đề, chỉ là log bình thường của Git.
