(function () {
  var C = window.MindMarkCore;
  var tabs = document.querySelector(".lesson_ic_course_tab___4Bt8");
  var wrap = document.querySelector(".lesson_ic_practice_item_wrap___A1sZ");
  if (!tabs || !wrap) return;

  var buttons = [].slice.call(tabs.querySelectorAll("button"));
  var state = { course: null, bank: null, tab: "ELA", busy: true, token: 0 };
  var TABS = {
    ELA: "ELA",
    MATH: "MATH",
    ESSENTIALS: "ESSENTIALS",
    "Practice Test": "TEST",
    FMQ: "FMQ",
    "My Notes": "NOTES"
  };
  var TAB_PARAMS = {
    ela: "ELA",
    math: "MATH",
    essentials: "ESSENTIALS",
    practice: "Practice Test",
    "practice-test": "Practice Test",
    test: "Practice Test",
    fmq: "FMQ",
    notes: "My Notes"
  };
  var initialLabel =
    TAB_PARAMS[(new URLSearchParams(window.location.search).get("tab") || "").toLowerCase()] || "ELA";
  state.tab = TABS[initialLabel] || "ELA";

  wrap.querySelectorAll(".lesson_ic_practice_item_mb__SzKk4").forEach(function (node) {
    node.remove();
  });
  var panel = document.createElement("div");
  panel.id = "mindmark-panel";
  panel.className = "mindmark-panel";
  wrap.appendChild(panel);

  var timerModal = document.createElement("div");
  timerModal.className = "mindmark-modal-backdrop";
  timerModal.hidden = true;
  document.body.appendChild(timerModal);
  var timerChoice = 1;
  var timerTarget = null;

  function timeTypes() {
    return (
      (state.course && state.course.examTimeTypes) || [
        { label: "Timed", value: 1 },
        { label: "One and half", value: 1.5 },
        { label: "Double", value: 2 },
        { label: "Non timed", value: -1 }
      ]
    );
  }

  function selectedLabel() {
    var found = timeTypes().find(function (type) {
      return Number(type.value) === Number(timerChoice);
    });
    return found ? found.label : "Timed";
  }

  function openTimer(target) {
    timerTarget = target;
    timerChoice = 1;
    var options = timeTypes()
      .map(function (type) {
        return (
          '<li data-time-value="' +
          type.value +
          '"' +
          (Number(type.value) === 1 ? ' class="selected"' : "") +
          ">" +
          C.esc(type.label) +
          "</li>"
        );
      })
      .join("");
    timerModal.innerHTML =
      '<div class="mindmark-modal" role="dialog" aria-modal="true" aria-labelledby="mindmark-timer-title">' +
      '<button class="mindmark-modal-close" data-modal-close aria-label="Close">×</button>' +
      '<h2 id="mindmark-timer-title">Choose Your Timer Option</h2>' +
      '<p class="mindmark-modal-sub">Once you’ve started, you cannot change this selection.</p>' +
      '<div class="mindmark-select" id="mindmark-timer-select">' +
      '<button type="button" class="mindmark-select-trigger" data-select-toggle><span>' +
      C.esc(selectedLabel()) +
      '</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>' +
      '<ul class="mindmark-select-menu">' +
      options +
      "</ul></div>" +
      '<p class="mindmark-caution"><strong>Caution:</strong> Click Next to save your response. Using Back or Review before clicking Next will erase your answer.</p>' +
      '<div class="mindmark-modal-actions"><button class="mindmark-modal-start" data-modal-start>Start ' +
      (target.kind === "test" ? "Test" : "Lesson") +
      "</button></div></div>";
    timerModal.hidden = false;
  }

  function closeTimer() {
    timerModal.hidden = true;
    timerModal.innerHTML = "";
    timerTarget = null;
  }

  timerModal.addEventListener("click", function (event) {
    if (event.target === timerModal || event.target.closest("[data-modal-close]")) {
      closeTimer();
      return;
    }
    var toggle = event.target.closest("[data-select-toggle]");
    if (toggle) {
      var select = toggle.closest(".mindmark-select");
      select.classList.toggle("open");
      return;
    }
    var option = event.target.closest("[data-time-value]");
    if (option) {
      timerChoice = Number(option.dataset.timeValue);
      var menu = timerModal.querySelector(".mindmark-select-menu");
      menu.querySelectorAll("li").forEach(function (item) {
        item.classList.toggle("selected", item === option);
      });
      timerModal.querySelector("[data-select-toggle] span").textContent = selectedLabel();
      timerModal.querySelector(".mindmark-select").classList.remove("open");
      return;
    }
    var start = event.target.closest("[data-modal-start]");
    if (start && timerTarget) {
      var target = timerTarget;
      var time = timerChoice;
      closeTimer();
      window.location.href =
        "/course-lessons/lesson/?" +
        (target.kind === "test" ? "test=" : "slug=") +
        encodeURIComponent(target.key) +
        "&time=" +
        time;
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !timerModal.hidden) closeTimer();
  });

  function setActive(label) {
    buttons.forEach(function (button) {
      if (button.textContent.trim() === label) button.classList.add("lesson_active__ABBDE");
      else button.classList.remove("lesson_active__ABBDE");
    });
  }

  function lessonRows(subject) {
    var lessons = state.course.lessons.filter(function (lesson) {
      return lesson.subject === subject;
    });
    return lessons
      .map(function (lesson) {
        var local = C.attemptsFor(lesson.slug);
        var original = lesson.attempts || [];
        var last = local[local.length - 1];
        var originalLast = original[original.length - 1];
        var draft = C.draftFor(lesson.slug);
        var status;
        var action;

        if (draft) {
          var answered = (draft.answers || []).filter(function (answer) {
            return answer != null && answer !== "";
          }).length;
          status =
            "In progress here · " +
            answered +
            " of " +
            (lesson.totalQuiz || (draft.ids || []).length) +
            " answered";
          action =
            '<button data-resume="' +
            C.esc(lesson.slug) +
            '" data-time="' +
            draft.time +
            '">Resume</button>';
        } else if (last) {
          status =
            "Practice here: <strong>" +
            last.score +
            "</strong> · " +
            C.esc(String(last.correct) + "/" + last.total + " correct") +
            " · " +
            C.fmtDate(new Date(last.at).toISOString());
          action = '<button data-start="' + C.esc(lesson.slug) + '">Practice again</button>';
        } else if (originalLast) {
          var pct = C.percent(originalLast.correct, originalLast.total);
          status =
            originalLast.status === "in_progress"
              ? "In progress on MindMark · resume where you left off"
              : "Completed " +
                C.fmtDate(originalLast.completedAt || originalLast.startedAt) +
                " · Score <strong>" +
                pct +
                "</strong>";
          action = '<button data-start="' + C.esc(lesson.slug) + '">Start lesson</button>';
        } else {
          status = "Not started · " + lesson.totalQuiz + " questions";
          action = '<button data-start="' + C.esc(lesson.slug) + '">Start lesson</button>';
        }

        var reviewable = !draft && (Boolean(last) || Boolean(originalLast && originalLast.status === "completed"));
        if (reviewable) {
          status =
            '<button class="mindmark-status-link" data-review="' +
            C.esc(lesson.slug) +
            '" title="Review your answers">' +
            status +
            "</button>";
        }

        return (
          '<div class="lesson_ic_practice_item_mb__SzKk4">' +
          '<div class="lesson_ic_practice_item__hvduK">' +
          '<div class="lesson_item_title__3YupR">' +
          '<div class="lesson_item_left__cGe10">' +
          '<div class="lesson_ic_lesson_icon__bkj3S"></div>' +
          "<p>" + C.esc(lesson.title) + "</p>" +
          "</div>" +
          '<div class="lesson_item_right__KSILF">' +
          action +
          "</div>" +
          "</div>" +
          '<div class="lesson_ic_completed_time__m81e2">' +
          '<div class="lesson_ic_score__peJjZ lesson_ic_score_completed__UdwVF">' +
          '<span class="lesson_ic_progress_row_left__5L9bI"><p class="ic_secondary">' +
          status +
          "</p></span>" +
          "</div>" +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderLessons(subject) {
    var rows = lessonRows(subject);
    panel.innerHTML = rows
      ? '<div class="mindmark-list">' + rows + "</div>"
      : '<div class="mindmark-empty">No lessons in this section yet.</div>';
  }

  function renderTests() {
    var rows = state.course.practices
      .map(function (practice) {
        var local = C.attemptsFor(practice.slug);
        var last = local[local.length - 1];
        var draft = C.draftFor(practice.slug);
        var status = practice.locked
          ? "Locked · not included in this copy"
          : practice.totalQuiz
            ? "4 modules · adaptive Module 2 · 98 questions · 2 hr 14 min + 10 min break"
            : "This test has not been copied yet";
        if (draft) {
          var answered = (draft.answers || []).filter(function (answer) {
            return answer != null && answer !== "";
          }).length;
          status = "In progress here · " + answered + " of " + (draft.ids || []).length + " answered";
        } else if (last) {
          status = "Practice here: <strong>" + last.score + "</strong> · " + C.fmtDate(new Date(last.at).toISOString());
        }
        var action = practice.locked
          ? "<button disabled>Locked</button>"
          : draft
            ? '<button data-resume="' +
              C.esc(practice.slug) +
              '" data-test="1" data-time="' +
              draft.time +
              '">Resume</button>'
            : last
              ? '<button data-test="' + C.esc(practice.slug) + '">Practice again</button>'
              : '<button data-test="' + C.esc(practice.slug) + '">Start test</button>';
        if (last && !draft && !practice.locked) {
          status =
            '<button class="mindmark-status-link" data-review-test="' +
            C.esc(practice.slug) +
            '" title="Review your answers">' +
            status +
            "</button>";
        }
        return (
          '<div class="lesson_ic_practice_item_mb__SzKk4">' +
          '<div class="lesson_ic_practice_item__hvduK">' +
          '<div class="lesson_item_title__3YupR">' +
          '<div class="lesson_item_left__cGe10">' +
          '<div class="lesson_ic_lesson_icon__bkj3S"></div>' +
          "<p>" +
          C.esc(practice.name) +
          ' <span class="lesson_ic_attempt_text__YxKnB">' +
          (local.length ? local.length + " attempt" + (local.length === 1 ? "" : "s") + " here" : "Not started") +
          "</span></p>" +
          "</div>" +
          '<div class="lesson_item_right__KSILF">' +
          action +
          "</div>" +
          "</div>" +
          '<div class="lesson_ic_completed_time__m81e2">' +
          '<div class="lesson_ic_score__peJjZ lesson_ic_score_completed__UdwVF">' +
          '<span class="lesson_ic_progress_row_left__5L9bI"><p class="ic_secondary">' +
          status +
          "</p></span>" +
          "</div>" +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");
    panel.innerHTML = rows ? '<div class="mindmark-list">' + rows + "</div>" : "";
  }

  function optionLabel(question, index) {
    if (index == null || index === "" || !question.options[index]) return "no answer";
    return String.fromCharCode(65 + index) + ". " + question.options[index].html;
  }

  async function renderMissed() {
    var token = ++state.token;
    var slugs = Object.keys(C.attempts()).filter(function (slug) {
      return C.attemptsFor(slug).length;
    });
    if (!slugs.length) {
      panel.innerHTML =
        '<div class="mindmark-empty"><h3>Nothing missed yet.</h3><p>Finish a lesson and the questions you miss will collect here with the explanation.</p></div>';
      return;
    }
    panel.innerHTML = '<div class="mindmark-empty"><h3>Loading missed questions…</h3></div>';
    var index = await C.questionIndex(slugs);
    if (token !== state.token) return;
    var rows = [];
    slugs.forEach(function (slug) {
      var lesson = state.course.lessons.find(function (item) {
        return item.slug === slug;
      });
      C.attemptsFor(slug).forEach(function (attempt) {
        (attempt.ids || []).forEach(function (id, i) {
          var entry = index[id];
          if (!entry) return;
          var question = entry.question;
          if (C.isCorrect(question, attempt.answers[i])) return;
          var given = attempt.answers[i];
          var answers =
            question.type === "saq"
              ? '<span class="wrong">You wrote: ' +
                C.esc(String(given == null || given === "" ? "no answer" : given)) +
                '</span><span class="right">Correct: ' +
                C.esc(question.answer) +
                "</span>"
              : '<span class="wrong">You chose: ' +
                C.cleanHtml(optionLabel(question, given)) +
                '</span><span class="right">Correct: ' +
                C.cleanHtml(optionLabel(question, C.correctIndex(question))) +
                "</span>";
          rows.push(
            '<article class="mindmark-miss">' +
              '<div class="mindmark-miss-top"><span>' +
              C.esc(lesson ? lesson.title : slug) +
              '</span><span class="mindmark-tag">Missed</span></div>' +
              '<div class="mindmark-rich mindmark-miss-question">' +
              C.cleanHtml(question.html) +
              "</div>" +
              '<div class="mindmark-miss-answers">' +
              answers +
              "</div>" +
              (question.explanation
                ? '<div class="mindmark-rich mindmark-why">' + C.cleanHtml(question.explanation) + "</div>"
                : "") +
              "</article>"
          );
        });
      });
    });
    panel.innerHTML = rows.length
      ? '<div class="mindmark-list">' + rows.join("") + "</div>"
      : '<div class="mindmark-empty"><h3>Nothing missed yet.</h3><p>Every question you have answered here has been correct.</p></div>';
  }

  function renderNotes() {
    var list = C.notesFor(state.course.slug);
    var cards = list
      .map(function (note) {
        return (
          '<article class="mindmark-note">' +
          "<h3>" +
          C.esc(note.title) +
          "</h3><p>" +
          C.esc(note.body) +
          "</p><footer><span>" +
          C.fmtDate(new Date(note.at).toISOString()) +
          '</span><button data-del-note="' +
          C.esc(note.id) +
          '">Delete</button></footer></article>'
        );
      })
      .join("");
    panel.innerHTML =
      '<div class="mindmark-notes">' +
      '<div class="mindmark-note-form">' +
      '<input id="mindmark-note-title" placeholder="Title — e.g. Semicolons" />' +
      '<textarea id="mindmark-note-body" rows="4" placeholder="Two complete sentences need a semicolon, not a comma."></textarea>' +
      '<div class="mindmark-note-actions"><span>Saved in this browser</span><button data-add-note="1">Add note</button></div>' +
      "</div>" +
      (cards
        ? '<div class="mindmark-note-grid">' + cards + "</div>"
        : '<div class="mindmark-empty"><h3>The margin is empty.</h3><p>Notes stay with this course, not with a single lesson.</p></div>') +
      "</div>";
  }

  function render() {
    if (state.busy) return;
    state.token += 1;
    if (state.tab === "ELA" || state.tab === "MATH" || state.tab === "ESSENTIALS") renderLessons(state.tab);
    else if (state.tab === "TEST") renderTests();
    else if (state.tab === "FMQ") renderMissed();
    else renderNotes();
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      var label = button.textContent.trim();
      state.tab = TABS[label] || "ELA";
      setActive(label);
      render();
    });
  });

  panel.addEventListener("click", function (event) {
    var target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.start) {
      openTimer({ kind: "lesson", key: target.dataset.start });
    } else if (target.dataset.resume) {
      window.location.href =
        "/course-lessons/lesson/?" +
        (target.dataset.test ? "test=" : "slug=") +
        encodeURIComponent(target.dataset.resume) +
        "&time=" +
        encodeURIComponent(target.dataset.time || "-1");
    } else if (target.dataset.review) {
      window.location.href =
        "/course-lessons/lesson/?slug=" + encodeURIComponent(target.dataset.review) + "&review=1";
    } else if (target.dataset.reviewTest) {
      window.location.href =
        "/course-lessons/lesson/?test=" + encodeURIComponent(target.dataset.reviewTest) + "&review=1";
    } else if (target.dataset.test) {
      openTimer({ kind: "test", key: target.dataset.test });
    } else if (target.dataset.addNote) {
      var title = document.getElementById("mindmark-note-title");
      var body = document.getElementById("mindmark-note-body");
      if (!title.value.trim() && !body.value.trim()) return;
      var list = C.notesFor(state.course.slug);
      list.unshift({
        id: "note-" + Date.now(),
        title: title.value.trim() || "Untitled note",
        body: body.value.trim(),
        at: Date.now()
      });
      C.saveNotes(state.course.slug, list);
      renderNotes();
    } else if (target.dataset.delNote) {
      var remainingNotes = C.notesFor(state.course.slug).filter(function (note) {
        return note.id !== target.dataset.delNote;
      });
      C.saveNotes(state.course.slug, remainingNotes);
      renderNotes();
    }
  });

  C.load()
    .then(function (data) {
      state.course = data.course;
      state.bank = data.bank;
      state.busy = false;
      Object.keys(C.drafts()).forEach(function (key) {
        var draft = C.draftFor(key);
        var answered = (draft.answers || []).some(function (answer) {
          return answer != null && answer !== "";
        });
        if (!answered) C.clearDraft(key);
      });
      setActive(initialLabel);
      render();
    })
    .catch(function (error) {
      panel.innerHTML =
        '<div class="mindmark-empty"><h3>Could not load the course.</h3><p>' +
        C.esc(error.message) +
        "</p></div>";
    });
})();
