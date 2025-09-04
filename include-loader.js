// include-loader.js
document.addEventListener("DOMContentLoaded", () => {
  // Try multiple paths (relative first, then root-absolute)
  const fetchText = async (paths) => {
    for (const p of paths) {
      try {
        const res = await fetch(p, { cache: "no-store" });
        if (res.ok) return await res.text();
        console.warn(`[include-loader] ${p} -> ${res.status}`);
      } catch (e) {
        console.warn(`[include-loader] fetch failed for ${p}`, e);
      }
    }
    throw new Error(`[include-loader] All fetch attempts failed: ${paths.join(", ")}`);
  };

  const applyFixedNavOffsets = (nav) => {
    if (!nav) return;
    const setOffsets = () => {
      const h = nav.getBoundingClientRect().height || 0;
      document.body.style.paddingTop = h + "px";
      document.documentElement.style.scrollPaddingTop = h + "px";
    };
    setOffsets();

    // Keep in sync as layout changes
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(setOffsets);
      ro.observe(nav);
    }
    window.addEventListener("resize", setOffsets);

    // Fonts loading can change height
    if (document.fonts?.ready) {
      document.fonts.ready.then(setOffsets).catch(() => {});
    }
  };

  const headerEl = document.getElementById("header-include");
  const footerEl = document.getElementById("footer-include");

  // ---- HEADER ----
  fetchText(["includes/header.html", "/includes/header.html"])
    .then((html) => {
      if (!headerEl) return;
      headerEl.innerHTML = html;

      // Active page highlight (by filename)
      const hereFile = location.pathname.split("/").pop() || "index.html";
      document.querySelectorAll(".navbar a[href]").forEach((a) => {
        const linkFile = a.getAttribute("href").split("/").pop();
        if (linkFile === hereFile) {
          a.classList.add("active");
          a.closest(".dropdown")?.querySelector(".dropdown-toggle")?.classList.add("active");
        }
      });

      // Shadow on scroll
      const nav = document.querySelector(".navbar");
      if (nav) {
        const onScroll = () => nav.classList.toggle("shadow-sm", window.scrollY > 4);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
      }

      // If using fixed-top, pad the page so content isn't covered
      const fixedNav = document.querySelector(".navbar.fixed-top");
      applyFixedNavOffsets(fixedNav);
    })
    .catch((err) => console.error("Error loading header:", err));

  // ---- FOOTER ----
  fetchText(["includes/footer.html", "/includes/footer.html"])
    .then((html) => {
      if (!footerEl) return;
      footerEl.innerHTML = html;

      // Auto-set year if footer has #year
      const yearSpan = document.getElementById("year");
      if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
      }
    })
    .catch((err) => console.error("Error loading footer:", err));
});
