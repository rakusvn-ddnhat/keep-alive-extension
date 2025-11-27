# Tab Keeper & Request Recorder

## 📖 Hướng dẫn sử dụng / User Guide

Chrome Extension giúp chặn đóng tab và ghi lại HTTP requests để debug và test.

---

## 🎯 2 Chức năng chính

### 1️⃣ Chặn đóng Tab (Block Close Tab)

**Mục đích:** Ngăn trình duyệt đóng tab khi bạn đang debug, tránh mất dữ liệu.

**Cách sử dụng:**
1. Mở extension popup (click icon trên thanh công cụ)
2. Bật toggle **"Chặn đóng Tab"** (toggle đầu tiên)
3. Khi bật:
   - Một nút vàng nhắc nhở **"Mở DevTools (F12)"** sẽ hiện góc phải màn hình
   - Bạn có thể kéo nút này đi chỗ khác nếu che UI
4. Khi bạn cố đóng tab, trình duyệt sẽ hỏi xác nhận

**Lưu ý:**
- ⚠️ Nên mở DevTools (F12) để theo dõi requests trong tab Network
- Nút vàng có thể kéo và vị trí được lưu tự động

---

### 2️⃣ Record Requests (Ghi lại HTTP Requests)

**Mục đích:** Ghi lại các HTTP requests để export thành cURL hoặc JMeter test script.

**Cách sử dụng:**

#### Bước 1: Bật Recording
1. Mở extension popup
2. Bật toggle **"Record Requests"** (toggle thứ 2)

#### Bước 2: Lọc Domain (Tùy chọn)
- **Để trống** → Ghi lại TẤT CẢ requests
- **Nhập domain cụ thể** (VD: `example.com`) → Chỉ ghi requests của domain đó
- **Nút "Lấy domain"** → Tự động điền domain của tab hiện tại

#### Bước 3: Thực hiện các thao tác
- Làm bất cứ điều gì trên website (click, submit form, API calls...)
- Extension sẽ tự động ghi lại tất cả requests

#### Bước 4: Xem số lượng requests
- Số requests được ghi lại hiển thị ở giữa popup
- VD: `15 requests đã ghi lại`

#### Bước 5: Export
**A. Export JMeter** (Test automation)
1. Click nút **"Export JMeter"** (nút xanh đầu tiên)
2. File `.jmx` sẽ tự động tải về
3. Mở file này bằng Apache JMeter để chạy load test

**B. Export cURL** (Command line)
1. Click nút **"Export cURL"** (nút xanh lá thứ hai)
2. File `.sh` sẽ tự động tải về
3. Chạy file này trong terminal để replay requests

#### Bước 6: Xóa dữ liệu
- Click nút **"Xóa tất cả"** (nút đỏ) để xóa tất cả requests đã ghi

---

## 🌐 Đa ngôn ngữ

Extension hỗ trợ 3 ngôn ngữ:
- 🇻🇳 Tiếng Việt
- 🇬🇧 English
- 🇯🇵 日本語 (Tiếng Nhật)

**Đổi ngôn ngữ:**
1. Mở extension popup
2. Chọn ngôn ngữ trong dropdown ở trên cùng
3. Tất cả text sẽ tự động đổi

---

## 💡 Tips & Best Practices

### Khi nào dùng "Chặn đóng Tab"?
✅ Đang debug và sợ vô tình đóng tab
✅ Đang điền form dài, muốn chắc chắn không mất data
✅ Đang test flow phức tạp cần giữ trạng thái

### Khi nào dùng "Record Requests"?
✅ Muốn replay các API calls
✅ Tạo test automation script cho JMeter
✅ Debug network issues
✅ Học cách một website gọi API

### Nên lọc domain khi nào?
- **Không lọc (để trống):** Khi muốn ghi TẤT CẢ requests 
- **Có lọc:** Khi chỉ quan tâm requests của 1 domain cụ thể  

---

## 📋 Ví dụ thực tế

### Ví dụ 1: Debug form submission
```
1. Bật "Chặn đóng Tab" → Đảm bảo không bị đóng tab vô tình
2. Bật "Record Requests" 
3. Nhập domain: "api.example.com"
4. Điền form và submit
5. Export JMeter → Có test case tự động
```

### Ví dụ 2: Học cách website hoạt động
```
1. Bật "Record Requests"
2. Để trống domain → Ghi tất cả
3. Thao tác trên website
4. Export cURL → Xem tất cả API calls
```

### Ví dụ 3: Load testing
```
1. Bật "Record Requests"
2. Nhập domain backend
3. Thực hiện user flow (login → browse → checkout)
4. Export JMeter
5. Mở JMeter → Config số users → Chạy load test
```

---

## 🔧 Troubleshooting

**Q: Không thấy requests được ghi?**
- ✓ Kiểm tra toggle "Record Requests" đã bật chưa
- ✓ Kiểm tra domain filter có đúng không
- ✓ Mở DevTools (F12) tab Network để xác nhận có requests

**Q: Nút "Lấy domain" không hoạt động?**
- ✓ Đảm bảo bạn đang ở tab có URL hợp lệ (không phải `chrome://` hoặc `about:blank`)

**Q: Export file bị trống?**
- ✓ Chưa có requests nào được ghi lại
- ✓ Bật recording trước khi thao tác trên website

**Q: Nút vàng che mất UI?**
- ✓ Kéo nút đó đi chỗ khác, vị trí sẽ được lưu

---

## 👨‍💻 Tác giả

© Đoàn Duy Nhất

---

## 📞 Hỗ trợ

Nếu có vấn đề hoặc câu hỏi:
1. Check phần Troubleshooting ở trên
2. Mở DevTools Console xem có lỗi không
3. Reload extension và thử lại

---

## 🎉 Thành công!

Extension giờ đã sẵn sàng. Chúc bạn debug và testing hiệu quả! 🚀
