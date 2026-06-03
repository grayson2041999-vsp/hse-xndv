/* =========================================================
   APP.JS - Lõi portal Quản lý HSE
   - Xem công khai không cần đăng nhập (chế độ Viewer)
   - Nút đăng nhập góc phải trên cho User / Admin
   - 3 vai trò: admin / user / viewer
   - Phân quyền truy cập theo từng trang (module)
   - Render sidebar, topbar, nội dung
   - Lưu dữ liệu bằng localStorage (bản demo, dễ thay backend sau)
   ========================================================= */
(function (global) {
  "use strict";

  /* -------- DANH MỤC MODULE (nguồn dữ liệu duy nhất) -------- */
  var MENU = [
    { slug:"tong-quan",          title:"Tổng quan",                   icon:"📊", sub:["Số giờ làm việc an toàn","Tai nạn, sự cố gần nhất"] },
    { slug:"pccc-cnch",          title:"PCCC & CNCH",                 icon:"🧯", sub:["Hệ thống báo cháy tự động (BCTĐ)","Phương tiện CC & CNCH"] },
    { slug:"cap-phat-bhld",      title:"Cấp phát BHLĐ",               icon:"🦺", sub:["Quản lý cấp phát","Danh mục BHLĐ","Định mức cấp phát","Phiếu yêu cầu","Tồn kho","Nhu cầu mua sắm"] },
    { slug:"huan-luyen-dao-tao", title:"Huấn luyện - Đào tạo",        icon:"🎓", sub:["Thống kê các loại đào tạo, huấn luyện","Kiểm tra kiến thức an toàn","Đào tạo nội bộ"] },
    { slug:"ung-pho-khan-cap",   title:"Ứng phó tình huống khẩn cấp", icon:"🚨", sub:["Kế hoạch","Báo cáo"] },
    { slug:"jsa",                title:"JSA",                         icon:"📝", sub:["Hướng dẫn lập JSA online"] },
    { slug:"sop",                title:"SOP",                         icon:"📑", sub:[] },
    { slug:"kiem-tra-cac-cap",   title:"Kiểm tra các cấp",            icon:"🔍", sub:["Số lượng kiểm tra các cấp","Ghi nhận các lỗi vào hệ thống","Ghi nhận hành động khắc phục, thời hạn"] },
    { slug:"quan-ly-thiet-bi",   title:"Quản lý thiết bị",            icon:"⚙️", sub:["Thiết bị nâng","Bình áp lực"] },
    { slug:"kham-suc-khoe",      title:"Khám sức khoẻ nghề nghiệp",   icon:"🩺", sub:["Theo dõi khám sức khoẻ nghề nghiệp","Theo dõi khám bệnh nghề nghiệp"] },
    { slug:"an-toan-dien",       title:"An toàn điện",                icon:"⚡", sub:[] },
    { slug:"an-toan-giao-thong", title:"An toàn giao thông",          icon:"🚧", sub:[] },
    { slug:"moi-truong",         title:"Môi trường",                  icon:"🌿", sub:["Thống kê khối lượng rác thải xử lý"] },
    { slug:"quan-ly-hoa-chat",   title:"Quản lý hóa chất",            icon:"🧪", sub:["Thông tin về các khu vực hoá chất","Lập báo cáo hoá chất"] },
    { slug:"quan-ly-nha-thau",   title:"Quản lý nhà thầu",            icon:"👷", sub:["Thông tin các nhà thầu đang làm việc","Thuê kho, bãi, văn phòng làm việc"] },
    { slug:"ke-hoach",           title:"Kế hoạch",                    icon:"🗓️", sub:["Lập kế hoạch (chọn các mục liên quan)","Báo cáo kế hoạch cụ thể"] },
    { slug:"bao-cao",            title:"Báo cáo",                     icon:"📈", sub:[] },
    { slug:"quan-tri-he-thong",  title:"Quản trị hệ thống",           icon:"🛡️", sub:[], adminOnly:true }
  ];

  var APP_NAME = "Quản lý HSE";
  var ORG_SHORT = "XN Dịch vụ Cảng & Cung ứng VTTB";
  var ORG = "Xí nghiệp Dịch vụ Cảng và Cung ứng vật tư thiết bị";
  var ORG_PARENT = "Liên doanh Việt - Nga Vietsovpetro";
  var LOGO_PATH = "assets/logo.svg";
  var K_USERS = "hse_users";
  var K_SESS  = "hse_session";

  /* -------- TIỆN ÍCH -------- */
  function $(s, r){ return (r||document).querySelector(s); }
  function el(tag, cls, html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function load(k, def){ try{ var v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch(e){ return def; } }
  function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  function allSlugs(){ return MENU.map(function(m){return m.slug;}); }
  function menuBySlug(s){ for(var i=0;i<MENU.length;i++) if(MENU[i].slug===s) return MENU[i]; return null; }

  /* -------- KHỞI TẠO DB (Google Sheets) -------- */
  function initDB(){
    if(typeof DB === "undefined") return;
    DB.init(); // Đọc URL: localStorage → DEFAULT_URL trong db.js
    var u = currentUser();
    if(u) DB.setUser(u.username);
    if(!DB.isReady()) return; // Chưa có URL thì thôi
    // Pull từ Sheets sau 2s khi trang load xong
    setTimeout(function(){
      DB.syncUsersFromSheets(K_USERS);
    }, 2000);
    // Auto-sync mỗi 5 phút
    DB.startAutoSync(K_USERS, 5);
  }

  /* -------- KHỞI TẠO TÀI KHOẢN MẶC ĐỊNH -------- */
  function seedUsers(){
    var u = load(K_USERS, null);
    if(!u || !u.length){
      u = [{
        id: Date.now().toString(36),
        username:"admin", password:"admin123", fullname:"Quản trị viên",
        role:"admin", perms: allSlugs(), active:true,
        created: new Date().toISOString()
      }];
      save(K_USERS, u);
    }
    return u;
  }
  function getUsers(){ return load(K_USERS, []); }
  function dedupUsers(u){
    var seen={}, out=[];
    (u||[]).forEach(function(x){ if(x.username && !seen[x.username]){ seen[x.username]=true; out.push(x); } });
    return out;
  }
  function setUsers(u){
    u = dedupUsers(u);
    save(K_USERS, u);
    // Đẩy lên Sheets ngầm (write-through cache)
    if(typeof DB !== "undefined" && DB.isReady()){
      DB.bulkWrite("users", u).then(function(){
        showToast("☁️ Đã đồng bộ " + u.length + " tài khoản lên Sheets!", "success");
      }).catch(function(e){
        showToast("⚠️ Lưu local OK nhưng chưa sync Sheets: " + e.message, "warning");
      });
    }
  }
  function findUser(un){ var u=getUsers(); for(var i=0;i<u.length;i++) if(u[i].username===un) return u[i]; return null; }

  /* -------- PHIÊN LÀM VIỆC -------- */
  function currentUser(){ var un=load(K_SESS,null); return un?findUser(un):null; }
  /* -------- HASH MẬT KHẨU (SHA-256 + salt, async) -------- */
  var PW_SALT = "vsp_hse_2024";
  function hashPw(pw){
    var data = new TextEncoder().encode(PW_SALT + pw);
    return crypto.subtle.digest("SHA-256", data).then(function(buf){
      return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,"0"); }).join("");
    });
  }
  // Phát hiện mật khẩu đã hash chưa — SHA-256 luôn là đúng 64 ký tự hex
  // Không dùng flag pwHash riêng vì field này bị mất khi sync qua Google Sheets
  function isHashed(pw){ return !!pw && /^[0-9a-f]{64}$/.test(pw); }

  function login(un, pw, callback){
    hashPw(pw).then(function(hashed){
      var u=findUser((un||"").trim());
      if(!u){ callback({ok:false,msg:"Tài khoản không tồn tại."}); return; }
      if(u.pendingApproval && u.active===false){
        callback({ok:false,msg:"⏳ Tài khoản đang chờ Admin phê duyệt. Vui lòng liên hệ quản trị viên."}); return;
      }
      if(u.active===false){ callback({ok:false,msg:"🔒 Tài khoản đã bị khoá. Liên hệ Admin để mở khoá."}); return; }
      // Tự phát hiện: nếu stored password là 64-char hex → đã hash; ngược lại → plaintext cũ
      var isMatch = isHashed(u.password) ? (u.password === hashed) : (u.password === pw);
      if(!isMatch){ callback({ok:false,msg:"Sai mật khẩu."}); return; }
      // Migrate plaintext → hash khi login thành công
      if(!isHashed(u.password)){
        var users=getUsers();
        for(var i=0;i<users.length;i++){
          if(users[i].username===u.username){ users[i].password=hashed; break; }
        }
        save(K_USERS, dedupUsers(users));
      }
      save(K_SESS, u.username);
      if(typeof DB !== "undefined") DB.setUser(u.username);
      callback({ok:true});
    });
  }
  function logout(){ localStorage.removeItem(K_SESS); location.reload(); }

  /* -------- PHÂN QUYỀN -------- */
  function isAdmin(u){ return u && u.role==="admin"; }
  function canView(u, slug){
    var m = menuBySlug(slug);
    // Trang adminOnly: chỉ admin đăng nhập mới xem được
    if(m && m.adminOnly) return u && u.role==="admin";
    // Tất cả người dùng (kể cả chưa đăng nhập) đều xem được trang thường
    return true;
  }
  function canEdit(u, slug){
    if(!u) return false;
    if(u.role==="admin") return true;
    if(u.role==="viewer") return false;
    // User: chỉ edit được trang admin đã cấp quyền
    return (u.perms||[]).indexOf(slug) !== -1;
  }
  function roleLabel(r){ return r==="admin"?"Admin":(r==="viewer"?"Viewer":"User"); }

  /* =========================================================
     MODAL ĐĂNG NHẬP (popup nhỏ từ topbar)
     ========================================================= */
  function ensureLoginModal(){
    if(document.getElementById("hse-login-modal")) return;
    var bg = el("div","login-modal-bg"); bg.id="hse-login-modal";
    bg.innerHTML =
      '<div class="login-popup">'+
        '<div class="login-popup-h">'+
          '<div style="display:flex;align-items:center;gap:10px">'+
            '<div class="login-popup-logo"><img src="assets/logo.svg" alt="VSP" style="width:100%;height:100%;object-fit:contain"></div>'+
            '<div>'+
              '<div style="font-weight:700;font-size:14px;color:var(--brand)">'+APP_NAME+'</div>'+
              '<div style="font-size:10.5px;color:var(--text-muted);line-height:1.3">'+ORG+'</div>'+
              '<div style="font-size:10.5px;color:var(--text-muted);line-height:1.3">'+ORG_PARENT+'</div>'+
            '</div>'+
          '</div>'+
          '<button class="x" id="hse-lm-close">×</button>'+
        '</div>'+
        '<div class="login-popup-b">'+
          '<div class="login-err" id="hse-lm-err"></div>'+
          '<form id="hse-lm-form">'+
            '<div class="field"><label>Email</label><input id="hse-lm-u" class="inp" type="text" style="width:100%" autocomplete="username" placeholder="VD: sonlhh.sd"></div>'+
            '<div class="field"><label>Mật khẩu</label><input id="hse-lm-p" type="password" class="inp" style="width:100%" autocomplete="current-password" placeholder="Nhập mật khẩu"></div>'+
            '<button class="btn btn-block" type="submit">Đăng nhập</button>'+
          '</form>'+
          '<div style="text-align:center;margin-top:14px;">'+
            '<span style="font-size:12.5px;color:var(--text-muted);">Chưa có tài khoản? </span>'+
            '<a href="#" id="hse-lm-reg-link" style="font-size:12.5px;font-weight:600;color:var(--brand);">Đăng ký</a>'+
          '</div>'+
        '</div>'+
        '<!-- PANEL ĐĂNG KÝ (ẩn mặc định) -->'+
        '<div id="hse-reg-panel" style="display:none;padding:0 20px 20px;">'+
          '<div style="font-size:13px;font-weight:700;color:var(--brand);margin-bottom:14px;">📝 Đăng ký tài khoản</div>'+
          '<div class="login-err" id="hse-reg-err"></div>'+
          '<div class="field"><label>Email *</label><input id="reg-un" class="inp" type="text" style="width:100%" placeholder="VD: sonlhh.sd"></div>'+
          '<div class="field"><label>Họ và tên *</label><input id="reg-fn" class="inp" style="width:100%" placeholder="Nguyễn Văn A"></div>'+
          '<div class="field"><label>Danh số</label><input id="reg-ds" class="inp" style="width:100%" placeholder="VD: 21398"></div>'+
          '<div class="field"><label>Mật khẩu *</label><input id="reg-pw" type="password" class="inp" style="width:100%"></div>'+
          '<div class="field"><label>Xác nhận mật khẩu *</label><input id="reg-pw2" type="password" class="inp" style="width:100%"></div>'+
          '<div style="background:#fef9e7;border-left:3px solid var(--warning);padding:9px 12px;border-radius:6px;font-size:12px;color:#856404;margin-bottom:14px;">'+
            '⏳ Tài khoản mới cần Admin phê duyệt trước khi sử dụng.'+
          '</div>'+
          '<button class="btn btn-block" id="hse-reg-submit">Gửi đăng ký</button>'+
          '<div style="text-align:center;margin-top:12px;">'+
            '<a href="#" id="hse-reg-back" style="font-size:12.5px;color:var(--text-muted);">← Quay lại đăng nhập</a>'+
          '</div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(bg);

    function close(){ bg.classList.remove("open"); showLoginPanel(); }
    function showLoginPanel(){
      document.getElementById("hse-lm-form").parentElement.style.display="block";
      document.getElementById("hse-reg-panel").style.display="none";
      document.getElementById("hse-lm-err").style.display="none";
    }
    function showRegPanel(){
      document.getElementById("hse-lm-form").parentElement.style.display="none";
      document.getElementById("hse-reg-panel").style.display="block";
      document.getElementById("hse-reg-err").style.display="none";
      document.getElementById("reg-un").value="";
      document.getElementById("reg-fn").value="";
      document.getElementById("reg-ds").value="";
      document.getElementById("reg-pw").value="";
      document.getElementById("reg-pw2").value="";
    }

    bg.addEventListener("click", function(e){ if(e.target===bg) close(); });
    $("#hse-lm-close").addEventListener("click", close);
    $("#hse-lm-form").addEventListener("submit", function(e){
      e.preventDefault();
      var btn=this.querySelector("button[type=submit]");
      if(btn){btn.disabled=true;btn.textContent="Đang kiểm tra...";}
      login($("#hse-lm-u").value, $("#hse-lm-p").value, function(r){
        if(btn){btn.disabled=false;btn.textContent="Đăng nhập";}
        if(r.ok){ location.reload(); }
        else{ var er=$("#hse-lm-err"); er.textContent=r.msg; er.style.display="block"; }
      });
    });
    document.getElementById("hse-lm-reg-link").addEventListener("click", function(e){ e.preventDefault(); showRegPanel(); });
    document.getElementById("hse-reg-back").addEventListener("click", function(e){ e.preventDefault(); showLoginPanel(); });
    document.getElementById("hse-reg-submit").addEventListener("click", function(){
      var un=(document.getElementById("reg-un").value||"").trim();
      var fn=(document.getElementById("reg-fn").value||"").trim();
      var ds=(document.getElementById("reg-ds").value||"").trim();
      var pw=document.getElementById("reg-pw").value;
      var pw2=document.getElementById("reg-pw2").value;
      var errEl=document.getElementById("hse-reg-err");
      function showErr(msg){ errEl.textContent=msg; errEl.style.display="block"; }
      if(!un||!fn||!pw){ return showErr("Vui lòng điền đầy đủ các trường bắt buộc (*)"); }
      if(!un){ return showErr("Vui lòng nhập email."); }
      if(pw!==pw2){ return showErr("Mật khẩu xác nhận không khớp."); }
      if(pw.length<6){ return showErr("Mật khẩu tối thiểu 6 ký tự."); }
      if(findUser(un)){ return showErr("Email này đã được đăng ký."); }
      var u=getUsers();
      var regBtn=document.getElementById("hse-reg-submit");
      if(regBtn){regBtn.disabled=true;regBtn.textContent="Đang xử lý...";}
      hashPw(pw).then(function(hashed){
        u.push({ id:Date.now().toString(36), username:un, password:hashed, fullname:fn, danhSo:ds,
          role:"viewer", perms:[], active:false, pendingApproval:true, created:new Date().toISOString() });
        setUsers(u);
        document.getElementById("hse-reg-panel").innerHTML=
          '<div style="text-align:center;padding:24px 0;">'+
            '<div style="font-size:40px;margin-bottom:12px;">✅</div>'+
            '<div style="font-size:14px;font-weight:700;color:var(--brand);margin-bottom:8px;">Đăng ký thành công!</div>'+
            '<div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Tài khoản <b>'+esc(un)+'</b> đã được tạo và đang chờ Admin phê duyệt.</div>'+
            '<button class="btn" onclick="document.getElementById(\'hse-login-modal\').classList.remove(\'open\')">Đóng</button>'+
          '</div>';
      }).catch(function(){ if(regBtn){regBtn.disabled=false;regBtn.textContent="Gửi đăng ký";} });
    });
  }

  function openLoginModal(){
    var bg = document.getElementById("hse-login-modal");
    if(!bg){ ensureLoginModal(); bg=document.getElementById("hse-login-modal"); }
    bg.classList.add("open");
    setTimeout(function(){ var f=document.getElementById("hse-lm-u"); if(f) f.focus(); }, 80);
  }

  /* =========================================================
     RENDER: KHUNG LAYOUT (sidebar + topbar)
     ========================================================= */
  function renderShell(activeSlug, contentNode){
    var u = currentUser();
    // Không redirect - cho phép xem không cần đăng nhập
    var m = menuBySlug(activeSlug);

    document.body.className="";
    document.body.innerHTML="";

    var layout = el("div","layout");

    /* SIDEBAR */
    var side = el("aside","sidebar"); side.id="sidebar";
    side.appendChild(el("div","sidebar-head",
      '<div class="logo"><img src="assets/logo.svg" alt="Vietsovpetro"></div>'+
      '<div><div class="t1">'+APP_NAME+'</div>'+
      '<div class="t2">'+ORG_SHORT+'</div>'+
      '<div class="t2">'+ORG_PARENT+'</div></div>'));
    var nav = el("nav","nav");
    // Fix 6: đếm tài khoản chờ duyệt để hiện badge
    var pendingCount = isAdmin(u) ? getUsers().filter(function(x){ return x.pendingApproval && x.active===false; }).length : 0;
    MENU.forEach(function(item){
      if(item.adminOnly && !isAdmin(u)) return;
      var editable = canEdit(u, item.slug);
      var badge = (item.slug==="quan-tri-he-thong" && pendingCount>0)
        ? '<span style="margin-left:auto;background:#C8102E;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;">'+pendingCount+'</span>'
        : '';
      // Nếu user đăng nhập nhưng không có quyền sửa → hiện nhãn "Chỉ xem" nhỏ
      var viewOnlyTag = (u && u.role!=="admin" && !editable && item.slug!=="quan-tri-he-thong")
        ? '<span style="margin-left:auto;font-size:9.5px;opacity:.6;font-style:italic;">chỉ xem</span>'
        : '';
      var a = el("a", (item.slug===activeSlug?"active ":""));
      a.innerHTML='<span class="ic">'+item.icon+'</span><span>'+esc(item.title)+'</span>'+badge+viewOnlyTag;
      a.href=item.slug+".html";
      nav.appendChild(a);
    });
    side.appendChild(nav);
    side.appendChild(el("div","sidebar-foot","© "+new Date().getFullYear()+" "+ORG_PARENT));
    layout.appendChild(side);

    /* MAIN */
    var main = el("div","main");
    var top = el("header","topbar");

    var userBoxHtml;
    if(u){
      var initials=(u.fullname||u.username).trim().split(/\s+/).map(function(w){return w[0];}).slice(-2).join("").toUpperCase();
      var pendingBadge = (isAdmin(u) && pendingCount > 0)
        ? '<a href="quan-tri-he-thong.html" style="position:relative;display:inline-flex;align-items:center;margin-right:8px;text-decoration:none;" title="'+pendingCount+' tài khoản chờ duyệt">'+
            '<span style="font-size:18px;">🔔</span>'+
            '<span style="position:absolute;top:-4px;right:-5px;background:#C8102E;color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;min-width:14px;text-align:center;">'+pendingCount+'</span>'+
          '</a>'
        : '';
      userBoxHtml=
        '<div class="user-box" style="position:relative;">'+
          pendingBadge+
          '<button id="btn-profile" style="display:flex;align-items:center;gap:8px;background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:8px;transition:background .15s;" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">'+
            '<div class="avatar" style="background:var(--brand);color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">'+esc(initials)+'</div>'+
            '<div style="text-align:left;">'+
              '<div style="font-size:13px;font-weight:600;color:var(--text);">'+esc(u.fullname||u.username)+'</div>'+
              '<div style="font-size:11px;color:var(--text-muted);">'+roleLabel(u.role)+'</div>'+
            '</div>'+
            '<span style="font-size:10px;color:var(--text-muted);">▼</span>'+
          '</button>'+
          '<div id="profile-dropdown" style="display:none;position:absolute;right:0;top:calc(100% + 6px);background:#fff;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.14);min-width:220px;z-index:200;border:1px solid var(--border);overflow:hidden;">'+
            '<div style="padding:14px 16px;border-bottom:1px solid var(--border);background:#f8f9fd;">'+
              '<div style="font-weight:700;font-size:13.5px;">'+esc(u.fullname||u.username)+'</div>'+
              '<div style="font-size:12px;color:var(--text-muted);">'+esc(u.username)+' · '+roleLabel(u.role)+'</div>'+
            '</div>'+
            '<button id="btn-edit-profile" style="width:100%;text-align:left;padding:10px 16px;border:none;background:none;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;transition:background .12s;" onmouseover="this.style.background=\'#f0f3fa\'" onmouseout="this.style.background=\'transparent\'">'+
              '👤 Chỉnh sửa hồ sơ cá nhân'+
            '</button>'+
            '<button id="btn-doi-mk" style="width:100%;text-align:left;padding:10px 16px;border:none;background:none;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;transition:background .12s;" onmouseover="this.style.background=\'#f0f3fa\'" onmouseout="this.style.background=\'transparent\'">'+
              '🔑 Đổi mật khẩu'+
            '</button>'+
            '<div style="height:1px;background:var(--border);margin:4px 0;"></div>'+
            '<button id="lo" style="width:100%;text-align:left;padding:10px 16px;border:none;background:none;cursor:pointer;font-size:13px;color:#c0392b;display:flex;align-items:center;gap:8px;transition:background .12s;" onmouseover="this.style.background=\'#fdedec\'" onmouseout="this.style.background=\'transparent\'">'+
              '🚪 Đăng xuất'+
            '</button>'+
          '</div>'+
        '</div>';
    } else {
      userBoxHtml=
        '<div class="user-box">'+
          '<span class="viewer-notice">Chế độ xem</span>'+
          '<button class="btn btn-sm btn-login-top" id="lo">🔐 Đăng nhập</button>'+
        '</div>';
    }

    top.innerHTML=
      '<button class="menu-btn" id="mbtn">☰</button>'+
      '<div><h2>'+esc(m?m.title:APP_NAME)+'</h2><div class="crumb">'+APP_NAME+' · '+esc(m?m.title:"")+'</div></div>'+
      '<div class="spacer"></div>'+
      userBoxHtml;

    main.appendChild(top);
    var content = el("main","content"); content.id="content";
    if(contentNode) content.appendChild(contentNode);
    main.appendChild(content);
    layout.appendChild(main);

    var bd = el("div","backdrop"); bd.id="backdrop";
    document.body.appendChild(layout);
    document.body.appendChild(bd);

    if(u){
      // Profile dropdown toggle
      var profileBtn=document.getElementById("btn-profile");
      var profileDrop=document.getElementById("profile-dropdown");
      if(profileBtn&&profileDrop){
        profileBtn.addEventListener("click",function(e){
          e.stopPropagation();
          var open=profileDrop.style.display!=="none";
          profileDrop.style.display=open?"none":"block";
        });
        document.addEventListener("click",function(){ profileDrop.style.display="none"; },{once:false});
        profileDrop.addEventListener("click",function(e){e.stopPropagation();});
      }
      $("#lo").addEventListener("click", logout);
      var doiMkBtn = document.getElementById("btn-doi-mk");
      if(doiMkBtn) doiMkBtn.addEventListener("click", function(){ if(profileDrop)profileDrop.style.display="none"; openDoiMatKhau(); });
      var editProfileBtn = document.getElementById("btn-edit-profile");
      if(editProfileBtn) editProfileBtn.addEventListener("click", function(){ if(profileDrop)profileDrop.style.display="none"; openEditProfile(); });
    } else {
      ensureLoginModal();
      $("#lo").addEventListener("click", openLoginModal);
    }
    $("#mbtn").addEventListener("click", function(){ $("#sidebar").classList.toggle("open"); bd.classList.toggle("open"); });
    bd.addEventListener("click", function(){ $("#sidebar").classList.remove("open"); bd.classList.remove("open"); });
    return content;
  }

  /* =========================================================
     RENDER: TRANG MODULE
     ========================================================= */
  function renderPage(slug){
    seedUsers();
    var u = currentUser();

    // Quản trị hệ thống: chỉ admin
    if(slug==="quan-tri-he-thong"){
      if(!u){
        renderShell(slug, needLoginNode("Trang này yêu cầu đăng nhập với quyền Admin.")); return;
      }
      if(!isAdmin(u)){ renderShell(slug, deniedNode()); return; }
      var c = renderShell(slug, el("div")); renderAdmin(c); return;
    }

    // Trang thường: anonymous có thể xem, user/viewer theo phân quyền
    if(!canView(u, slug)){
      renderShell(slug, deniedNode()); return;
    }

    var m = menuBySlug(slug);
    var wrap = el("div");

    var descText;
    if(!u){
      descText='<span style="color:var(--text-muted)">Bạn đang xem ở chế độ khách. </span>'+
        '<a href="#" id="loginLink" style="color:var(--brand);font-weight:600">Đăng nhập</a>'+
        '<span style="color:var(--text-muted)"> để thao tác và nhập liệu.</span>';
    } else if(canEdit(u,slug)){
      descText='Bạn có quyền thao tác trên trang này.';
    } else {
      descText='Bạn chỉ có quyền xem trang này.';
    }

    wrap.appendChild(el("div","",
      '<div class="page-title">'+m.icon+' '+esc(m.title)+'</div>'+
      '<div class="page-desc">'+descText+'</div>'));

    // Widget kế hoạch tháng này
    renderKeHoachWidget(slug, wrap);

    wrap.appendChild(el("div","wip",
      '<div class="ic">🚧</div><h3>Đang xây dựng</h3>'+
      '<p>Trang <b>'+esc(m.title)+'</b> đang được phát triển. Nội dung chi tiết sẽ được bổ sung trong phiên bản tiếp theo.</p>'));

    if(m.sub && m.sub.length){
      wrap.appendChild(el("div","section-h","Các mục chức năng dự kiến"));
      var grid = el("div","grid grid-sub");
      m.sub.forEach(function(s){
        var card = el("div","card sub-card",
          '<div class="sic">📄</div><div><h4>'+esc(s)+'</h4><span class="tag">Đang xây dựng</span></div>');
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
    }

    renderShell(slug, wrap);

    // Wire up inline login link
    var ll = document.getElementById("loginLink");
    if(ll){ ll.addEventListener("click", function(e){ e.preventDefault(); openLoginModal(); }); }
  }

  function deniedNode(){
    return el("div","wip",
      '<div class="ic">🔒</div><h3>Không có quyền truy cập</h3>'+
      '<p>Bạn chưa được cấp quyền truy cập trang này. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>');
  }

  function needLoginNode(msg){
    var d = el("div","wip");
    d.innerHTML='<div class="ic">🔐</div><h3>Yêu cầu đăng nhập</h3>'+
      '<p>'+(msg||"Vui lòng đăng nhập để tiếp tục.")+'</p>'+
      '<button class="btn" style="margin-top:16px" id="needLoginBtn">Đăng nhập ngay</button>';
    setTimeout(function(){
      var b = document.getElementById("needLoginBtn");
      if(b) b.addEventListener("click", openLoginModal);
    }, 0);
    return d;
  }

  /* =========================================================
     RENDER: TRANG TỔNG QUAN (dashboard có thẻ điều hướng)
     ========================================================= */
  function renderDashboard(){
    seedUsers();
    var u = currentUser();

    var wrap = el("div");

    var greeting;
    if(u){
      greeting = 'Xin chào <b>'+esc(u.fullname||u.username)+'</b> — Bảng điều khiển hệ thống Quản lý HSE.';
    } else {
      greeting = 'Bảng điều khiển hệ thống Quản lý HSE · <a href="#" id="dashLoginLink" style="color:var(--brand);font-weight:600">Đăng nhập</a> để thao tác và nhập liệu.';
    }

    wrap.appendChild(el("div","",
      '<div class="page-title">📊 Tổng quan</div>'+
      '<div class="page-desc" style="margin-bottom:4px">'+greeting+'</div>'+
      '<div style="font-size:12px;color:var(--text-muted);margin-bottom:20px">'+ORG+' · '+ORG_PARENT+'</div>'));

    var stats = el("div","grid grid-stat");
    stats.innerHTML=
      '<div class="card stat green"><span class="lbl">Số giờ làm việc an toàn</span><span class="val">—</span><span class="meta">Đang xây dựng</span></div>'+
      '<div class="card stat red"><span class="lbl">Tai nạn / sự cố gần nhất</span><span class="val">—</span><span class="meta">Đang xây dựng</span></div>'+
      '<div class="card stat amber"><span class="lbl">Kiểm tra chờ khắc phục</span><span class="val">—</span><span class="meta">Đang xây dựng</span></div>'+
      '<div class="card stat"><span class="lbl">Huấn luyện trong tháng</span><span class="val">—</span><span class="meta">Đang xây dựng</span></div>';
    wrap.appendChild(stats);

    wrap.appendChild(el("div","section-h","Truy cập nhanh các phân hệ"));
    var grid = el("div","grid grid-mod");
    MENU.forEach(function(item){
      if(item.slug==="tong-quan") return;
      if(item.adminOnly && !isAdmin(u)) return;
      var allowed = canView(u, item.slug);
      var card = el("div","card mod-card"+(allowed?"":" locked"),
        '<div class="mic">'+item.icon+'</div>'+
        '<h3>'+esc(item.title)+'</h3>'+
        '<p>'+(allowed?(item.sub.length?item.sub.length+" mục chức năng":"Đang xây dựng"):"🔒 Chưa được cấp quyền")+'</p>');
      if(allowed) card.addEventListener("click",function(){ location.href=item.slug+".html"; });
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    renderShell("tong-quan", wrap);

    var dl = document.getElementById("dashLoginLink");
    if(dl){ dl.addEventListener("click", function(e){ e.preventDefault(); openLoginModal(); }); }
  }

  /* =========================================================
     RENDER: QUẢN TRỊ HỆ THỐNG (quản lý user + phân quyền)
     ========================================================= */
  function renderAdmin(container){
    container.innerHTML="";
    container.appendChild(el("div","",
      '<div class="page-title">🛡️ Quản trị hệ thống</div>'+
      '<div class="page-desc">Quản lý người dùng, vai trò và phân quyền truy cập từng trang.</div>'));

    var bar = el("div","toolbar");
    bar.innerHTML='<button class="btn btn-accent" id="addU">＋ Thêm người dùng</button>'+
      '<div class="muted">Vai trò: <b>Admin</b> toàn quyền · <b>User</b> thao tác theo phân quyền · <b>Viewer</b> chỉ xem.</div>'+
      '<div class="spacer"></div><input class="inp" id="q" placeholder="Tìm theo tên / tài khoản...">';
    container.appendChild(bar);

    var tw = el("div","table-wrap"); var tbl = el("table"); tbl.id="utbl"; tw.appendChild(tbl); container.appendChild(tw);

    var modal = buildModal(); container.appendChild(modal.bg);

    function draw(filter){
      var u = getUsers(); var me = currentUser();
      var rows = u.filter(function(x){
        if(!filter) return true; var f=filter.toLowerCase();
        return (x.username+" "+(x.fullname||"")).toLowerCase().indexOf(f)!==-1;
      });
      var nMod = MENU.length;
      var html='<thead><tr><th>Tài khoản</th><th>Danh số</th><th>Họ tên</th><th>Vai trò</th><th>Trang được phép sửa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>';
      rows.forEach(function(x){
        var permCount = x.role==="admin" ? nMod : (x.perms||[]).length;
        var isPending = x.pendingApproval && x.active===false;
        var statusHtml = isPending
          ? '<span class="badge" style="background:#fef9e7;color:#856404;">⏳ Chờ duyệt</span>'
          : (x.active===false
            ? '<span class="badge badge-viewer">Đã khoá</span>'
            : '<span class="badge badge-user">Hoạt động</span>');
        html+='<tr>'+
          '<td><b>'+esc(x.username)+'</b></td>'+
          '<td style="color:var(--text-muted);font-size:12.5px;">'+(x.danhSo||'—')+'</td>'+
          '<td>'+esc(x.fullname||"")+'</td>'+
          '<td><span class="badge badge-'+x.role+'">'+roleLabel(x.role)+'</span></td>'+
          '<td>'+permCount+' / '+nMod+'</td>'+
          '<td>'+statusHtml+'</td>'+
          '<td>'+
            '<button class="btn btn-ghost btn-sm" data-act="edit" data-u="'+esc(x.username)+'">'+(isPending?'✅ Duyệt / Sửa':'Sửa')+'</button> '+
            (!isPending?'<button class="btn btn-ghost btn-sm" data-act="lock" data-u="'+esc(x.username)+'">'+(x.active===false?"Mở khoá":"Khoá")+'</button> ':'')+
            '<button class="btn btn-danger btn-sm" data-act="del" data-u="'+esc(x.username)+'"'+(x.username===me.username?' disabled':'')+'>Xoá</button>'+
          '</td></tr>';
      });
      if(!rows.length) html+='<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Không có người dùng phù hợp.</td></tr>';
      html+='</tbody>';
      tbl.innerHTML=html;

      Array.prototype.forEach.call(tbl.querySelectorAll("button[data-act]"), function(b){
        b.addEventListener("click", function(){
          var un=b.getAttribute("data-u"), act=b.getAttribute("data-act");
          if(act==="edit") modal.open(findUser(un));
          else if(act==="del") delUser(un);
          else if(act==="lock") lockUser(un);
        });
      });
    }

    function delUser(un){
      if(un===currentUser().username){ alert("Không thể xoá tài khoản đang đăng nhập."); return; }
      if(!confirm("Xoá người dùng \""+un+"\"?")) return;
      setUsers(getUsers().filter(function(x){return x.username!==un;}));
      draw($("#q").value);
    }
    function lockUser(un){
      var u=getUsers(); u.forEach(function(x){ if(x.username===un){ if(un===currentUser().username && x.active!==false){ alert("Không thể khoá tài khoản đang đăng nhập."); return; } x.active = x.active===false; } });
      setUsers(u); draw($("#q").value);
    }

    modal.onSave=function(data, originalUsername){
      var u=getUsers();
      if(originalUsername){
        for(var i=0;i<u.length;i++){
          if(u[i].username===originalUsername){
            u[i].fullname=data.fullname;
            u[i].danhSo=data.danhSo||"";
            u[i].role=data.role;
            u[i].perms=data.perms;
            u[i].updated=new Date().toISOString();
            if(data.password){ u[i].password=data.password; }
            if(data.approve){ u[i].active=true; u[i].pendingApproval=false; }
          }
        }
      } else {
        if(findUser(data.username)){ alert("Email này đã được sử dụng."); return false; }
        u.push({ id:Date.now().toString(36), username:data.username,
          password:data.password, fullname:data.fullname,
          danhSo:data.danhSo||"", role:data.role, perms:data.perms,
          active:true, created:new Date().toISOString() });
      }
      setUsers(u); draw($("#q").value); return true;
    };

    $("#addU").addEventListener("click", function(){ modal.open(null); });
    $("#q").addEventListener("input", function(){ draw(this.value); });
    draw("");

    // Phần cài đặt kết nối Google Sheets DB
    var dbSection = el("div");
    container.appendChild(dbSection);
    renderDBSettings(dbSection);
  }

  function buildModal(){
    var bg = el("div","modal-bg");
    bg.innerHTML=
      '<div class="modal"><div class="modal-h"><h3 id="mt">Người dùng</h3><button class="x" id="mx">×</button></div>'+
      '<div class="modal-b">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'+
          '<div class="field"><label>Email</label><input class="inp" id="m_un" type="text" style="width:100%" placeholder="VD: sonlhh.sd"></div>'+
          '<div class="field"><label>Danh số</label><input class="inp" id="m_ds" style="width:100%" placeholder="VD: 21398"></div>'+
        '</div>'+
        '<div class="field"><label>Họ và tên</label><input class="inp" id="m_fn" style="width:100%"></div>'+
        '<div class="field"><label>Vai trò</label><select id="m_role" style="width:100%">'+
          '<option value="user">User — thao tác theo phân quyền</option>'+
          '<option value="admin">Admin — toàn quyền</option></select></div>'+
        '<div class="field" id="permWrap"><label>Phân quyền truy cập trang '+
          '<span class="muted">(<a href="#" id="selAll">chọn tất cả</a> · <a href="#" id="selNone">bỏ chọn</a>)</span></label>'+
          '<div class="perm-grid" id="m_perms"></div>'+
          '<div class="muted" id="adminNote" style="display:none;margin-top:6px">Admin mặc định có toàn quyền tất cả các trang.</div></div>'+
        '<div id="m_pw_wrap" style="border-top:1px solid var(--border);margin-top:14px;padding-top:14px;display:none">'+
          '<div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">🔑 Đặt mật khẩu ban đầu</div>'+
          '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">Chỉ dùng khi tạo tài khoản mới. Người dùng tự đổi mật khẩu qua hồ sơ cá nhân.</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'+
            '<div class="field"><label>Mật khẩu <span style="color:var(--danger)">*</span></label><input class="inp" id="m_pw" type="password" style="width:100%" placeholder="Tối thiểu 6 ký tự"></div>'+
            '<div class="field"><label>Xác nhận mật khẩu</label><input class="inp" id="m_pw2" type="password" style="width:100%" placeholder="Nhập lại mật khẩu"></div>'+
          '</div>'+
        '</div>'+
        '<div id="m_approve_wrap" style="display:none;background:#fef9e7;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-top:12px;">'+
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">'+
            '<input type="checkbox" id="m_approve" style="width:16px;height:16px;accent-color:var(--brand);">'+
            '<span>✅ Phê duyệt & kích hoạt tài khoản này</span>'+
          '</label>'+
        '</div>'+
      '</div>'+
      '<div class="modal-f"><button class="btn btn-ghost" id="mc">Huỷ</button><button class="btn btn-accent" id="ms">Lưu</button></div></div>';

    var permBox = $("#m_perms",bg);
    MENU.forEach(function(item){
      if(item.adminOnly) return;
      var lab = el("label","perm-item");
      lab.innerHTML='<input type="checkbox" value="'+item.slug+'"><span>'+item.icon+' '+esc(item.title)+'</span>';
      permBox.appendChild(lab);
    });

    var editing = null;
    function setPerms(arr){ Array.prototype.forEach.call(permBox.querySelectorAll("input"), function(c){ c.checked=arr.indexOf(c.value)!==-1; }); }
    function getPerms(){ var a=[]; Array.prototype.forEach.call(permBox.querySelectorAll("input:checked"), function(c){ a.push(c.value); }); return a; }
    function toggleRoleUI(){
      var isAdm = $("#m_role",bg).value==="admin";
      $("#m_perms",bg).style.display=isAdm?"none":"grid";
      $("#adminNote",bg).style.display=isAdm?"block":"none";
    }

    var api = { bg:bg, onSave:null };
    api.open=function(user){
      editing=user;
      $("#mt",bg).textContent=user?"Phân quyền người dùng":"Thêm người dùng mới";
      $("#m_un",bg).value=user?user.username:"";
      $("#m_un",bg).disabled=!!user;
      $("#m_fn",bg).value=user?(user.fullname||""):"";
      $("#m_ds",bg).value=user?(user.danhSo||""):"";
      $("#m_pw",bg).value="";
      $("#m_pw2",bg).value="";
      // Chỉ hiện ô mật khẩu khi tạo mới
      var pwWrap=document.getElementById("m_pw_wrap");
      if(pwWrap) pwWrap.style.display=user?"none":"block";
      $("#m_role",bg).value=user?user.role:"user";
      setPerms(user?(user.role==="admin"?[]:(user.perms||[])):[]);
      toggleRoleUI();
      // Hiện ô phê duyệt nếu tài khoản đang chờ
      var approveWrap=document.getElementById("m_approve_wrap");
      var approveChk=document.getElementById("m_approve");
      if(user && user.pendingApproval && !user.active){
        approveWrap.style.display="block";
        approveChk.checked=false;
        // Fix 5: gợi ý phân quyền mặc định khi duyệt (chọn sẵn các trang cơ bản)
        var defaultPerms=["tong-quan","pccc-cnch","cap-phat-bhld","huan-luyen-dao-tao",
          "ung-pho-khan-cap","jsa","sop","kiem-tra-cac-cap","quan-ly-thiet-bi",
          "kham-suc-khoe","an-toan-dien","an-toan-giao-thong","moi-truong",
          "quan-ly-hoa-chat","quan-ly-nha-thau","ke-hoach","bao-cao"];
        if(!(user.perms && user.perms.length)) setPerms(defaultPerms);
      } else { approveWrap.style.display="none"; }
      bg.classList.add("open");
    };
    function close(){ bg.classList.remove("open"); }
    $("#mx",bg).addEventListener("click",close);
    $("#mc",bg).addEventListener("click",close);
    $("#m_role",bg).addEventListener("change",toggleRoleUI);
    $("#selAll",bg).addEventListener("click",function(e){e.preventDefault(); setPerms(allSlugs());});
    $("#selNone",bg).addEventListener("click",function(e){e.preventDefault(); setPerms([]);});
    bg.addEventListener("click",function(e){ if(e.target===bg) close(); });
    $("#ms",bg).addEventListener("click",function(){
      var un=$("#m_un",bg).value.trim();
      var fn=$("#m_fn",bg).value.trim();
      var ds=$("#m_ds",bg).value.trim();
      var role=$("#m_role",bg).value;
      var pw=$("#m_pw",bg).value;
      var pw2=$("#m_pw2",bg).value;
      if(!editing && !un){ alert("Vui lòng nhập tên đăng nhập."); return; }
      if(!fn){ alert("Vui lòng nhập họ tên."); return; }
      // Fix 3: bắt buộc nhập mật khẩu khi tạo mới
      if(!editing && !pw){ alert("Vui lòng nhập mật khẩu cho tài khoản mới."); return; }
      if(pw && pw.length<6){ alert("Mật khẩu phải có tối thiểu 6 ký tự."); return; }
      if(pw && pw!==pw2){ alert("Mật khẩu xác nhận không khớp."); return; }
      var perms = role==="admin" ? allSlugs() : getPerms();
      var approve = document.getElementById("m_approve") && document.getElementById("m_approve").checked;
      var saveBtn=document.getElementById("ms"); if(saveBtn){saveBtn.disabled=true;saveBtn.textContent="Đang lưu...";}
      function doSave(hashedPw){
        var data={username:un, fullname:fn, danhSo:ds, role:role, perms:perms, password:hashedPw, pwHash:!!hashedPw, approve:approve};
        var ok=api.onSave && api.onSave(data, editing?editing.username:null);
        if(saveBtn){saveBtn.disabled=false;saveBtn.textContent="Lưu";}
        if(ok!==false) close();
      }
      // Fix 4: hash nếu có mật khẩu mới
      if(pw){ hashPw(pw).then(doSave); } else { doSave(null); }
    });
    return api;
  }

  /* -------- ĐỔI MẬT KHẨU (dùng cho cả admin & user) -------- */
  function openDoiMatKhau(){
    var existing = document.getElementById("hse-doi-mk-modal");
    if(existing) { existing.classList.add("open"); return; }

    var bg = el("div","modal-bg"); bg.id="hse-doi-mk-modal";
    bg.innerHTML=
      '<div class="modal" style="max-width:420px;">'+
        '<div class="modal-h"><h3>🔑 Đổi mật khẩu</h3><button class="x" id="dmk-close">×</button></div>'+
        '<div class="modal-b">'+
          '<div class="login-err" id="dmk-err"></div>'+
          '<div id="dmk-ok" style="display:none;background:#eafaf1;color:#1a7a3c;border:1px solid #a9dfbf;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:12px;"></div>'+
          '<div class="field"><label>Mật khẩu hiện tại</label><input class="inp" id="dmk-cur" type="password" style="width:100%" placeholder="Nhập mật khẩu hiện tại"></div>'+
          '<div class="field"><label>Mật khẩu mới</label><input class="inp" id="dmk-new" type="password" style="width:100%" placeholder="Tối thiểu 6 ký tự"></div>'+
          '<div class="field"><label>Xác nhận mật khẩu mới</label><input class="inp" id="dmk-new2" type="password" style="width:100%" placeholder="Nhập lại mật khẩu mới"></div>'+
        '</div>'+
        '<div class="modal-f">'+
          '<button class="btn btn-ghost" id="dmk-cancel">Huỷ</button>'+
          '<button class="btn btn-accent" id="dmk-save">💾 Cập nhật</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(bg);

    function close(){
      bg.classList.remove("open");
      document.getElementById("dmk-cur").value="";
      document.getElementById("dmk-new").value="";
      document.getElementById("dmk-new2").value="";
      document.getElementById("dmk-err").style.display="none";
      document.getElementById("dmk-ok").style.display="none";
    }
    function showErr(msg){ var e=document.getElementById("dmk-err"); e.textContent=msg; e.style.display="block"; document.getElementById("dmk-ok").style.display="none"; }
    function showOk(msg){ var e=document.getElementById("dmk-ok"); e.textContent=msg; e.style.display="block"; document.getElementById("dmk-err").style.display="none"; }

    document.getElementById("dmk-close").addEventListener("click", close);
    document.getElementById("dmk-cancel").addEventListener("click", close);
    bg.addEventListener("click", function(e){ if(e.target===bg) close(); });
    document.getElementById("dmk-save").addEventListener("click", function(){
      var cur=document.getElementById("dmk-cur").value;
      var nw=document.getElementById("dmk-new").value;
      var nw2=document.getElementById("dmk-new2").value;
      var me=currentUser();
      if(!me){ showErr("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại."); return; }
      if(!cur){ showErr("Vui lòng nhập mật khẩu hiện tại."); return; }
      if(!nw||nw.length<6){ showErr("Mật khẩu mới phải có tối thiểu 6 ký tự."); return; }
      if(nw!==nw2){ showErr("Mật khẩu xác nhận không khớp."); return; }
      if(nw===cur){ showErr("Mật khẩu mới phải khác mật khẩu hiện tại."); return; }
      var saveBtn=document.getElementById("dmk-save");
      saveBtn.disabled=true;
      // Kiểm tra mật khẩu hiện tại (hỗ trợ cả hash lẫn plaintext)
      hashPw(cur).then(function(curHash){
        var isOk = isHashed(me.password) ? (me.password===curHash) : (me.password===cur);
        if(!isOk){ showErr("Mật khẩu hiện tại không đúng."); saveBtn.disabled=false; return; }
        return hashPw(nw);
      }).then(function(newHash){
        if(!newHash) return;
        var u=getUsers();
        for(var i=0;i<u.length;i++){
          if(u[i].username===me.username){ u[i].password=newHash; u[i].updated=new Date().toISOString(); break; }
        }
        setUsers(u);
        saveBtn.disabled=false;
        showOk("✅ Đổi mật khẩu thành công!");
        document.getElementById("dmk-cur").value="";
        document.getElementById("dmk-new").value="";
        document.getElementById("dmk-new2").value="";
      });
    });

    bg.classList.add("open");
    setTimeout(function(){ document.getElementById("dmk-cur").focus(); }, 80);
  }

  /* -------- HỒ SƠ CÁ NHÂN -------- */
  function openEditProfile(){
    var me=currentUser();
    if(!me) return;
    var existing=document.getElementById("hse-profile-modal");
    if(existing){ existing.classList.add("open"); return; }
    var bg=el("div","modal-bg"); bg.id="hse-profile-modal";
    bg.innerHTML=
      '<div class="modal" style="max-width:440px;">'+
        '<div class="modal-h"><h3>👤 Hồ sơ cá nhân</h3><button class="x" id="pf-close">×</button></div>'+
        '<div class="modal-b">'+
          '<div id="pf-ok" style="display:none;background:#eafaf1;color:#1a7a3c;border:1px solid #a9dfbf;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:12px;"></div>'+
          '<div id="pf-err" style="display:none;background:#fdedec;color:#c0392b;border:1px solid #f1948a;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:12px;"></div>'+
          '<div class="field"><label>Tên đăng nhập</label>'+
            '<input class="inp" id="pf-un" disabled style="width:100%;background:#f8f9fd;color:var(--text-muted)">'+
          '</div>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
            '<div class="field"><label>Họ và tên <span style="color:var(--danger)">*</span></label>'+
              '<input class="inp" id="pf-fn" style="width:100%" placeholder="Nguyễn Văn A">'+
            '</div>'+
            '<div class="field"><label>Danh số</label>'+
              '<input class="inp" id="pf-ds" style="width:100%" placeholder="VD: 21398">'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div class="modal-f"><button class="btn btn-ghost" id="pf-cancel">Huỷ</button><button class="btn btn-accent" id="pf-save">💾 Lưu thông tin</button></div>'+
      '</div>';
    document.body.appendChild(bg);
    function close(){ bg.classList.remove("open"); }
    document.getElementById("pf-close").addEventListener("click",close);
    document.getElementById("pf-cancel").addEventListener("click",close);
    bg.addEventListener("click",function(e){ if(e.target===bg) close(); });
    document.getElementById("pf-save").addEventListener("click",function(){
      var fn=(document.getElementById("pf-fn").value||"").trim();
      var ds=(document.getElementById("pf-ds").value||"").trim();
      var errEl=document.getElementById("pf-err");
      var okEl=document.getElementById("pf-ok");
      errEl.style.display="none"; okEl.style.display="none";
      if(!fn){ errEl.textContent="Vui lòng nhập họ và tên."; errEl.style.display="block"; return; }
      var users=getUsers(); var me2=currentUser();
      for(var i=0;i<users.length;i++){
        if(users[i].username===me2.username){ users[i].fullname=fn; users[i].danhSo=ds; users[i].updated=new Date().toISOString(); break; }
      }
      setUsers(users);
      okEl.textContent="✅ Đã cập nhật thông tin thành công!"; okEl.style.display="block";
      setTimeout(function(){ location.reload(); },1200);
    });
    bg.classList.add("open");
    var me2=currentUser();
    document.getElementById("pf-un").value=me2.username;
    document.getElementById("pf-fn").value=me2.fullname||"";
    document.getElementById("pf-ds").value=me2.danhSo||"";
    setTimeout(function(){ document.getElementById("pf-fn").focus(); },80);
  }

  /* -------- PHẦN CÀI ĐẶT DB (hiển thị trong trang Quản trị) -------- */
  function renderDBSettings(container) {
    if(!container) return;
    var dbReady = typeof DB !== "undefined" && DB.isReady();
    var currentUrl = dbReady ? localStorage.getItem("hse_db_url") || "" : "";
    container.innerHTML =
      '<div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">' +
        '<h3 style="font-size:15px;font-weight:700;color:var(--brand);margin-bottom:6px;">☁️ Kết nối Google Sheets Database</h3>' +
        '<p style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px;">Dán URL Apps Script Web App vào đây. Dữ liệu sẽ được lưu lên Google Sheets và đồng bộ giữa các máy.</p>' +
        '<div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
          '<input id="hse-db-url" class="inp" style="flex:1;min-width:300px;font-size:12.5px;" ' +
            'placeholder="https://script.google.com/macros/s/.../exec" value="' + esc(currentUrl) + '">' +
          '<button class="btn btn-accent btn-sm" id="hse-db-save">💾 Lưu URL</button>' +
          '<button class="btn btn-ghost btn-sm" id="hse-db-test">🔍 Kiểm tra kết nối</button>' +
          '<button class="btn btn-ghost btn-sm" id="hse-db-sync">🔄 Sync Users</button>' +
        '</div>' +
        '<div id="hse-db-status" style="font-size:12.5px;padding:8px 12px;border-radius:6px;display:none;"></div>' +
      '</div>';

    var urlInput = document.getElementById("hse-db-url");
    var statusEl = document.getElementById("hse-db-status");

    function showStatus(msg, ok) {
      statusEl.style.display = "block";
      statusEl.style.background = ok ? "#eafaf1" : "#fdedec";
      statusEl.style.color = ok ? "#1a7a3c" : "#c0392b";
      statusEl.style.border = "1px solid " + (ok ? "#a9dfbf" : "#f1948a");
      statusEl.textContent = msg;
    }

    document.getElementById("hse-db-save").onclick = function() {
      var url = urlInput.value.trim();
      if(typeof DB === "undefined") { showStatus("❌ db.js chưa được tải.", false); return; }
      DB.init(url);
      showStatus(url ? "✅ Đã lưu URL thành công!" : "⚠️ Đã xóa URL (chế độ offline).", !!url);
    };

    document.getElementById("hse-db-test").onclick = function() {
      if(typeof DB === "undefined" || !DB.isReady()) { showStatus("❌ Chưa nhập URL.", false); return; }
      showStatus("⏳ Đang kiểm tra...", true);
      DB.testConnection().then(function(r) {
        showStatus("✅ Kết nối OK — " + r.count + " sheets: " + r.sheets.slice(0,5).join(", ") + "...", true);
      }).catch(function(e) {
        showStatus("❌ Lỗi: " + e.message, false);
      });
    };

    document.getElementById("hse-db-sync").onclick = function() {
      if(typeof DB === "undefined" || !DB.isReady()) { showStatus("❌ Chưa kết nối Sheets.", false); return; }
      var users = getUsers();
      if(!users.length) { showStatus("⚠️ Không có tài khoản nào để đẩy lên.", false); return; }
      showStatus("⏳ Đang đẩy " + users.length + " tài khoản lên Sheets...", true);
      DB.bulkWrite("users", users).then(function() {
        showStatus("✅ Đã đẩy " + users.length + " tài khoản lên Sheets thành công!", true);
      }).catch(function(e) {
        showStatus("❌ Lỗi: " + e.message, false);
      });
    };
  }

  /* =========================================================
     WIDGET: KẾ HOẠCH THÁNG NÀY
     Đọc hse_ke_hoach_links, lọc theo slug + tháng hiện tại
     ========================================================= */
  function renderKeHoachWidget(slug, wrap){
    var now = new Date();
    var curMonth = now.getMonth() + 1;   // 1–12
    var curYear  = now.getFullYear();

    var allLinks = load("hse_ke_hoach_links", {});
    var tasks = (allLinks[slug] || []).filter(function(t){
      if(t.type === "oncetime"){
        // Nằm trong khoảng start–end mà khoảng đó giao với tháng hiện tại
        var inRange = true;
        if(t.start){
          var s = new Date(t.start);
          // last day of current month
          var lastOfMonth = new Date(curYear, curMonth, 0);
          if(s > lastOfMonth) inRange = false;
        }
        if(t.end){
          var e = new Date(t.end);
          // first day of current month
          var firstOfMonth = new Date(curYear, curMonth - 1, 1);
          if(e < firstOfMonth) inRange = false;
        }
        return inRange;
      } else {
        // recurring: allMonths hoặc tháng hiện tại nằm trong months[]
        if(t.allMonths) return true;
        return (t.months||[]).indexOf(curMonth) >= 0;
      }
    });

    var monthLabel = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                      "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"][curMonth-1]
                     + "/" + curYear;

    var section = el("div");
    section.innerHTML =
      '<div class="section-h" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'+
        '<span>📋 Kế hoạch ' + monthLabel + '</span>'+
        '<a href="ke-hoach.html" style="font-size:12px;color:var(--brand);font-weight:600;text-decoration:none">→ Xem & quản lý kế hoạch</a>'+
      '</div>';

    if(!tasks.length){
      section.innerHTML +=
        '<div style="background:#fff;border-radius:10px;padding:20px 18px;box-shadow:0 2px 8px rgba(0,0,0,0.06);'+
          'color:var(--text-muted);font-size:13px;text-align:center;">'+
          '✅ Không có công việc kế hoạch nào trong ' + monthLabel + '.'+
        '</div>';
    } else {
      var rows = tasks.map(function(t, i){
        var typeBadge = t.type === "oncetime"
          ? '<span style="background:#dceaf7;color:#003087;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">Một lần</span>'
          : '<span style="background:#eafaf1;color:#1a7a3c;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">Lặp lại</span>';
        var ngayTH = "";
        if(t.type === "oncetime"){
          var parts = [];
          if(t.start) parts.push(t.start.split("-").reverse().join("/"));
          if(t.end)   parts.push(t.end.split("-").reverse().join("/"));
          ngayTH = parts.join(" – ") || "—";
        } else {
          ngayTH = t.lastDay ? "Cuối tháng" : (t.execDay ? "Ngày " + t.execDay : "—");
        }
        var ph = Array.isArray(t.phoiHop) ? t.phoiHop.join(", ") : (t.phoiHop || "—");
        return '<tr>'+
          '<td style="color:var(--text-muted);font-size:12px;width:30px">'+(i+1)+'</td>'+
          '<td style="font-weight:600">'+ esc(t.name) +'</td>'+
          '<td>'+ typeBadge +'</td>'+
          '<td style="white-space:nowrap;font-size:12.5px">'+ esc(ngayTH) +'</td>'+
          '<td style="font-size:12.5px">'+ esc(t.chuTri||"—") +'</td>'+
          '<td style="font-size:12.5px">'+ esc(ph) +'</td>'+
          '<td style="font-size:12px;color:var(--text-muted)">'+ esc(t.coSo||"—") +'</td>'+
          '<td style="font-size:12px;color:var(--text-muted)">'+ esc(t.ghiChu||"—") +'</td>'+
          '</tr>';
      }).join("");

      section.innerHTML +=
        '<div style="background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.07);overflow:auto">'+
          '<table style="width:100%;border-collapse:collapse">'+
            '<thead>'+
              '<tr>'+
                '<th style="background:#dde6f3;color:#003087;padding:9px 12px;font-size:12.5px;text-align:left;width:30px">#</th>'+
                '<th style="background:#dde6f3;color:#003087;padding:9px 12px;font-size:12.5px;text-align:left">Nội dung công việc</th>'+
                '<th style="background:#dde6f3;color:#003087;padding:9px 12px;font-size:12.5px;text-align:left">Loại</th>'+
                '<th style="background:#dde6f3;color:#003087;padding:9px 12px;font-size:12.5px;text-align:left">Ngày thực hiện</th>'+
                '<th style="background:#dde6f3;color:#003087;padding:9px 12px;font-size:12.5px;text-align:left">Đơn vị chủ trì</th>'+
                '<th style="background:#dde6f3;color:#003087;padding:9px 12px;font-size:12.5px;text-align:left">Đơn vị phối hợp</th>'+
                '<th style="background:#dde6f3;color:#003087;padding:9px 12px;font-size:12.5px;text-align:left">Cơ sở</th>'+
                '<th style="background:#dde6f3;color:#003087;padding:9px 12px;font-size:12.5px;text-align:left">Ghi chú</th>'+
              '</tr>'+
            '</thead>'+
            '<tbody>'+ rows +'</tbody>'+
          '</table>'+
        '</div>';
    }

    wrap.appendChild(section);
  }

  /* -------- XUẤT API -------- */
  global.HSE = {
    MENU: MENU,
    renderPage: renderPage,
    renderDashboard: renderDashboard,
    currentUser: currentUser,
    logout: logout,
    renderDBSettings: renderDBSettings,
    DB: typeof DB !== "undefined" ? DB : null
  };

  /* -------- KHỞI ĐỘNG DB -------- */
  seedUsers();
  initDB();

})(window);
