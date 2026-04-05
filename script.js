(() => {
  "use strict";

  // ---- Scroll progress bar ----
  const progressBar = document.querySelector(".scroll-progress");
  let scrollable = document.documentElement.scrollHeight - window.innerHeight;

  const updateProgress = () => {
    if (!progressBar) return;
    const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    progressBar.style.width = `${Math.min(pct, 100)}%`;
  };

  const onResize = () => {
    scrollable = document.documentElement.scrollHeight - window.innerHeight;
    updateProgress();
  };

  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });

  // ---- Reveal-on-scroll ----
  const revealEls = document.querySelectorAll(".reveal");

  // Stagger children inside grids
  document.querySelectorAll(
    ".mini-grid, .programme-grid, .impact-grid, .involvement-grid, .testimonial-grid, .pathway-grid, .event-grid, .values-grid, .stats-strip"
  ).forEach((container) => {
    Array.from(container.children).forEach((child, i) => {
      child.style.setProperty("--delay", `${i * 60}ms`);
      if (!child.classList.contains("reveal")) child.classList.add("reveal");
    });
  });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

  // ---- Stat number counter ----
  const animateNumber = (node) => {
    const target = Number(node.dataset.target);
    if (!target || Number.isNaN(target)) return;
    const duration = 1200;
    const start = performance.now();

    const step = (time) => {
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  const statObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateNumber(entry.target);
        statObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.5 }
  );

  document.querySelectorAll(".stat__number[data-target]").forEach((n) =>
    statObserver.observe(n)
  );

  // ---- Mobile nav toggle ----
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.querySelector(".nav");

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const expanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!expanded));
      siteNav.classList.toggle("is-open", !expanded);
    });

    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navToggle.setAttribute("aria-expanded", "false");
        siteNav.classList.remove("is-open");
      });
    });
  }

  // ---- Smooth scroll for anchor links ----
  const header = document.querySelector(".site-header");

  const getHeaderOffset = () => {
    if (!header) return 0;
    const pos = getComputedStyle(header).position;
    return pos === "sticky" ? header.offsetHeight + 16 : 0;
  };

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  // ---- Event category filtering ----
  const filterPills = document.querySelectorAll(".filter-pill");
  const eventCards = document.querySelectorAll(".card--event");

  if (filterPills.length && eventCards.length) {
    filterPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        const category = pill.dataset.category;

        filterPills.forEach((p) => p.classList.remove("filter-pill--active"));
        pill.classList.add("filter-pill--active");

        eventCards.forEach((card) => {
          if (category === "all" || card.dataset.category === category) {
            card.style.display = "";
          } else {
            card.style.display = "none";
          }
        });
      });
    });
  }

  // ---- Form validation ----
  document.querySelectorAll(".form").forEach((form) => {
    const successMsg = form.querySelector(".form__success");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let isValid = true;

      form.querySelectorAll("[required]").forEach((field) => {
        const errorEl = field.parentElement.querySelector(".form__error");

        if (!field.value.trim()) {
          isValid = false;
          field.classList.add("is-error");
          if (errorEl) errorEl.classList.add("is-visible");
        } else if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
          isValid = false;
          field.classList.add("is-error");
          if (errorEl) {
            errorEl.textContent = "Please enter a valid email address.";
            errorEl.classList.add("is-visible");
          }
        } else {
          field.classList.remove("is-error");
          if (errorEl) errorEl.classList.remove("is-visible");
        }
      });

      if (isValid && successMsg) {
        form.querySelectorAll("input, select, textarea").forEach((f) => (f.value = ""));
        successMsg.classList.add("is-visible");
        setTimeout(() => successMsg.classList.remove("is-visible"), 5000);
      }
    });

    // Clear error on input
    form.querySelectorAll("input, select, textarea").forEach((field) => {
      field.addEventListener("input", () => {
        field.classList.remove("is-error");
        const errorEl = field.parentElement.querySelector(".form__error");
        if (errorEl) errorEl.classList.remove("is-visible");
      });
    });
  });
})();
