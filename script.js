(() => {
  "use strict";

  document.documentElement.classList.add("js");

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
  // Stagger children inside grids
  document.querySelectorAll(
    ".mini-grid, .programme-grid, .impact-grid, .involvement-grid, .testimonial-grid, .pathway-grid, .event-grid, .values-grid, .stats-strip"
  ).forEach((container) => {
    Array.from(container.children).forEach((child, i) => {
      child.style.setProperty("--delay", `${i * 60}ms`);
      if (!child.classList.contains("reveal")) child.classList.add("reveal");
    });
  });

  const revealEls = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
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

    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  // ---- Stat number counter ----
  const animateNumber = (node) => {
    const target = Number(node.dataset.target);
    if (!target || Number.isNaN(target)) return;
    const suffix = node.dataset.suffix || "";
    const duration = 1200;
    const start = performance.now();

    const step = (time) => {
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = `${Math.round(target * eased)}${suffix}`;
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  const statNumbers = document.querySelectorAll(".stat__number[data-target]");

  if ("IntersectionObserver" in window) {
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

    statNumbers.forEach((n) => statObserver.observe(n));
  } else {
    statNumbers.forEach((n) => animateNumber(n));
  }

  // ---- Mobile nav toggle ----
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.querySelector(".nav");

  if (navToggle && siteNav) {
    const closeNav = () => {
      navToggle.setAttribute("aria-expanded", "false");
      siteNav.classList.remove("is-open");
    };

    navToggle.addEventListener("click", () => {
      const expanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!expanded));
      siteNav.classList.toggle("is-open", !expanded);
    });

    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        closeNav();
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav();
    });

    document.addEventListener("click", (e) => {
      if (!siteNav.classList.contains("is-open")) return;
      if (siteNav.contains(e.target) || navToggle.contains(e.target)) return;
      closeNav();
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
      let target = null;
      try {
        target = document.querySelector(href);
      } catch {
        return;
      }
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  // ---- Event category filtering ----
  const filterPills = document.querySelectorAll(".filter-pill");
  const eventCards = document.querySelectorAll(".card--event");
  const eventFilterStatus = document.querySelector("#event-filter-status");

  if (filterPills.length && eventCards.length) {
    const setEventFilter = (category) => {
      let visibleCount = 0;

      filterPills.forEach((p) => {
        const active = p.dataset.category === category;
        p.classList.toggle("filter-pill--active", active);
        p.setAttribute("aria-pressed", String(active));
      });

      eventCards.forEach((card) => {
        const visible = category === "all" || card.dataset.category === category;
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      if (eventFilterStatus) {
        const label = category === "all" ? "all" : category;
        eventFilterStatus.textContent =
          category === "all"
            ? `Showing all ${visibleCount} activities.`
            : `Showing ${visibleCount} ${label} activities.`;
      }
    };

    filterPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        setEventFilter(pill.dataset.category || "all");
      });
    });
  }

  // ---- Contact form helpers ----
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const fieldLabel = (field) => {
    const label = field.labels && field.labels[0] ? field.labels[0].textContent : "";
    return (label || field.name || field.id || "Field").replace(/\s+/g, " ").trim();
  };

  const fieldValue = (field) => {
    if (field.tagName === "SELECT") {
      const option = field.options[field.selectedIndex];
      return option && option.value ? option.text.trim() : "";
    }

    return field.value.trim();
  };

  const buildMailto = (to, subject, body) =>
    `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const getFormFields = (form) =>
    Array.from(form.querySelectorAll("input, select, textarea")).filter(
      (field) => field.type !== "submit" && field.type !== "button"
    );

  const getFormPayload = (form) => {
    const fields = getFormFields(form);
    const payload = {
      formName: form.dataset.formName || form.dataset.subjectPrefix || "Website enquiry",
      subjectPrefix: form.dataset.subjectPrefix || "Website enquiry",
      fields: {},
    };

    fields.forEach((field) => {
      payload.fields[fieldLabel(field)] = fieldValue(field);
      if (field.name) payload[field.name] = fieldValue(field);
    });

    return payload;
  };

  const setFormStatus = (statusEl, message, type = "success") => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle("form__success--error", type === "error");
    statusEl.classList.add("is-visible");
  };

  const setSubmitting = (form, isSubmitting) => {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;

    if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
    button.disabled = isSubmitting;
    button.textContent = isSubmitting ? "Sending..." : button.dataset.defaultText;
  };

  const postFormToEndpoint = async (form) => {
    const endpoint = form.dataset.endpoint;
    if (!endpoint || !window.fetch) throw new Error("Message endpoint is unavailable");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(getFormPayload(form)),
    });

    let result = {};
    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Message could not be sent");
    }

    return result;
  };

  const openMailtoForForm = (form) => {
    const to = form.dataset.mailto;
    if (!to) return;

    const prefix = form.dataset.subjectPrefix || "Website enquiry";
    const fields = getFormFields(form);
    const detailField = fields.find((field) => field.name === "subject" || field.name === "interest");
    const detail = detailField ? fieldValue(detailField) : "";
    const subject = detail ? `${prefix}: ${detail}` : prefix;
    const bodyLines = fields
      .filter((field) => field.type !== "submit" && fieldValue(field))
      .map((field) => `${fieldLabel(field)}: ${fieldValue(field)}`);

    window.location.href = buildMailto(to, subject, bodyLines.join("\n"));
  };

  // ---- Form validation ----
  document.querySelectorAll(".form").forEach((form) => {
    const successMsg = form.querySelector(".form__success");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let isValid = true;
      if (successMsg) {
        successMsg.classList.remove("is-visible", "form__success--error");
        successMsg.textContent = successMsg.dataset.defaultText || successMsg.textContent;
        successMsg.dataset.defaultText = successMsg.textContent;
      }

      form.querySelectorAll("[required]").forEach((field) => {
        const errorEl = field.parentElement.querySelector(".form__error");
        const value = fieldValue(field);

        if (!value) {
          isValid = false;
          field.classList.add("is-error");
          if (errorEl) errorEl.classList.add("is-visible");
        } else if (field.type === "email" && !emailPattern.test(value)) {
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
        setSubmitting(form, true);

        try {
          await postFormToEndpoint(form);
          form.querySelectorAll("input, select, textarea").forEach((f) => {
            if (f.tagName === "SELECT") {
              f.selectedIndex = 0;
            } else {
              f.value = "";
            }
          });
          setFormStatus(successMsg, "Thank you. Your message has been sent to Friends of Fieldway.");
        } catch {
          openMailtoForForm(form);
          setFormStatus(
            successMsg,
            "We could not send this automatically, so your email app should open as a fallback. You can also email roy@friendsoffieldway.org.",
            "error"
          );
        } finally {
          setSubmitting(form, false);
        }
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
