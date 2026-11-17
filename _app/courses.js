(function () {
  var USER_KEY = "mindmark_copy_user";
  var SESSION_COOKIE = "mindmark_session_user";
  var KEY = "mindmark_copy_enrollments";

  var myGrid = document.querySelector("[data-my-courses]");
  var myEmpty = document.querySelector("[data-my-empty]");
  var catalog = document.querySelector("[data-catalog]");
  if (!myGrid || !catalog) return;

  function sessionUser() {
    var match = document.cookie.match(new RegExp("(?:^|;\\s*)" + SESSION_COOKIE + "=([^;]+)"));
    return match ? decodeURIComponent(match[1]) : "";
  }

  var user = localStorage.getItem(USER_KEY) || sessionUser() || "";

  var COURSES = [
    {
      slug: "digital-sat",
      title: "Digital SAT Learning Hub",
      cover: "/images/brand/mindmark-course.svg",
      href: "/course-lessons/digital-sat-learning-hub/",
      open: true
    },
    {
      slug: "shsat",
      title: "SHSAT Prep",
      cover: "/images/brand/mindmark-shsat.svg",
      href: "",
      open: false
    }
  ];

  function readAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function enrolled() {
    var all = readAll();
    return Array.isArray(all[user]) ? all[user] : [];
  }

  function known(slug) {
    for (var i = 0; i < COURSES.length; i++) {
      if (COURSES[i].slug === slug) return COURSES[i];
    }
    return null;
  }

  function card(item, mode) {
    var footer = "";
    if (mode === "enroll") {
      footer = '<button class="mm-enroll-btn" type="button" data-enroll="' + item.slug + '">Enroll</button>';
    } else if (mode === "soon") {
      footer = '<span class="mm-soon-label">Coming soon</span>';
    } else {
      footer = '<a class="mm-course-start" href="' + item.href + '">Start course</a>';
    }
    return '<div class="my-course-item_ic_my_course_item__xJ2Yg mm-course-card">' +
      '<div class="my-course-item_ic_thumbnail__ZUJh_"><img alt="' + item.title + ' cover" loading="lazy" width="1200" height="900" src="' + item.cover + '"></div>' +
      '<div class="my-course-item_ic_content_wrap__gsWjf">' +
      '<div class="my-course-item_ic_title_progress__5fpCZ ic_my_course_progress"><h5>' + item.title + "</h5></div>" +
      '<div class="my-course-item_ic_duration_continue__p_VmT">' + footer + "</div>" +
      "</div></div>";
  }

  function render() {
    var list = enrolled();
    var slugs = list.map(function (item) { return item.slug; });

    myGrid.innerHTML = list.map(function (item) {
      var match = known(item.slug);
      return card({
        title: item.title || (match ? match.title : item.slug),
        cover: match ? match.cover : "/images/brand/mindmark-course.svg",
        href: match && match.href ? match.href : "/course/" + item.slug + "/"
      }, "start");
    }).join("");
    myGrid.hidden = list.length === 0;
    myEmpty.hidden = list.length > 0;

    catalog.innerHTML = COURSES.filter(function (course) {
      return slugs.indexOf(course.slug) === -1;
    }).map(function (course) {
      return card(course, course.open ? "enroll" : "soon");
    }).join("");
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-enroll]");
    if (!button) return;
    var course = known(button.getAttribute("data-enroll"));
    if (!course) return;

    var all = readAll();
    var list = Array.isArray(all[user]) ? all[user] : [];
    if (!list.some(function (item) { return item.slug === course.slug; })) {
      list.push({ slug: course.slug, title: course.title, at: Date.now() });
    }
    all[user] = list;
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch (error) {
      /* storage unavailable */
    }

    render();
    var block = document.querySelector("[data-my-courses-block]");
    if (block && block.scrollIntoView) {
      block.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  render();
})();
