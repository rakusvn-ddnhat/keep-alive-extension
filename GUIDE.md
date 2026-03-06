# Dev Toolbox - Hướng dẫn sử dụng

## 📖 Giới thiệu

Chrome Extension đa năng hỗ trợ developer với nhiều công cụ tiện ích.

**Version:** 0.0.5  
**Tác giả:** © Đoàn Duy Nhất

---

## 🎯 Danh sách tính năng

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 1 | 🔒 Chặn đóng Tab | Ngăn đóng tab vô tình khi debug |
| 2 | 📋 Copy Mode | Copy text trên mọi trang, kể cả trang bị chặn |
| 3 | 🌐 Translate Mode | Dịch text bằng Google Translate |
| 4 | ➕ Web Crosshair | Thước kẻ căn chỉnh UI |
| 5 | 📊 Zabbix Charts | Tải charts từ Zabbix về ảnh/PDF |
| 6 | 📜 Script Loader | Tự động nhúng script vào trang |
| 7 | 🚀 API Tester | Test API như Postman |
| 8 | 📡 Record Requests | Ghi lại HTTP requests |
| 9 | 🔄 Auto Update | Kiểm tra và cập nhật extension |

---

## 1️⃣ Chặn đóng Tab (Block Close Tab)

### Mục đích
Ngăn trình duyệt đóng tab khi đang debug, tránh mất dữ liệu.

### Cách sử dụng
1. Mở extension popup (click icon trên thanh công cụ)
2. Bật toggle **"Chặn đóng Tab"**
3. Khi bật:
   - Nút vàng **"Mở DevTools (F12)"** hiện ở góc phải màn hình
   - Bạn có thể kéo nút này đi chỗ khác
4. Khi đóng tab → Browser sẽ hỏi xác nhận

### Mẹo
- ⚠️ Nên mở DevTools (F12) để xem requests trong Network tab
- Vị trí nút vàng được lưu tự động

---

## 2️⃣ Copy Mode

### Mục đích
Cho phép copy text trên các trang đã bị chặn right-click hoặc select text.

### Cách sử dụng
1. Mở extension popup
2. Bật toggle **"📋 Copy Mode"**
3. Hover vào bất kỳ text/button nào → Element được highlight
4. Click → Text được copy vào clipboard

### Các tùy chọn

| Icon | Tùy chọn | Mô tả |
|------|----------|-------|
| 👁️ | Hiện indicator | Bật/tắt badge "COPY" trên trang web |

### Tính năng đặc biệt với SELECT (dropdown)

Khi click vào `<select>` element, sẽ hiện **menu chọn**:

| Tùy chọn | Mô tả | Ví dụ |
|----------|-------|-------|
| 📝 **Value** | Copy giá trị value | `99`, `0`, `1` |
| 📄 **Text** | Copy text hiển thị | `すべての伝票`, `交通費精算` |

### Ví dụ thực tế
```
HTML: <option value="99">すべての伝票</option>

Click vào select → Menu hiện:
┌─────────────────────────┐
│ 📋 Chọn kiểu copy:      │
├─────────────────────────┤
│ 📝 Value    "99"        │
│ 📄 Text     "すべての伝票" │
└─────────────────────────┘
```

---

## 3️⃣ Translate Mode (Dịch văn bản)

### Mục đích
Dịch text sang ngôn ngữ khác trực tiếp trên trang web.

### Cách sử dụng
1. Mở extension popup
2. Bật toggle **"🌐 Translate Mode"**
3. Chọn ngôn ngữ đích trong dropdown (English, Tiếng Việt)
4. Hover hoặc click vào text để dịch

### Các tùy chọn

| Icon | Tùy chọn | Mô tả |
|------|----------|-------|
| 👁️ | Hiện indicator | Bật/tắt badge "TRANSLATE" trên trang |
| 👆 | Auto hover | Tự động dịch khi di chuột qua text |

### Chế độ dịch

| Chế độ | Cách dùng |
|--------|-----------|
| **Hover** (👆 bật) | Di chuột lên text → Tự động hiện bản dịch |
| **Click** (👆 tắt) | Click vào text → Hiện bản dịch |

### Tính năng đặc biệt với SELECT (dropdown)
- Tự động lấy **text hiển thị** của option đang chọn để dịch
- Ví dụ: `<option value="99">すべての伝票</option>` → Dịch "すべての伝票" (không phải "99")

### Hỗ trợ ngôn ngữ
- Tiếng Nhật ↔ Tiếng Việt
- Tiếng Anh ↔ Tiếng Việt
- Và các ngôn ngữ khác được Google Translate hỗ trợ

### Lưu ý
- 📖 Có sẵn ~250+ từ vựng offline thông dụng
- 🌐 Các từ khác sử dụng Google Translate (cần internet)

---

## 4️⃣ Web Crosshair (Thước kẻ màn hình)

### Mục đích
Hiển thị đường kẻ ngang/dọc theo con trỏ chuột để căn chỉnh UI.

### Cách sử dụng
1. Mở extension popup
2. Bật toggle **"➕ Web Crosshair"**
3. Click vào bất kỳ trang web nào
4. Đường kẻ sẽ theo con trỏ chuột

### Các tùy chọn

| Tùy chọn | Mô tả |
|----------|-------|
| 👁️ **Hiện indicator** | Bật/tắt badge "Crosshair" trên trang |
| **Chế độ** | Đường ngang / Đường dọc / Cả hai |
| **Màu** | Chọn màu đường kẻ |

### Phím tắt
- **ESC**: Ẩn đường kẻ tạm thời
- **Click indicator**: Bật/tắt nhanh crosshair

### Use case
- Căn chỉnh UI với design
- Kiểm tra alignment giữa các elements
- So sánh khoảng cách pixels

---

## 5️⃣ Zabbix Charts Downloader

### Mục đích
Tải tất cả biểu đồ từ trang Zabbix về dạng ảnh hoặc PDF.

### Cách sử dụng
1. Mở trang Zabbix có charts
2. Mở extension popup
3. Xem số lượng charts được detect
4. Click:
   - **📥 Tải ảnh** → Tải từng ảnh PNG
   - **📄 Xuất PDF** → Gộp tất cả charts vào 1 file PDF

### Lưu ý
- Chỉ hoạt động trên trang Zabbix
- Nếu không detect được charts, thử reload trang

---

## 6️⃣ Script Loader

### Mục đích
Tự động nhúng script JavaScript vào các trang web theo domain (giống Tampermonkey).

### Cách thêm script

**Cách 1: Từ URL**
1. Dán URL script vào ô input (hỗ trợ GitHub raw URL)
2. Click nút **➕**

**Cách 2: Từ file local**
1. Click nút **📁**
2. Chọn file `.js` từ máy tính

**Cách 3: Tải template**
1. Click nút **📄** để tải file mẫu
2. Chỉnh sửa theo ý muốn
3. Thêm vào extension

### Quản lý scripts

| Nút | Chức năng |
|-----|-----------|
| **Toggle ON/OFF** | Bật/tắt script |
| **🔄 Update** | Cập nhật từ URL nguồn |
| **📝 Edit** | Chỉnh sửa biến của script |
| **🗑️ Xóa** | Gỡ script |

### Cấu hình script (UserScript header)
```javascript
// ==UserScript==
// @name        Tên Script
// @version     1.0.0
// @match       https://example.com/*
// @updateURL   https://raw.githubusercontent.com/.../script.js
// @var         apiKey = "your-key"
// @var         debugMode = true
// ==/UserScript==

// Code của bạn ở đây
console.log('Script loaded!', apiKey, debugMode);
```

### Giải thích các @tag

| Tag | Mô tả | Ví dụ |
|-----|-------|-------|
| `@name` | Tên hiển thị | `My Script` |
| `@version` | Phiên bản | `1.0.0` |
| `@match` | URL pattern để inject | `https://example.com/*` |
| `@updateURL` | URL để check update | GitHub raw URL |
| `@var` | Biến có thể edit từ popup | `apiKey = "xxx"` |

### Tùy chọn quan trọng
- **🖼️ Chạy trong iframe:**
  - ✅ BẬT: Script chạy cả trong iframe
  - ❌ TẮT: Script chỉ chạy ở trang chính

### Troubleshooting

**Script không chạy?**
- ✓ Kiểm tra `@match` pattern
- ✓ Đảm bảo script đã toggle ON
- ✓ Reload trang sau khi thêm script
- ✓ Mở Console (F12) xem lỗi

---

## 7️⃣ API Tester

### Mục đích
Test API requests ngay trong browser, hỗ trợ đầy đủ tính năng.

### Cách mở

| Nút | Mô tả |
|-----|-------|
| **Mở** | Mở API Tester trong tab mới (có thể bị CORS) |
| **📌** | Inject API Tester vào trang hiện tại (**BYPASS CORS!**) |

### 📌 Inject Mode (Bypass CORS)

Khi gặp lỗi CORS trong API Tester thường:
```
❌ Error: Failed to fetch
Access-Control-Allow-Origin...
```

**Giải pháp: Dùng nút 📌 Inject!**

1. Mở trang web mà bạn muốn test API
2. Click nút **📌** (màu cam) trong popup
3. Panel API Tester sẽ xuất hiện trên trang
4. Gọi API từ context của trang gốc → **Không bị CORS!**

### Tính năng Inject Mode

| Feature | Description |
|---------|-------------|
| **Bypass CORS** | Request từ cùng origin, không bị block |
| **Gửi Cookies** | Tự động gửi cookies của trang gốc |
| **Draggable** | Kéo di chuyển panel |
| **Minimize** | Thu nhỏ panel khi không dùng |
| **Import cURL** | Paste cURL command to import |
| **Relative URL** | Hỗ trợ URL tương đối (VD: `/api/users`) |

### Tính năng chung

| Feature | Description |
|---------|-------------|
| **HTTP Methods** | GET, POST, PUT, PATCH, DELETE |
| **Headers** | Add/edit custom headers |
| **Body** | JSON, form-data, x-www-form-urlencoded, raw |
| **Auth** | Bearer Token, Basic Auth, API Key |
| **Import cURL** | Paste cURL command to import |
| **Import List** | Import file JSON từ Record Requests |
| **Load Records** | Load request từ danh sách đã record |
| **History** | Xem lịch sử requests |

### Xem Response

| Tab | Mô tả |
|-----|-------|
| **Body** | Response với syntax highlighting |
| **Headers** | Response headers |
| **Cookies** | Cookies được set |

### View modes
- **Pretty**: Formatted JSON/HTML
- **Raw**: Dữ liệu gốc
- **Preview**: Render HTML

### So sánh 2 mode

| Tiêu chí | Mở (tab mới) | 📌 Inject |
|----------|--------------|-----------|
| CORS | ❌ Có thể bị block | ✅ Bypass hoàn toàn |
| Cookies | ❌ Không gửi | ✅ Gửi tự động |
| Relative URL | ❌ Không dùng được | ✅ Hoạt động |
| History | ✅ Có | ❌ Không (session only) |
| UI | ✅ Đầy đủ | ⚡ Compact |

---

## 8️⃣ Record Requests

### Mục đích
Ghi lại các HTTP requests để export thành cURL hoặc JMeter test script.

### Cách sử dụng

**Bước 1: Bật Recording**
- Bật toggle **"Record Requests"**

**Bước 2: Lọc Domain (Tùy chọn)**

| Cài đặt | Hành vi |
|---------|---------|
| Để trống | Ghi lại TẤT CẢ requests |
| Nhập domain | Chỉ ghi requests của domain đó |
| Click "Lấy domain" | Tự động điền domain của tab hiện tại |

**Bước 3: Thực hiện các thao tác**
- Làm bất cứ điều gì trên website
- Extension tự động ghi lại requests

**Bước 4: Xem danh sách**
- Click **"📋 Xem"** để hiển thị
- Mỗi request có: 📋 Copy cURL | 🚀 Mở API Tester | 🗑️ Xóa

**Bước 5: Export**

| Nút | File | Mục đích |
|-----|------|----------|
| **Export JMeter** | `.jmx` | Load testing với Apache JMeter |
| **Export cURL** | `.sh` | Replay requests bằng command line |
| **📋 JSON** | `.json` | Export để import vào API Tester |

### Import vào API Tester
1. Click **📋 JSON** để export file JSON
2. Mở **API Tester**
3. Click **📁 Import List**
4. Chọn file JSON vừa export
5. Click vào request muốn test → Tự động load vào form

### Tùy chọn
- 👁️ **Hiện indicator**: Bật/tắt badge "REC" trên trang

---

## 9️⃣ Auto Update

### Mục đích
Kiểm tra và tải bản cập nhật mới nhất từ GitHub.

### Cách sử dụng
1. Kéo xuống cuối popup
2. Click **"Kiểm tra"**
3. Nếu có bản mới → Làm theo hướng dẫn

### Cập nhật thủ công
1. Tải file ZIP từ link
2. Giải nén đè lên folder extension
3. Vào `chrome://extensions`
4. Click **🔄 Reload**

---

## 🌐 Đa ngôn ngữ

Extension hỗ trợ 3 ngôn ngữ:
- 🇻🇳 Tiếng Việt
- 🇬🇧 English
- 🇯🇵 日本語

**Đổi ngôn ngữ:** Chọn trong dropdown ở trên cùng popup

---

## 💡 Tips & Best Practices

### Combo Debug API
```
1. Bật "Record Requests" với domain API
2. Thao tác trên trang
3. Click 🚀 → Mở request trong API Tester
4. Sửa params và test lại
```

### Combo Căn chỉnh UI
```
1. Bật "Web Crosshair"
2. Di chuột để xem tọa độ
3. Screenshot so sánh với design
```

### Combo Load Testing
```
1. Bật "Record Requests"
2. Thực hiện user flow (login → browse → checkout)
3. Export JMeter
4. Mở JMeter → Config threads → Run test
```

### Bypass trang chặn copy
```
1. Bật "Copy Mode"
2. Click vào text muốn copy
```

---

## 🔧 Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| Extension không hoạt động | Reload extension trong `chrome://extensions` |
| Script không inject | Kiểm tra `@match`, toggle ON, reload trang |
| API Tester bị CORS | Dùng proxy hoặc test từ backend |
| Không thấy requests | Check toggle ON, domain filter đúng |

---

## 📞 Hỗ trợ

1. Check phần Troubleshooting
2. Mở Console (F12) xem lỗi
3. Reload extension và thử lại
4. Liên hệ tác giả

---

## 👨‍💻 Tác giả

**© Đoàn Duy Nhất**

GitHub: [rakusvn-ddnhat/keep-alive-extension](https://github.com/rakusvn-ddnhat/keep-alive-extension)
