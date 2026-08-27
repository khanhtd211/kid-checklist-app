# Tiến độ dự án — Kid Checklist

> Nhật ký cập nhật theo phiên làm việc, mới nhất lên đầu. Chạy `/update-progress`
> (skill `init-context`) cuối mỗi phiên có tiến triển để giữ file này luôn mới.

## Đã hoàn thành

_(tính đến 27/08/2026)_

- **[27/08/2026]** Đổi hẳn icon app (`icons/icon-192.png`, `icons/icon-512.png`,
  `icons/apple-touch-icon.png`) sang thiết kế mới do **user tự tạo** (không
  phải AI của Claude vẽ — sau vài vòng thử vẽ icon "cây" bằng SVG tay không ra
  hình đẹp, đã thống nhất để user tự làm bằng công cụ khác rồi gửi file).
  Icon mới: cây cách điệu với 2 nhánh tạo hình dáng người lớn ôm trẻ nhỏ (âm
  bản/negative space), lá trắng-vàng-hồng, nền gradient cam-hồng — thể hiện
  đúng tinh thần "đồng hành cùng con" thay vì chỉ "checklist công cụ". User
  copy file gốc `icons/icon-kid-app.png` (1254×1254) vào thư mục `icons/`.
  File gốc có viền trắng thừa quanh hình (~45-55px mỗi cạnh trên tổng
  1254px) — dò bounding box vùng nội dung thật bằng 1 helper C# nhúng qua
  `Add-Type` (quét pixel non-white nhanh hơn nhiều so với loop PowerShell
  thuần), crop vuông theo đúng vùng đó rồi mới resize ra 3 kích thước cần
  bằng .NET `System.Drawing` (`HighQualityBicubic`) — máy không có
  Pillow/ImageMagick cài sẵn nên phải tự viết bằng .NET có sẵn trên Windows.
  Đổi `purpose` trong `manifest.json` từ `"any maskable"` → `"any"` vì ảnh đã
  tự bo góc riêng, không phù hợp để hệ điều hành cắt viền thêm lần nữa
  (maskable icon cần nội dung tràn viền, không có padding sẵn). Xoá
  `icons/icon.svg` (nguồn thiết kế icon CŨ, không dùng nữa, không ai tham
  chiếu tới). Đã verify: fetch cả 3 file trả 200, `manifest.json` parse hợp
  lệ, xem lại bản 192px sau khi crop — hình chiếm trọn khung, không còn viền
  trắng thừa xung quanh.
- **[26/08/2026]** Fix push notification hiện thêm dòng thừa **"Checklist /
  from Checklist"** trên điện thoại thật (user báo cáo, kèm ảnh chụp thực
  tế). Nguyên nhân: `notification.title` gửi lên đang để chuỗi rỗng `''`
  (quyết định trước đó — xem "Quyết định kỹ thuật" cũ) khiến Android/Chrome
  coi là thông báo web "ẩn danh", tự chèn tên app lấy từ `short_name` trong
  `manifest.json` ("Checklist") kèm dòng "from Checklist" để chống giả mạo —
  không tắt được bằng cách nào khác ngoài cấp title thật. Đổi
  `title: ''` → `title: 'Checklist Của Con'` (đúng field `name` trong
  manifest) trong `send-reminders.js`. **Chưa verify được trên thiết bị thật**
  (không có Node/Firebase credentials ở máy làm việc) — cũng chưa chắc chắn
  100% dòng phụ này biến mất hoàn toàn hay chỉ đổi nội dung (Android có thể
  vẫn gắn 1 dòng tên app rất nhỏ cho MỌI thông báo web, không phân biệt có
  title hay không — đó là hành vi chuẩn OS, không sửa được). Cần user xác
  nhận lại sau khi nhận thông báo thật lần tới.
- **[26/08/2026]** 3 chỉnh sửa nhỏ cho tab Bài tập theo phản hồi user:
  (1) bỏ icon 📊 khỏi tiêu đề "Thống kê tháng này" (chỉ còn text, đỡ rối mắt);
  (2) badge trên icon tab đổi sang dạng `X/Y` (đã xong/tổng số bài) giống
  tab Hôm nay/To-do, thay vì chỉ hiện số bài chưa làm như trước;
  (3) **fix bug**: badge tab không tự cập nhật khi tick/sửa/xoá bài tập ngay
  tại trang Bài tập (phải chuyển tab qua lại mới thấy đúng số) — do
  `updateTabBadges()` trước đó chỉ được gọi từ `renderToday()`, chưa gọi từ
  `renderHomeworkPage()`. Đã thêm gọi trực tiếp trong `renderHomeworkPage()`
  để mọi đường re-render (tick/thêm/sửa/xoá/chuyển tab) đều tự đồng bộ badge.
  User báo thêm "Đã hoàn thành/Quá hạn đang tính sai — đếm số ngày thay vì số
  bài" nhưng **đã test kỹ bằng browser với dữ liệu mô phỏng thực tế (bài quá
  hạn 1/5 ngày, đã/chưa làm, tương lai...) và không tái hiện được** — code
  vốn đã đếm đúng `.length` (số lượng), không có phép tính ngày nào ở 2 ô
  thống kê này. Nghi ngờ user đang thấy bug badge ở mục (3) rồi hiểu nhầm
  thành lỗi thống kê, hoặc điện thoại đang kẹt bản cache cũ (service worker) —
  đã báo lại user xác nhận sau khi cập nhật bản mới, xem "Việc tồn đọng".
- **[26/08/2026]** Card **"⚠️ Quá hạn"** + **thống kê tháng này** trong tab
  Bài tập. Đổi mốc dọn dữ liệu từ **theo NGÀY → theo THÁNG** (đây là thay đổi
  ngược lại 1 phần quyết định trước đó — xem "Quyết định kỹ thuật"): bài quá
  hạn (chưa tick xong) giờ KHÔNG bị xoá ngay hôm sau nữa, mà giữ lại tới hết
  tháng để hiện ở card riêng (vẫn tick/sửa/xoá được bình thường) + tính vào
  thống kê "✅ Đã hoàn thành" / "⚠️ Quá hạn" trong tháng (`monthKeyOf()`, dùng
  chung layout `.history-summary` có sẵn từ trang Lịch sử). Bài đã tick xong
  dù quá hạn vẫn được giữ tới hết tháng (chỉ để tính thống kê, không hiện
  ở đâu cả — tự động biến mất khỏi mọi danh sách hiển thị). Sang tháng mới,
  toàn bộ bài tháng cũ (đã làm hay chưa) mới thật sự bị dọn — vẫn giữ tinh
  thần "không track dữ liệu vô thời hạn", chỉ nới từ 1 ngày lên 1 tháng.
  Push notification (`send-reminders.js`) **không đổi gì** — vẫn chỉ báo bài
  còn 0-2 ngày tới hạn, không nhắc bài đã quá hạn (giữ nguyên theo yêu cầu
  trước đó). Đã verify đầy đủ bằng browser test thật: bài tháng trước bị dọn
  đúng lúc reload, bài quá hạn (cả đã/chưa làm) được giữ lại đúng, card + số
  liệu thống kê cập nhật đúng khi tick/bỏ tick.
- **[26/08/2026]** Đổi danh sách môn học (`SUBJECT_CHOICES` trong `app.js`, +
  `SUBJECT_MAP` trong `send-reminders.js` — 2 nơi phải giữ đồng bộ, xem
  comment tại chỗ khai báo): bỏ **Đạo đức**, **Thể dục** (ít dùng theo user);
  thêm **Vật lý ⚛️**, **Hoá học 🧪**, **Sinh học 🧬**, **Học thêm 🏫**. Bài
  tập cũ đã lưu với key môn đã bỏ tự fallback về "Khác 📚" (cơ chế fallback
  có sẵn từ trước, không cần migrate thêm). Đã verify modal hiển thị đúng 12
  môn mới bằng browser test thật.
- **[26/08/2026]** Liên kết checklist chính ↔ Bài tập về nhà: chọn icon
  **🎒 (`HOMEWORK_LINK_EMOJI`)** cho 1 việc bất kỳ trong checklist chính (VD
  "Ghi BTVN", "Điền bài tập"... — tên gì cũng được) sẽ khiến việc đó tự động
  được tick khi bé **thêm mới** (không tính sửa) 1 bài tập ở tab Bài tập
  (`autoTickHomeworkLinkedTasks()`), tính sao bình thường nếu đó là việc cuối
  cùng còn thiếu trong ngày. Chỉ tick thêm, không tự bỏ tick lại nếu bé xoá
  bớt bài đã ghi (giữ tinh thần tự giác). **Bản đầu dùng 1 ô tick riêng
  trong modal Thêm/Sửa việc** (`task.linkHomeworkLog`) — user cho rằng thêm
  hẳn 1 dòng UI cho tính năng ít người cần là bất hợp lý, nên đổi sang dùng
  thẳng icon 🎒 (đã có sẵn trong bộ chọn) làm "công tắc": chọn icon đó mới
  hiện dòng giải thích (`.modal-hint` ẩn/hiện theo icon đang chọn), không
  thêm field/UI mới nào cho các việc khác. Mục đích: khích lệ bé DÙNG APP để
  note bài (không phải thưởng cho việc LÀM bài tập — user nhấn mạnh làm bài
  là nghĩa vụ, không nên gắn sao). Bấm CHỌN icon 🎒 (không phải chỉ mở modal
  sửa 1 việc đã sẵn icon này) còn tự điền tên việc chuẩn `"Ghi danh sách bài
  tập về nhà"` (`HOMEWORK_LINK_TASK_TITLE`) cho đồng bộ giữa các gia đình —
  chỉ điền lúc chủ động bấm chọn, không đụng tên đã đặt khi chỉ mở xem/sửa.
  Đã verify đầy đủ bằng browser test thật cả 2 bản thiết kế + bản điền tên tự
  động: hint ẩn/hiện đúng theo icon, tên tự điền đúng lúc bấm chọn và KHÔNG bị
  ghi đè khi chỉ mở sửa, tick đúng lúc, tính sao đúng lúc (chỉ khi là việc
  cuối), sửa bài tập không kích hoạt, badge tab Hôm nay cập nhật ngay dù đang
  đứng ở tab khác.
- **[26/08/2026]** Xác nhận lại: việc bỏ khung "🎯 Còn X sao nữa để nhận..."
  ở trang Hôm nay và đổi icon 📚→🎒 (nhắc ở mục "Việc tồn đọng" trước đây) —
  **đều là chủ đích của user**, có yêu cầu tường minh trong phiên làm việc
  này ("bỏ luôn card...", "icon quyển sách... nhàm mắt"). Không cần khôi phục.
- **[26/08/2026]** Tách **"🎒 Bài tập về nhà"** ra tab riêng trên tabbar
  (trước đó là 1 card trong trang Hôm nay) — tận dụng đúng chỗ trống tabbar
  vừa gộp Lịch sử vào Thống kê để lại (vẫn 6 nút). Đặt ngay sau tab "Hôm nay".
  Trang mới có topbar riêng (ngày + badge tổng quan dạng pill màu tím "X bài
  chưa làm" / "Đã xong hết! 🎉", tự ẩn khi danh sách rỗng), cộng thêm số đếm
  bài chưa làm trên icon tab (giống cách tab Phiếu quà đang đếm phiếu chưa
  dùng). Đổi tên hàm `renderHomeworkCard()` → `renderHomeworkPage()` cho đúng
  quy ước đặt tên (`renderTodoPage`, `renderStats`...). Logic CRUD/tự xoá qua
  ngày mới giữ nguyên 100%, phần nhắc push notification cho bài tập **không
  đổi gì** (theo yêu cầu user). Đã verify bằng browser test thật: render
  trang, đếm badge, chuyển trạng thái xong/chưa xong.
- **[26/08/2026]** Gộp tab **Lịch sử** vào tab **Thống kê**: bỏ hẳn khỏi
  tabbar dưới (giảm 6 tab còn 5), chuyển trang Lịch sử thành trang phụ —
  tái dùng đúng pattern điều hướng "trang phụ có nút ← quay lại" mà trang
  Quản lý dữ liệu đã dùng (không phát sinh cơ chế mới). Lý do: tab Lịch sử ít
  dùng, ý nghĩa gần trùng Thống kê. **Cách mở đã đổi 2 lần trong cùng ngày:**
  bản đầu dùng 1 nút 📜 riêng ở đầu trang Thống kê → sau đó user yêu cầu gộp
  luôn vào nút sao ⭐ sẵn có (không tách 2 nút) — bản cuối cùng: bấm thẳng vào
  `#statsStars` (đã có sẵn style `.stars-badge` dạng nút bấm) để mở, không
  còn nút 📜 riêng nữa. Đã verify cả 2 bản bằng browser test thật.
- **[26/08/2026]** Kèm theo commit ở trên: 1 phần sửa dở **có sẵn trong
  working tree từ đầu phiên** (không phải do phiên này tạo ra, nghi là của 1
  phiên Claude Code khác chạy song song/máy khác, chưa commit) — bỏ khung
  "🎯 Còn X sao nữa để nhận..." ở trang Hôm nay, đổi emoji card bài tập về
  nhà 📚→🎒. Đã hỏi user xác nhận nhưng chưa nhận được câu trả lời rõ ràng
  trước khi user chạy `/init-context` tiếp — **commit chung theo yêu cầu
  auto-push đã thiết lập**, xem "Việc tồn đọng" bên dưới để theo dõi lại.
- **[26/08/2026]** Tính năng mới **"📚 Bài tập về nhà"**: card ngay trên trang
  Hôm nay (không tách tab riêng), mỗi bài gồm môn học (chọn từ 10 môn dạng
  chip), nội dung, hạn nộp (custom date-picker, chỉ chọn được từ hôm nay trở
  đi), ghi chú, trạng thái chưa làm/đã xong. CRUD đầy đủ (`app.js`:
  `openHomeworkModal`/`saveHomeworkModal`/`toggleHomeworkDone`/
  `deleteHomeworkItem`). **Tự động xoá khỏi hệ thống khi sang ngày mới** (dù
  đã làm hay chưa) — không track lịch sử nhiều ngày, xem "Quyết định kỹ thuật"
  bên dưới. Đã verify CRUD + cơ chế tự xoá bằng browser test thật (seed data
  hạn "hôm qua" → reload → tự biến mất).
- **[26/08/2026]** Xoá hẳn `_notify_update/send-reminders.js` (bản sao trùng
  của `.github/scripts/send-reminders.js`, không được workflow nào dùng tới,
  không rõ mục đích) — sau khi thêm logic nhắc bài tập vào bản chính, 2 file
  lệch nhau 112 dòng, dễ gây nhầm lẫn nếu ai đó sửa nhầm file. User xác nhận
  xoá.
- **[26/08/2026]** Push notification cho bài tập về nhà (`send-reminders.js`):
  báo bài **chưa làm xong**, còn 2 ngày/1 ngày/đúng hôm nay là hạn nộp. Ngày
  thường chỉ báo khung tối (19h-20h); T7/CN báo được ở bất kỳ khung nào trong
  3 khung sẵn có, tối đa 1 lần/ngày. Gộp chung vào 1 push với nhắc checklist
  (nếu cùng lúc có cả 2) thay vì gửi 2 thông báo riêng. Tái dùng nguyên hạ
  tầng cron 3 khung giờ đã có, không cần thêm workflow/cron mới.
- **[26/08/2026]** Fix bug huy hiệu to-do (🌱 3 ngày...) mở khoá SAI/sớm hơn
  thực tế: `calcTodoStreak()` trước đây tính lại "ngày X đã xong hết to-do
  chưa" từ danh sách to-do **hiện tại** mỗi lần gọi, nên sửa/xoá 1 to-do sẽ
  làm các ngày cũ bị tính lại hồi tố sai. Đã thêm `todoCompleteDays` để chốt
  cứng kết quả từng ngày ngay khi có tương tác (giống cách `starDays` chốt
  cho checklist chính) — verify bằng test thật trong browser (xem "Quyết định
  kỹ thuật" bên dưới).
- **[26/08/2026]** Thêm khung thông báo thứ 3: **sáng thứ 7/CN 10h-11h giờ
  VN** (`weekend_morning`), bên cạnh chiều/tối đã có — cron riêng chỉ chạy 2
  ngày cuối tuần (`.github/workflows/send-reminders.yml`), bỏ qua nếu bé đã
  xong hết trước 10h (giống buổi chiều, tránh khen 3 lần/ngày).
- **[26/08/2026]** Tối ưu nội dung thông báo đẩy (`send-reminders.js`): bỏ
  hẳn tiêu đề thông báo, rút gọn câu chữ (bỏ "hôm nay" thừa, bỏ lặp tên bé),
  và khi nhiều bé cùng chưa xong thì gộp chung 1 dòng nhắc thay vì mỗi bé 1
  dòng riêng (chỉ nói "làm nốt nhé!" một lần ở cuối).
- Checklist hàng ngày theo lịch (lặp lại theo thứ trong tuần, hoặc "1 lần" theo
  ngày cụ thể) + hệ thống sao thưởng khi hoàn thành hết việc trong ngày.
- Mốc thưởng theo số sao → đổi thành phiếu quà, quản lý ở tab riêng (dùng/hoàn
  sao huỷ phiếu).
- Multi-profile: nhiều bé dùng chung 1 app, chọn hồ sơ ở màn hình picker.
- To-do không bắt buộc (không tính sao) — có chuỗi ngày (streak) liên tục +
  huy hiệu mở khoá theo mốc (3/7/14/30/60/100 ngày), lịch theo dõi dạng lưới
  theo tháng.
- Quản lý sao (Bố/Mẹ): tặng/thu hồi sao có lý do, bảo vệ bằng mã PIN; lịch sử
  đầy đủ mọi thay đổi sao (tự hoàn thành / được tặng / bị thu hồi / đổi
  thưởng).
- Đồng bộ dữ liệu nhiều thiết bị qua Firebase Firestore bằng "mã gia đình"
  (family sync code), kèm auto backup lên mây hàng tuần + khôi phục thủ công.
- Push notification (FCM) nhắc nhở buổi chiều/tối nếu bé chưa xong checklist,
  gửi bởi cron job GitHub Actions (`.github/workflows/send-reminders.yml`).
- Export/Import dữ liệu ra file JSON (sao lưu thủ công).
- Service worker: cache offline + chiến lược network-first cho core file để
  tránh app bị kẹt ở bản code cũ trên Safari/iOS.
- **[26/08/2026]** Thay `<input type="date">` native bằng custom date-picker
  dạng lưới (lịch tháng, điều hướng qua lại) cho 2 chỗ chọn ngày "1 lần" (việc
  + to-do) — disable hẳn được ngày quá khứ (không bấm chọn được), khắc phục
  triệt để bug iOS Safari không tự khoá ngày quá khứ trên wheel picker.

## Đang làm dở

_(không có việc dở dang tại thời điểm ghi — phiên gần nhất đã hoàn tất và
verify bằng browser test thật, chưa nhận phản hồi test trên iPhone thật từ
user)_

## Quyết định kỹ thuật quan trọng

- **[26/08/2026] Bài tập về nhà KHÔNG track nhiều ngày — tự xoá khi sang ngày
  mới.** ⚠️ **Đã bị NỚI RỘNG thành "theo tháng" ở bản cập nhật sau cùng ngày**
  (xem entry "⚠️ Quá hạn + thống kê tháng" ở mục "Đã hoàn thành") vì user cần
  hiện bài quá hạn + thống kê tháng, cả 2 đều cần giữ dữ liệu qua nhiều ngày.
  Filter đổi từ `dueDate >= todayKey()` sang `monthKeyOf(dueDate) >=
  monthKeyOf(todayKey())`. Giữ lại đoạn dưới đây để biết lý do ban đầu (mỗi
  bài chỉ liên quan 1 khoảng thời gian ngắn, không cần lịch sử/streak như
  to-do) — lý do đó vẫn đúng tinh thần, chỉ đổi đơn vị thời gian áp dụng.
  ~~Implement bằng filter `dueDate >= todayKey()` ở 2 lớp: `normalizeAppData()`
  (dọn lúc app khởi động — trường hợp chính) + phòng hờ trong
  `renderHomeworkCard()` (trường hợp app mở xuyên nửa đêm không tải lại
  trang).~~ Do đó hạn nộp cũng bị giới hạn chỉ chọn được từ hôm nay trở đi
  (giống pattern task/todo "1 lần"), để tránh vừa thêm bài hạn quá khứ đã bị
  tự xoá ngay — **điểm này KHÔNG đổi**, vẫn giữ nguyên dù mốc dọn đã nới ra.
- **[26/08/2026] Nhắc bài tập tái dùng 3 khung cron sẵn có, không thêm cron
  mới.** Lý do: đơn giản hoá — thay vì thêm 1 lịch cron riêng cho "12h trước
  hạn", chỉ cần thêm điều kiện `homeworkWindowAllowed` (ngày thường = chỉ khung
  `evening`; cuối tuần = cả 3 khung) và cờ `schedule.homeworkSent` (reset theo
  `dateKey`, y hệt cách `notifySchedule` cũ hoạt động) để đảm bảo tối đa 1
  push/ngày cho phần bài tập, dù khung nào bắt được cơ hội gửi trước. Phần
  checklist cũ giữ nguyên hành vi 100%, không bị ảnh hưởng.
- **[26/08/2026] Chốt lịch sử hoàn thành to-do (`todoCompleteDays`) thay vì
  tính lại từ lịch hiện tại.** Lý do: `todosForDate()` luôn đọc danh sách
  to-do **hiện tại** (`p.todos`) để suy ra "ngày X có những to-do nào" — kể cả
  cho ngày trong QUÁ KHỨ. Nếu phụ huynh xoá 1 to-do mà bé từng bỏ sót, các
  ngày cũ bỗng "trông như" đã xong hết theo lịch mới, dù thực tế lúc đó chưa
  xong → streak nhảy vọt, mở khoá huy hiệu sai. Giải pháp: mỗi lần bé tick
  to-do hôm nay, chốt luôn kết quả `true/false` của NGÀY ĐÓ vào
  `todoCompleteDays[dateKey]` — một khi ngày đó trôi qua, giá trị này không
  còn bị ghi đè nữa (đông cứng vĩnh viễn), nên sửa/xoá to-do sau này không
  ảnh hưởng ngày cũ. Ngày chưa từng tương tác (dữ liệu cũ trước bản fix này)
  fallback về cách tính cũ để tương thích ngược.
- **[26/08/2026] Notification: để `title: ''` thay vì bỏ hẳn field.** Lý do:
  thử bỏ hẳn key `title` khỏi payload FCM thì `firebase-messaging-compat` ở
  `sw.js` có thể gọi `showNotification(undefined, ...)`, khiến 1 số trình
  duyệt hiện chữ **"undefined"** làm tiêu đề — chuỗi rỗng mới thực sự ẩn được
  tiêu đề mà không lộ lỗi hiển thị.
- **[26/08/2026] Bỏ hẳn `<input type="date">` native, tự vẽ lịch custom.**
  Lý do: iOS Safari có bug đã biết — wheel picker của input ngày không tự
  làm mờ/khoá ngày trước thuộc tính `min`, chỉ báo lỗi lúc submit form. Vì app
  không dùng `<form>` để tận dụng validation đó, nên hướng snap-back-sau-khi-
  chọn (thử trước) vẫn cho phép chọn được ngày quá khứ trong UI, trải nghiệm
  không tốt. Custom picker tái dùng lại style `.month-cal-*` sẵn có từ lịch
  theo dõi to-do để đồng bộ giao diện, không phát sinh thư viện ngoài.
- **[trước đó] Service worker network-first + `cache:'no-store'` cho core
  file.** Lý do: dù đã network-first, Safari/iOS vẫn có thể trả về bản JS/HTML
  cũ từ HTTP cache của trình duyệt (đặc biệt khi mở app từ Home Screen) nếu
  không ép `cache:'no-store'` ở tầng `fetch()`.

## Việc tồn đọng / Next steps

- **Cần user xác nhận trên điện thoại thật** xem push notification đã hết
  dòng thừa "Checklist / from Checklist" chưa sau khi đổi title (xem mục
  "Đã hoàn thành") — chưa verify được vì máy làm việc không chạy Node/gửi
  FCM thật được.
- **Cần user xác nhận lại sau khi cập nhật** xem "Đã hoàn thành/Quá hạn tính
  sai (đếm ngày thay vì bài)" đã hết chưa — không tái hiện được bug này qua
  test browser, nghi là do bug badge tab (đã fix) hoặc cache cũ trên điện
  thoại. Nếu vẫn còn sai sau khi mở lại app, cần user chụp màn hình cụ thể để
  soi tiếp (không thể đoán thêm nếu không thấy đúng số đang hiển thị sai).
- **Thống kê tháng của Bài tập về nhà chỉ xem được THÁNG HIỆN TẠI** — do dữ
  liệu bị dọn khi qua tháng mới (xem "Quyết định kỹ thuật"), nên qua đầu
  tháng sau sẽ KHÔNG xem lại được số liệu tháng trước (không có kho lưu trữ
  nhiều tháng). Nếu sau này user muốn xem lịch sử nhiều tháng, cần đổi sang
  lưu counter tổng hợp riêng theo tháng (giống cách `todoCompleteDays` chốt
  cứng kết quả từng ngày cho to-do) thay vì giữ nguyên item — việc lớn hơn,
  chưa làm vì user chỉ yêu cầu "biết trong tháng" (đọc là tháng đang chạy).
- **Cần chạy thử push bài tập về nhà bằng `workflow_dispatch`** (chọn
  `window: evening`, `force_send: true`) sau khi deploy — máy làm việc hiện
  tại không có Node cài sẵn nên chỉ rà cú pháp/logic `send-reminders.js` bằng
  mắt, chưa chạy thật được (kể cả `node --check`). Ưu tiên test trước khi tin
  tưởng hoàn toàn vào phần nhắc bài tập mới.
- **Cần user test thật trên iPhone** phần custom date-picker (từ phiên trước) —
  đã verify bằng browser giả lập, chưa có xác nhận trên thiết bị thật.
- **Cần theo dõi thực tế khung thông báo mới** (`weekend_morning` 10h-11h thứ
  7/CN) sau khi deploy — GitHub Actions cron cần đủ 1 chu kỳ (hoặc test thủ
  công qua `workflow_dispatch` chọn `weekend_morning` + `force_send`) để chắc
  chắn gửi đúng giờ, đúng ngày, và text rút gọn hiển thị đúng trên điện thoại
  thật (mới verify bằng cách chạy hàm dựng text trong browser, chưa nhận
  notification thật).
- Chưa có `README.md` mô tả cách setup Firebase project mới / deploy từ đầu
  cho người khác join dự án (hiện tại chỉ có comment rải rác trong code).
- Luôn nhớ bump `CACHE_NAME` trong `sw.js` mỗi khi sửa `index.html`/`app.js`/
  `style.css` — xem quy ước trong `CLAUDE.md`.
