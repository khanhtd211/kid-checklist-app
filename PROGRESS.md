# Tiến độ dự án — Kid Checklist

> Nhật ký cập nhật theo phiên làm việc, mới nhất lên đầu. Chạy `/update-progress`
> (skill `init-context`) cuối mỗi phiên có tiến triển để giữ file này luôn mới.

## Đã hoàn thành

_(tính đến 26/08/2026)_

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

- **Cần user test thật trên iPhone** phần custom date-picker (từ phiên trước) —
  đã verify bằng browser giả lập, chưa có xác nhận trên thiết bị thật.
- **Cần theo dõi thực tế khung thông báo mới** (`weekend_morning` 10h-11h thứ
  7/CN) sau khi deploy — GitHub Actions cron cần đủ 1 chu kỳ (hoặc test thủ
  công qua `workflow_dispatch` chọn `weekend_morning` + `force_send`) để chắc
  chắn gửi đúng giờ, đúng ngày, và text rút gọn hiển thị đúng trên điện thoại
  thật (mới verify bằng cách chạy hàm dựng text trong browser, chưa nhận
  notification thật).
- File `_notify_update/send-reminders.js` là bản sao **y hệt**
  `.github/scripts/send-reminders.js` (đã diff, không lệch dòng nào). Chưa rõ
  mục đích (backup thủ công? file cũ quên xoá?) — nên hỏi user và cân nhắc xoá
  để tránh phải sửa đồng thời 2 nơi khi update script gửi thông báo.
- Chưa có `README.md` mô tả cách setup Firebase project mới / deploy từ đầu
  cho người khác join dự án (hiện tại chỉ có comment rải rác trong code).
- Luôn nhớ bump `CACHE_NAME` trong `sw.js` mỗi khi sửa `index.html`/`app.js`/
  `style.css` — xem quy ước trong `CLAUDE.md`.
