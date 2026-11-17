(function () {
  var USER_KEY = "mindmark_copy_user";
  var SESSION_COOKIE = "mindmark_session_user";
  var ADMIN_USER = "42mahinlabib";

  function sessionUser() {
    var match = document.cookie.match(new RegExp("(?:^|;\\s*)" + SESSION_COOKIE + "=([^;]+)"));
    return match ? decodeURIComponent(match[1]) : "";
  }

  var user = localStorage.getItem(USER_KEY) || sessionUser() || "";
  if (!user) return;

  // Account pages already have a server-rendered account menu handled by account.js.
  if (document.querySelector("[data-account-menu]")) return;

  var holders = document.querySelectorAll(".header_ic_header_login_btn__37rFr");
  if (!holders.length) return;

  if (!document.querySelector('link[href="/_app/account.css"]')) {
    var style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "/_app/account.css";
    document.head.appendChild(style);
  }

  var menuMarkup =
    '<div class="header_login_user__biSt7 ic_center ic_black fw_500" style="display:inline-flex!important;align-items:center!important;justify-content:center;gap:12px!important;height:46px!important;padding:0 22px!important;border:1.5px solid #14161b!important;border-radius:13px!important;box-sizing:border-box;flex:0 0 auto" data-account-menu data-session-menu aria-haspopup="true" aria-expanded="false" role="button" tabindex="0" title="Signed in as ' +
    user.replace(/&/g, "&amp;").replace(/"/g, "&quot;") +
    '">' +
    '<a class="header_ic_profile_label" href="/my-profile/account/?tab=profile" style="display:inline-flex;align-items:center;line-height:1;text-decoration:none;color:inherit;font-weight:500;white-space:nowrap">My Profile</a><img alt="user" loading="lazy" width="25" height="25" src="/images/mirror/74fbe1b2fd-user_default.png" style="color:transparent;width:30px!important;height:30px!important;object-fit:contain;flex:0 0 auto">' +
    '<div class="header_ic_login_user_dropdown__fb1Q7"><ul>' +
    '<li><a class="header_item__1yLaj" href="/my-profile/course/">Courses</a></li>' +
    (user === ADMIN_USER ? '<li><a class="header_item__1yLaj" href="/admin/">Admin Panel</a></li>' : '') +
    '<li><button class="header_item__1yLaj" type="button" data-session-logout>Log out</button></li>' +
    "</ul></div></div>";

  holders.forEach(function (holder) {
    holder.innerHTML = '<a class="header_ic_contact_btn" href="/contact/" style="display:inline-flex;align-items:center;text-decoration:none;color:inherit;font-weight:500;white-space:nowrap;margin-right:18px">Contact Us</a>' + menuMarkup;
  });

  function closeMenus() {
    document.querySelectorAll("[data-session-menu].mindmark-menu-open").forEach(function (menu) {
      menu.classList.remove("mindmark-menu-open");
      menu.setAttribute("aria-expanded", "false");
    });
  }

  document.addEventListener("click", function (event) {
    if (event.target.closest("[data-session-logout]")) {
      localStorage.removeItem(USER_KEY);
      document.cookie = SESSION_COOKIE + "=; Max-Age=0; path=/";
      window.location.href = "/auth/login/";
      return;
    }
    var menu = event.target.closest("[data-session-menu]");
    if (menu && !event.target.closest("a[href]")) {
      event.preventDefault();
      var open = menu.classList.toggle("mindmark-menu-open");
      menu.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    if (!event.target.closest("[data-session-menu]")) closeMenus();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    var menu = event.target.closest("[data-session-menu]");
    if (!menu) return;
    event.preventDefault();
    var open = menu.classList.toggle("mindmark-menu-open");
    menu.setAttribute("aria-expanded", open ? "true" : "false");
  });
})();
