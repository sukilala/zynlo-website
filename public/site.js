(function () {
  document.documentElement.classList.add("js");
  var nav = document.getElementById("nav");
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle("scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  var menuBtn = document.getElementById("menuBtn");
  var mobileMenu = document.getElementById("mobileMenu");
  function setMenu(open) {
    if (!menuBtn || !mobileMenu) return;
    mobileMenu.classList.toggle("open", open);
    mobileMenu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  if (menuBtn && mobileMenu) {
    setMenu(false);
    menuBtn.addEventListener("click", function () {
      setMenu(mobileMenu.hidden);
    });
    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setMenu(false);
    });
  }

  var sticky = document.querySelector(".sticky");
  var hero = document.querySelector(".hero");
  if (sticky && hero) {
    var syncSticky = function () {
      sticky.classList.toggle("is-on", hero.getBoundingClientRect().bottom < 120);
    };
    syncSticky();
    window.addEventListener("scroll", syncSticky, { passive: true });
  }

  var audit = document.getElementById("auditForm");
  if (audit) {
    audit.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = document.getElementById("name").value.trim();
      var phone = document.getElementById("phone").value.trim();
      var industry = document.getElementById("industry").value.trim();
      var err = document.getElementById("formErr");
      if (!name || !phone || !industry) {
        err.hidden = false;
        err.textContent = "Please complete all fields.";
        return;
      }
      if (phone.replace(/\D/g, "").length < 9) {
        err.hidden = false;
        err.textContent = "Enter a valid WhatsApp number.";
        return;
      }
      err.hidden = true;
      var text = encodeURIComponent(
        "Hi Zynlo, I would like a free Lost Revenue Audit.\nName: " + name + "\nWhatsApp: " + phone + "\nIndustry: " + industry
      );
      window.open("https://wa.me/94723589231?text=" + text, "_blank", "noopener,noreferrer");
    });
  }

  var enquiry = document.getElementById("enquiryForm");
  if (enquiry) {
    enquiry.addEventListener("submit", function (event) {
      event.preventDefault();
      var err = document.getElementById("formErr");
      var ok = document.getElementById("formOk");
      var fallback = document.getElementById("formFallback");
      var button = enquiry.querySelector("button[type=submit]");
      err.hidden = true;
      ok.hidden = true;
      fallback.hidden = true;

      var data = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        company: document.getElementById("company").value.trim(),
        audience: (enquiry.querySelector("input[name=audience]:checked") || {}).value || "",
        message: document.getElementById("message").value.trim(),
        hp: document.getElementById("hp").value
      };
      if (!data.name || !data.email || !data.company || !data.audience || !data.message) {
        err.hidden = false;
        err.textContent = "Please complete every field.";
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
        err.hidden = false;
        err.textContent = "Enter a work email we can reply to.";
        return;
      }

      button.disabled = true;
      fetch("/api/enquiry", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(data)
      }).then(function (response) {
        return response.json().catch(function () { return { ok: false }; }).then(function (payload) {
          return { response: response, payload: payload };
        });
      }).then(function (result) {
        button.disabled = false;
        if (result.payload && result.payload.ok) {
          document.getElementById("enquiryFields").hidden = true;
          ok.hidden = false;
          return;
        }
        if (result.response.status === 400 && result.payload && result.payload.error) {
          err.hidden = false;
          err.textContent = result.payload.error;
          return;
        }
        fallback.hidden = false;
      }).catch(function () {
        button.disabled = false;
        fallback.hidden = false;
      });
    });
  }
})();
