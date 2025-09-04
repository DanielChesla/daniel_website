// include-loader.js
document.addEventListener("DOMContentLoaded", () => {
  // Helper to apply top offsets when we have a fixed nav
  const applyFixedNavOffsets = (nav) => {
    if (!nav) return;
    const setOffsets = () => {
      const h = nav.getBoundingClientRect().height;
      document.body.style.paddingTop = h + "px";
      document.documentElement.style.scrollPaddingTop = h + "px";
    };
    setOffsets();

    // Keep in sync on resize and when the nav height changes (responsive)
    const ro = new ResizeObserver(setOffsets);
    ro.observe(nav);
    window.addEventListener("resize", setOffsets);

    // Fonts can change height after they load
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(setOffsets).catch(() => {});
    }
  };

  // Load header
  fetch("includes/header.html", { cache: "no-store" })
    .then((res) => res.text())
    .then((html) => {
      document.getElementById("header-include").innerHTML = html;

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

  // Load footer
  fetch("includes/footer.html", { cache: "no-store" })
    .then((res) => res.text())
    .then((html) => {
      document.getElementById("footer-include").innerHTML = html;
      document.getElementById("year")?.textContent = new Date().getFullYear();
    })
    .catch((err) => console.error("Error loading footer:", err));
});
