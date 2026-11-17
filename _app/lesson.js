(function () {
  var C = window.MindMarkCore;
  var app = document.getElementById("app");
  var timerEl = document.getElementById("mindmark-timer");
  var params = new URLSearchParams(window.location.search);
  var slug = params.get("slug");
  var testSlug = params.get("test");
  var review = params.get("review") === "1";
  var requestedTime = Number(params.get("time"));
  if (!isFinite(requestedTime)) requestedTime = -1;

  var state = {
    course: null,
    bank: null,
    lesson: null,
    test: null,
    questions: [],
    index: 0,
    answers: [],
    seconds: 0,
    done: false,
    timeType: requestedTime,
    limit: null,
    key: testSlug || slug,
    modules: null,
    adaptive: null,
    adapt: {},
    moduleIndex: 0,
    moduleSeconds: 0,
    breakLeft: 0,
    onBreak: false,
    eliminateMode: false,
    eliminated: {},
    timerHidden: false,
    reviewed: {},
    reviewAttempt: null,
    reviewById: null
  };

  function letter(index) {
    return String.fromCharCode(65 + index);
  }

  function showClock() {
    if (state.onBreak) {
      timerEl.textContent = C.fmtClock(state.breakLeft);
      timerEl.title = "Break remaining";
      return;
    }
    var elapsed = state.modules ? state.moduleSeconds : state.seconds;
    if (state.limit != null) {
      timerEl.textContent = C.fmtClock(Math.max(0, state.limit - elapsed));
      timerEl.title = state.modules ? "Module time remaining" : "Time remaining";
    } else {
      timerEl.textContent = C.fmtClock(elapsed);
      timerEl.title = state.modules ? "Module time elapsed" : "Time elapsed";
    }
  }

  function hasAnyAnswer() {
    return state.answers.some(function (answer) {
      return answer != null && answer !== "";
    });
  }

  function persistDraft() {
    if (state.done || review || !state.questions.length || !hasAnyAnswer()) return;
    C.saveDraft(state.key, {
      kind: state.test ? "test" : "lesson",
      time: state.timeType,
      index: state.index,
      answers: state.answers.slice(),
      seconds: state.seconds,
      moduleIndex: state.moduleIndex,
      moduleSeconds: state.moduleSeconds,
      adapt: state.adapt,
      ids: state.questions.map(function (question) {
        return question.id;
      }),
      updatedAt: Date.now()
    });
  }

  function startTimer() {
    window.clearInterval(state.timer);
    showClock();
    state.timer = window.setInterval(function () {
      if (state.done || state.onBreak) return;
      state.seconds += 1;
      if (state.modules) state.moduleSeconds += 1;
      showClock();
      if (state.seconds % 5 === 0) persistDraft();
      if (state.limit == null) return;
      if (state.modules) {
        if (state.moduleSeconds >= state.limit) endModule(true);
      } else if (state.seconds >= state.limit) {
        submit(true);
      }
    }, 1000);
  }

  function stopTimer() {
    window.clearInterval(state.timer);
  }

  window.addEventListener("beforeunload", persistDraft);

  function updateToolVisibility(isQuestion) {
    var question = isQuestion && state.questions ? state.questions[state.index] : null;
    var isMath = Boolean(question && String(question.subject || "").toLowerCase() === "math");
    var tools = document.querySelectorAll("[data-bluebook-calc], [data-bluebook-ref]");
    for (var i = 0; i < tools.length; i += 1) tools[i].hidden = !isMath;
  }

  function shell(content) {
    app.innerHTML = content;
    var isQuestion = content.indexOf("bluebook-question") !== -1;
    document.body.classList.toggle("mindmark-bluebook", isQuestion);
    document.body.classList.toggle("mindmark-break-active", content.indexOf("mindmark-break-screen") !== -1);
    document.body.classList.toggle("mindmark-review-active", content.indexOf("mindmark-review-page") !== -1);
    updateExamHeader(isQuestion);
    updateToolVisibility(isQuestion);
  }

  function hubTab() {
    if (state.test) return "practice";
    var subject = state.lesson && state.lesson.subject ? String(state.lesson.subject).toLowerCase() : "ela";
    if (subject === "math") return "math";
    if (subject === "essentials") return "essentials";
    return "ela";
  }

  function hubHref() {
    return "/course-lessons/digital-sat-learning-hub/?tab=" + hubTab();
  }

  function updateExamHeader(isQuestion) {
    var hubLink = document.getElementById("bluebook-back-hub");
    if (hubLink) hubLink.href = hubHref();
    var section = document.getElementById("bluebook-section");
    var tier = document.getElementById("bluebook-tier");
    if (!section) return;
    var module = state.modules ? state.modules[state.moduleIndex] : null;
    var label = "MindMark";
    if (state.test) {
      label =
        isQuestion && module
          ? (module.subject === "math" ? "Section 2: " : "Section 1: ") + module.label
          : state.test.name;
    } else if (state.lesson) {
      label = (isQuestion ? "Lesson: " : "") + state.lesson.title;
    }
    section.textContent = label;
    section.title = label;
    if (!tier) return;
    var tierName = "";
    if (isQuestion && state.test && module && module.label.indexOf("Module 2") !== -1) {
      tierName = (state.adapt && state.adapt[module.subject]) || "";
    }
    tier.hidden = tierName !== "easy" && tierName !== "hard";
    if (!tier.hidden) {
      tier.textContent = tierName === "easy" ? "Easier" : "Harder";
      tier.className = "mindmark-tier-tag mindmark-tier-" + tierName;
    }
  }

  function currentUserName() {
    var stored = localStorage.getItem("mindmark_copy_user") || "";
    if (stored) return stored;
    var match = document.cookie.match(/(?:^|;\s*)mindmark_session_user=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function studentName() {
    try {
      var user = currentUserName();
      var profiles = JSON.parse(localStorage.getItem("mindmark_copy_profiles") || "{}");
      if (user && profiles[user] && profiles[user].name) return profiles[user].name;
      return user || "Student";
    } catch (error) {
      return "Student";
    }
  }

  function isMathContext() {
    var question = state.questions[state.index];
    var subject = question && question.subject ? question.subject : state.lesson ? state.lesson.subject : "";
    return String(subject || "").toLowerCase() !== "ela";
  }

  function destroyCalculator() {
    var overlay = document.querySelector(".mindmark-calc-overlay");
    if (!overlay) return;
    if (overlay.__onKey) document.removeEventListener("keydown", overlay.__onKey);
    overlay.remove();
    document.body.classList.remove("mindmark-calc-open");
    if (window.__lenis && window.__lenis.start) window.__lenis.start();
  }

  function closeCalculator() {
    var overlay = document.querySelector(".mindmark-calc-overlay");
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove("mindmark-calc-open");
    if (window.__lenis && window.__lenis.start) window.__lenis.start();
    var trigger = document.getElementById("mindmark-desmos");
    if (trigger) trigger.focus();
  }

  function openCalculator() {
    var open = document.querySelector(".mindmark-calc-overlay");
    if (open) {
      open.hidden = false;
      document.body.classList.add("mindmark-calc-open");
      if (window.__lenis && window.__lenis.stop) window.__lenis.stop();
      open.querySelector(".mindmark-calc-close").focus();
      return;
    }
    var overlay = document.createElement("div");
    overlay.className = "mindmark-calc-overlay";
    overlay.innerHTML =
      '<div class="mindmark-calc-window" role="dialog" aria-modal="true" aria-label="Desmos graphing calculator">' +
      '<div class="mindmark-calc-bar"><span>Calculator</span>' +
      '<button type="button" class="mindmark-calc-close" aria-label="Close calculator">×</button></div>' +
      '<div class="mindmark-calc-body"><p class="mindmark-calc-loading">Loading Desmos…</p>' +
      '<iframe title="Desmos graphing calculator" src="https://www.desmos.com/calculator" loading="lazy" allow="fullscreen"></iframe></div>' +
      "</div>";
    document.body.appendChild(overlay);
    var frame = overlay.querySelector("iframe");
    var loading = overlay.querySelector(".mindmark-calc-loading");
    frame.addEventListener("load", function () {
      if (loading) loading.hidden = true;
    });
    document.body.classList.add("mindmark-calc-open");
    if (window.__lenis && window.__lenis.stop) window.__lenis.stop();
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeCalculator();
    });
    overlay.querySelector(".mindmark-calc-close").addEventListener("click", closeCalculator);
    overlay.__onKey = function (event) {
      if (event.key === "Escape" && !overlay.hidden) closeCalculator();
    };
    document.addEventListener("keydown", overlay.__onKey);
    overlay.querySelector(".mindmark-calc-close").focus();
  }

  function syncCalculator(show) {
    var existing = document.getElementById("mindmark-desmos");
    if (!show) {
      if (existing) existing.remove();
      destroyCalculator();
      return;
    }
    if (existing) return;
    var button = document.createElement("button");
    button.type = "button";
    button.id = "mindmark-desmos";
    button.className = "mindmark-desmos";
    button.title = "Open the Desmos graphing calculator";
    button.setAttribute("aria-label", "Open the Desmos graphing calculator");
    button.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 4v16h16"></path><path d="M6.5 15.5c2.2 0 2.6-8 5-8s2.8 8 5 8"></path></svg>' +
      "<span>Desmos</span>";
    button.addEventListener("click", openCalculator);
    document.body.appendChild(button);
  }

  function referenceSheetMarkup() {
    return [
      '<div class="mindmark-ref-sheet">',
      '<span class="mindmark-ref-tag">REFERENCE</span>',
      '<div class="mindmark-ref-row mindmark-ref-row--top">',
      '<div class="mindmark-ref-item">',
      '<svg viewBox="0 0 150 108" role="img" aria-label="Circle with radius r">',
      '<circle cx="75" cy="54" r="34" fill="none" stroke="currentColor" stroke-width="1.5"></circle>',
      '<circle cx="75" cy="54" r="2" fill="currentColor"></circle>',
      '<line x1="75" y1="54" x2="99" y2="54" stroke="currentColor" stroke-width="1.2"></line>',
      '<text x="84" y="48" font-family="Arial" font-size="14" font-style="italic">r</text>',
      '</svg>',
      '<div class="ref-formula">A = πr<sup>2</sup><br>C = 2πr</div>',
      '</div>',
      '<div class="mindmark-ref-item">',
      '<svg viewBox="0 0 150 108" role="img" aria-label="Rectangle with length l and width w">',
      '<rect x="30" y="31" width="90" height="51" fill="none" stroke="currentColor" stroke-width="1.5"></rect>',
      '<text x="70" y="23" font-family="Arial" font-size="14" font-style="italic">ℓ</text>',
      '<text x="126" y="61" font-family="Arial" font-size="14" font-style="italic">w</text>',
      '</svg>',
      '<div class="ref-formula">A = ℓw</div>',
      '</div>',
      '<div class="mindmark-ref-item">',
      '<svg viewBox="0 0 150 108" role="img" aria-label="Triangle with base b and height h">',
      '<polygon points="25,87 125,87 88,28" fill="none" stroke="currentColor" stroke-width="1.5"></polygon>',
      '<line x1="88" y1="28" x2="88" y2="87" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 3"></line>',
      '<text x="72" y="103" font-family="Arial" font-size="14" font-style="italic">b</text>',
      '<text x="95" y="61" font-family="Arial" font-size="14" font-style="italic">h</text>',
      '</svg>',
      '<div class="ref-formula">A = <span class="ref-frac"><span>1</span><span>2</span></span>bh</div>',
      '</div>',
      '<div class="mindmark-ref-item">',
      '<svg viewBox="0 0 150 108" role="img" aria-label="Right triangle with legs a and b and hypotenuse c">',
      '<polygon points="28,87 122,87 28,28" fill="none" stroke="currentColor" stroke-width="1.5"></polygon>',
      '<path d="M28 79h8v8" fill="none" stroke="currentColor" stroke-width="1.1"></path>',
      '<text x="72" y="103" font-family="Arial" font-size="14" font-style="italic">a</text>',
      '<text x="13" y="62" font-family="Arial" font-size="14" font-style="italic">b</text>',
      '<text x="80" y="54" font-family="Arial" font-size="14" font-style="italic">c</text>',
      '</svg>',
      '<div class="ref-formula">c<sup>2</sup> = a<sup>2</sup> + b<sup>2</sup></div>',
      '</div>',
      '<div class="mindmark-ref-item mindmark-ref-special">',
      '<div class="mindmark-ref-special-grid">',
      '<svg viewBox="0 0 120 108" role="img" aria-label="45 45 90 special right triangle">',
      '<polygon points="18,87 84,87 84,21" fill="none" stroke="currentColor" stroke-width="1.4"></polygon>',
      '<path d="M84 79h8v8" fill="none" stroke="currentColor" stroke-width="1"></path>',
      '<text x="44" y="103" font-family="Arial" font-size="12" font-style="italic">s</text>',
      '<text x="89" y="58" font-family="Arial" font-size="12" font-style="italic">s</text>',
      '<text x="28" y="51" font-family="Arial" font-size="11" font-style="italic" transform="rotate(-45 38 51)">s√2</text>',
      '<text x="23" y="82" font-family="Arial" font-size="10">45°</text>',
      '<text x="61" y="35" font-family="Arial" font-size="10">45°</text>',
      '</svg>',
      '<svg viewBox="0 0 150 108" role="img" aria-label="30 60 90 special right triangle">',
      '<polygon points="12,87 100,87 100,21" fill="none" stroke="currentColor" stroke-width="1.4"></polygon>',
      '<path d="M100 79h8v8" fill="none" stroke="currentColor" stroke-width="1"></path>',
      '<text x="49" y="103" font-family="Arial" font-size="12" font-style="italic">x</text>',
      '<text x="83" y="57" font-family="Arial" font-size="12" font-style="italic">x√3</text>',
      '<text x="50" y="49" font-family="Arial" font-size="12" font-style="italic" transform="rotate(-45 58 49)">2x</text>',
      '<text x="17" y="82" font-family="Arial" font-size="10">30°</text>',
      '<text x="79" y="34" font-family="Arial" font-size="10">60°</text>',
      '</svg>',
      '</div>',
      '<div class="ref-special-title">Special Right Triangles</div>',
      '</div>',
      '</div>',
      '<div class="mindmark-ref-row mindmark-ref-row--bottom">',
      '<div class="mindmark-ref-item">',
      '<svg viewBox="0 0 150 108" role="img" aria-label="Rectangular prism with length l width w and height h">',
      '<path d="M30 40 98 40 118 25 50 25Z" fill="none" stroke="currentColor" stroke-width="1.4"></path>',
      '<path d="M30 40V87h68V40M98 87l20-15V25" fill="none" stroke="currentColor" stroke-width="1.4"></path>',
      '<text x="59" y="102" font-family="Arial" font-size="13" font-style="italic">ℓ</text>',
      '<text x="103" y="34" font-family="Arial" font-size="13" font-style="italic">w</text>',
      '<text x="19" y="66" font-family="Arial" font-size="13" font-style="italic">h</text>',
      '</svg>',
      '<div class="ref-formula">V = ℓwh</div>',
      '</div>',
      '<div class="mindmark-ref-item">',
      '<svg viewBox="0 0 150 108" role="img" aria-label="Cylinder with radius r and height h">',
      '<ellipse cx="75" cy="27" rx="31" ry="9" fill="none" stroke="currentColor" stroke-width="1.4"></ellipse>',
      '<path d="M44 27v56M106 27v56" fill="none" stroke="currentColor" stroke-width="1.4"></path>',
      '<ellipse cx="75" cy="83" rx="31" ry="9" fill="none" stroke="currentColor" stroke-width="1.4"></ellipse>',
      '<line x1="75" y1="27" x2="99" y2="27" stroke="currentColor" stroke-width="1.1"></line>',
      '<text x="84" y="21" font-family="Arial" font-size="12" font-style="italic">r</text>',
      '<line x1="115" y1="27" x2="115" y2="83" stroke="currentColor" stroke-width="1.1" stroke-dasharray="3 3"></line>',
      '<text x="119" y="58" font-family="Arial" font-size="12" font-style="italic">h</text>',
      '</svg>',
      '<div class="ref-formula">V = πr<sup>2</sup>h</div>',
      '</div>',
      '<div class="mindmark-ref-item">',
      '<svg viewBox="0 0 150 108" role="img" aria-label="Sphere with radius r">',
      '<circle cx="75" cy="54" r="34" fill="none" stroke="currentColor" stroke-width="1.4"></circle>',
      '<ellipse cx="75" cy="54" rx="34" ry="12" fill="none" stroke="currentColor" stroke-width="1.1"></ellipse>',
      '<circle cx="75" cy="54" r="2" fill="currentColor"></circle>',
      '<line x1="75" y1="54" x2="98" y2="54" stroke="currentColor" stroke-width="1.1"></line>',
      '<text x="84" y="48" font-family="Arial" font-size="12" font-style="italic">r</text>',
      '</svg>',
      '<div class="ref-formula">V = <span class="ref-frac"><span>4</span><span>3</span></span>πr<sup>3</sup></div>',
      '</div>',
      '<div class="mindmark-ref-item">',
      '<svg viewBox="0 0 150 108" role="img" aria-label="Cone with radius r and height h">',
      '<path d="M75 17 109 83M75 17 41 83" fill="none" stroke="currentColor" stroke-width="1.4"></path>',
      '<ellipse cx="75" cy="83" rx="34" ry="9" fill="none" stroke="currentColor" stroke-width="1.4"></ellipse>',
      '<line x1="75" y1="17" x2="75" y2="83" stroke="currentColor" stroke-width="1.1" stroke-dasharray="4 3"></line>',
      '<line x1="75" y1="83" x2="99" y2="83" stroke="currentColor" stroke-width="1.1"></line>',
      '<text x="84" y="77" font-family="Arial" font-size="12" font-style="italic">r</text>',
      '<text x="79" y="51" font-family="Arial" font-size="12" font-style="italic">h</text>',
      '</svg>',
      '<div class="ref-formula">V = <span class="ref-frac"><span>1</span><span>3</span></span>πr<sup>2</sup>h</div>',
      '</div>',
      '<div class="mindmark-ref-item">',
      '<svg viewBox="0 0 150 108" role="img" aria-label="Pyramid with base length l width w and height h">',
      '<path d="M75 12 35 50 90 43 120 68 60 78Z" fill="none" stroke="currentColor" stroke-width="1.4"></path>',
      '<path d="M75 12 35 50M75 12 90 43M75 12 120 68M75 12 60 78" fill="none" stroke="currentColor" stroke-width="1.1"></path>',
      '<path d="M35 50 90 43 120 68 60 78Z" fill="none" stroke="currentColor" stroke-width="1.1"></path>',
      '<line x1="75" y1="12" x2="75" y2="58" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3"></line>',
      '<text x="79" y="42" font-family="Arial" font-size="12" font-style="italic">h</text>',
      '<text x="105" y="63" font-family="Arial" font-size="11" font-style="italic">w</text>',
      '<text x="83" y="83" font-family="Arial" font-size="11" font-style="italic">ℓ</text>',
      '</svg>',
      '<div class="ref-formula">V = <span class="ref-frac"><span>1</span><span>3</span></span>ℓwh</div>',
      '</div>',
      '</div>',
      '<div class="mindmark-ref-notes">',
      '<p>The number of degrees of arc in a circle is 360.</p>',
      '<p>The number of radians of arc in a circle is 2π.</p>',
      '<p>The sum of the measures in degrees of the angles of a triangle is 180.</p>',
      '</div>',
      '</div>'
    ].join("");
  }

  function openReference() {
    if (document.querySelector(".mindmark-ref-overlay")) return;
    var overlay = document.createElement("div");
    overlay.className = "mindmark-calc-overlay mindmark-ref-overlay";
    overlay.innerHTML =
      '<div class="mindmark-calc-window mindmark-ref-window" role="dialog" aria-modal="true" aria-label="Reference sheet">' +
      '<div class="mindmark-calc-bar"><span>Reference</span>' +
      '<button type="button" class="mindmark-calc-close" aria-label="Close reference">×</button></div>' +
      '<div class="mindmark-ref-body">' +
      referenceSheetMarkup() +
      '</div></div>';
    document.body.appendChild(overlay);
    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(event) {
      if (event.key === "Escape") close();
    }
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });
    overlay.querySelector(".mindmark-calc-close").addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    overlay.querySelector(".mindmark-calc-close").focus();
  }

  function setupExamChrome() {
    var directions = document.getElementById("bluebook-directions");
    var directionsPanel = document.getElementById("bluebook-directions-panel");
    var moreButton = document.querySelector("[data-bluebook-more]");
    var morePanel = document.getElementById("bluebook-more-panel");
    var hideButton = document.getElementById("bluebook-hide");
    var calcButton = document.querySelector("[data-bluebook-calc]");
    var refButton = document.querySelector("[data-bluebook-ref]");

    function closePanels() {
      if (directionsPanel) directionsPanel.hidden = true;
      if (morePanel) morePanel.hidden = true;
      if (directions) directions.setAttribute("aria-expanded", "false");
      if (moreButton) moreButton.setAttribute("aria-expanded", "false");
    }

    if (directions && directionsPanel) {
      directions.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = directionsPanel.hidden;
        closePanels();
        directionsPanel.hidden = !open;
        directions.setAttribute("aria-expanded", String(open));
      });
    }
    if (moreButton && morePanel) {
      moreButton.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = morePanel.hidden;
        closePanels();
        morePanel.hidden = !open;
        moreButton.setAttribute("aria-expanded", String(open));
      });
    }
    var saveExit = document.getElementById("bluebook-back-hub");
    if (saveExit) {
      saveExit.addEventListener("click", function () {
        syncInput();
        persistDraft();
      });
    }
    if (calcButton) calcButton.addEventListener("click", openCalculator);
    if (refButton) refButton.addEventListener("click", openReference);
    if (hideButton) {
      hideButton.addEventListener("click", function () {
        state.timerHidden = !state.timerHidden;
        document.body.classList.toggle("bluebook-timer-hidden", state.timerHidden);
        hideButton.textContent = state.timerHidden ? "Show" : "Hide";
      });
    }
    document.addEventListener("click", function (event) {
      if (
        !event.target.closest(".bluebook-popover") &&
        !event.target.closest("#bluebook-directions") &&
        !event.target.closest("[data-bluebook-more]")
      ) {
        closePanels();
      }
    });
  }

  setupExamChrome();

  function message(title, body) {
    shell(
      '<section class="mindmark-card mindmark-message"><h1>' +
        C.esc(title) +
        "</h1><p>" +
        C.esc(body) +
        '</p><a class="mindmark-button ghost" href="' +
        hubHref() +
        '">Back to lessons</a></section>'
    );
    syncCalculator(false);
  }

  function difficultyScore(question) {
    var text =
      String(question.html || "") +
      " " +
      (question.options || [])
        .map(function (option) {
          return String(option.html || "");
        })
        .join(" ");
    var plain = text.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
    var words = plain.trim().split(/\s+/).filter(Boolean).length;
    var score = words / 40;
    if (question.type === "saq") score += 0.5;
    var hard = plain.match(
      /\b(quadratic|exponential|function f|graph of|vertex|parabola|system of equations|inequality|absolute value|similar solids|cylinder|volume|probability|standard deviation|trigonometric|radian|polynomial|frequency table|two-way table|expression equivalent|survey|webinar|cross-text|command of evidence|inference|text structure|central idea|main purpose)\b/gi
    );
    if (hard) score += hard.length * 2;
    var easy = plain.match(
      /\b(solution to the given equation|what is 10%|percent of|solve for x|linear equation|slope|y-intercept|simplify|ratio|proportion|average|nearest meaning|most nearly mean|words in context)\b/gi
    );
    if (easy) score -= easy.length * 1.6;
    return score;
  }

  function byDifficulty(list) {
    return list.slice().sort(function (a, b) {
      return difficultyScore(a) - difficultyScore(b);
    });
  }

  function buildModules(questions) {
    var ela = questions
      .filter(function (question) {
        return String(question.subject || "").toLowerCase() === "ela";
      })
      .slice(0, 81);
    var math = questions
      .filter(function (question) {
        return String(question.subject || "").toLowerCase() === "math";
      })
      .slice(0, 66);
    if (!ela.length || !math.length) return null;
    var elaM1 = ela.slice(0, 27);
    var mathM1 = math.slice(0, 22);
    var elaRest = ela.slice(27);
    var mathRest = math.slice(22);
    var elaStandard = elaRest.slice(0, 27);
    var mathStandard = mathRest.slice(0, 22);
    var adaptive = null;
    if (elaStandard.length === 27 && mathStandard.length === 22) {
      var elaSorted = byDifficulty(elaRest);
      var mathSorted = byDifficulty(mathRest);
      adaptive = {
        ela: {
          standard: elaStandard,
          easy: elaSorted.slice(0, 27),
          hard: elaSorted.slice(-27)
        },
        math: {
          standard: mathStandard,
          easy: mathSorted.slice(0, 22),
          hard: mathSorted.slice(-22)
        }
      };
    }
    var combined = elaM1.concat(elaStandard, mathM1, mathStandard);
    var modules = [];
    var at = 0;
    function addModule(subject, label, minutes, list) {
      if (!list.length) return;
      modules.push({ subject: subject, label: label, minutes: minutes, start: at, end: at + list.length });
      at += list.length;
    }
    addModule("ela", "Reading & Writing · Module 1", 32, elaM1);
    addModule("ela", "Reading & Writing · Module 2", 32, elaStandard);
    addModule("math", "Math · Module 1", 35, mathM1);
    addModule("math", "Math · Module 2", 35, mathStandard);
    return { questions: combined, modules: modules, adaptive: adaptive };
  }

  function applyTier(subject, tier) {
    var pools = state.adaptive && state.adaptive[subject];
    if (!pools || !state.modules) return;
    var module = state.modules[subject === "ela" ? 1 : 3];
    if (!module) return;
    var list = pools[tier] || pools.standard;
    if (!list || list.length !== module.end - module.start) return;
    state.questions.splice.apply(state.questions, [module.start, module.end - module.start].concat(list));
    state.adapt[subject] = pools[tier] ? tier : "standard";
    if (Array.isArray(state.answers) && state.answers.length === state.questions.length) {
      for (var index = module.start; index < module.end; index += 1) {
        state.answers[index] = null;
      }
    }
  }

  function modulePercent(module) {
    var graded = 0;
    var correct = 0;
    for (var index = module.start; index < module.end; index += 1) {
      var question = state.questions[index];
      if (!question || question.ungraded) continue;
      graded += 1;
      if (C.isCorrect(question, state.answers[index])) correct += 1;
    }
    return graded ? Math.round((correct / graded) * 100) : 0;
  }

  var HARD_MODULE_MIN_PERCENT = 60;

  function selectAdaptive(subject) {
    if (!state.adaptive || !state.adaptive[subject]) return;
    var module = state.modules[subject === "ela" ? 0 : 2];
    if (!module) return;
    var percent = modulePercent(module);
    applyTier(subject, percent < HARD_MODULE_MIN_PERCENT ? "easy" : "hard");
  }

  function currentModule() {
    return state.modules ? state.modules[state.moduleIndex] : null;
  }

  function questionBounds() {
    var module = currentModule();
    return module ? [module.start, module.end - 1] : [0, state.questions.length - 1];
  }

  function startModule(index, resume) {
    window.clearInterval(state.breakTimer);
    state.onBreak = false;
    state.moduleIndex = Math.max(0, Math.min(state.modules.length - 1, index));
    var module = state.modules[state.moduleIndex];
    state.limit = C.timerSeconds(module.minutes, state.timeType);
    if (!resume) {
      state.moduleSeconds = 0;
      state.index = module.start;
    } else {
      state.index = Math.min(Math.max(state.index, module.start), module.end - 1);
    }
    persistDraft();
    if (state.limit != null && state.moduleSeconds >= state.limit) {
      state.moduleSeconds = state.limit;
      endModule(true);
      return;
    }
    startTimer();
    renderQuestion();
  }

  function showBreak() {
    stopTimer();
    state.onBreak = true;
    state.breakLeft = 600;
    syncCalculator(false);
    shell(
      '<section class="mindmark-break-screen">' +
        '<div class="mindmark-break-inner">' +
        '<div class="mindmark-break-left">' +
        '<div class="mindmark-break-clock-card">' +
        '<p>Remaining Break Time</p>' +
        '<div class="mindmark-break-clock" id="mindmark-break-clock">10:00</div>' +
        "</div>" +
        '<button type="button" class="mindmark-break-resume" data-break-continue="1">Resume Testing</button>' +
        "</div>" +
        '<div class="mindmark-break-copy">' +
        "<h1>Practice Test Break</h1>" +
        "<p>You can resume this practice test as soon as you&#39;re ready to move on. On test day, you&#39;ll wait until the clock counts down. Read below to see how breaks work on test day.</p>" +
        "<hr>" +
        "<h2>Take a Break: Do Not Close Your Device</h2>" +
        "<p>After the break, a <strong>Resume Testing Now</strong> button will appear and you&#39;ll start the next session.</p>" +
        "<p>Follow these rules during the break:</p>" +
        "<ul>" +
        "<li>Do not disturb students who are still testing.</li>" +
        "<li>Do not exit the app or close your laptop.</li>" +
        "<li>Do not access phones, smartwatches, textbooks, notes, or the internet.</li>" +
        "<li>Do not eat or drink near any testing device.</li>" +
        "<li>Do not speak in the test room; outside the test room, do not discuss the exam with anyone.</li>" +
        "</ul>" +
        "</div>" +
        "</div>" +
        "</section>"
    );
    showClock();
    window.clearInterval(state.breakTimer);
    state.breakTimer = window.setInterval(function () {
      state.breakLeft = Math.max(0, state.breakLeft - 1);
      var clock = document.getElementById("mindmark-break-clock");
      if (clock) clock.textContent = C.fmtClock(state.breakLeft);
      showClock();
      if (state.breakLeft === 0) window.clearInterval(state.breakTimer);
    }, 1000);
  }

  function endModule(force) {
    stopTimer();
    syncInput();
    if (state.modules) {
      if (state.moduleIndex === 0) selectAdaptive("ela");
      else if (state.moduleIndex === 2) selectAdaptive("math");
    }
    persistDraft();
    var module = currentModule();
    var next = state.modules[state.moduleIndex + 1];
    if (!next) {
      finalize();
      return;
    }
    if (module && module.subject === "ela" && next.subject === "math") {
      showBreak();
      return;
    }
    startModule(state.moduleIndex + 1);
  }

  function isAnswered(index) {
    var question = state.questions[index];
    var answer = state.answers[index];
    if (question.type === "saq") return String(answer == null ? "" : answer).trim() !== "";
    return answer != null;
  }

  function syncInput() {
    var input = document.getElementById("mindmark-saq-input");
    if (input) state.answers[state.index] = input.value;
  }

  function renderQuestion() {
    var question = state.questions[state.index];
    var selected = state.answers[state.index];
    var module = currentModule();
    var bounds = questionBounds();
    var first = bounds[0];
    var last = bounds[1];
    var dots = state.questions
      .slice(first, last + 1)
      .map(function (item, offset) {
        var index = first + offset;
        var cls = "mindmark-dot";
        if (isAnswered(index)) cls += " answered";
        if (index === state.index) cls += " current";
        var flagged = Boolean(state.reviewed[index]);
        if (flagged) cls += " reviewed";
        var flag = flagged
          ? '<span class="mindmark-review-flag" aria-hidden="true"><svg viewBox="0 0 12 16"><path d="M2 1h8v14L6 11.6 2 15z"></path></svg></span>'
          : "";
        return (
          '<button class="' +
          cls +
          '" data-jump="' +
          index +
          '" aria-label="Question ' +
          (offset + 1) +
          (flagged ? ", marked for review" : "") +
          '">' +
          flag +
          (offset + 1) +
          "</button>"
        );
      })
      .join("");

    var body =
      question.type === "saq"
        ? '<div class="mindmark-saq"><input id="mindmark-saq-input" type="text" autocomplete="off" inputmode="decimal" placeholder="Type your answer" value="' +
          C.esc(selected == null ? "" : selected) +
          '" /><p>Enter a number, decimal, or fraction.</p></div>'
        : '<div class="mindmark-options bluebook-options">' +
          question.options
            .map(function (option, index) {
              var marks = state.eliminated[state.index] || {};
              var eliminated = Boolean(marks[index]);
              return (
                '<div class="bluebook-answer-row">' +
                '<div class="mindmark-option' +
                (selected != null && selected !== "" && Number(selected) === index ? " selected" : "") +
                (eliminated ? " eliminated" : "") +
                '">' +
                '<button type="button" class="bluebook-option-hit" data-choice="' +
                index +
                '"><span class="mindmark-key">' +
                letter(index) +
                '</span><span class="mindmark-rich">' +
                C.cleanHtml(option.html) +
                "</span></button>" +
                "</div>" +
                (state.eliminateMode
                  ? '<button type="button" class="bluebook-eliminate' +
                    (eliminated ? " active" : "") +
                    '" data-eliminate="' +
                    index +
                    '" aria-pressed="' +
                    eliminated +
                    '" aria-label="Cross out option ' +
                    letter(index) +
                    '"><span aria-hidden="true">' +
                    letter(index) +
                    "</span></button>"
                  : "") +
                "</div>"
              );
            })
            .join("") +
          "</div>";

    var relativeNumber = state.index - first + 1;
    var totalInModule = last - first + 1;
    var reviewed = Boolean(state.reviewed[state.index]);

    shell(
      '<section class="bluebook-question' +
        (state.eliminateMode ? " bluebook-eliminate-mode" : "") +
        '">' +
        '<div class="bluebook-toolbar">' +
        '<span class="bluebook-qnum">' +
        relativeNumber +
        "</span>" +
        '<button type="button" class="bluebook-review' +
        (reviewed ? " active" : "") +
        '" data-review-toggle aria-pressed="' +
        reviewed +
        '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"></path></svg>' +
        "<span>Review</span></button>" +
        '<span class="bluebook-toolbar-rule"></span>' +
        '<button type="button" class="bluebook-abc' +
        (state.eliminateMode ? " active" : "") +
        '" data-abc-toggle aria-pressed="' +
        Boolean(state.eliminateMode) +
        '" title="Cross out answer choices">ABC</button>' +
        "</div>" +
        '<div class="bluebook-content">' +
        '<div class="mindmark-rich bluebook-prompt">' +
        C.cleanHtml(question.html) +
        "</div>" +
        body +
        "</div>" +
        '<footer class="bluebook-footer">' +
        '<div class="bluebook-name">' +
        C.esc(studentName()) +
        "</div>" +
        '<button type="button" class="bluebook-qswitch" data-qswitch aria-expanded="false">Question ' +
        relativeNumber +
        " of " +
        totalInModule +
        ' <span aria-hidden="true">▾</span></button>' +
        '<div class="bluebook-footer-nav">' +
        '<button class="mindmark-button ghost" data-prev="1"' +
        (state.index === first ? " disabled" : "") +
        ">Back</button>" +
        (state.index === last
          ? '<button class="mindmark-button" data-submit="1">Submit</button>'
          : '<button class="mindmark-button" data-next="1">Next</button>') +
        "</div>" +
        '<div class="bluebook-jump" data-jump-panel data-lenis-prevent hidden><p>Questions</p><div class="bluebook-jump-grid">' +
        dots +
        "</div></div>" +
        "</footer>" +
        "</section>"
    );
    syncCalculator(isMathContext());
  }

  function reportSectionKey(index, question) {
    var source = question || state.questions[index];
    var subject = source && String(source.subject || "").toLowerCase();
    if (subject === "math") return "math";
    if (subject === "ela" || subject === "reading") return "rw";
    if (state.test && state.modules) {
      for (var moduleIndex = 0; moduleIndex < state.modules.length; moduleIndex += 1) {
        var module = state.modules[moduleIndex];
        if (index >= module.start && index < module.end) {
          return module.subject === "math" ? "math" : "rw";
        }
      }
    }
    return "rw";
  }

  function reportContext(index) {
    if (state.test) {
      return reportSectionKey(index) === "math" ? "Math" : "Reading & Writing";
    }
    if (state.modules) {
      for (var moduleIndex = 0; moduleIndex < state.modules.length; moduleIndex += 1) {
        var module = state.modules[moduleIndex];
        if (index >= module.start && index < module.end) return module.label;
      }
    }
    return state.lesson ? state.lesson.title : "Practice";
  }

  function scaledPracticeScore(correct, graded) {
    if (!graded) return 200;
    var ratio = Math.max(0, Math.min(1, correct / graded));
    return Math.round((200 + ratio * 600) / 10) * 10;
  }

  function practiceSkillMarkup(label, stats) {
    var percent = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
    var filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
    var segments = "";
    for (var segment = 0; segment < 10; segment += 1) {
      segments += '<span class="mindmark-test-skill-segment' + (segment < filled ? " is-on" : "") + '"></span>';
    }
    return (
      '<div class="mindmark-test-skill"><div class="mindmark-test-skill-head"><strong>' +
      label +
      "</strong><span>" +
      stats.correct +
      " of " +
      stats.total +
      " correct · " +
      percent +
      '%</span></div><div class="mindmark-test-skill-bar" role="img" aria-label="' +
      label +
      ": " +
      percent +
      '% correct">' +
      segments +
      "</div></div>"
    );
  }

  var PRACTICE_CATEGORIES = [
    { key: "information", label: "Information and Ideas" },
    { key: "craft", label: "Craft and Structure" },
    { key: "expression", label: "Expression of Ideas" },
    { key: "conventions", label: "Standard English Conventions" }
  ];

  var PRACTICE_MATH_CATEGORIES = [
    { key: "algebra", label: "Algebra" },
    { key: "advanced", label: "Advanced Math" },
    { key: "data", label: "Problem-Solving and Data Analysis" },
    { key: "geometry", label: "Geometry and Trigonometry" }
  ];

  function practiceQuestionText(question) {
    return String(question.html || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function practiceCategoryKey(question) {
    if (String(question.subject || "").toLowerCase() !== "ela") return null;
    var text = practiceQuestionText(question);
    if (/conforms to the conventions/.test(text)) return "conventions";
    if (/most logical transition/.test(text)) return "expression";
    if (/student has taken the following notes|student wants to (contrast|emphasize|introduce|explain|present)/.test(text)) return "expression";
    if (/most nearly mean|most logical and precise word or phrase|as used in the text/.test(text)) return "craft";
    if (/overall structure|structure of the text|main purpose|function of the underlined|primarily serves to|text 1[\s\S]*text 2|both authors/.test(text)) return "craft";
    return "information";
  }

  function practiceCategoryLabel(question) {
    var key = practiceCategoryKey(question);
    if (!key) return null;
    for (var index = 0; index < PRACTICE_CATEGORIES.length; index += 1) {
      if (PRACTICE_CATEGORIES[index].key === key) return PRACTICE_CATEGORIES[index].label;
    }
    return null;
  }

  function practiceMathCategoryKey(question) {
    if (String(question.subject || "").toLowerCase() !== "math") return null;
    var text = practiceQuestionText(question);
    if (
      /(parallel|intersects at|in the figure above|right triangle|hypotenuse|isosceles|equilateral|similar|triangle|rectangle|polygon|circle|radius|diameter|radian|arc length|central angle|inscribed angle|transversal|perimeter|volume|surface area|pyramid|prism|cylinder|cone|sphere|sine|cosine|tangent|\btan\b|\bsin\b|\bcos\b|xy-plane.*circle|circle.*xy-plane)/.test(
        text
      )
    )
      return "geometry";
    if (
      /(which equation|which of the following equations|which inequality|system of equations|equation models|equation represents|minimum number|monthly pass|cost less|slope|y-intercept|linear equation|linear function|solutions to the given inequality)/.test(
        text
      )
    )
      return "algebra";
    if (
      /(principal balance|approximately [0-9.]+% greater|compound interest|product of the solutions|absolute value|quadratic|polynomial|exponential|rational|radical|zeros|real solutions?|square root|sqrt|increases? by|decreases? by|growth|decay|function f|function h|function g|values of 2|which expression is equivalent|\|[^|]+\|\s*=)/.test(
        text
      )
    )
      return "advanced";
    if (
      /(probability|median|\bmode\b|\bmean\b|\baverage\b|data set|scatterplot|line of best fit|survey|sample|random|percent|percentage|\d+%|ratio|proportion|density|unit conversion|conversion|table above|two-way table|per hour|per month)/.test(
        text
      )
    )
      return "data";
    return "algebra";
  }

  function practiceMathCategoryLabel(question) {
    var key = practiceMathCategoryKey(question);
    if (!key) return null;
    for (var index = 0; index < PRACTICE_MATH_CATEGORIES.length; index += 1) {
      if (PRACTICE_MATH_CATEGORIES[index].key === key) return PRACTICE_MATH_CATEGORIES[index].label;
    }
    return null;
  }

  function practiceCategoryMarkup(category, stats, sectionTotal) {
    var percent = sectionTotal ? Math.round((stats.total / sectionTotal) * 100) : 0;
    var score = scaledPracticeScore(stats.correct, stats.graded);
    var low = Math.max(200, Math.round((score - 30) / 10) * 10);
    var high = Math.min(800, Math.round((score + 30) / 10) * 10);
    var filled = Math.max(0, Math.min(7, Math.round(((score - 200) / 600) * 7)));
    var segments = "";
    for (var segment = 0; segment < 7; segment += 1) {
      segments += '<span class="mindmark-test-category-segment' + (segment < filled ? " is-on" : "") + '"></span>';
    }
    var performance = stats.graded ? low + "–" + high : "—";
    return (
      '<div class="mindmark-test-category"><div class="mindmark-test-category-head"><strong>' +
      category.label +
      '</strong><span>(' +
      percent +
      "% of section · " +
      stats.total +
      " questions)</span></div>" +
      '<div class="mindmark-test-category-scale"><span>200</span><div class="mindmark-test-category-bar" role="img" aria-label="' +
      category.label +
      " estimated performance " +
      performance +
      '">' +
      segments +
      '</div><span>800</span></div>' +
      '<div class="mindmark-test-category-performance">Performance: <strong>' +
      performance +
      "</strong></div></div>"
    );
  }

  function reviewTabIndex(tab) {
    var attempt = state.reviewAttempt;
    var byId = state.reviewById;
    if (!attempt || !byId) return [];
    var indices = [];
    attempt.ids.forEach(function (id, index) {
      if (!byId[id]) return;
      if (tab === "all" || reportSectionKey(index, byId[id]) === tab) indices.push(index);
    });
    return indices;
  }

  function reviewAdjacentIndex(index, direction) {
    var tab = state.test && state.reviewTab ? state.reviewTab : "all";
    var indices = reviewTabIndex(tab);
    var at = indices.indexOf(index);
    if (at < 0) return null;
    var next = indices[at + direction];
    return next == null ? null : next;
  }

  function hasReviewExplanation(html) {
    return String(html || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim().length > 0;
  }

  function reviewDetailBody(question, given, reveal) {
    var ungraded = Boolean(question.ungraded);
    if (question.type === "saq") {
      var answerHtml =
        '<div class="mindmark-review-answer"><span>Your answer</span><strong>' +
        C.esc(String(given == null || given === "" ? "No answer" : given)) +
        "</strong></div>";
      var correctHtml = "";
      if (reveal && question.answer) {
        correctHtml =
          '<div class="mindmark-review-answer ok"><span>' +
          (ungraded ? "Suggested answer" : "Correct answer") +
          "</span><strong>" +
          C.esc(question.answer) +
          "</strong></div>";
      }
      return '<div class="mindmark-review-detail-answers">' + answerHtml + correctHtml + "</div>";
    }
    return (
      '<div class="mindmark-review-choice-list">' +
      question.options
        .map(function (option, optionIndex) {
          var cls = "mindmark-review-choice";
          if (Number(given) === optionIndex) cls += " selected";
          if (reveal && option.correct) cls += " correct";
          return (
            '<div class="' +
            cls +
            '">' +
            '<span class="mindmark-review-radio" aria-hidden="true"></span>' +
            '<span class="mindmark-review-choice-letter">' +
            letter(optionIndex) +
            '.</span>' +
            '<span class="mindmark-rich">' +
            C.cleanHtml(option.html) +
            "</span></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function closeReviewDetail() {
    var modal = document.querySelector("[data-review-modal]");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("mindmark-review-modal-open");
  }

  function openReviewDetail(index, keepReveal) {
    var attempt = state.reviewAttempt;
    var byId = state.reviewById;
    var modal = document.querySelector("[data-review-modal]");
    if (!attempt || !byId || !modal) return;
    var question = byId[attempt.ids[index]];
    if (!question) return;
    var given = attempt.answers[index];
    var ungraded = Boolean(question.ungraded);
    var ok = !ungraded && C.isCorrect(question, given);
    var reveal = Boolean(keepReveal && modal.dataset.reveal === "1");
    var prevIndex = reviewAdjacentIndex(index, -1);
    var nextIndex = reviewAdjacentIndex(index, 1);
    var statusClass = ungraded ? "written" : ok ? "good" : "bad";
    var statusText = ungraded
      ? "Your Answer is Saved."
      : ok
        ? "Your Answer is Correct."
        : "Your Answer is Incorrect.";
    var eye =
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    var explanation = "";
    if (reveal && question.explanation && hasReviewExplanation(question.explanation)) {
      explanation =
        '<div class="mindmark-review-detail-explanation"><span>Explanation</span><div class="mindmark-rich">' +
        C.cleanHtml(question.explanation) +
        "</div></div>";
    }

    modal.dataset.index = String(index);
    modal.dataset.reveal = reveal ? "1" : "0";
    var body = modal.querySelector("[data-review-modal-body]");
    body.innerHTML =
      '<div class="mindmark-review-detail-top">' +
      '<span class="mindmark-review-qbadge" title="' +
      C.esc(reportContext(index)) +
      '">' +
      (index + 1) +
      "</span>" +
      '<div class="mindmark-rich mindmark-review-detail-question">' +
      C.cleanHtml(question.html) +
      "</div>" +
      "</div>" +
      reviewDetailBody(question, given, reveal) +
      explanation +
      '<div class="mindmark-review-detail-footer">' +
      '<div class="mindmark-review-detail-state">' +
      '<span class="mindmark-review-verdict ' +
      statusClass +
      '">' +
      statusText +
      "</span>" +
      '<button type="button" class="mindmark-review-reveal" data-review-reveal="1">' +
      (reveal ? "Hide The Correct Answer" : "Show The Correct Answer") +
      eye +
      "</button>" +
      "</div>" +
      '<div class="mindmark-review-detail-nav">' +
      '<button type="button" class="mindmark-review-nav-button" data-review-prev="1"' +
      (prevIndex == null ? " disabled" : "") +
      ">Previous</button>" +
      '<button type="button" class="mindmark-review-nav-button primary" data-review-next="1"' +
      (nextIndex == null ? " disabled" : "") +
      ">Next</button>" +
      "</div>" +
      "</div>";
    modal.hidden = false;
    document.body.classList.add("mindmark-review-modal-open");
    var dialog = modal.querySelector(".mindmark-review-detail-dialog");
    if (dialog) {
      dialog.focus();
      dialog.scrollTop = 0;
    }
  }

  function toggleReviewDetailAnswer() {
    var modal = document.querySelector("[data-review-modal]");
    if (!modal || modal.hidden) return;
    modal.dataset.reveal = modal.dataset.reveal === "1" ? "0" : "1";
    openReviewDetail(Number(modal.dataset.index), true);
  }

  function setTestReviewTab(tab) {
    var counts = state.testReviewCounts && state.testReviewCounts[tab];
    if (!counts) return;
    state.reviewTab = tab;
    document.querySelectorAll("[data-test-tab]").forEach(function (button) {
      var active = button.getAttribute("data-test-tab") === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".mindmark-review-table tbody tr[data-section]").forEach(function (row) {
      row.hidden = tab !== "all" && row.getAttribute("data-section") !== tab;
    });
    document.querySelectorAll("[data-test-section]").forEach(function (group) {
      group.hidden = tab !== "all" && group.getAttribute("data-test-section") !== tab;
    });
    ["total", "correct", "incorrect"].forEach(function (key) {
      var node = document.querySelector('[data-test-overview="' + key + '"]');
      if (node) node.textContent = counts[key];
    });
  }

  document.addEventListener("click", function (event) {
    if (event.target.closest("[data-review-close]")) closeReviewDetail();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && document.querySelector("[data-review-modal]:not([hidden])")) closeReviewDetail();
  });

  function renderReport(attempt) {
    stopTimer();
    syncCalculator(false);
    state.done = true;
    state.reviewAttempt = attempt;
    var byId = {};
    state.questions.forEach(function (question) {
      byId[question.id] = question;
    });
    state.reviewById = byId;

    var isTest = Boolean(state.test);
    var totalQuestions = attempt.ids.length;
    var sectionStats = {
      all: { total: 0, graded: 0, correct: 0 },
      rw: { total: 0, graded: 0, correct: 0 },
      math: { total: 0, graded: 0, correct: 0 }
    };
    var categoryStats = {};
    var mathCategoryStats = {};
    if (isTest) {
      PRACTICE_CATEGORIES.forEach(function (category) {
        categoryStats[category.key] = { total: 0, graded: 0, correct: 0 };
      });
      PRACTICE_MATH_CATEGORIES.forEach(function (category) {
        mathCategoryStats[category.key] = { total: 0, graded: 0, correct: 0 };
      });
      attempt.ids.forEach(function (id, index) {
        var question = byId[id];
        if (!question) return;
        var key = reportSectionKey(index, question);
        ["all", key].forEach(function (name) {
          var bucket = sectionStats[name];
          bucket.total += 1;
          if (!question.ungraded) {
            bucket.graded += 1;
            if (C.isCorrect(question, attempt.answers[index])) bucket.correct += 1;
          }
        });
        if (key === "rw" && !question.ungraded) {
          var categoryKey = practiceCategoryKey(question);
          var categoryBucket = categoryKey && categoryStats[categoryKey];
          if (categoryBucket) {
            categoryBucket.total += 1;
            categoryBucket.graded += 1;
            if (C.isCorrect(question, attempt.answers[index])) categoryBucket.correct += 1;
          }
        }
        if (key === "math") {
          var mathCategoryKey = practiceMathCategoryKey(question);
          var mathCategoryBucket = mathCategoryKey && mathCategoryStats[mathCategoryKey];
          if (mathCategoryBucket) {
            mathCategoryBucket.total += 1;
            if (!question.ungraded) {
              mathCategoryBucket.graded += 1;
              if (C.isCorrect(question, attempt.answers[index])) mathCategoryBucket.correct += 1;
            }
          }
        }
      });
    }
    var totalCorrect = isTest ? sectionStats.all.correct : attempt.correct;
    var totalGraded = isTest ? sectionStats.all.graded : attempt.total;
    var incorrect = isTest
      ? Math.max(0, totalQuestions - totalCorrect)
      : Math.max(0, totalGraded - totalCorrect);
    state.reviewTab = "all";
    state.testReviewCounts = null;
    var ungradedCount = 0;
    var missedGroups = {};
    var missedCount = 0;
    var rows = attempt.ids
      .map(function (id, index) {
        var question = byId[id];
        if (!question) return "";
        var given = attempt.answers[index];
        var ungraded = Boolean(question.ungraded);
        var ok = !ungraded && C.isCorrect(question, given);
        var context = reportContext(index);
        var rowSection = reportSectionKey(index, question);
        var insightGroup = isTest
          ? rowSection === "math"
            ? practiceMathCategoryLabel(question) || "Math"
            : practiceCategoryLabel(question) || "Reading & Writing"
          : context;
        var correctLabel =
          question.type === "saq"
            ? question.answer || "See explanation"
            : C.correctIndex(question) >= 0
              ? letter(C.correctIndex(question))
              : "—";
        var statusText;
        var statusClass;
        if (ungraded) {
          ungradedCount += 1;
          statusText = "Written";
          statusClass = "written";
        } else if (given == null || given === "") {
          statusText = "No answer";
          statusClass = "neutral";
        } else if (ok) {
          statusText = "Correct";
          statusClass = "good";
        } else {
          statusText = "Incorrect";
          statusClass = "bad";
        }
        if (!ungraded && !ok) {
          missedCount += 1;
          missedGroups[insightGroup] = (missedGroups[insightGroup] || 0) + 1;
        }
        return (
          '<tr data-section="' +
          rowSection +
          '">' +
          '<td class="mindmark-review-num">' +
          (index + 1) +
          "</td>" +
          '<td class="mindmark-review-context" title="' +
          C.esc(context) +
          '">' +
          C.esc(context) +
          "</td>" +
          '<td class="mindmark-review-answer-cell">' +
          C.esc(String(correctLabel)) +
          "</td>" +
          '<td class="mindmark-review-answer-cell"><span class="mindmark-answer-status ' +
          statusClass +
          '">' +
          statusText +
          "</span></td>" +
          '<td class="mindmark-review-time">—</td>' +
          '<td class="mindmark-review-action-cell"><button type="button" class="mindmark-review-link" data-review-index="' +
          index +
          '">Review</button></td>' +
          "</tr>"
        );
      })
      .join("");

    var groupRows = Object.keys(missedGroups)
      .map(function (name) {
        return (
          '<div class="mindmark-insight-row"><span>' +
          C.esc(name) +
          "</span><strong>" +
          missedGroups[name] +
          " missed</strong></div>"
        );
      })
      .join("");
    var insightsBody = missedCount
      ? '<p>Focus your review on the questions marked Incorrect. Open <strong>Review</strong> beside any question to see the correct answer and explanation.</p>' +
        '<div class="mindmark-insight-groups">' +
        groupRows +
        "</div>"
      : "<p>No auto-scored questions were missed. Open any question below to revisit the answer and explanation.</p>";

    var activityTitle = state.lesson ? state.lesson.title : state.test.name;
    var dateLabel = C.fmtDate(new Date(attempt.at).toISOString());
    var writtenNote = ungradedCount
      ? " · " +
        ungradedCount +
        " student-produced response" +
        (ungradedCount === 1 ? "" : "s") +
        " saved but not auto-scored."
      : "";
    var rwStats = sectionStats.rw;
    var mathStats = sectionStats.math;
    var rwScore = scaledPracticeScore(rwStats.correct, rwStats.graded);
    var mathScore = scaledPracticeScore(mathStats.correct, mathStats.total);
    var totalScore = rwScore + mathScore;
    var readingCategoryMarkup = isTest
      ? PRACTICE_CATEGORIES.map(function (category) {
          return practiceCategoryMarkup(category, categoryStats[category.key], rwStats.total);
        }).join("")
      : "";
    var mathCategoryMarkup = isTest
      ? PRACTICE_MATH_CATEGORIES.map(function (category) {
          return practiceCategoryMarkup(category, mathCategoryStats[category.key], mathStats.total);
        }).join("")
      : "";
    var testPanelMarkup = "";
    if (isTest) {
      state.testReviewCounts = {
        all: { total: totalQuestions, correct: totalCorrect, incorrect: incorrect },
        rw: {
          total: rwStats.total,
          correct: rwStats.correct,
          incorrect: Math.max(0, rwStats.graded - rwStats.correct)
        },
        math: {
          total: mathStats.total,
          correct: mathStats.correct,
          incorrect: Math.max(0, mathStats.total - mathStats.correct)
        }
      };
      testPanelMarkup =
        '<div class="mindmark-test-summary-panel">' +
        '<div class="mindmark-test-tabs" role="tablist" aria-label="Practice test sections">' +
        '<button type="button" class="mindmark-test-tab is-active" data-test-tab="all" role="tab" aria-selected="true">All</button>' +
        '<button type="button" class="mindmark-test-tab" data-test-tab="rw" role="tab" aria-selected="false">Reading &amp; Writing</button>' +
        '<button type="button" class="mindmark-test-tab" data-test-tab="math" role="tab" aria-selected="false">Math</button>' +
        "</div>" +
        '<div class="mindmark-test-scorecards">' +
        '<div class="mindmark-test-score-card"><span>Your Total Score</span><strong>' +
        totalScore +
        "</strong><small>OUT OF 1600</small></div>" +
        '<div class="mindmark-test-score-card"><span>Your Reading &amp; Writing Score</span><strong>' +
        rwScore +
        "</strong><small>OUT OF 800</small></div>" +
        '<div class="mindmark-test-score-card"><span>Your Math Score</span><strong>' +
        mathScore +
        "</strong><small>OUT OF 800</small></div>" +
        "</div>" +
        '<p class="mindmark-test-score-note">Attempted ' +
        dateLabel +
        ". Scaled scores are estimates based on section totals.</p>" +
        '<p class="mindmark-test-structure-note">Reading &amp; Writing <strong>' +
        rwStats.total +
        "</strong> questions (2 × 27) · Math <strong>" +
        mathStats.total +
        "</strong> questions (2 × 22)</p>" +
        '<div class="mindmark-test-skills">' +
        "<h2>Knowledge and Skills</h2>" +
        "<p>View your performance across each category of this practice test.</p>" +
        '<div class="mindmark-test-skill-group" data-test-section="rw">' +
        '<div class="mindmark-test-skill-group-head"><strong>Reading &amp; Writing</strong><span>' +
        rwStats.total +
        " questions</span></div>" +
        readingCategoryMarkup +
        "</div>" +
        '<div class="mindmark-test-skill-group" data-test-section="math">' +
        '<div class="mindmark-test-skill-group-head"><strong>Math</strong><span>' +
        mathStats.total +
        " questions</span></div>" +
        mathCategoryMarkup +
        "</div>" +
        "</div>" +
        "</div>";
    }

    var headingMarkup =
      '<div class="mindmark-review-heading' +
      (isTest ? " mindmark-test-heading" : "") +
      '">' +
      "<div>" +
      '<p class="mindmark-eyebrow">' +
      (isTest ? "Practice test" : "Score report") +
      "</p>" +
      "<h1>" +
      (isTest
        ? 'Score Summary <span class="mindmark-test-heading-name">- ' + C.esc(state.test.name) + "</span>"
        : "Review your results") +
      "</h1>" +
      '<p class="mindmark-review-subtitle">' +
      (isTest
        ? "Take more practice tests and check your score reports to see what areas need improvement."
        : C.esc(activityTitle) + " · " + dateLabel + writtenNote) +
      "</p>" +
      "</div>" +
      (isTest
        ? ""
        : '<div class="mindmark-review-score"><strong>' +
          attempt.score +
          '%</strong><span>Score</span></div>') +
      "</div>";

    function testCountAttr(key) {
      return isTest ? ' data-test-overview="' + key + '"' : "";
    }

    var summaryMarkup =
      '<div class="mindmark-review-summary">' +
      '<div class="mindmark-summary-card"><strong' +
      testCountAttr("total") +
      ">" +
      totalQuestions +
      "</strong><span>Total Questions</span></div>" +
      '<div class="mindmark-summary-card"><strong' +
      testCountAttr("correct") +
      ">" +
      totalCorrect +
      "</strong><span>Correct</span></div>" +
      '<div class="mindmark-summary-card"><strong' +
      testCountAttr("incorrect") +
      ">" +
      incorrect +
      "</strong><span>Incorrect</span></div>" +
      "</div>";

    var overviewHeadingMarkup = isTest
      ? '<div class="mindmark-questions-overview-head"><h2>Questions Overview</h2><p>Review your results for each question from this practice test.</p></div>'
      : "";
    var countNoteMarkup =
      isTest && ungradedCount
        ? '<p class="mindmark-test-count-note">' +
          ungradedCount +
          " student-produced response" +
          (ungradedCount === 1 ? "" : "s") +
          " included in the section total but not auto-scored.</p>"
        : "";
    var detailsMarkup =
      '<details class="mindmark-review-insights">' +
      '<summary><span class="mindmark-insights-title">Areas of Improvement <span>Detailed insights</span></span>' +
      '<svg class="mindmark-insights-chevron" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
      "</summary>" +
      '<div class="mindmark-insights-body">' +
      insightsBody +
      "</div>" +
      "</details>";

    shell(
      '<section class="mindmark-review-page">' +
        '<div class="mindmark-review-shell">' +
        '<header class="mindmark-review-topbar">' +
        '<a class="mindmark-review-brand" href="/" aria-label="MindMark home"><img src="/images/brand/mindmark-lockup.svg" alt="MindMark"></a>' +
        '<div class="mindmark-review-topbar-actions">' +
        '<a class="mindmark-review-back" href="' +
        hubHref() +
        '"><svg class="mindmark-review-back-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"></path><path d="m12 19-7-7 7-7"></path></svg>Back to lessons</a>' +
        '<div class="mindmark-review-student"><span>Student Name</span><strong>' +
        C.esc(studentName()) +
        "</strong></div>" +
        "</div>" +
        "</header>" +
        headingMarkup +
        (isTest
          ? testPanelMarkup +
            detailsMarkup +
            overviewHeadingMarkup +
            summaryMarkup +
            countNoteMarkup
          : summaryMarkup + detailsMarkup) +
        '<div class="mindmark-review-table-wrap">' +
        '<table class="mindmark-review-table">' +
        "<thead><tr><th>Question</th><th>" +
        (state.test ? "Section" : "Lesson") +
        "</th><th class=\"mindmark-review-center\">Correct Answer</th><th class=\"mindmark-review-center\">Your Answer</th><th class=\"mindmark-review-center\">Time Spent</th><th>Actions</th></tr></thead>" +
        "<tbody>" +
        rows +
        "</tbody></table></div>" +
        '<p class="mindmark-review-note">N.B. This review retains answers and explanations from this attempt only.</p>' +
        '<div class="mindmark-review-actions">' +
        '<button class="mindmark-button" data-retry="1">Take it again</button>' +
        '<a class="mindmark-button ghost" href="' +
        hubHref() +
        '">Back to lessons</a>' +
        "</div>" +
        "</div>" +
        '<div class="mindmark-review-modal" data-review-modal hidden>' +
        '<button type="button" class="mindmark-review-backdrop" data-review-close aria-label="Close question review"></button>' +
        '<div class="mindmark-review-detail-dialog" role="dialog" aria-modal="true" aria-label="Question review" tabindex="-1">' +
        '<button type="button" class="mindmark-review-detail-close" data-review-close aria-label="Close">×</button>' +
        '<div data-review-modal-body></div>' +
        "</div>" +
        "</div>" +
        "</section>"
    );
  }

  function finalize() {
    var graded = state.questions.filter(function (question) {
      return !question.ungraded;
    });
    var correct = graded.reduce(function (sum, question) {
      return sum + (C.isCorrect(question, state.answers[state.questions.indexOf(question)]) ? 1 : 0);
    }, 0);
    var attempt = {
      at: Date.now(),
      score: C.percent(correct, graded.length),
      correct: correct,
      total: graded.length,
      seconds: state.seconds,
      ids: state.questions.map(function (question) {
        return question.id;
      }),
      answers: state.answers.slice()
    };
    C.clearDraft(state.key);
    C.saveAttempt(state.test ? state.test.slug : state.lesson.slug, attempt);
    renderReport(attempt);
  }

  function completeModule(force) {
    var module = currentModule();
    var unanswered = 0;
    for (var index = module.start; index < module.end; index += 1) {
      if (!isAnswered(index)) unanswered += 1;
    }
    if (
      unanswered &&
      !force &&
      !window.confirm(
        unanswered + " question(s) in this module are unanswered and will count as missed. Complete this module?"
      )
    ) {
      return;
    }
    endModule();
  }

  function submit(force) {
    syncInput();
    if (state.modules) {
      completeModule(force);
      return;
    }
    var unanswered = state.questions.filter(function (question, index) {
      return !isAnswered(index);
    }).length;
    if (
      unanswered &&
      !force &&
      !window.confirm(unanswered + " question(s) are unanswered and will count as missed. Submit?")
    ) {
      return;
    }
    finalize();
  }

  function localTest(bank, count) {
    var pool = [];
    bank.lessons.forEach(function (lesson) {
      lesson.questions.forEach(function (question) {
        pool.push({
          id: question.id,
          type: "mcq",
          html:
            (question.passage ? "<p>" + C.esc(question.passage) + "</p>" : "") +
            "<p>" +
            C.esc(question.prompt) +
            "</p>",
          explanation: question.explanation ? "<p>" + C.esc(question.explanation) + "</p>" : "",
          options: question.choices.map(function (choice, index) {
            return { html: C.esc(choice), correct: index === question.answer };
          })
        });
      });
    });
    var picked = [];
    var step = Math.max(1, Math.floor(pool.length / count));
    for (var i = 0; i < count && pool.length; i += 1) {
      picked.push(pool.splice((i * step) % pool.length, 1)[0]);
    }
    return picked;
  }

  function mindmarkAttempt(content, lesson) {
    var questions = content.questions || [];
    var hasAnswers = questions.some(function (question) {
      return (question.selected != null && question.selected !== "") || question.wasCorrect;
    });
    if (!hasAnswers || !lesson.attempts.length) return null;
    var answers = questions.map(function (question) {
      if (question.type === "saq") return question.selected == null ? "" : String(question.selected);
      if (question.selected == null || question.selected === "") return null;
      var index = question.options.findIndex(function (option) {
        return String(option.id) === String(question.selected);
      });
      return index >= 0 ? index : null;
    });
    var correct = questions.reduce(function (sum, question) {
      return sum + (question.wasCorrect ? 1 : 0);
    }, 0);
    var last = lesson.attempts[lesson.attempts.length - 1] || {};
    var at = Date.now();
    if (last.completedAt) {
      var parsed = new Date(String(last.completedAt).replace(" ", "T"));
      if (!isNaN(parsed.getTime())) at = parsed.getTime();
    }
    return {
      at: at,
      score: C.percent(correct, questions.length),
      correct: correct,
      total: questions.length,
      seconds: last.seconds || 0,
      ids: questions.map(function (question) {
        return question.id;
      }),
      answers: answers,
      source: "mindmark"
    };
  }

  function begin(questions, baseMinutes) {
    var built = state.test ? buildModules(questions) : null;
    state.modules = built ? built.modules : null;
    state.adaptive = built ? built.adaptive : null;
    state.adapt = {};
    if (built) questions = built.questions;
    state.questions = questions;
    var draft = review ? null : C.draftFor(state.key);
    if (draft && draft.adapt) {
      if (draft.adapt.ela) applyTier("ela", draft.adapt.ela);
      if (draft.adapt.math) applyTier("math", draft.adapt.math);
    }
    var draftHasAnswers =
      draft &&
      Array.isArray(draft.answers) &&
      draft.answers.some(function (answer) {
        return answer != null && answer !== "";
      });
    if (draft && !draftHasAnswers) {
      C.clearDraft(state.key);
      draft = null;
    }
    if (draft && Array.isArray(draft.ids) && draft.ids.length === questions.length) {
      state.timeType = Number(draft.time);
      if (!isFinite(state.timeType)) state.timeType = requestedTime;
      state.answers = Array.isArray(draft.answers) ? draft.answers.slice() : questions.map(function () {
        return null;
      });
      state.index = Math.min(Math.max(0, Number(draft.index) || 0), questions.length - 1);
      state.seconds = Math.max(0, Number(draft.seconds) || 0);
      state.moduleIndex = state.modules
        ? Math.min(Math.max(0, Number(draft.moduleIndex) || 0), state.modules.length - 1)
        : 0;
      state.moduleSeconds = state.modules ? Math.max(0, Number(draft.moduleSeconds) || 0) : 0;
    } else {
      if (draft) C.clearDraft(state.key);
      state.answers = questions.map(function () {
        return null;
      });
      state.index = 0;
      state.seconds = 0;
      state.timeType = requestedTime;
      state.moduleIndex = 0;
      state.moduleSeconds = 0;
    }
    if (state.modules) {
      var module = state.modules[state.moduleIndex];
      state.index = Math.min(Math.max(state.index, module.start), module.end - 1);
      startModule(state.moduleIndex, true);
      return;
    }
    state.limit = C.timerSeconds(baseMinutes, state.timeType);
    if (state.limit != null && state.seconds >= state.limit) {
      state.seconds = state.limit;
      submit(true);
      return;
    }
    startTimer();
    renderQuestion();
  }

  var jumpScrollFrame = 0;
  var jumpScrollGrid = null;
  var jumpScrollTarget = 0;
  var jumpScrollCurrent = 0;

  function stopJumpScroll() {
    if (jumpScrollFrame) window.cancelAnimationFrame(jumpScrollFrame);
    jumpScrollFrame = 0;
    jumpScrollGrid = null;
    jumpScrollTarget = 0;
    jumpScrollCurrent = 0;
  }

  function animateJumpScroll() {
    if (!jumpScrollGrid) return;
    var grid = jumpScrollGrid;
    var max = grid.scrollHeight - grid.clientHeight;
    if (max <= 0) {
      stopJumpScroll();
      return;
    }
    jumpScrollTarget = Math.max(0, Math.min(max, jumpScrollTarget));
    var distance = jumpScrollTarget - jumpScrollCurrent;
    if (Math.abs(distance) < 0.5) {
      jumpScrollCurrent = jumpScrollTarget;
      grid.scrollTop = jumpScrollTarget;
      stopJumpScroll();
      return;
    }
    jumpScrollCurrent += distance * 0.14;
    grid.scrollTop = jumpScrollCurrent;
    jumpScrollFrame = window.requestAnimationFrame(animateJumpScroll);
  }

  function queueJumpScroll(grid, delta) {
    var max = grid.scrollHeight - grid.clientHeight;
    if (max <= 0) return;
    if (jumpScrollFrame) window.cancelAnimationFrame(jumpScrollFrame);
    if (jumpScrollGrid !== grid) {
      jumpScrollGrid = grid;
      jumpScrollCurrent = grid.scrollTop;
      jumpScrollTarget = grid.scrollTop;
    }
    jumpScrollTarget = Math.max(0, Math.min(max, jumpScrollTarget + delta));
    jumpScrollFrame = window.requestAnimationFrame(animateJumpScroll);
  }

  app.addEventListener(
    "wheel",
    function (event) {
      var target = event.target;
      var grid = target && target.closest ? target.closest(".bluebook-jump-grid") : null;
      if (!grid) return;
      var max = grid.scrollHeight - grid.clientHeight;
      if (max <= 0) return;
      var delta = event.deltaY;
      if (event.deltaMode === 1) delta *= 16;
      else if (event.deltaMode === 2) delta *= grid.clientHeight;
      event.preventDefault();
      event.stopPropagation();
      queueJumpScroll(grid, delta);
    },
    { passive: false }
  );

  app.addEventListener("pointerdown", function (event) {
    var target = event.target;
    if (target && target.closest && target.closest(".bluebook-jump-grid")) stopJumpScroll();
  });

  app.addEventListener("click", function (event) {
    var target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.reviewToggle != null) {
      state.reviewed[state.index] = !state.reviewed[state.index];
      renderQuestion();
    } else if (target.dataset.abcToggle != null) {
      state.eliminateMode = !state.eliminateMode;
      renderQuestion();
    } else if (target.dataset.eliminate != null) {
      var choice = Number(target.dataset.eliminate);
      var marks = state.eliminated[state.index] || (state.eliminated[state.index] = {});
      if (marks[choice]) delete marks[choice];
      else {
        marks[choice] = true;
        if (Number(state.answers[state.index]) === choice) state.answers[state.index] = null;
      }
      renderQuestion();
    } else if (target.dataset.qswitch != null) {
      stopJumpScroll();
      var jumpPanel = document.querySelector("[data-jump-panel]");
      if (jumpPanel) {
        jumpPanel.hidden = !jumpPanel.hidden;
        target.setAttribute("aria-expanded", String(!jumpPanel.hidden));
      }
    } else if (target.dataset.choice != null) {
      var picked = Number(target.dataset.choice);
      var crossed = state.eliminated[state.index] && state.eliminated[state.index][picked];
      if (!crossed) {
        state.answers[state.index] = picked;
        persistDraft();
      }
      renderQuestion();
    } else if (target.dataset.next != null) {
      syncInput();
      state.index = Math.min(questionBounds()[1], state.index + 1);
      persistDraft();
      renderQuestion();
    } else if (target.dataset.prev != null) {
      syncInput();
      state.index = Math.max(questionBounds()[0], state.index - 1);
      persistDraft();
      renderQuestion();
    } else if (target.dataset.jump != null) {
      syncInput();
      state.index = Number(target.dataset.jump);
      persistDraft();
      renderQuestion();
    } else if (target.dataset.submit != null) {
      submit();
    } else if (target.dataset.breakContinue != null) {
      startModule(state.moduleIndex + 1);
    } else if (target.dataset.reviewIndex != null) {
      openReviewDetail(Number(target.dataset.reviewIndex));
    } else if (target.dataset.reviewReveal != null) {
      toggleReviewDetailAnswer();
    } else if (target.dataset.reviewPrev != null) {
      var reviewModal = document.querySelector("[data-review-modal]");
      var previousReview = reviewAdjacentIndex(Number(reviewModal.dataset.index), -1);
      if (previousReview != null) openReviewDetail(previousReview);
    } else if (target.dataset.reviewNext != null) {
      var nextReviewModal = document.querySelector("[data-review-modal]");
      var followingReview = reviewAdjacentIndex(Number(nextReviewModal.dataset.index), 1);
      if (followingReview != null) openReviewDetail(followingReview);
    } else if (target.dataset.testTab != null) {
      setTestReviewTab(target.dataset.testTab);
    } else if (target.dataset.retry != null) {
      window.location.href =
        (state.test
          ? "/course-lessons/lesson/?test=" + encodeURIComponent(state.test.slug)
          : "/course-lessons/lesson/?slug=" + encodeURIComponent(state.lesson.slug)) +
        "&time=" +
        encodeURIComponent(state.timeType);
    }
  });

  app.addEventListener("input", function (event) {
    if (event.target.id === "mindmark-saq-input") {
      state.answers[state.index] = event.target.value;
      persistDraft();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (state.done || state.onBreak || event.target.tagName === "INPUT") return;
    if (!document.querySelector(".mindmark-question")) return;
    var bounds = questionBounds();
    var numeric = Number(event.key);
    if (numeric >= 1 && numeric <= 4 && state.questions[state.index].type !== "saq") {
      var marks = state.eliminated[state.index] || {};
      if (!marks[numeric - 1]) {
        state.answers[state.index] = numeric - 1;
        renderQuestion();
      }
    }
    if (event.key === "ArrowRight" && state.index < bounds[1]) {
      state.index += 1;
      renderQuestion();
    }
    if (event.key === "ArrowLeft" && state.index > bounds[0]) {
      state.index -= 1;
      renderQuestion();
    }
  });

  C.load()
    .then(function (data) {
      state.course = data.course;
      state.bank = data.bank;

      if (testSlug) {
        state.test = state.course.practices.find(function (practice) {
          return practice.slug === testSlug;
        });
        if (!state.test) return message("Test not found.", "That practice test is not in this course.");
        if (state.test.locked) {
          return message("This test is locked.", "Purchase it from the course page to unlock the attempts.");
        }
        var local = C.attemptsFor(state.test.slug);
        return C.loadPractice(state.test.slug)
          .then(function (content) {
            state.questions = content.questions;
            if (review) {
              if (!local.length) {
                return message(
                  "No review available yet.",
                  "This test has no saved answers to review. Take it here and its report will be kept."
                );
              }
              var attempt = local[local.length - 1];
              var byId = {};
              state.questions.forEach(function (question) {
                byId[question.id] = question;
              });
              var picked = attempt.ids.map(function (id) {
                return byId[id];
              }).filter(Boolean);
              if (picked.length !== attempt.ids.length) {
                state.questions = localTest(state.bank, 10);
                return renderReport(attempt);
              }
              state.questions = picked;
              return renderReport(attempt);
            }
            begin(content.questions, content.minutes || 134);
          })
          .catch(function () {
            var questions = localTest(state.bank, 10);
            state.questions = questions;
            if (review) {
              if (!local.length) {
                return message(
                  "No review available yet.",
                  "This test has no saved answers to review. Take it here and its report will be kept."
                );
              }
              return renderReport(local[local.length - 1]);
            }
            begin(questions, 32);
          });
      }

      state.lesson = state.course.lessons.find(function (item) {
        return item.slug === slug;
      });
      if (!state.lesson) return message("Lesson not found.", "That lesson is not part of this course.");

      return C.loadLesson(state.lesson.slug).then(function (content) {
        state.questions = content.questions;
        var localAttempts = C.attemptsFor(state.lesson.slug);
        if (review) {
          if (!localAttempts.length) {
            var captured = mindmarkAttempt(content, state.lesson);
            if (captured) {
              state.questions = content.questions;
              return renderReport(captured);
            }
            return message(
              "No review available yet.",
              "This lesson has no saved answers to review. Take it here and its report will be kept."
            );
          }
          var attempt = localAttempts[localAttempts.length - 1];
          var byId = {};
          state.questions.forEach(function (question) {
            byId[question.id] = question;
          });
          state.questions = attempt.ids.map(function (id) {
            return byId[id];
          }).filter(Boolean);
          return renderReport(attempt);
        }
        begin(state.questions, state.lesson.time || 30);
      });
    })
    .catch(function (error) {
      message("Could not open the lesson.", error.message);
    });
})();
