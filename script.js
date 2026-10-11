(() => {
  "use strict";

  document.documentElement.classList.add("js");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollBehavior = (event) => reducedMotion.matches || event.detail === 0 ? "instant" : "smooth";

  const focusTarget = (target) => {
    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
      target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    }
    target.focus({ preventScroll: true });
  };

  // ---- Scroll progress bar ----
  const progressBar = document.querySelector(".scroll-progress");
  const backToTop = document.querySelector(".back-to-top");
  let scrollable = document.documentElement.scrollHeight - window.innerHeight;

  const updateProgress = () => {
    if (!progressBar) return;
    const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    progressBar.style.transform = `scaleX(${Math.min(pct, 100) / 100})`;
  };

  const updateScrollUi = () => {
    updateProgress();

    if (!backToTop) return;
    const isVisible = window.scrollY > Math.max(320, window.innerHeight * 0.6);
    backToTop.classList.toggle("is-visible", isVisible);
    backToTop.tabIndex = isVisible ? 0 : -1;
    backToTop.setAttribute("aria-hidden", String(!isVisible));
  };

  const onResize = () => {
    scrollable = document.documentElement.scrollHeight - window.innerHeight;
    updateScrollUi();
  };

  updateScrollUi();
  window.addEventListener("scroll", updateScrollUi, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(document.body);

  if (backToTop) {
    backToTop.addEventListener("click", (event) => {
      focusTarget(document.querySelector("main"));
      window.scrollTo({ top: 0, behavior: scrollBehavior(event) });
    });
  }

  // ---- Fade content in as it scrolls into view ----
  const revealItems = Array.from(document.querySelectorAll(".reveal")).filter((el) => el.tagName !== "SECTION");
  const showItem = (el) => el.classList.add("is-visible");

  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealItems.forEach(showItem);
  } else {
    // Stagger siblings (e.g. cards in a grid) so they arrive one after another.
    revealItems.forEach((el) => {
      const siblings = Array.from(el.parentElement.children).filter((child) => child.classList.contains("reveal"));
      const index = siblings.indexOf(el);
      if (index > 0) el.style.setProperty("--delay", `${Math.min(index, 5) * 70}ms`);
    });

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          showItem(entry.target);
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
    );

    revealItems.forEach((el) => revealObserver.observe(el));
  }

  // Anchor targets appear straight away rather than waiting to fade in.
  const revealWithin = (target) => {
    if (target.classList.contains("reveal")) showItem(target);
    target.querySelectorAll(".reveal").forEach(showItem);
  };

  const revealHashTarget = () => {
    if (!window.location.hash) return;
    try {
      const hashTarget = document.querySelector(window.location.hash);
      if (hashTarget) revealWithin(hashTarget);
    } catch {
      // Ignore hashes that are not valid selectors.
    }
  };

  revealHashTarget();
  window.addEventListener("hashchange", revealHashTarget);

  window.addEventListener("beforeprint", () => revealItems.forEach(showItem));

  // ---- Stat number counter ----
  const animateNumber = (node) => {
    const target = Number(node.dataset.target);
    if (!target || Number.isNaN(target)) return;
    const suffix = node.dataset.suffix || "";
    if (reducedMotion.matches) {
      node.textContent = `${target}${suffix}`;
      return;
    }
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
    const closeNav = (restoreFocus = false) => {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open menu");
      siteNav.classList.remove("is-open");
      if (restoreFocus) navToggle.focus({ preventScroll: true });
    };

    navToggle.addEventListener("click", () => {
      const expanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!expanded));
      navToggle.setAttribute("aria-label", expanded ? "Open menu" : "Close menu");
      siteNav.classList.toggle("is-open", !expanded);
    });

    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        closeNav();
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && siteNav.classList.contains("is-open")) closeNav(true);
    });

    document.addEventListener("click", (e) => {
      if (!siteNav.classList.contains("is-open")) return;
      if (siteNav.contains(e.target) || navToggle.contains(e.target)) return;
      closeNav();
    });
    document.addEventListener("focusin", (e) => {
      if (!siteNav.contains(e.target) && e.target !== navToggle) closeNav();
    });
    window.matchMedia("(min-width: 1025px)").addEventListener("change", () => closeNav());
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
      revealWithin(target);
      const top = target.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
      focusTarget(target);
      history.pushState(null, "", href);
      window.scrollTo({ top, behavior: scrollBehavior(e) });
    });
  });

  const programmeNames = {
    "homework-club": "Homework club and academic support",
    "tutoring-mentoring": "Individual tutoring and mentoring",
    "youth-activities": "Youth activities and engagement",
    "womens-group": "Women's group and support network",
    "mens-group": "Men's group and community support",
    "elderly-engagement": "Elderly community engagement",
    "creative-arts": "Creative arts, reading, and poetry",
  };
  const topics = {
    launch: { subject: "launch", message: "I'd like to come to the launch on Thursday 5th November.\n\n" },
    idea: { subject: "general", message: "I have an idea for an activity: " },
  };
  const params = new URLSearchParams(window.location.search);
  const requestedProgramme = params.get("programme");
  const requestedTopic = params.get("topic");
  const contactSubject = document.querySelector("#contact-subject");
  const contactMessage = document.querySelector("#contact-message");
  const prefillContact = (subject, message) => {
    contactSubject.value = subject;
    if (!contactMessage.value) contactMessage.value = message;
  };
  if (contactSubject && contactMessage) {
    if (Object.hasOwn(programmeNames, requestedProgramme)) {
      prefillContact("programmes", `I would like to know more about ${programmeNames[requestedProgramme]}.\n\n`);
    } else if (Object.hasOwn(topics, requestedTopic)) {
      prefillContact(topics[requestedTopic].subject, topics[requestedTopic].message);
    }
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
    form.setAttribute("aria-busy", String(isSubmitting));
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

  // ---- Form validation ----
  document.querySelectorAll(".form").forEach((form) => {
    const successMsg = form.querySelector(".form__success");
    if (successMsg) {
      successMsg.textContent = "";
      successMsg.setAttribute("role", "status");
      successMsg.setAttribute("aria-live", "polite");
      successMsg.setAttribute("aria-atomic", "true");
    }
    form.querySelectorAll("[required]").forEach((field) => {
      const errorEl = field.parentElement.querySelector(".form__error");
      if (errorEl) {
        errorEl.id = `${field.id}-error`;
        const description = field.getAttribute("aria-describedby") || "";
        field.setAttribute("aria-describedby", `${description} ${errorEl.id}`.trim());
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.getAttribute("aria-busy") === "true") return;
      let isValid = true;
      if (successMsg) {
        successMsg.classList.remove("is-visible", "form__success--error");
        successMsg.textContent = "";
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
        field.setAttribute("aria-invalid", String(field.classList.contains("is-error")));
      });

      if (!isValid) {
        form.querySelector(".is-error").focus();
        return;
      }

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
          setFormStatus(
            successMsg,
            "Your message could not be sent. Your details are still here. Please try again or use the email link below.",
            "error"
          );
          const fallback = document.createElement("a");
          fallback.className = "form__fallback";
          fallback.textContent = "Email roy@friendsoffieldway.org instead";
          fallback.href = buildMailto(form.dataset.mailto, "Website enquiry", getFormFields(form)
            .filter((field) => field.name !== "company" && fieldValue(field))
            .map((field) => `${fieldLabel(field)}: ${fieldValue(field)}`).join("\n"));
          successMsg.append(document.createElement("br"), fallback);
        } finally {
          setSubmitting(form, false);
        }
      }
    });

    // Clear error on input
    form.querySelectorAll("input, select, textarea").forEach((field) => {
      field.addEventListener("input", () => {
        field.classList.remove("is-error");
        field.removeAttribute("aria-invalid");
        const errorEl = field.parentElement.querySelector(".form__error");
        if (errorEl) errorEl.classList.remove("is-visible");
      });
    });
  });

})();
