(function () {
  var MODE = document.body.getAttribute("data-auth-mode") || "login";
  var KEY = "mindmark_copy_accounts";
  var USER_KEY = "mindmark_copy_user";
  var SESSION_COOKIE = "mindmark_session_user";
  var ADMIN_USER = "42mahinlabib";
  var ADMIN_PASS = "thegreatpiano/";

  var form = document.getElementById("auth-form") || document.querySelector("form");
  var error = document.getElementById("auth-error");
  if (!form) return;

  var roleInputs = form.querySelectorAll('input[name="role"]');

  function chosenRole() {
    var picked = form.querySelector('input[name="role"]:checked');
    return picked ? picked.value : "student";
  }

  // The two boxes act like a single choice: ticking one clears the other.
  Array.prototype.forEach.call(roleInputs, function (input) {
    input.addEventListener("change", function () {
      if (!input.checked) return;
      Array.prototype.forEach.call(roleInputs, function (other) {
        if (other !== input) other.checked = false;
      });
    });
  });

  // Restore a remembered username so the checkbox has a visible effect.
  (function () {
    var remembered = "";
    try {
      remembered = localStorage.getItem("mindmark_remember_user") || "";
    } catch (e) {}
    if (!remembered) return;
    if (form.username && !form.username.value) form.username.value = remembered;
    if (form.remember) form.remember.checked = true;
  })();

  function fail(message) {
    if (error) {
      error.textContent = message;
      error.style.display = "block";
    } else {
      alert(message);
    }
  }

  function accounts() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function roleOf(record) {
    return record && typeof record === "object" && record.role === "admin" ? "admin" : "student";
  }

  function hashOf(record) {
    return record && typeof record === "object" ? record.hash : record;
  }

  async function digest(value) {
    if (window.crypto && crypto.subtle) {
      var bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
      return Array.from(new Uint8Array(bytes))
        .map(function (b) {
          return b.toString(16).padStart(2, "0");
        })
        .join("");
    }
    return "plain:" + value;
  }

  function startSession(username, remember) {
    localStorage.removeItem(USER_KEY);
    document.cookie = SESSION_COOKIE + "=; Max-Age=0; path=/";
    if (remember) {
      localStorage.setItem(USER_KEY, username);
      try {
        localStorage.setItem("mindmark_remember_user", username);
      } catch (e) {}
      document.cookie = SESSION_COOKIE + "=" + encodeURIComponent(username) + "; path=/; SameSite=Lax; Max-Age=31536000";
    } else {
      try {
        localStorage.removeItem("mindmark_remember_user");
      } catch (e) {}
      document.cookie = SESSION_COOKIE + "=" + encodeURIComponent(username) + "; path=/; SameSite=Lax";
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (error) error.style.display = "none";

    var username = (form.username.value || "").trim().toLowerCase();
    var password = form.password.value || "";
    if (username.length < 3) return fail("Choose a username of at least 3 characters.");
    if (password.length < 6) return fail("Use a password of at least 6 characters.");

    var stored = accounts();
    var hash = await digest(password);
    var accountRole = MODE === "login" ? chosenRole() : "student";

    if (MODE === "login") {
      if (accountRole === "admin") {
        // One fixed administrator login; no admin account is stored locally.
        if (username !== ADMIN_USER || password !== ADMIN_PASS) {
          return fail("Wrong username or password. Please try again.");
        }
      } else {
        if (username === ADMIN_USER) return fail("Wrong username or password. Please try again.");
        var record = stored[username];
        if (!record) return fail("No account found with that username.");
        if (hashOf(record) !== hash) return fail("That password does not match.");
        if (roleOf(record) !== "student") return fail("That account cannot be used as a student.");
      }
    } else {
      if (username === ADMIN_USER) return fail("That username is reserved.");
      if (stored[username]) return fail("That username is already taken.");
      stored[username] = {
        hash: hash,
        role: accountRole,
        created: new Date().toISOString()
      };
      localStorage.setItem(KEY, JSON.stringify(stored));
    }

    startSession(username, !!(form.remember && form.remember.checked));
    window.location.href = accountRole === "admin" ? "/admin/" : "/my-profile/course/";
  });
})();
