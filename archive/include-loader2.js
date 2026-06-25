// include-loader.js
document.addEventListener("DOMContentLoaded", () => {
  // Load header
  fetch("includes/header.html", { cache: "no-store" })
    .then(res => res.text())
    .then(html => {
      document.getElementById("header-include").innerHTML = html;

      // Highlight the active page
      const hereFile = location.pathname.split("/").pop() || "index.html";
      document.querySelectorAll(".navbar a[href]").forEach(a => {
        const linkFile = a.getAttribute("href").split("/").pop();
        if (linkFile === hereFile) {
          a.classList.add("active");
          const dropdown = a.closest(".dropdown");
          if (dropdown) {
            dropdown.querySelector(".dropdown-toggle")?.classList.add("active");
          }
        }
      });

      // Add drop shadow on scroll
      const nav = document.querySelector(".navbar.sticky-top");
      if (nav) {
        const onScroll = () => {
          nav.classList.toggle("shadow-sm", window.scrollY > 4);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
      }
    })
    .catch(err => console.error("Error loading header:", err));

  // Load footer
  fetch("includes/footer.html", { cache: "no-store" })
    .then(res => res.text())
    .then(html => {
      document.getElementById("footer-include").innerHTML = html;

      // Auto-set year if footer has #year
      const yearSpan = document.getElementById("year");
      if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
      }
    })
    .catch(err => console.error("Error loading footer:", err));
});
