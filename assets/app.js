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
    { slug:"sop",                title:"SOP",                         icon:"📑", sub:[], adminEditOnly:true },
    { slug:"kiem-tra-cac-cap",   title:"Kiểm tra các cấp",            icon:"🔍", sub:["Số lượng kiểm tra các cấp","Ghi nhận các lỗi vào hệ thống","Ghi nhận hành động khắc phục, thời hạn"] },
    { slug:"quan-ly-thiet-bi",   title:"Quản lý thiết bị",            icon:"⚙️", sub:["Thiết bị nâng","Bình áp lực"] },
    { slug:"kham-suc-khoe",      title:"Khám sức khoẻ nghề nghiệp",   icon:"🩺", sub:["Theo dõi khám sức khoẻ nghề nghiệp","Theo dõi khám bệnh nghề nghiệp"] },
    { slug:"moi-truong",         title:"Môi trường",                  icon:"🌿", sub:["Thống kê khối lượng rác thải xử lý"] },
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
  function sheetDateToLocal(s){ if(!s||typeof s!=="string"||s.indexOf("T")<0) return s; var d=new Date(s); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
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
    // (đủ để đồng bộ — không cần auto-sync định kỳ, tránh ghi đè tài khoản mới)
    setTimeout(function(){
      DB.syncUsersFromSheets(K_USERS);
    }, 2000);
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
    // Sheet sync được thực hiện riêng tại từng thao tác qua _syncUserSheet()
    // thay vì bulkWrite toàn bộ danh sách ở đây
  }

  // Đồng bộ 1 user lên Sheet theo đúng loại thao tác: 'insert' | 'update' | 'delete'
  // insert: userOrId là object user mới
  // update: userOrId là object user đầy đủ (cần có .id)
  // delete: userOrId là id string
  function _syncUserSheet(action, userOrId){
    if(typeof DB === "undefined" || !DB.isReady()) return;
    var p;
    if(action === 'insert')      p = DB.insert("users", userOrId);
    else if(action === 'update') p = DB.update("users", userOrId.id, userOrId);
    else if(action === 'delete') p = DB.delete("users", userOrId);
    if(p) p.then(function(){
      showToast("☁️ Đã đồng bộ tài khoản lên Sheets!", "success");
    }).catch(function(e){
      showToast("⚠️ Lưu local OK nhưng chưa sync Sheets: " + (e && e.message || e), "warning");
    });
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
    // Trang chỉ admin được chỉnh sửa
    var m = menuBySlug(slug);
    if(m && m.adminEditOnly) return false;
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
        var newUser={ id:Date.now().toString(36), username:un, password:hashed, fullname:fn, danhSo:ds,
          role:"viewer", perms:[], active:false, pendingApproval:true, created:new Date().toISOString() };
        u.push(newUser);
        setUsers(u);
        _syncUserSheet('insert', newUser);
        document.getElementById("hse-reg-panel").innerHTML=
          '<div style="text-align:center;padding:24px 0;">'+
            '<div style="font-size:40px;margin-bottom:12px;">✅</div>'+
            '<div style="font-size:14px;font-weight:700;color:var(--brand);margin-bottom:8px;">Đăng ký thành công!</div>'+
            '<div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Tài khoản <b>'+esc(un)+'</b> đã được tạo và đang chờ Admin phê duyệt.</div>'+
            '<button class="btn" onclick="document.getElementById(\'hse-login-modal\').classList.remove(\'open\')">Đóng</button>'+
          '</div>';
      }).catch(function(e){
        if(regBtn){regBtn.disabled=false;regBtn.textContent="Gửi đăng ký";}
        alert("❌ Đăng ký thất bại, vui lòng thử lại.\n(" + (e && e.message || "Lỗi kết nối") + ")");
      });
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
    if(activeSlug==="tong-quan"){
      side.appendChild(el("div","sidebar-head",
        '<div class="logo"><img src="assets/logo.svg" alt="Vietsovpetro"></div>'+
        '<div><div class="t1">'+APP_NAME+'</div>'+
        '<div class="t2">'+ORG_SHORT+'</div>'+
        '<div class="t2">'+ORG_PARENT+'</div></div>'));
    }
    var nav = el("nav","nav"); nav.style.paddingTop = activeSlug==="tong-quan" ? "" : "8px";
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
      var roleColor = u.role==="admin" ? "#C8102E" : u.role==="viewer" ? "#6b7c93" : "#1a7a3c";
      userBoxHtml=
        '<div class="user-box" style="position:relative;display:flex;align-items:center;gap:8px;">'+
          pendingBadge+
          '<button id="btn-profile"'+
            ' style="display:flex;align-items:center;gap:7px;background:rgba(255,255,255,0.15);'+
            'border:1.5px solid rgba(255,255,255,0.3);color:#fff;padding:5px 12px;border-radius:7px;'+
            'cursor:pointer;font-size:12.5px;transition:.15s;"'+
            ' onmouseover="this.style.background=\'rgba(255,255,255,0.25)\'"'+
            ' onmouseout="this.style.background=\'rgba(255,255,255,0.15)\'">'+
            '<span style="font-size:14px;">👤</span>'+
            '<span style="font-weight:600;">'+esc(u.fullname||u.username)+'</span>'+
            '<span style="background:'+roleColor+';color:#fff;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:700;">'+roleLabel(u.role)+'</span>'+
          '</button>'+
          '<button id="lo"'+
            ' style="background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.3);'+
            'color:#fff;padding:5px 14px;border-radius:7px;cursor:pointer;font-size:12.5px;font-weight:600;transition:.15s;"'+
            ' onmouseover="this.style.background=\'rgba(255,255,255,0.25)\'"'+
            ' onmouseout="this.style.background=\'rgba(255,255,255,0.15)\'">'+
            'Đăng xuất'+
          '</button>'+
          '<div id="profile-dropdown" style="display:none;position:absolute;right:0;top:calc(100% + 6px);background:#fff;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.14);min-width:220px;z-index:200;border:1px solid var(--border);overflow:hidden;">'+
            '<div style="padding:14px 16px;border-bottom:1px solid var(--border);background:#f8f9fd;">'+
              '<div style="font-weight:700;font-size:13.5px;color:var(--text);">'+esc(u.fullname||u.username)+'</div>'+
              '<div style="font-size:12px;color:var(--text-muted);">'+esc(u.username)+' · '+roleLabel(u.role)+'</div>'+
            '</div>'+
            '<button id="btn-edit-profile" style="width:100%;text-align:left;padding:10px 16px;border:none;background:none;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;transition:background .12s;" onmouseover="this.style.background=\'#f0f3fa\'" onmouseout="this.style.background=\'transparent\'">'+
              '👤 Chỉnh sửa hồ sơ cá nhân'+
            '</button>'+
            '<button id="btn-doi-mk" style="width:100%;text-align:left;padding:10px 16px;border:none;background:none;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;transition:background .12s;" onmouseover="this.style.background=\'#f0f3fa\'" onmouseout="this.style.background=\'transparent\'">'+
              '🔑 Đổi mật khẩu'+
            '</button>'+
          '</div>'+
        '</div>';
    } else {
      userBoxHtml= activeSlug==="tong-quan"
        ? '<div class="user-box">'+
            '<span class="viewer-notice">Chế độ xem</span>'+
            '<button class="btn btn-sm btn-login-top" id="lo">🔐 Đăng nhập</button>'+
          '</div>'
        : '<div class="user-box">'+
            '<span class="viewer-notice">Chế độ xem</span>'+
          '</div>';
    }

    top.innerHTML=
      '<button class="menu-btn" id="mbtn">☰</button>'+
      '<div>'+
        '<div style="font-size:11px;opacity:.75;">'+esc(ORG_PARENT)+'</div>'+
        '<div style="font-size:13px;font-weight:700;opacity:.95;">'+esc(ORG)+'</div>'+
      '</div>'+
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
    } else if(activeSlug==="tong-quan") {
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

    // Trang SOP: custom renderer
    if(slug === "sop"){
      if(!canView(u, slug)){ renderShell(slug, deniedNode()); return; }
      var sopContainer = renderShell(slug, el("div"));
      renderSop(sopContainer, u, isAdmin(u));
      return;
    }

    // Trang huấn luyện đào tạo: custom renderer (module riêng)
    if(slug === "huan-luyen-dao-tao"){
      if(!canView(u, slug)){ renderShell(slug, deniedNode()); return; }
      var hlContainer = renderShell(slug, el("div"));
      if(typeof window.renderHuanLuyen === "function"){
        window.renderHuanLuyen(hlContainer, u, canEdit(u, slug), isAdmin(u));
      }
      return;
    }

    // Trang quản lý thiết bị: custom renderer (module riêng)
    if(slug === "quan-ly-thiet-bi"){
      if(!canView(u, slug)){ renderShell(slug, deniedNode()); return; }
      var tbContainer = renderShell(slug, el("div"));
      if(typeof window.renderQuanLyThietBi === "function"){
        window.renderQuanLyThietBi(tbContainer, u, canEdit(u, slug), isAdmin(u));
      }
      return;
    }

    // Trang quản lý nhà thầu: custom renderer (module riêng)
    if(slug === "quan-ly-nha-thau"){
      if(!canView(u, slug)){ renderShell(slug, deniedNode()); return; }
      var ntContainer = renderShell(slug, el("div"));
      if(typeof window.renderQuanLyNhaThau === "function"){
        window.renderQuanLyNhaThau(ntContainer, u, canEdit(u, slug) || isAdmin(u));
      }
      return;
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

    // Render ngay bằng data localStorage (không chờ mạng)
    renderKeHoachDashboard(wrap);
    renderShell("tong-quan", wrap);
    var dl = document.getElementById("dashLoginLink");
    if(dl){ dl.addEventListener("click", function(e){ e.preventDefault(); openLoginModal(); }); }

    // Fetch ngầm — cập nhật lại phần kế hoạch khi có data mới
    if(typeof DB !== "undefined" && DB.isReady()){
      Promise.all([
        DB.getAll("ke_hoach_mot_lan").then(function(rows){
          if(rows && rows.length){
            rows.forEach(function(r){
              r.start = sheetDateToLocal(r.start);
              r.end   = sheetDateToLocal(r.end);
              if(r.completionDate) r.completionDate = sheetDateToLocal(r.completionDate);
            });
            save("hse_ke_hoach_mot_lan", rows);
          }
        }).catch(function(e){ console.warn("[KeHoach] Pull mot_lan thất bại:", e && e.message || e); }),
        DB.getAll("ke_hoach_lap_lai").then(function(rows){
          if(rows && rows.length) save("hse_ke_hoach_lap_lai", rows);
        }).catch(function(e){ console.warn("[KeHoach] Pull lap_lai thất bại:", e && e.message || e); })
      ]).then(function(){
        // Rebuild hse_ke_hoach_links từ dữ liệu vừa pull
        var once  = load("hse_ke_hoach_mot_lan", []);
        var recur = load("hse_ke_hoach_lap_lai", []);
        var allLinks = {};
        var today = new Date(); today.setHours(0,0,0,0);
        once.forEach(function(item){
          var targetPages = (item.pages && item.pages.length) ? item.pages : ["ke-hoach"];
          targetPages.forEach(function(slug){
            if(!allLinks[slug]) allLinks[slug]=[];
            var st = item.status||"Chưa bắt đầu";
            if(st!=="Đã hoàn thành" && item.end && new Date(item.end)<today) st="Trễ hạn";
            allLinks[slug].push({ id:item.id, type:"oncetime", name:item.name,
              start:item.start, end:item.end, status:st,
              completionDate:item.completionDate||"", completionReport:item.completionReport||"",
              chuTri:item.chuTri, phoiHop:item.phoiHop, coSo:item.coSo, ghiChu:item.ghiChu });
          });
        });
        recur.forEach(function(item){
          var targetPages = (item.pages && item.pages.length) ? item.pages : ["ke-hoach"];
          targetPages.forEach(function(slug){
            if(!allLinks[slug]) allLinks[slug]=[];
            allLinks[slug].push({ id:item.id, type:"recurring", name:item.name,
              allMonths:item.allMonths, months:item.months||[],
              execDay:item.execDay, lastDay:item.lastDay,
              chuTri:item.chuTri, phoiHop:item.phoiHop, coSo:item.coSo, ghiChu:item.ghiChu });
          });
        });
        save("hse_ke_hoach_links", allLinks);
        // Chỉ cập nhật phần kế hoạch, không render lại toàn trang
        var existing = document.getElementById("dash-kh-section");
        if(existing){
          var tmp = el("div"); renderKeHoachDashboard(tmp);
          existing.parentNode.replaceChild(tmp.lastChild, existing);
        }
      }).catch(function(e){ console.warn("[Dashboard] Pull kế hoạch thất bại:", e && e.message || e); });
    }
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
      var delTarget=findUser(un);
      setUsers(getUsers().filter(function(x){return x.username!==un;}));
      if(delTarget) _syncUserSheet('delete', delTarget.id);
      draw($("#q").value);
    }
    function lockUser(un){
      var u=getUsers(); var changedUser=null;
      u.forEach(function(x){ if(x.username===un){ if(un===currentUser().username && x.active!==false){ alert("Không thể khoá tài khoản đang đăng nhập."); return; } x.active = x.active===false; changedUser=x; } });
      setUsers(u); if(changedUser) _syncUserSheet('update', changedUser); draw($("#q").value);
    }

    modal.onSave=function(data, originalUsername){
      var u=getUsers(); var sheetUser=null; var sheetAction=null;
      if(originalUsername){
        for(var i=0;i<u.length;i++){
          if(u[i].username===originalUsername){
            u[i].fullname=data.fullname;
            u[i].danhSo=data.danhSo||"";
            u[i].role=data.role;
            u[i].perms=data.perms;
            u[i].capPhatUnits=data.capPhatUnits||[];
            u[i].updated=new Date().toISOString();
            if(data.password){ u[i].password=data.password; }
            if(data.approve){ u[i].active=true; u[i].pendingApproval=false; }
            sheetUser=u[i]; sheetAction='update';
          }
        }
      } else {
        if(findUser(data.username)){ alert("Email này đã được sử dụng."); return false; }
        var newUser={ id:Date.now().toString(36), username:data.username,
          password:data.password, fullname:data.fullname,
          danhSo:data.danhSo||"", role:data.role, perms:data.perms,
          capPhatUnits:data.capPhatUnits||[],
          active:true, created:new Date().toISOString() };
        u.push(newUser);
        sheetUser=newUser; sheetAction='insert';
      }
      setUsers(u); if(sheetUser) _syncUserSheet(sheetAction, sheetUser); draw($("#q").value); return true;
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
    var CAP_PHAT_UNITS = ['Cảng biển','Căn cứ Kho - Giao nhận','Xưởng sửa chữa','Đội xe VTHH&PTTBCD','Đội xe VCHK','Bộ máy điều hành'];
    MENU.forEach(function(item){
      if(item.adminOnly) return;
      if(item.adminEditOnly) return;
      var lab = el("label","perm-item");
      lab.innerHTML='<input type="checkbox" value="'+item.slug+'"><span>'+item.icon+' '+esc(item.title)+'</span>';
      permBox.appendChild(lab);
    });

    // Sub-panel phân quyền đơn vị con cho Cấp phát BHLĐ
    var cpUnitWrap = document.createElement("div");
    cpUnitWrap.id = "cpUnitWrap";
    cpUnitWrap.style.cssText = "display:none;grid-column:1/-1;background:#f0f7ff;border:1.5px solid #b3d0f0;border-radius:8px;padding:12px 14px;margin-top:4px;";
    cpUnitWrap.innerHTML = '<div style="font-size:12px;font-weight:700;color:#003087;margin-bottom:8px;">🦺 Đơn vị được phép xem trong Cấp phát BHLĐ</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;" id="cpUnitGrid"></div>'+
      '<div style="margin-top:8px;display:flex;gap:10px;"><a href="#" id="cpSelAll" style="font-size:12px;">chọn tất cả</a> · <a href="#" id="cpSelNone" style="font-size:12px;">bỏ chọn</a></div>';
    permBox.parentNode.insertBefore(cpUnitWrap, permBox.nextSibling);
    // Dùng querySelector trên cpUnitWrap vì bg chưa được thêm vào document DOM lúc này
    var cpGrid = cpUnitWrap.querySelector("#cpUnitGrid");
    CAP_PHAT_UNITS.forEach(function(u){
      var lab = el("label","perm-item");
      lab.innerHTML='<input type="checkbox" value="'+u+'"><span>'+u+'</span>';
      cpGrid.appendChild(lab);
    });
    cpUnitWrap.querySelector("#cpSelAll").addEventListener("click",function(e){e.preventDefault();cpGrid.querySelectorAll("input").forEach(function(c){c.checked=true;});});
    cpUnitWrap.querySelector("#cpSelNone").addEventListener("click",function(e){e.preventDefault();cpGrid.querySelectorAll("input").forEach(function(c){c.checked=false;});});

    function getCapPhatUnits(){ var a=[]; cpGrid.querySelectorAll("input:checked").forEach(function(c){a.push(c.value);}); return a; }
    function setCapPhatUnits(arr){ cpGrid.querySelectorAll("input").forEach(function(c){c.checked=arr.indexOf(c.value)!==-1;}); }
    function updateCpUnitWrap(){
      var cpChk = permBox.querySelector("input[value='cap-phat-bhld']");
      var isAdm = $("#m_role",bg).value==="admin";
      cpUnitWrap.style.display = (!isAdm && cpChk && cpChk.checked) ? "block" : "none";
    }
    // Lắng nghe thay đổi trên checkbox cap-phat-bhld
    var cpChkEl = permBox.querySelector("input[value='cap-phat-bhld']");
    if(cpChkEl) cpChkEl.addEventListener("change", updateCpUnitWrap);

    var editing = null;
    function setPerms(arr){ Array.prototype.forEach.call(permBox.querySelectorAll("input"), function(c){ c.checked=arr.indexOf(c.value)!==-1; }); updateCpUnitWrap(); }
    function getPerms(){ var a=[]; Array.prototype.forEach.call(permBox.querySelectorAll("input:checked"), function(c){ a.push(c.value); }); return a; }
    function toggleRoleUI(){
      var isAdm = $("#m_role",bg).value==="admin";
      $("#m_perms",bg).style.display=isAdm?"none":"grid";
      $("#adminNote",bg).style.display=isAdm?"block":"none";
      updateCpUnitWrap();
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
      setCapPhatUnits(user?(Array.isArray(user.capPhatUnits)?user.capPhatUnits:[]):[]);
      toggleRoleUI();
      // Hiện ô phê duyệt nếu tài khoản đang chờ
      var approveWrap=document.getElementById("m_approve_wrap");
      var approveChk=document.getElementById("m_approve");
      if(user && user.pendingApproval && !user.active){
        approveWrap.style.display="block";
        approveChk.checked=false;
        // Fix 5: gợi ý phân quyền mặc định khi duyệt (chọn sẵn các trang cơ bản)
        var defaultPerms=["tong-quan","pccc-cnch","cap-phat-bhld","huan-luyen-dao-tao",
          "kiem-tra-cac-cap","quan-ly-thiet-bi",
          "kham-suc-khoe","moi-truong",
          "quan-ly-nha-thau","ke-hoach","bao-cao"];
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
      var capPhatUnits = role==="admin" ? CAP_PHAT_UNITS : getCapPhatUnits();
      var approve = document.getElementById("m_approve") && document.getElementById("m_approve").checked;
      var saveBtn=document.getElementById("ms"); if(saveBtn){saveBtn.disabled=true;saveBtn.textContent="Đang lưu...";}
      function doSave(hashedPw){
        var data={username:un, fullname:fn, danhSo:ds, role:role, perms:perms, capPhatUnits:capPhatUnits, password:hashedPw, pwHash:!!hashedPw, approve:approve};
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
        var u=getUsers(); var changedUser=null;
        for(var i=0;i<u.length;i++){
          if(u[i].username===me.username){ u[i].password=newHash; u[i].updated=new Date().toISOString(); changedUser=u[i]; break; }
        }
        setUsers(u); if(changedUser) _syncUserSheet('update', changedUser);
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
      var users=getUsers(); var me2=currentUser(); var changedUser=null;
      for(var i=0;i<users.length;i++){
        if(users[i].username===me2.username){ users[i].fullname=fn; users[i].danhSo=ds; users[i].updated=new Date().toISOString(); changedUser=users[i]; break; }
      }
      setUsers(users); if(changedUser) _syncUserSheet('update', changedUser);
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
     Hiển thị thêm: công việc trễ hạn + badge trạng thái
     ========================================================= */
  function renderKeHoachWidget(slug, wrap){
    var now = new Date();
    var curMonth = now.getMonth() + 1;
    var curYear  = now.getFullYear();
    var firstOfMonth = new Date(curYear, curMonth - 1, 1);
    var lastOfMonth  = new Date(curYear, curMonth, 0);

    var allLinks = load("hse_ke_hoach_links", {});
    var allTasks = allLinks[slug] || [];

    // Công việc trễ hạn: end < đầu tháng hiện tại, chưa hoàn thành
    var overdueTasks = allTasks.filter(function(t){
      if(t.type !== "oncetime") return false;
      if(t.status === "Đã hoàn thành") return false;
      if(!t.end) return false;
      return new Date(t.end) < firstOfMonth;
    });

    // Công việc trong tháng hiện tại
    var currentTasks = allTasks.filter(function(t){
      if(t.type === "oncetime"){
        var inRange = true;
        if(t.start && new Date(t.start) > lastOfMonth) inRange = false;
        if(t.end   && new Date(t.end)   < firstOfMonth) inRange = false;
        return inRange;
      } else {
        if(t.allMonths) return true;
        return (t.months||[]).indexOf(curMonth) >= 0;
      }
    });

    var monthLabel = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                      "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"][curMonth-1]
                     + "/" + curYear;

    // Badge trạng thái
    function statusBadge(status){
      if(!status) return "";
      var styles = {
        "Đã hoàn thành": "background:#eafaf1;color:#1a7a3c",
        "Đang thực hiện": "background:#fef5e4;color:#e68900",
        "Trễ hạn":        "background:#fdedec;color:#c0392b",
        "Chưa bắt đầu":   "background:#f0f3fa;color:#4a5568"
      };
      var s = styles[status] || "background:#f0f3fa;color:#4a5568";
      return '<span style="'+s+';padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;margin-left:4px">'+esc(status)+'</span>';
    }

    // Render hàng bảng
    function renderRows(tasks){
      return tasks.map(function(t, i){
        var typeBadge = t.type === "oncetime"
          ? '<span style="background:#dceaf7;color:#003087;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">Có kỳ hạn</span>'
          : '<span style="background:#eafaf1;color:#1a7a3c;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">Định kỳ</span>';
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
          '<td style="font-weight:600">'+ esc(t.name) + (t.status ? statusBadge(t.status) : "") +'</td>'+
          '<td>'+ typeBadge +'</td>'+
          '<td style="white-space:nowrap;font-size:12.5px">'+ esc(ngayTH) +'</td>'+
          '<td style="font-size:12.5px">'+ esc(t.chuTri||"—") +'</td>'+
          '<td style="font-size:12.5px">'+ esc(ph) +'</td>'+
          '<td style="font-size:12px;color:var(--text-muted)">'+ esc(t.coSo||"—") +'</td>'+
          '<td style="font-size:12px;color:var(--text-muted)">'+ esc(t.ghiChu||"—") +'</td>'+
          '</tr>';
      }).join("");
    }

    function tableWrap(rows, headerBg, headerColor){
      headerBg    = headerBg    || "#dde6f3";
      headerColor = headerColor || "#003087";
      var th = function(txt){ return '<th style="background:'+headerBg+';color:'+headerColor+';padding:9px 12px;font-size:12.5px;text-align:left">'+txt+'</th>'; };
      return '<div style="background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.07);overflow:auto">'+
        '<table style="width:100%;border-collapse:collapse">'+
          '<thead><tr>'+
            '<th style="background:'+headerBg+';color:'+headerColor+';padding:9px 12px;font-size:12.5px;text-align:left;width:30px">#</th>'+
            th('Nội dung công việc')+th('Loại')+th('Ngày thực hiện')+
            th('Đơn vị chủ trì')+th('Đơn vị phối hợp')+th('Cơ sở')+th('Ghi chú')+
          '</tr></thead>'+
          '<tbody>'+rows+'</tbody>'+
        '</table>'+
      '</div>';
    }

    var section = el("div");
    section.innerHTML =
      '<div class="section-h" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'+
        '<span>📋 Kế hoạch ' + monthLabel + '</span>'+
        '<a href="ke-hoach.html" style="font-size:12px;color:var(--brand);font-weight:600;text-decoration:none">→ Xem & quản lý kế hoạch</a>'+
      '</div>';

    // --- Cảnh báo trễ hạn ---
    if(overdueTasks.length){
      section.innerHTML +=
        '<div style="background:#fdedec;border-left:4px solid #c0392b;border-radius:0 8px 8px 0;'+
          'padding:9px 14px;margin-bottom:10px;font-size:12.5px;font-weight:700;color:#c0392b;">'+
          '⚠️ ' + overdueTasks.length + ' công việc trễ hạn chưa hoàn thành'+
        '</div>';
      section.innerHTML += tableWrap(renderRows(overdueTasks), "#fdedec", "#c0392b");
      section.innerHTML += '<div style="height:14px"></div>';
    }

    // --- Công việc tháng hiện tại ---
    if(!currentTasks.length && !overdueTasks.length){
      section.innerHTML +=
        '<div style="background:#fff;border-radius:10px;padding:20px 18px;box-shadow:0 2px 8px rgba(0,0,0,0.06);'+
          'color:var(--text-muted);font-size:13px;text-align:center;">'+
          '✅ Không có công việc kế hoạch nào trong ' + monthLabel + '.'+
        '</div>';
    } else if(currentTasks.length){
      section.innerHTML += tableWrap(renderRows(currentTasks));
    }

    wrap.appendChild(section);
  }

  /* =========================================================
     RENDER: KẾ HOẠCH TỔNG HỢP CHO TRANG TỔNG QUAN
     Gom tất cả module, thêm cột Phân hệ
     ========================================================= */
  function renderKeHoachDashboard(wrap){
    var now = new Date();
    var curMonth = now.getMonth() + 1;
    var curYear  = now.getFullYear();
    var firstOfMonth = new Date(curYear, curMonth - 1, 1);
    var lastOfMonth  = new Date(curYear, curMonth, 0);

    var allLinks = load("hse_ke_hoach_links", {});
    var monthLabel = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                      "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"][curMonth-1]
                     + "/" + curYear;

    var overdueTasks = [];
    var currentTasks = [];

    MENU.forEach(function(item){
      if(item.slug === "tong-quan") return;
      var tasks = allLinks[item.slug] || [];
      tasks.forEach(function(t){
        var tw = Object.assign({}, t, { _phanHe: item.icon + " " + item.title });
        // Trễ hạn
        if(t.type === "oncetime" && t.status !== "Đã hoàn thành" && t.end && new Date(t.end) < firstOfMonth){
          overdueTasks.push(tw);
        }
        // Tháng hiện tại
        var inCurrent = false;
        if(t.type === "oncetime"){
          var ok = true;
          if(t.start && new Date(t.start) > lastOfMonth) ok = false;
          if(t.end   && new Date(t.end)   < firstOfMonth) ok = false;
          inCurrent = ok;
        } else {
          inCurrent = t.allMonths || (t.months||[]).indexOf(curMonth) >= 0;
        }
        if(inCurrent) currentTasks.push(tw);
      });
    });

    function statusBadge(status){
      if(!status) return "";
      var styles = {
        "Đã hoàn thành": "background:#eafaf1;color:#1a7a3c",
        "Đang thực hiện": "background:#fef5e4;color:#e68900",
        "Trễ hạn":        "background:#fdedec;color:#c0392b",
        "Chưa bắt đầu":   "background:#f0f3fa;color:#4a5568"
      };
      var s = styles[status] || "background:#f0f3fa;color:#4a5568";
      return '<span style="'+s+';padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;margin-left:4px">'+esc(status)+'</span>';
    }

    function renderRows(tasks){
      return tasks.map(function(t, i){
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
          '<td style="font-size:12px;color:var(--text-muted);white-space:nowrap">'+esc(t._phanHe||"—")+'</td>'+
          '<td style="font-weight:600">'+ esc(t.name) + (t.status ? statusBadge(t.status) : "") +'</td>'+
          '<td style="white-space:nowrap;font-size:12.5px">'+ esc(ngayTH) +'</td>'+
          '<td style="font-size:12.5px">'+ esc(t.chuTri||"—") +'</td>'+
          '<td style="font-size:12.5px">'+ esc(ph) +'</td>'+
          '<td style="font-size:12px;color:var(--text-muted)">'+ esc(t.coSo||"—") +'</td>'+
          '<td style="font-size:12px;color:var(--text-muted)">'+ esc(t.ghiChu||"—") +'</td>'+
          '</tr>';
      }).join("");
    }

    function tableWrap(rows, headerBg, headerColor){
      headerBg    = headerBg    || "#dde6f3";
      headerColor = headerColor || "#003087";
      var th = function(txt){ return '<th style="background:'+headerBg+';color:'+headerColor+';padding:9px 12px;font-size:12.5px;text-align:left">'+txt+'</th>'; };
      return '<div style="background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.07);overflow:auto">'+
        '<table style="width:100%;border-collapse:collapse">'+
          '<thead><tr>'+
            '<th style="background:'+headerBg+';color:'+headerColor+';padding:9px 12px;font-size:12.5px;text-align:left;width:30px">#</th>'+
            th('Phân hệ')+th('Nội dung công việc')+th('Ngày thực hiện')+
            th('Đơn vị chủ trì')+th('Đơn vị phối hợp')+th('Cơ sở')+th('Ghi chú')+
          '</tr></thead>'+
          '<tbody>'+rows+'</tbody>'+
        '</table>'+
      '</div>';
    }

    var section = el("div");
    section.innerHTML =
      '<div class="section-h" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'+
        '<span>📋 Kế hoạch ' + monthLabel + '</span>'+
        '<a href="ke-hoach.html" style="font-size:12px;color:var(--brand);font-weight:600;text-decoration:none">→ Xem & quản lý kế hoạch</a>'+
      '</div>';

    if(overdueTasks.length){
      section.innerHTML +=
        '<div style="background:#fdedec;border-left:4px solid #c0392b;border-radius:0 8px 8px 0;'+
          'padding:9px 14px;margin-bottom:10px;font-size:12.5px;font-weight:700;color:#c0392b;">'+
          '⚠️ ' + overdueTasks.length + ' công việc trễ hạn chưa hoàn thành'+
        '</div>';
      section.innerHTML += tableWrap(renderRows(overdueTasks), "#fdedec", "#c0392b");
      section.innerHTML += '<div style="height:14px"></div>';
    }

    var oncetimeTasks  = currentTasks.filter(function(t){ return t.type === "oncetime"; });
    var recurringTasks = currentTasks.filter(function(t){ return t.type !== "oncetime"; });

    if(!currentTasks.length && !overdueTasks.length){
      section.innerHTML +=
        '<div style="background:#fff;border-radius:10px;padding:20px 18px;box-shadow:0 2px 8px rgba(0,0,0,0.06);'+
          'color:var(--text-muted);font-size:13px;text-align:center;">'+
          '✅ Không có công việc kế hoạch nào trong ' + monthLabel + '.'+
        '</div>';
    } else {
      if(oncetimeTasks.length){
        section.innerHTML += '<div style="font-size:13px;font-weight:700;color:var(--brand);margin:14px 0 8px">📌 Công việc có kỳ hạn</div>';
        section.innerHTML += tableWrap(renderRows(oncetimeTasks));
      }
      if(recurringTasks.length){
        section.innerHTML += '<div style="font-size:13px;font-weight:700;color:#1a7a3c;margin:14px 0 8px">🔁 Công việc định kỳ</div>';
        section.innerHTML += tableWrap(renderRows(recurringTasks), "#eafaf1", "#1a7a3c");
      }
    }

    section.id = "dash-kh-section";
    wrap.appendChild(section);
  }

  /* =========================================================
     RENDER: TRANG SOP
     ========================================================= */
  var K_SOP = "hse_sop";
  function fmtSopDate(s){
    // Chuẩn hoá ISO → YYYY-MM-DD trước, rồi hiển thị DD/MM/YYYY
    var d = sheetDateToLocal(s);
    if(!d) return "—";
    var parts = d.split("-");
    if(parts.length === 3) return parts[2]+"/"+parts[1]+"/"+parts[0];
    return d;
  }

  function getSops(){ return load(K_SOP, []); }
  function setSops(arr){
    save(K_SOP, arr);
    if(typeof DB !== "undefined" && DB.isReady()){
      DB.bulkWrite("sop", arr).catch(function(e){ console.warn("[SOP] Sync Sheets thất bại:", e); });
    }
  }

  function renderSop(container, u, admin){
    container.innerHTML = "";

    // ── Tiêu đề trang ──
    var descText = admin
      ? 'Bạn có quyền thêm, chỉnh sửa và xoá tài liệu SOP.'
      : 'Bạn chỉ có quyền xem danh sách tài liệu SOP.';
    container.appendChild(el("div","",
      '<div class="page-title">📑 SOP</div>'+
      '<div class="page-desc">'+esc(descText)+'</div>'));

    // ── Toolbar: tìm kiếm + lọc đơn vị + nút thêm (admin) ──
    var bar = el("div","toolbar");
    bar.innerHTML =
      '<input class="inp" id="sop-q" placeholder="🔍 Tìm theo mã hoặc tên SOP..." style="min-width:220px">'+
      '<select class="inp" id="sop-filter-dv" style="min-width:180px">'+
        '<option value="">— Tất cả đơn vị —</option>'+
      '</select>'+
      '<div class="spacer"></div>'+
      (admin ? '<button class="btn btn-accent" id="sop-add">＋ Thêm SOP</button>' : '');
    container.appendChild(bar);

    // ── Bảng danh sách ──
    var tw = el("div","table-wrap");
    var tbl = el("table"); tbl.id = "sop-tbl"; tw.appendChild(tbl); container.appendChild(tw);

    // ── Modal thêm/sửa (chỉ admin) ──
    var modal = null;
    if(admin){ modal = buildSopModal(); container.appendChild(modal.bg); }

    // ── Cập nhật dropdown đơn vị ──
    function refreshDvOptions(){
      var sops = getSops();
      var dvSet = {};
      sops.forEach(function(s){ if(s.don_vi) dvSet[s.don_vi] = true; });
      var sel = document.getElementById("sop-filter-dv");
      if(!sel) return;
      var cur = sel.value;
      sel.innerHTML = '<option value="">— Tất cả đơn vị —</option>';
      Object.keys(dvSet).sort().forEach(function(dv){
        var opt = document.createElement("option");
        opt.value = dv; opt.textContent = dv;
        if(dv === cur) opt.selected = true;
        sel.appendChild(opt);
      });
    }

    // ── Vẽ bảng ──
    function draw(){
      var q   = (document.getElementById("sop-q")||{value:""}).value.toLowerCase();
      var dv  = (document.getElementById("sop-filter-dv")||{value:""}).value;
      var sops = getSops().filter(function(s){
        var matchQ = !q || (s.ma_td||"").toLowerCase().indexOf(q)!==-1 || (s.ten_sop||"").toLowerCase().indexOf(q)!==-1;
        var matchDv = !dv || s.don_vi === dv;
        return matchQ && matchDv;
      });
      var html = '<thead><tr>'+
        '<th style="width:130px">Mã tài liệu</th>'+
        '<th>Tên SOP</th>'+
        '<th style="width:180px">Đơn vị thực hiện</th>'+
        '<th style="width:120px">Ngày phê duyệt</th>'+
        '<th style="width:120px;text-align:center">Tài liệu</th>'+
        (admin ? '<th style="width:110px;text-align:center">Thao tác</th>' : '')+
        '</tr></thead><tbody>';
      if(!sops.length){
        html += '<tr><td colspan="'+(admin?6:5)+'" class="muted" style="text-align:center;padding:28px">Không có tài liệu SOP nào.</td></tr>';
      }
      sops.forEach(function(s){
        html += '<tr>'+
          '<td><span style="font-family:monospace;font-size:12.5px;color:var(--primary);font-weight:600">'+esc(s.ma_td||'—')+'</span></td>'+
          '<td><b>'+esc(s.ten_sop||'')+'</b></td>'+
          '<td style="color:var(--text-muted)">'+esc(s.don_vi||'—')+'</td>'+
          '<td style="color:var(--text-muted);font-size:12.5px">'+esc(fmtSopDate(s.ngay_pd))+'</td>'+
          '<td style="text-align:center">'+
            (s.link ? '<a href="'+esc(s.link)+'" target="_blank" style="display:inline-flex;align-items:center;gap:5px;background:var(--primary);color:white;text-decoration:none;padding:5px 12px;border-radius:6px;font-size:12.5px;font-weight:600">📄 Xem</a>' : '<span style="color:var(--text-muted);font-size:12.5px">—</span>')+
          '</td>'+
          (admin ?
            '<td style="text-align:center">'+
              '<button class="btn btn-ghost btn-sm" data-act="edit" data-id="'+esc(s.id)+'">Sửa</button> '+
              '<button class="btn btn-danger btn-sm" data-act="del" data-id="'+esc(s.id)+'">Xoá</button>'+
            '</td>' : '')+
          '</tr>';
      });
      html += '</tbody>';
      tbl.innerHTML = html;

      if(admin){
        Array.prototype.forEach.call(tbl.querySelectorAll("button[data-act]"), function(b){
          b.addEventListener("click", function(){
            var id = b.getAttribute("data-id"), act = b.getAttribute("data-act");
            if(act==="edit"){ var rec = getSops().filter(function(x){return x.id===id;})[0]; if(rec) modal.open(rec); }
            else if(act==="del"){ delSop(id); }
          });
        });
      }
    }

    function delSop(id){
      if(!confirm("Xoá tài liệu SOP này?")) return;
      setSops(getSops().filter(function(x){ return x.id !== id; }));
      refreshDvOptions(); draw();
    }

    if(admin){
      modal.onSave = function(data, editId){
        var arr = getSops();
        if(editId){
          arr.forEach(function(x){ if(x.id===editId){ x.ma_td=data.ma_td; x.ten_sop=data.ten_sop; x.don_vi=data.don_vi; x.ngay_pd=data.ngay_pd; x.link=data.link; } });
        } else {
          arr.push({ id: Date.now().toString(36), ma_td:data.ma_td, ten_sop:data.ten_sop, don_vi:data.don_vi, ngay_pd:data.ngay_pd, link:data.link });
        }
        setSops(arr); refreshDvOptions(); draw();
      };
      document.getElementById("sop-add").addEventListener("click", function(){ modal.open(null); });
    }

    document.getElementById("sop-q").addEventListener("input", draw);
    document.getElementById("sop-filter-dv").addEventListener("change", draw);

    // Load từ Sheets nếu đã kết nối
    if(typeof DB !== "undefined" && DB.isReady()){
      DB.getAll("sop").then(function(rows){
        if(rows && rows.length){ save(K_SOP, rows); refreshDvOptions(); draw(); }
      }).catch(function(e){ console.warn("[SOP] Pull thất bại:", e && e.message || e); });
    }

    refreshDvOptions(); draw();
  }

  function buildSopModal(){
    var bg = el("div","modal-bg"); bg.id = "sop-modal";
    bg.innerHTML =
      '<div class="modal" style="max-width:480px">'+
        '<div class="modal-h"><span id="sop-mt">Thêm SOP</span><button class="x" id="sop-mx">×</button></div>'+
        '<div class="modal-b">'+
          '<div class="field"><label>Mã tài liệu <span style="color:var(--accent)">*</span></label><input class="inp" id="sop-ma" style="width:100%" placeholder="Nhập mã tài liệu"></div>'+
          '<div class="field"><label>Tên SOP <span style="color:var(--accent)">*</span></label><input class="inp" id="sop-ten" style="width:100%" placeholder="Tên đầy đủ của SOP"></div>'+
          '<div class="field"><label>Đơn vị thực hiện</label><input class="inp" id="sop-dv" style="width:100%" placeholder="Nhập đơn vị thực hiện"></div>'+
          '<div class="field"><label>Ngày phê duyệt</label><input class="inp" id="sop-nd" type="date" style="width:100%"></div>'+
          '<div class="field"><label>Link tài liệu</label><input class="inp" id="sop-lk" style="width:100%" placeholder="https://..."></div>'+
        '</div>'+
        '<div class="modal-f"><button class="btn btn-ghost" id="sop-mc">Huỷ</button><button class="btn btn-accent" id="sop-ms">Lưu</button></div>'+
      '</div>';

    var editId = null;
    var api = { bg: bg, onSave: null };

    api.open = function(rec){
      editId = rec ? rec.id : null;
      $("#sop-mt",bg).textContent = rec ? "Chỉnh sửa SOP" : "Thêm SOP mới";
      $("#sop-ma",bg).value  = rec ? (rec.ma_td||"")   : "";
      $("#sop-ten",bg).value = rec ? (rec.ten_sop||"")  : "";
      $("#sop-dv",bg).value  = rec ? (rec.don_vi||"")   : "";
      if(window.HSEDate) HSEDate.setValue($("#sop-nd",bg), rec ? (rec.ngay_pd||"") : "");
      else $("#sop-nd",bg).value  = rec ? (sheetDateToLocal(rec.ngay_pd)||"")  : "";
      $("#sop-lk",bg).value  = rec ? (rec.link||"")     : "";
      bg.classList.add("open");
    };
    function close(){ bg.classList.remove("open"); }

    $("#sop-mx",bg).addEventListener("click", close);
    $("#sop-mc",bg).addEventListener("click", close);
    bg.addEventListener("click", function(e){ if(e.target===bg) close(); });

    $("#sop-ms",bg).addEventListener("click", function(){
      var ma  = $("#sop-ma",bg).value.trim();
      var ten = $("#sop-ten",bg).value.trim();
      if(!ma || !ten){ alert("Vui lòng nhập Mã tài liệu và Tên SOP."); return; }
      if(api.onSave){
        api.onSave({
          ma_td:   ma,
          ten_sop: ten,
          don_vi:  $("#sop-dv",bg).value.trim(),
          ngay_pd: window.HSEDate ? HSEDate.getValue($("#sop-nd",bg)) : $("#sop-nd",bg).value,
          link:    $("#sop-lk",bg).value.trim()
        }, editId);
      }
      close();
    });

    return api;
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
