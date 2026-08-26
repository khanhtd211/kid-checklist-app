# Tiến độ dự án — Kid Checklist

> Nhật ký cập nhật theo phiên làm việc, mới nhất lên đầu. Chạy `/update-progress`
> (skill `init-context`) cuối mỗi phiên có tiến triển để giữ file này luôn mới.

## Đã hoàn thành

_(tính đến 26/08/2026)_

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

- **Cần user test thật trên iPhone** phần custom date-picker vừa làm (đã verify
  bằng browser giả lập, chưa có xác nhận trên thiết bị thật) — đây là việc ưu
  tiên nhất cho phiên tiếp theo.
- File `_notify_update/send-reminders.js` là bản sao **y hệt**
  `.github/scripts/send-reminders.js` (đã diff, không lệch dòng nào). Chưa rõ
  mục đích (backup thủ công? file cũ quên xoá?) — nên hỏi user và cân nhắc xoá
  để tránh phải sửa đồng thời 2 nơi khi update script gửi thông báo.
- Chưa có `README.md` mô tả cách setup Firebase project mới / deploy từ đầu
  cho người khác join dự án (hiện tại chỉ có comment rải rác trong code).
- Luôn nhớ bump `CACHE_NAME` trong `sw.js` mỗi khi sửa `index.html`/`app.js`/
  `style.css` — xem quy ước trong `CLAUDE.md`.
