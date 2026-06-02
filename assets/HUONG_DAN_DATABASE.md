# Hướng dẫn cài đặt Google Sheets Database

## Cấu trúc tổng quan

```
HSE Webapp
├── Portal (16 module)  →  1 Google Spreadsheet chung  →  1 Apps Script URL
└── Cấp phát BHLĐ      →  Google Spreadsheet riêng    →  Apps Script URL riêng
```

---

## BƯỚC 1 — Tạo Google Spreadsheet chung

1. Vào [Google Sheets](https://sheets.google.com) → Tạo spreadsheet mới
2. Đặt tên: **"HSE Webapp Database – XNDVC"**
3. Ghi nhớ ID file (trong URL: `docs.google.com/spreadsheets/d/**{ID}**/edit`)

---

## BƯỚC 2 — Cài Apps Script

1. Trong Spreadsheet → **Extensions → Apps Script**
2. Xóa code mặc định → Dán toàn bộ nội dung file **`assets/Code.gs`**
3. Nhấn **Save** (Ctrl+S)
4. Chạy hàm `setupSheets()` **một lần duy nhất**:
   - Chọn function: `setupSheets` → nhấn ▶ Run
   - Cấp quyền khi được hỏi (Allow)
   - Kiểm tra log: phải thấy "✅ Đã tạo 19 sheets"

> **Kết quả:** Spreadsheet sẽ có 19 tabs: users, huan_luyen, jsa, sop, kiem_tra, thiet_bi, pccc, hoa_chat, nha_thau, ke_hoach, su_co, moi_truong, bao_cao, ung_pho, an_toan_dien, an_toan_gt, ksk, logs...

---

## BƯỚC 3 — Deploy Web App

1. Trong Apps Script → **Deploy → New deployment**
2. Chọn type: **Web App**
3. Cài đặt:
   - **Execute as:** Me (your email)
   - **Who has access:** Anyone
4. Nhấn **Deploy** → Copy URL (dạng `https://script.google.com/macros/s/.../exec`)

---

## BƯỚC 4 — Kết nối Webapp

1. Mở portal HSE → Đăng nhập Admin → **Quản trị hệ thống**
2. Kéo xuống mục **"☁️ Kết nối Google Sheets Database"**
3. Dán URL Apps Script vào ô → nhấn **💾 Lưu URL**
4. Nhấn **🔍 Kiểm tra kết nối** → phải thấy "✅ Kết nối OK — 19 sheets"
5. Nhấn **🔄 Sync Users** để đồng bộ tài khoản lên Sheets

---

## Cấu trúc các Sheet (tabs)

| Sheet | Mô tả | Module |
|---|---|---|
| `users` | Tài khoản & phân quyền | Quản trị hệ thống |
| `huan_luyen` | Khóa đào tạo, huấn luyện | Huấn luyện - Đào tạo |
| `jsa` | Phân tích công việc an toàn | JSA |
| `sop` | Quy trình chuẩn | SOP |
| `kiem_tra` | Biên bản kiểm tra các cấp | Kiểm tra các cấp |
| `kiem_tra_loi` | Lỗi & hành động khắc phục | Kiểm tra các cấp |
| `thiet_bi` | Thiết bị nâng, bình áp lực | Quản lý thiết bị |
| `ksk` | Khám sức khoẻ nghề nghiệp | Khám sức khoẻ |
| `pccc` | Phương tiện PCCC & CNCH | PCCC & CNCH |
| `hoa_chat` | Danh mục hoá chất | Quản lý hoá chất |
| `nha_thau` | Thông tin nhà thầu | Quản lý nhà thầu |
| `ke_hoach` | Kế hoạch HSE | Kế hoạch |
| `su_co` | Sự cố, tai nạn, near-miss | Tổng quan |
| `moi_truong` | Rác thải, môi trường | Môi trường |
| `bao_cao` | Báo cáo HSE | Báo cáo |
| `ung_pho` | Kế hoạch ứng phó | Ứng phó khẩn cấp |
| `an_toan_dien` | Kiểm tra an toàn điện | An toàn điện |
| `an_toan_gt` | Sự cố giao thông | An toàn giao thông |
| `logs` | Nhật ký thao tác | Tự động |

---

## Cách dùng DB trong code module mới

```javascript
// Lấy tất cả records
var data = await DB.getAll("jsa");

// Thêm record mới
var newJSA = await DB.insert("jsa", {
  ten_cong_viec: "Bốc xếp hàng hóa",
  don_vi: "Cảng biển",
  nguoi_tao: "Nguyễn Văn A"
});

// Cập nhật
await DB.update("jsa", newJSA.id, { trang_thai: "Đã duyệt" });

// Xóa
await DB.delete("jsa", newJSA.id);

// Cache-first (đọc nhanh, sync ngầm)
var cached = DB.cachedLoad("hse_jsa_cache", "jsa", [], function(fresh) {
  // fresh data từ Sheets → render lại UI
  renderJSATable(fresh);
});
renderJSATable(cached); // render ngay từ cache
```

---

## Cấp phát BHLĐ (Database riêng)

Trang `cap-phat-bhld.html` có database riêng. Cài đặt tương tự nhưng:
- Tạo **Spreadsheet riêng** cho BHLĐ
- Trong trang BHLĐ → đăng nhập Admin → **⚙️ Cài đặt kết nối** → nhập URL riêng

---

## Tài khoản mặc định

| Username | Password | Vai trò |
|---|---|---|
| `admin` | `admin123` | Admin — toàn quyền |
| `hse_officer` | `123456` | User — 5 module cơ bản |

> ⚠️ **Đổi mật khẩu ngay sau khi triển khai!**
