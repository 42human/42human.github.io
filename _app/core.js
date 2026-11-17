window.MindMarkCore = (function () {
  var ATTEMPTS = "mindmark_attempts_v1";
  var NOTES = "mindmark_notes_v1";
  var DRAFTS = "mindmark_drafts_v1";
  var USER = "mindmark_copy_user";
  var SESSION_COOKIE = "mindmark_session_user";
  var lessonCache = {};

  function sessionUser() {
    var match = document.cookie.match(new RegExp("(?:^|;\\s*)" + SESSION_COOKIE + "=([^;]+)"));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function currentUser() {
    try {
      return localStorage.getItem(USER) || sessionUser() || "";
    } catch (error) {
      return sessionUser();
    }
  }

  function scope() {
    return currentUser();
  }

  function scopedKey(key) {
    var user = scope();
    return user ? key + ":" + user : key;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var MATHML_NS = "http://www.w3.org/1998/Math/MathML";

  function repairEmptyRootIndices(doc) {
    doc.querySelectorAll("mrow").forEach(function (row) {
      var children = [].slice.call(row.children);
      for (var index = 0; index < children.length - 1; index += 1) {
        var msup = children[index];
        var root = children[index + 1];
        if (!msup || !root || msup.tagName.toLowerCase() !== "msup" || root.tagName.toLowerCase() !== "msqrt") continue;
        if (msup.children.length < 2) continue;
        var base = msup.children[0];
        if (!base || base.tagName.toLowerCase() !== "mrow" || base.textContent.trim() !== "") continue;
        var exponent = msup.children[1];
        var radicand = doc.createElementNS(MATHML_NS, "mrow");
        [].slice.call(root.children).forEach(function (child) {
          radicand.appendChild(child.cloneNode(true));
        });
        var mroot = doc.createElementNS(MATHML_NS, "mroot");
        mroot.appendChild(radicand);
        mroot.appendChild(exponent.cloneNode(true));
        row.replaceChild(mroot, msup);
        row.removeChild(root);
        index += 1;
      }
    });
  }

  function repairEmptySuperscripts(doc) {
    doc.querySelectorAll("span.katex").forEach(function (span) {
      var top = span.querySelector(".katex-mathml > math > semantics > mrow") || span.querySelector(".katex-mathml > math > mrow");
      if (!top) return;
      var children = [].slice.call(top.children).filter(function (child) {
        return child.tagName.toLowerCase() !== "annotation";
      });
      if (children.length !== 1 || children[0].tagName.toLowerCase() !== "msup") return;
      var msup = children[0];
      if (msup.children.length < 2) return;
      var base = msup.children[0];
      if (!base || base.tagName.toLowerCase() !== "mrow" || base.textContent.trim() !== "") return;
      var exponent = msup.children[1];
      var previous = span.previousSibling;
      var previousText = previous ? String(previous.textContent || "") : "";
      if (!/[\w\u00C0-\uFFFF)\]}]\s*$/.test(previousText)) return;
      var sup = doc.createElement("sup");
      sup.className = "mindmark-exponent";
      if (exponent.querySelector("mfrac, msqrt, mroot, msup, msub, mrow")) {
        var math = doc.createElementNS(MATHML_NS, "math");
        math.setAttribute("xmlns", MATHML_NS);
        var row = doc.createElementNS(MATHML_NS, "mrow");
        row.appendChild(exponent.cloneNode(true));
        math.appendChild(row);
        sup.appendChild(math);
      } else {
        sup.textContent = exponent.textContent;
      }
      span.parentNode.replaceChild(sup, span);
    });
  }

  function cleanHtml(html) {
    if (!html) return "";
    var doc = new DOMParser().parseFromString(String(html), "text/html");
    doc.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach(function (node) {
      node.remove();
    });
    repairEmptyRootIndices(doc);
    repairEmptySuperscripts(doc);
    doc.querySelectorAll("*").forEach(function (el) {
      [].slice.call(el.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var value = attr.value;
        if (name.indexOf("on") === 0) el.removeAttribute(attr.name);
        if (name === "href" && /^\s*javascript:/i.test(value)) el.removeAttribute(attr.name);
        if (name === "srcset") el.removeAttribute(attr.name);
      });
      if (el.tagName === "IMG") {
        var src = el.getAttribute("src") || "";
        if (src.indexOf("//") === 0) el.setAttribute("src", "https:" + src);
        else if (src.charAt(0) === "/") el.setAttribute("src", src);
        el.setAttribute("loading", "lazy");
      }
      if (el.tagName === "A") {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    });
    return doc.body.innerHTML;
  }

  function read(key, fallback) {
    try {
      var scoped = scopedKey(key);
      var raw = localStorage.getItem(scoped);
      if (raw == null && scope()) {
        var legacy = localStorage.getItem(key);
        if (legacy != null) {
          localStorage.setItem(scoped, legacy);
          localStorage.removeItem(key);
          raw = legacy;
        }
      }
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(scopedKey(key), JSON.stringify(value));
    } catch (error) {
      /* private mode or full storage */
    }
  }

  function attempts() {
    return read(ATTEMPTS, {});
  }

  function attemptsFor(slug) {
    return attempts()[slug] || [];
  }

  function saveAttempt(slug, attempt) {
    var all = attempts();
    all[slug] = (all[slug] || []).concat([attempt]);
    write(ATTEMPTS, all);
    return all[slug];
  }

  function notes() {
    return read(NOTES, {});
  }

  function notesFor(course) {
    return notes()[course] || [];
  }

  function saveNotes(course, list) {
    var all = notes();
    all[course] = list;
    write(NOTES, all);
  }

  function drafts() {
    return read(DRAFTS, {});
  }

  function draftFor(key) {
    return drafts()[key] || null;
  }

  function saveDraft(key, draft) {
    var all = drafts();
    all[key] = draft;
    write(DRAFTS, all);
  }

  function clearDraft(key) {
    var all = drafts();
    delete all[key];
    write(DRAFTS, all);
  }

  function timerSeconds(baseMinutes, type) {
    var value = Number(type);
    if (value === -1) return null;
    var multiplier = value === 1.5 ? 1.5 : value === 2 ? 2 : 1;
    return Math.round((Number(baseMinutes) || 30) * 60 * multiplier);
  }

  async function loadLesson(slug) {
    if (lessonCache[slug]) return lessonCache[slug];
    var response = await fetch("/_data/lessons/" + encodeURIComponent(slug) + ".json");
    if (!response.ok) throw new Error("Lesson content is missing for " + slug);
    var data = await response.json();
    lessonCache[slug] = data;
    return data;
  }

  async function loadPractice(slug) {
    if (lessonCache["practice:" + slug]) return lessonCache["practice:" + slug];
    var response = await fetch("/_data/practices/" + encodeURIComponent(slug) + ".json");
    if (!response.ok) throw new Error("Practice test content is missing for " + slug);
    var data = await response.json();
    lessonCache["practice:" + slug] = data;
    return data;
  }

  function correctIndex(question) {
    for (var i = 0; i < question.options.length; i += 1) {
      if (question.options[i].correct) return i;
    }
    return -1;
  }

  function numeric(value) {
    var text = String(value == null ? "" : value).trim().replace(/,/g, "").replace(/\s+/g, "");
    if (!text) return null;
    var percent = /^(-?\d+(?:\.\d+)?)%$/.exec(text);
    if (percent) return parseFloat(percent[1]) / 100;
    var fraction = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(text);
    if (fraction) {
      var denominator = parseFloat(fraction[2]);
      if (denominator !== 0) return parseFloat(fraction[1]) / denominator;
    }
    if (/^-?\d+(?:\.\d+)?$/.test(text)) return parseFloat(text);
    return null;
  }

  function answerMatches(question, given) {
    if (given == null) return false;
    var expected = question.answer || "";
    var left = numeric(given);
    var right = numeric(expected);
    if (left != null && right != null) return Math.abs(left - right) < 1e-6;
    return (
      String(given).trim().toLowerCase().replace(/\s+/g, "") ===
      String(expected).trim().toLowerCase().replace(/\s+/g, "")
    );
  }

  function isCorrect(question, answer) {
    if (answer == null || answer === "") return false;
    if (question.type === "saq") return answerMatches(question, answer);
    return Number(answer) === correctIndex(question) && correctIndex(question) !== -1;
  }

  async function questionIndex(slugs) {
    var map = {};
    for (var i = 0; i < slugs.length; i += 1) {
      try {
        var lesson = await loadLesson(slugs[i]);
        lesson.questions.forEach(function (question) {
          map[question.id] = { question: question, lesson: lesson };
        });
      } catch (error) {
        /* skip a lesson whose file is missing */
      }
    }
    return map;
  }

  function fmtClock(total) {
    var seconds = Math.max(0, Math.floor(total || 0));
    var minutes = Math.floor(seconds / 60);
    var rest = seconds % 60;
    return (minutes < 10 ? "0" : "") + minutes + ":" + (rest < 10 ? "0" : "") + rest;
  }

  function fmtDate(value) {
    if (!value) return "";
    var date = new Date(String(value).replace(" ", "T"));
    if (isNaN(date.getTime())) return "";
    return (
      String(date.getMonth() + 1).padStart(2, "0") +
      "/" +
      String(date.getDate()).padStart(2, "0") +
      "/" +
      date.getFullYear()
    );
  }

  function percent(correct, total) {
    return total ? Math.round((correct / total) * 100) : 0;
  }

  async function load() {
    var responses = await Promise.all([fetch("/_data/course.json"), fetch("/_data/questions.json")]);
    var course = await responses[0].json();
    var bank = await responses[1].json();
    return { course: course, bank: bank };
  }

  return {
    esc: esc,
    cleanHtml: cleanHtml,
    load: load,
    loadLesson: loadLesson,
    loadPractice: loadPractice,
    attempts: attempts,
    attemptsFor: attemptsFor,
    drafts: drafts,
    draftFor: draftFor,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    timerSeconds: timerSeconds,
    saveAttempt: saveAttempt,
    notes: notes,
    notesFor: notesFor,
    saveNotes: saveNotes,
    correctIndex: correctIndex,
    isCorrect: isCorrect,
    answerMatches: answerMatches,
    questionIndex: questionIndex,
    fmtClock: fmtClock,
    fmtDate: fmtDate,
    percent: percent
  };
})();
