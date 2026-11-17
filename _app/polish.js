/* MindMark polish layer: header elevation + scroll reveals */
(function () {
  "use strict";

  /* --- header gains a soft shadow once the page moves --- */
  var header = document.querySelector(".header_ic_header_wrap__Ncj34");
  if (header) {
    var ticking = false;
    var syncHeader = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
      ticking = false;
    };
    syncHeader();
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(syncHeader);
        }
      },
      { passive: true }
    );
  }

  /* --- reveal-on-scroll choreography --- */
  if (!("IntersectionObserver" in window)) return;

  var SELECTOR = [
    ".ic_course_card",
    ".ic_choose_card",
    ".we-deliver_ic_deliver_card__1P0Dl",
    ".ic_header"
  ].join(",");

  var targets = [];
  var nodes = document.querySelectorAll(SELECTOR);
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    var rect = el.getBoundingClientRect();
    /* never hide something the visitor is already looking at */
    if (rect.top < window.innerHeight * 0.92) continue;
    if (rect.width === 0 && rect.height === 0) continue;
    el.classList.add("mm-reveal");
    targets.push(el);
  }

  /* stagger cards inside the same row so they cascade instead of popping */
  targets.forEach(function (el) {
    var group = el.parentElement || el;
    var idx = Array.prototype.indexOf.call(group.children, el);
    el.style.transitionDelay = Math.min(idx, 3) * 80 + "ms";
  });

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("mm-in");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
  );

  targets.forEach(function (el) {
    observer.observe(el);
  });
})();

/* ---------- faq accordion ---------- */
(function () {
  function toggle(item) {
    var isOpen = item.classList.contains("ant-collapse-item-active");
    item.classList.toggle("ant-collapse-item-active", !isOpen);
    var header = item.querySelector(".ant-collapse-header");
    if (header) header.setAttribute("aria-expanded", isOpen ? "false" : "true");
  }

  document.addEventListener("click", function (e) {
    var target = e.target;
    if (!target || !target.closest) return;
    var header = target.closest(".ant-collapse-header");
    if (!header) return;
    var item = header.closest(".ant-collapse-item");
    if (item) toggle(item);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
    var target = e.target;
    if (!target || !target.closest) return;
    var header = target.closest(".ant-collapse-header");
    if (!header) return;
    e.preventDefault();
    var item = header.closest(".ant-collapse-item");
    if (item) toggle(item);
  });
})();
