(function () {
  var TOKEN_KEY = 'ph_token';
  var SHANGHAI_OFFSET = 8 * 3600 * 1000;
  window.PH = {};

  PH.getToken = function () { return localStorage.getItem(TOKEN_KEY); };
  PH.setToken = function (t) { localStorage.setItem(TOKEN_KEY, t); };
  PH.clearToken = function () { localStorage.removeItem(TOKEN_KEY); };

  PH.api = async function (path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var t = PH.getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    var res = await fetch(path, Object.assign({}, opts, {
      headers: Object.assign(headers, opts.headers),
    }));
    if (res.status === 401) { PH.showLogin(); throw new Error('未授权'); }
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error((data && data.error) || res.statusText);
    return data;
  };

  // UTC ISO -> 北京时间 'YYYY-MM-DD HH:mm'
  PH.fmtDateTime = function (iso) {
    if (!iso) return '';
    var d = new Date(new Date(iso).getTime() + SHANGHAI_OFFSET);
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
      ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
  };

  PH.fmtDate = function (iso) {
    var s = PH.fmtDateTime(iso);
    return s ? s.slice(0, 10) : '';
  };

  // UTC ISO -> datetime-local 输入值
  PH.toInput = function (iso) {
    return PH.fmtDateTime(iso).replace(' ', 'T');
  };

  PH.esc = function (s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  };

  // 登录浮层
  PH.showLogin = function () {
    var ov = document.getElementById('loginOverlay');
    if (ov) { ov.style.display = 'flex'; return; }
    ov = document.createElement('div');
    ov.id = 'loginOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:999;';
    ov.innerHTML =
      '<div style="background:#fff;border-radius:12px;padding:24px;width:280px;box-shadow:0 4px 20px rgba(0,0,0,.2);font-family:system-ui,sans-serif;">' +
      '<h2 style="margin:0 0 12px;font-size:18px;">🔐 Personal Hub</h2>' +
      '<input id="loginToken" type="password" placeholder="请输入访问口令" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box;"/>' +
      '<button id="loginBtn" style="margin-top:12px;width:100%;padding:8px;border:none;border-radius:6px;background:#2563eb;color:#fff;cursor:pointer;">登录</button>' +
      '<div id="loginErr" style="color:#dc2626;font-size:12px;margin-top:8px;"></div>' +
      '</div>';
    document.body.appendChild(ov);
    var btn = ov.querySelector('#loginBtn');
    var input = ov.querySelector('#loginToken');
    var err = ov.querySelector('#loginErr');
    async function doLogin() {
      var t = input.value.trim();
      if (!t) return;
      try {
        var res = await fetch('/api/ping', { headers: { 'Authorization': 'Bearer ' + t } });
        if (res.ok) { PH.setToken(t); ov.remove(); location.reload(); }
        else err.textContent = '口令不正确';
      } catch (e) { err.textContent = '网络错误'; }
    }
    btn.onclick = doLogin;
    input.onkeydown = function (e) { if (e.key === 'Enter') doLogin(); };
    input.focus();
  };

  PH.ensureLogin = function () {
    if (!PH.getToken()) PH.showLogin();
  };

  PH.logout = function () { PH.clearToken(); location.reload(); };

  // 通用页面样式注入
  PH.style = function () {
    var css = 'body{margin:0;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f5f6f8;color:#1f2328;}' +
      '.wrap{max-width:760px;margin:0 auto;padding:16px;}' +
      '.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}' +
      'h1{font-size:20px;margin:0;}' +
      '.top a{color:#2563eb;text-decoration:none;font-size:14px;}' +
      '.card{background:#fff;border-radius:10px;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.06);}' +
      'form .row{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;}' +
      'input,select,textarea{padding:8px;border:1px solid #d0d7de;border-radius:6px;font-size:14px;box-sizing:border-box;}' +
      'textarea{width:100%;resize:vertical;}' +
      'button{padding:8px 14px;border:none;border-radius:6px;background:#2563eb;color:#fff;cursor:pointer;font-size:14px;}' +
      'button.gray{background:#e7ecf3;color:#1f2328;}' +
      'button.red{background:#f87171;}' +
      '.list div{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0f2f5;font-size:14px;}' +
      '.list div:last-child{border-bottom:none;}' +
      '.muted{color:#8a919c;font-size:13px;}' +
      '.done{color:#8a919c;text-decoration:line-through;}' +
      '.tag{background:#e7ecf3;border-radius:4px;padding:1px 6px;font-size:12px;color:#57606a;}' +
      '.stat{display:flex;gap:12px;margin-bottom:4px;}' +
      '.stat div{flex:1;background:#f8fafc;border-radius:8px;padding:10px;text-align:center;}' +
      '.stat b{font-size:18px;display:block;}';
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  };

  PH.nav = function (active) {
    var items = [
      ['/index.html', '🏠 首页'],
      ['/tasks.html', '📋 任务'],
      ['/calendar.html', '📅 日历'],
      ['/finances.html', '💰 财务'],
      ['/contacts.html', '👤 通讯录'],
    ];
    var html = items.map(function (it) {
      return it[0] === active
        ? '<a href="' + it[0] + '" style="font-weight:600;">' + it[1] + '</a>'
        : '<a href="' + it[0] + '">' + it[1] + '</a>';
    }).join('&nbsp;·&nbsp;');
    var div = document.createElement('div');
    div.className = 'card';
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    div.innerHTML = '<div>' + html + '</div>' +
      '<button class="gray" onclick="PH.logout()" style="padding:4px 10px;font-size:12px;">退出</button>';
    document.body.insertBefore(div, document.body.firstChild);
  };

  PH.toast = function (msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1f2328;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;z-index:1000;';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2000);
  };

  // 短时登录链接自动登录：/index.html?key=<signed>
  (function autoLogin() {
    var m = location.search.match(/[?&]key=([^&]+)/);
    if (m) {
      PH.setToken(decodeURIComponent(m[1]));
      history.replaceState(null, '', location.pathname);
      location.reload();
    }
  })();
})();
