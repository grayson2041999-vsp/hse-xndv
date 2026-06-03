/**
 * =========================================================
 *  GOOGLE APPS SCRIPT — HSE Webapp Database API
 *  Xí nghiệp Dịch vụ Cảng và Cung ứng vật tư thiết bị
 * =========================================================
 *
 *  CÁCH TRIỂN KHAI:
 *  1. Mở Google Sheets → Extensions → Apps Script
 *  2. Dán toàn bộ file này vào editor
 *  3. Chạy setupSheets() một lần để tạo các tab
 *  4. Deploy → New deployment → Web App:
 *       Execute as: Me
 *       Who has access: Anyone
 *  5. Copy URL và dán vào db.js (biến DB_URL)
 * =========================================================
 */

var SS = SpreadsheetApp.getActiveSpreadsheet();

// ─────────── CẤU TRÚC CÁC SHEET ───────────
var SCHEMA = {
  users: {
    cols: ["id","username","password","fullname","role","perms","active","created","updated"],
    desc: "Tài khoản người dùng"
  },
  huan_luyen: {
    cols: ["id","ma","ten_khoa","loai","don_vi","so_nguoi","ngay_bat_dau","ngay_ket_thuc","ket_qua","ghi_chu","created_by","created_at"],
    desc: "Huấn luyện - Đào tạo"
  },
  jsa: {
    cols: ["id","ma_jsa","ten_cong_viec","vi_tri","don_vi","nguoi_tao","ngay","trang_thai","noi_dung","ghi_chu","created_at"],
    desc: "JSA - Phân tích công việc an toàn"
  },
  sop: {
    cols: ["id","ma","ten","phong_ban","phien_ban","ngay_hieu_luc","trang_thai","noi_dung","ghi_chu","created_at"],
    desc: "SOP - Quy trình chuẩn"
  },
  kiem_tra: {
    cols: ["id","ma","ngay","cap_kiem_tra","don_vi","nguoi_kiem_tra","so_loi","trang_thai","ghi_chu","created_at"],
    desc: "Kiểm tra các cấp"
  },
  kiem_tra_loi: {
    cols: ["id","kiem_tra_id","mo_ta","muc_do","bien_phap","nguoi_xu_ly","han_xu_ly","trang_thai","created_at"],
    desc: "Lỗi & hành động khắc phục từ kiểm tra"
  },
  thiet_bi: {
    cols: ["id","ma","ten","loai","don_vi","so_seri","nha_san_xuat","ngay_nhap","han_kiem_dinh","lan_kiem_tra_tiep","trang_thai","ghi_chu"],
    desc: "Quản lý thiết bị (nâng, bình áp lực...)"
  },
  ksk: {
    cols: ["id","don_vi","nam","so_nguoi","binh_thuong","theo_doi","chuyen_vien","mac_nghe","ghi_chu","created_at"],
    desc: "Khám sức khoẻ nghề nghiệp"
  },
  pccc: {
    cols: ["id","loai","ten","vi_tri","so_luong","ngay_kiem_tra","han_tiep_theo","trang_thai","ghi_chu"],
    desc: "PCCC & CNCH - Phương tiện, hệ thống"
  },
  hoa_chat: {
    cols: ["id","ma_hh","ten","nhom","khu_vuc","muc_ton","don_vi","nguy_hiem","bien_phap","trang_thai","ghi_chu"],
    desc: "Quản lý hoá chất"
  },
  nha_thau: {
    cols: ["id","ten","loai_hop_dong","linh_vuc","nhan_su","dia_diem","ngay_bat_dau","ngay_ket_thuc","lien_he","trang_thai","ghi_chu"],
    desc: "Quản lý nhà thầu"
  },
  ke_hoach_mot_lan: {
    cols: ["id","name","status","start","end","chuTri","phoiHop","coSo","ghiChu","pages","order","updatedAt"],
    desc: "Kế hoạch – Công việc một lần"
  },
  ke_hoach_lap_lai: {
    cols: ["id","name","allMonths","months","execDay","lastDay","chuTri","phoiHop","coSo","ghiChu","pages","updatedAt"],
    desc: "Kế hoạch – Công việc lặp lại"
  },
  su_co: {
    cols: ["id","ngay","gio","loai","mo_ta","don_vi","nguoi_bao","xu_ly","trang_thai","ghi_chu","created_at"],
    desc: "Sự cố, tai nạn, near-miss"
  },
  moi_truong: {
    cols: ["id","thang","nam","loai_chat_thai","khoi_luong","don_vi","phuong_phap_xu_ly","don_vi_xu_ly","ghi_chu","created_at"],
    desc: "Môi trường - Quản lý rác thải"
  },
  bao_cao: {
    cols: ["id","ten","loai","ky","file_url","nguoi_tao","ngay_tao","trang_thai","ghi_chu"],
    desc: "Báo cáo HSE"
  },
  ung_pho: {
    cols: ["id","ten_ke_hoach","loai","pham_vi","nguoi_phu_trach","ngay_cap_nhat","lan_dien_tap_tiep","trang_thai","ghi_chu"],
    desc: "Ứng phó khẩn cấp - Kế hoạch"
  },
  an_toan_dien: {
    cols: ["id","ma","ten_hang_muc","vi_tri","don_vi","nguoi_phu_trach","ngay_kiem_tra","ket_qua","ghi_chu","created_at"],
    desc: "An toàn điện"
  },
  an_toan_gt: {
    cols: ["id","ngay","phuong_tien","bien_so","lai_xe","tuyen_duong","su_co","xu_ly","ghi_chu","created_at"],
    desc: "An toàn giao thông"
  },
  logs: {
    cols: ["id","user","action","sheet","record_id","detail","timestamp"],
    desc: "Nhật ký thao tác"
  }
};

// ─────────── SETUP: TẠO CÁC SHEET ───────────
function setupSheets() {
  Object.keys(SCHEMA).forEach(function(name) {
    var schema = SCHEMA[name];
    var sh = SS.getSheetByName(name);
    if (!sh) {
      sh = SS.insertSheet(name);
    }
    // Ghi header nếu sheet trống
    if (sh.getLastRow() === 0) {
      sh.appendRow(schema.cols);
      // Format header
      var hr = sh.getRange(1, 1, 1, schema.cols.length);
      hr.setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
      sh.setFrozenRows(1);
      // Auto-resize columns
      sh.autoResizeColumns(1, schema.cols.length);
    }
  });

  // Seed tài khoản admin mặc định nếu chưa có
  var userSheet = SS.getSheetByName("users");
  if (userSheet && userSheet.getLastRow() <= 1) {
    var now = new Date().toISOString();
    userSheet.appendRow([
      _genId(), "admin", "admin123", "Quản trị viên",
      "admin", JSON.stringify(["*"]), "true", now, now
    ]);
    userSheet.appendRow([
      _genId(), "hse_officer", "123456", "Cán bộ HSE",
      "user", JSON.stringify(["tong-quan","pccc-cnch","huan-luyen-dao-tao","jsa","kiem-tra-cac-cap"]), "true", now, now
    ]);
  }

  SpreadsheetApp.flush();
  Logger.log("✅ Đã tạo " + Object.keys(SCHEMA).length + " sheets thành công!");
}

// ─────────── HELPERS ───────────
function _genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Lấy sheet theo tên.
 * - Nếu chưa tồn tại VÀ autoCreate=true → tạo mới với header từ SCHEMA (hoặc để trống header)
 * - Nếu chưa tồn tại VÀ autoCreate=false → throw error (dùng cho read-only ops)
 */
function _getSheet(name, autoCreate) {
  var sh = SS.getSheetByName(name);
  if (!sh) {
    if (!autoCreate) throw new Error("Sheet không tồn tại: " + name);
    sh = SS.insertSheet(name);
    // Ghi header nếu có trong SCHEMA
    var schema = SCHEMA[name];
    if (schema && schema.cols && schema.cols.length) {
      sh.appendRow(schema.cols);
      var hr = sh.getRange(1, 1, 1, schema.cols.length);
      hr.setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, schema.cols.length);
    }
    Logger.log("✅ Tự động tạo sheet: " + name);
  }
  return sh;
}

function _sheetToObjects(sh) {
  var data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      var v = row[i];
      // Parse JSON string trở lại object/array nếu cần
      if (typeof v === "string" && (v.charAt(0) === "[" || v.charAt(0) === "{")) {
        try { v = JSON.parse(v); } catch(e) {}
      }
      // Boolean từ "TRUE"/"FALSE"
      if (v === "TRUE" || v === true) v = true;
      else if (v === "FALSE" || v === false) v = false;
      obj[h] = v;
    });
    return obj;
  });
}

function _objToRow(sh, obj) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  return headers.map(function(h) {
    var v = obj[h];
    if (v === undefined || v === null) return "";
    // Mảng & object → JSON string để Sheets hiển thị đúng
    if (typeof v === "object") return JSON.stringify(v);
    return v;
  });
}

function _findRowById(sh, id) {
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1; // 1-indexed
  }
  return -1;
}

function _log(user, action, sheetName, id, detail) {
  try {
    var logSh = SS.getSheetByName("logs");
    if (logSh) {
      logSh.appendRow([_genId(), user||"system", action, sheetName, id||"", detail||"", new Date().toISOString()]);
    }
  } catch(e) {}
}

// ─────────── CORS RESPONSE ───────────
function _cors(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─────────── API HANDLERS ───────────

/** Lấy tất cả records từ sheet (có thể filter) */
function _handleGetAll(params) {
  var sh = _getSheet(params.sheet);
  var rows = _sheetToObjects(sh);
  // Filter nếu có query params
  if (params.where) {
    try {
      var where = JSON.parse(params.where);
      rows = rows.filter(function(row) {
        return Object.keys(where).every(function(k) {
          return String(row[k]) === String(where[k]);
        });
      });
    } catch(e) {}
  }
  return { ok: true, data: rows };
}

/** Lấy 1 record theo id */
function _handleGetById(params) {
  var sh = _getSheet(params.sheet);
  var rows = _sheetToObjects(sh);
  var row = rows.find(function(r) { return String(r.id) === String(params.id); });
  if (!row) return { ok: false, error: "Không tìm thấy record id=" + params.id };
  return { ok: true, data: row };
}

/** Thêm record mới */
function _handleInsert(params, body) {
  var sh = _getSheet(params.sheet, true);
  var obj = body.data || body;
  if (!obj.id) obj.id = _genId();
  if (!obj.created_at) obj.created_at = new Date().toISOString();
  var row = _objToRow(sh, obj);
  sh.appendRow(row);
  _log(body.user, "insert", params.sheet, obj.id, "");
  return { ok: true, data: obj };
}

/** Cập nhật record theo id */
function _handleUpdate(params, body) {
  var sh = _getSheet(params.sheet, true);
  var rowNum = _findRowById(sh, params.id);
  if (rowNum < 0) return { ok: false, error: "Không tìm thấy id=" + params.id };
  var existing = _sheetToObjects(sh).find(function(r) { return String(r.id) === String(params.id); });
  var updated = Object.assign({}, existing, body.data || body, { id: params.id, updated_at: new Date().toISOString() });
  var row = _objToRow(sh, updated);
  sh.getRange(rowNum, 1, 1, row.length).setValues([row]);
  _log(body.user, "update", params.sheet, params.id, "");
  return { ok: true, data: updated };
}

/** Xoá record theo id */
function _handleDelete(params, body) {
  var sh = _getSheet(params.sheet);
  var rowNum = _findRowById(sh, params.id);
  if (rowNum < 0) return { ok: false, error: "Không tìm thấy id=" + params.id };
  sh.deleteRow(rowNum);
  _log((body||{}).user, "delete", params.sheet, params.id, "");
  return { ok: true };
}

/** Ghi đè toàn bộ sheet (bulk replace) */
function _handleBulkWrite(params, body) {
  var sh = _getSheet(params.sheet, true);
  var rows = body.data || [];
  // Nếu sheet hoàn toàn trống (chưa có header) → tạo header từ keys của row đầu tiên
  if (sh.getLastRow() === 0 && rows.length > 0) {
    var autoHeaders = Object.keys(rows[0]);
    sh.appendRow(autoHeaders);
    var hr = sh.getRange(1, 1, 1, autoHeaders.length);
    hr.setBackground("#003087").setFontColor("#ffffff").setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  // Xoá data cũ (giữ header)
  if (sh.getLastRow() > 1) {
    sh.deleteRows(2, sh.getLastRow() - 1);
  }
  rows.forEach(function(obj) {
    if (!obj.id) obj.id = _genId();
    sh.appendRow(_objToRow(sh, obj));
  });
  return { ok: true, count: rows.length };
}

/** Lấy danh sách schema (dùng để debug / setup) */
function _handleSchema() {
  var result = {};
  Object.keys(SCHEMA).forEach(function(k) {
    result[k] = { cols: SCHEMA[k].cols, desc: SCHEMA[k].desc };
  });
  return { ok: true, data: result };
}

// ─────────── ENTRY POINTS ───────────

function doGet(e) {
  try {
    var p = e.parameter || {};
    var action = p.action || "getAll";

    // Nếu có payload → đây là write operation gửi qua GET (tránh CORS)
    var body = {};
    if (p.payload) {
      try { body = JSON.parse(p.payload); } catch(ex) {}
    }

    var result;
    switch (action) {
      case "getAll":    result = _handleGetAll(p); break;
      case "getById":   result = _handleGetById(p); break;
      case "schema":    result = _handleSchema(); break;
      case "insert":    result = _handleInsert(p, body); break;
      case "update":    result = _handleUpdate(p, body); break;
      case "delete":    result = _handleDelete(p, body); break;
      case "bulkWrite": result = _handleBulkWrite(p, body); break;
      default:          result = { ok: false, error: "Action không hợp lệ: " + action };
    }
    return _cors(result);
  } catch(err) {
    return _cors({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var p = e.parameter || {};
    var action = p.action || "insert";
    var body = {};
    try { body = JSON.parse(e.postData.contents); } catch(ex) {}
    var result;
    switch (action) {
      case "insert":    result = _handleInsert(p, body); break;
      case "update":    result = _handleUpdate(p, body); break;
      case "delete":    result = _handleDelete(p, body); break;
      case "bulkWrite": result = _handleBulkWrite(p, body); break;
      default:          result = { ok: false, error: "Action không hợp lệ: " + action };
    }
    return _cors(result);
  } catch(err) {
    return _cors({ ok: false, error: err.message });
  }
}
