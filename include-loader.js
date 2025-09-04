(async () => {
  const [headerHTML, footerHTML] = await Promise.all([
    fetch('/includes/header.html', { cache: 'no-store' }).then(r => r.text()),
    fetch('/includes/footer.html', { cache: 'no-store' }).then(r => r.text())
  ]);

  const headerTarget = document.getElementById('header-include');
  const footerTarget = document.getElementById('footer-include');
  if (headerTarget) headerTarget.innerHTML = headerHTML;
  if (footerTarget) footerTarget.innerHTML = footerHTML;

  // Footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // --- Active states ---
  const herePath = location.pathname.replace(/\/index\.html$/, '/');
  // 1) Mark navbar links active by exact path match (for multi-page)
  document.querySelectorAll('.navbar a[href]').forEach(a => {
    const link = a.getAttribute('href');
    if (!link) return;
    // Normalize
    const linkPath = link.startsWith('http') || link.startsWith('mailto:')
      ? null
      : link.replace(/\/index\.html$/, '/');
    if (linkPath && (linkPath === herePath || linkPath === location.pathname)) {
      a.classList.add('active');
      // If it's inside a dropdown, also mark the parent toggle as active
      const dropdown = a.closest('.dropdown');
      if (dropdown) dropdown.querySelector('.nav-link.dropdown-toggle')?.classList.add('active');
    }
  });

  // 2) Single-page sections (index.html): set active by hash
  const setActiveByHash = () => {
    const hash = window.location.hash;
    if (!hash) return;
    document.querySelectorAll('.navbar .nav-link[href^="#"]').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });
  };
  setActiveByHash();
  window.addEventListener('hashchange', setActiveByHash);

  // Smooth scroll for in-page anchors (nice on index.html)
  document.querySelectorAll('a.nav-link[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const el = document.querySelector(id);
      if (el) {
        e.preventDefault();
        history.pushState(null, '', id);
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveByHash();
      }
    });
  });
})();
