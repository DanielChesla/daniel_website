(async () => {
  // Fetch partials (no-store so edits show right away after deploy)
  const [headerHTML, footerHTML] = await Promise.all([
    fetch('/includes/header.html', { cache: 'no-store' }).then(r => r.text()),
    fetch('/includes/footer.html', { cache: 'no-store' }).then(r => r.text())
  ]);

  // Inject into the page
  const headerTarget = document.getElementById('header-include');
  const footerTarget = document.getElementById('footer-include');
  if (headerTarget) headerTarget.innerHTML = headerHTML;
  if (footerTarget) footerTarget.innerHTML = footerHTML;

  // Update footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Highlight active section link for this single-page layout
  const setActiveByHash = () => {
    const hash = window.location.hash || '#top';
    document.querySelectorAll('.navbar .nav-link').forEach(a => {
      if (!a.hash) return a.classList.remove('active');
      a.classList.toggle('active', a.hash === hash);
    });
  };
  // Run once now and again on hash change
  setActiveByHash();
  window.addEventListener('hashchange', setActiveByHash);

  // Smooth scroll for in-page anchors (optional nicety)
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
