(function () {
  var USER_KEY = "mindmark_copy_user";
  var ADMIN_USER = "42mahinlabib";
  var SESSION_COOKIE = "mindmark_session_user";
  var ACCOUNTS_KEY = "mindmark_copy_accounts";
  var PROFILES_KEY = "mindmark_copy_profiles";
  var REVIEWS_KEY = "mindmark_copy_reviews";
  var FEEDBACK_KEY = "mindmark_copy_feedback";
  var ATTEMPTS_KEY = "mindmark_attempts_v1";
  var DRAFTS_KEY = "mindmark_drafts_v1";
  var NOTES_KEY = "mindmark_notes_v1";

  var TABS = {
    profile: ["Edit Profile", "Update your name, email and study goal."],
    contests: ["My Contest", "Your challenge entries and results."],
    review: ["Review MindMark", "Tell us how this copy is working for you."],
    feedback: ["Feedback", "Report a problem or suggest an improvement."]
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* storage unavailable */
    }
  }

  function scopedKey(key) {
    return user ? key + ":" + user : key;
  }

  function readScoped(key, fallback) {
    try {
      var raw = localStorage.getItem(scopedKey(key));
      if (raw == null && user) {
        var legacy = localStorage.getItem(key);
        if (legacy != null) {
          localStorage.setItem(scopedKey(key), legacy);
          localStorage.removeItem(key);
          raw = legacy;
        }
      }
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stamp(value) {
    if (!value) return "";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function sessionUser() {
    var match = document.cookie.match(new RegExp("(?:^|;\\s*)" + SESSION_COOKIE + "=([^;]+)"));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function clearUser() {
    localStorage.removeItem(USER_KEY);
    document.cookie = SESSION_COOKIE + "=; Max-Age=0; path=/";
  }

  var user = localStorage.getItem(USER_KEY) || sessionUser() || "";
  var isAccountPage = document.body.getAttribute("data-account-page") === "1";

  function profileFor(name) {
    var profiles = read(PROFILES_KEY, {});
    return profiles[name] || {};
  }

  function displayName() {
    var profile = profileFor(user);
    return profile.name || user || "there";
  }

  function updateGreeting() {
    var name = displayName();
    document.querySelectorAll("[data-account-name]").forEach(function (node) {
      node.textContent = name;
    });
    var welcome = document.querySelector(".ic_my_profile_card_header .right .ic_black");
    if (welcome) welcome.textContent = " " + name;
  }

  function toast(message) {
    var old = document.querySelector(".mindmark-toast");
    if (old) old.remove();
    var node = document.createElement("div");
    node.className = "mindmark-toast";
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(function () {
      node.remove();
    }, 2600);
  }

  function closeDialog() {
    var old = document.querySelector(".mindmark-dialog-backdrop");
    if (old) old.remove();
  }

  function openDialog(title, body, actions) {
    closeDialog();
    var wrap = document.createElement("div");
    wrap.className = "mindmark-dialog-backdrop";
    wrap.innerHTML =
      '<div class="mindmark-dialog" role="dialog" aria-modal="true" aria-label="' +
      esc(title) +
      '">' +
      "<h3>" +
      esc(title) +
      "</h3>" +
      '<div class="mindmark-dialog-body">' +
      body +
      "</div>" +
      '<div class="mindmark-dialog-actions">' +
      actions +
      "</div></div>";
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (event) {
      if (event.target === wrap || event.target.closest("[data-dialog-close]")) closeDialog();
    });
    return wrap;
  }

  function emptyState(title, text, href, label) {
    return (
      '<div class="mindmark-account-empty">' +
      '<div class="mindmark-empty-icon">✦</div>' +
      "<h3>" +
      esc(title) +
      "</h3>" +
      "<p>" +
      esc(text) +
      "</p>" +
      '<a class="mindmark-btn" href="' +
      esc(href) +
      '">' +
      esc(label) +
      "</a></div>"
    );
  }

  function signOut() {
    clearUser();
    window.location.href = "/auth/login/";
  }

  function confirmDelete() {
    var wrap = openDialog(
      "Delete profile?",
      "This removes your local account, saved answers, notes, reviews and feedback from this browser. This cannot be undone.",
      '<button type="button" class="mindmark-btn ghost" data-dialog-close>Cancel</button>' +
        '<button type="button" class="mindmark-btn danger" data-confirm-delete>Delete profile</button>'
    );
    wrap.querySelector("[data-confirm-delete]").addEventListener("click", function () {
      var accounts = read(ACCOUNTS_KEY, {});
      delete accounts[user];
      write(ACCOUNTS_KEY, accounts);
      var profiles = read(PROFILES_KEY, {});
      delete profiles[user];
      write(PROFILES_KEY, profiles);
      [ATTEMPTS_KEY, DRAFTS_KEY, NOTES_KEY].forEach(function (key) {
        localStorage.removeItem(scopedKey(key));
      });
      write(
        REVIEWS_KEY,
        read(REVIEWS_KEY, []).filter(function (item) {
          return item.user !== user;
        })
      );
      write(
        FEEDBACK_KEY,
        read(FEEDBACK_KEY, []).filter(function (item) {
          return item.user !== user;
        })
      );
      clearUser();
      window.location.href = "/auth/signup/";
    });
  }

  function initHeader() {
    document.querySelectorAll("[data-account-menu]").forEach(function (menu) {
      var dropdown = menu.querySelector(".header_ic_login_user_dropdown__fb1Q7");
      if (!dropdown) return;
      if (user === ADMIN_USER) {
        var list = dropdown.querySelector("ul");
        if (list && !list.querySelector('a[href="/admin/"]')) {
          var adminItem = document.createElement("li");
          adminItem.innerHTML = '<a class="header_item__1yLaj" href="/admin/">Admin Panel</a>';
          var lastItem = list.lastElementChild;
          if (lastItem) list.insertBefore(adminItem, lastItem);
          else list.appendChild(adminItem);
        }
      }
      menu.setAttribute("role", "button");
      menu.setAttribute("tabindex", "0");
      menu.setAttribute("aria-haspopup", "true");
      menu.addEventListener("click", function (event) {
        if (event.target.closest("a[href]") || event.target.closest("[data-account-action]")) return;
        event.preventDefault();
        var open = menu.classList.toggle("mindmark-menu-open");
        menu.setAttribute("aria-expanded", open ? "true" : "false");
      });
      menu.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          menu.click();
        }
      });
    });

    document.addEventListener("click", function (event) {
      document.querySelectorAll("[data-account-menu].mindmark-menu-open").forEach(function (menu) {
        if (!menu.contains(event.target)) {
          menu.classList.remove("mindmark-menu-open");
          menu.setAttribute("aria-expanded", "false");
        }
      });
    });

    var mobileMenu = document.querySelector(".header_ic_mobile_device_bar__sOxMF");
    if (mobileMenu) {
      mobileMenu.setAttribute("role", "button");
      mobileMenu.setAttribute("tabindex", "0");
      mobileMenu.setAttribute("aria-label", "Open menu");
      mobileMenu.addEventListener("click", function () {
        openDialog(
          "Menu",
          '<div class="mindmark-menu-links">' +
            '<a href="/category/sat/">SAT</a>' +
            '<a href="/my-profile/course/">My Courses</a>' +
            '<a href="/my-profile/account/?tab=profile">Edit Profile</a>' +
            "</div>",
          '<button type="button" class="mindmark-btn" data-dialog-close>Close</button>'
        );
      });
    }

    document.querySelectorAll("[data-cart]").forEach(function (cart) {
      cart.addEventListener("click", function (event) {
        event.preventDefault();
        openDialog(
          "Your cart",
          "Your cart is empty. This local copy does not process payments.",
          '<a class="mindmark-btn ghost" href="/category/sat/">Browse courses</a>' +
            '<button type="button" class="mindmark-btn" data-dialog-close>Close</button>'
        );
      });
    });
  }

  document.addEventListener("click", function (event) {
    var action = event.target.closest("[data-account-action]");
    if (!action) return;
    event.preventDefault();
    if (action.getAttribute("data-account-action") === "logout") signOut();
    if (action.getAttribute("data-account-action") === "delete") confirmDelete();
  });

  initHeader();
  updateGreeting();

  if (!isAccountPage) return;

  if (!user) {
    window.location.replace("/auth/login/?next=" + encodeURIComponent(window.location.pathname + window.location.search));
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var tab = params.get("tab") || "profile";
  if (!TABS[tab]) tab = "profile";
  var meta = TABS[tab];

  var titleNode = document.getElementById("account-title");
  var subtitleNode = document.getElementById("account-subtitle");
  var panel = document.getElementById("account-panel");
  if (titleNode) titleNode.textContent = meta[0];
  if (subtitleNode) subtitleNode.textContent = meta[1];
  document.title = meta[0] + " — Account Settings";

  document.querySelectorAll(".profile-sidebar_profile_sidebar_menu_link__D8ZuL").forEach(function (link) {
    link.classList.remove("profile-sidebar_active__IEx9N");
    link.classList.remove("false");
  });
  document.querySelectorAll("[data-account-tab]").forEach(function (link) {
    if (link.getAttribute("data-account-tab") === tab) {
      link.classList.add("profile-sidebar_active__IEx9N");
    }
  });

  var coursePromise = fetch("/_data/course.json")
    .then(function (response) {
      return response.ok ? response.json() : { lessons: [], practices: [] };
    })
    .catch(function () {
      return { lessons: [], practices: [] };
    });

  function renderProfile() {
    var profile = profileFor(user);
    var initial = (profile.name || user || "?").trim().charAt(0).toUpperCase();
    panel.innerHTML =
      '<div class="mindmark-account-head">' +
      '<div class="mindmark-account-avatar">' +
      esc(initial) +
      "</div><div><h3>" +
      esc(profile.name || user) +
      "</h3><p>@" +
      esc(user) +
      " · saved in this browser</p></div></div>" +
      '<form class="mindmark-form" id="profile-form" novalidate>' +
      '<div class="mindmark-form-error" id="profile-error"></div>' +
      '<div class="mindmark-form-grid">' +
      '<div class="mindmark-field"><label for="profile-username">Username</label><input id="profile-username" value="' +
      esc(user) +
      '" readonly></div>' +
      '<div class="mindmark-field"><label for="profile-name">Full name</label><input id="profile-name" value="' +
      esc(profile.name || "") +
      '" placeholder="Your name" autocomplete="name"></div>' +
      '<div class="mindmark-field"><label for="profile-email">Email</label><input id="profile-email" type="email" value="' +
      esc(profile.email || "") +
      '" placeholder="you@example.com" autocomplete="email"></div>' +
      '<div class="mindmark-field"><label for="profile-goal">Studying for</label><select id="profile-goal">' +
      ['SAT']
        .map(function (goal) {
          var current = "SAT";
          return '<option value="' + esc(goal) + '"' + (current === goal ? " selected" : "") + ">" + esc(goal) + "</option>";
        })
        .join("") +
      "</select></div>" +
      "</div>" +
      '<button type="submit" class="mindmark-btn">Save changes</button>' +
      "</form>";

    var form = document.getElementById("profile-form");
    var error = document.getElementById("profile-error");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = document.getElementById("profile-name").value.trim();
      var email = document.getElementById("profile-email").value.trim();
      var goal = document.getElementById("profile-goal").value;
      if (!name) {
        error.textContent = "Add a name so your account has a display name.";
        error.style.display = "block";
        return;
      }
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        error.textContent = "That email address does not look right.";
        error.style.display = "block";
        return;
      }
      var profiles = read(PROFILES_KEY, {});
      profiles[user] = { name: name, email: email, goal: goal, updatedAt: Date.now() };
      write(PROFILES_KEY, profiles);
      updateGreeting();
      toast("Profile saved");
    });
  }


  function renderContests() {
    panel.innerHTML = emptyState(
      "No contest entries yet",
      "Contest entries are not saved in this copy. You can still open the challenge page and see what it offers.",
      "/challenge/",
      "Explore the challenge"
    );
  }


  function renderReview() {
    var reviews = read(REVIEWS_KEY, []);
    var mine = reviews.find(function (item) {
      return item.user === user;
    });
    var rating = mine ? Number(mine.rating) || 0 : 0;

    panel.innerHTML =
      '<p class="mindmark-account-toolbar"><span>Your review is stored only in this browser.</span></p>' +
      '<form class="mindmark-form" id="review-form" novalidate>' +
      '<div class="mindmark-form-error" id="review-error"></div>' +
      '<div class="mindmark-field"><label>Your rating</label><div class="mindmark-stars" id="review-stars">' +
      [1, 2, 3, 4, 5]
        .map(function (value) {
          return '<button type="button" data-star="' + value + '" aria-label="' + value + ' stars">★</button>';
        })
        .join("") +
      "</div></div>" +
      '<div class="mindmark-field"><label for="review-note">What stood out?</label><textarea id="review-note" placeholder="Optional note">' +
      esc(mine ? mine.note || "" : "") +
      "</textarea></div>" +
      '<button type="submit" class="mindmark-btn">Submit review</button>' +
      "</form>" +
      (mine
        ? '<div class="mindmark-feedback-list"><div class="mindmark-feedback-item"><header><span>' +
          "★".repeat(rating) +
          "</span><span>" +
          esc(stamp(mine.at)) +
          "</span></header><p>" +
          esc(mine.note || "No note added.") +
          "</p></div></div>"
        : "");

    var stars = panel.querySelectorAll("[data-star]");
    function paint() {
      stars.forEach(function (button) {
        button.classList.toggle("on", Number(button.getAttribute("data-star")) <= rating);
      });
    }
    paint();

    stars.forEach(function (button) {
      button.addEventListener("click", function () {
        rating = Number(button.getAttribute("data-star"));
        paint();
      });
    });

    document.getElementById("review-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var error = document.getElementById("review-error");
      if (!rating) {
        error.textContent = "Pick a rating from one to five stars.";
        error.style.display = "block";
        return;
      }
      var note = document.getElementById("review-note").value.trim();
      var found = reviews.findIndex(function (item) {
        return item.user === user;
      });
      var entry = { user: user, rating: rating, note: note, at: Date.now() };
      if (found >= 0) reviews[found] = entry;
      else reviews.push(entry);
      write(REVIEWS_KEY, reviews);
      toast("Review saved");
      renderReview();
    });
  }

  function renderFeedback() {
    var all = read(FEEDBACK_KEY, []);
    var mine = all.filter(function (item) {
      return item.user === user;
    });

    panel.innerHTML =
      '<form class="mindmark-form" id="feedback-form" novalidate>' +
      '<div class="mindmark-form-error" id="feedback-error"></div>' +
      '<div class="mindmark-form-grid">' +
      '<div class="mindmark-field"><label for="feedback-type">Type</label><select id="feedback-type"><option>Problem</option><option>Suggestion</option><option>Content issue</option><option>Other</option></select></div>' +
      "</div>" +
      '<div class="mindmark-field"><label for="feedback-message">Message</label><textarea id="feedback-message" placeholder="What happened, or what would you change?" required></textarea></div>' +
      '<button type="submit" class="mindmark-btn">Send feedback</button>' +
      "</form>" +
      (mine.length
        ? '<div class="mindmark-feedback-list">' +
          mine
            .slice()
            .reverse()
            .map(function (item) {
              return (
                '<div class="mindmark-feedback-item"><header><strong>' +
                esc(item.type) +
                "</strong><span>" +
                esc(stamp(item.at)) +
                "</span></header><p>" +
                esc(item.message) +
                "</p></div>"
              );
            })
            .join("") +
          "</div>"
        : '<div class="mindmark-account-empty" style="margin-top:24px;padding:24px"><p style="margin:0">No feedback sent from this account yet.</p></div>');

    document.getElementById("feedback-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var error = document.getElementById("feedback-error");
      var type = document.getElementById("feedback-type").value;
      var message = document.getElementById("feedback-message").value.trim();
      if (!message) {
        error.textContent = "Write a message first.";
        error.style.display = "block";
        return;
      }
      var entries = read(FEEDBACK_KEY, []);
      entries.push({ user: user, type: type, message: message, at: Date.now() });
      write(FEEDBACK_KEY, entries);
      toast("Feedback saved");
      renderFeedback();
    });
  }

  function renderTab() {
    if (!panel) return;
    if (tab === "profile") renderProfile();
    else if (tab === "contests") renderContests();
    else if (tab === "review") renderReview();
    else if (tab === "feedback") renderFeedback();
  }

  renderTab();
})();
