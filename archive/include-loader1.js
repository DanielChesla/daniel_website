(async () => {
  // Use relative fetch (works on GitHub Pages and subfolders)
  const [headerHTML, footerHTML] = await Promise.all([
    fetch('includes/header.html', { cache: 'no-store' }).then(r => r.text()),
    fetch('includes/footer.html', { cache: 'no-store' }).then(r => r.text())
  ]);

  // Inject into placeholders
  const headerTarget = document.getElementById('header-include');
  const footerTarget = document.getElementById('footer-include');
  if (headerTarget) headerTarget.innerHTML = headerHTML;
  if (footerTarget) footerTarget.innerHTML = footerHTML;

  // Footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Active nav highlighting by current file
  const hereFile = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar a[href]').forEach(a => {
    const linkFile = a.getAttribute('href').split('/').pop();
    if (linkFile === hereFile) {
      a.classList.add('active');
      const dropdown = a.closest('.dropdown');
      if (dropdown) dropdown.querySelector('.nav-link.dropdown-toggle')?.classList.add('active');
    }
  });

  // Hash-based highlighting (for index.html sections)
  const setActiveByHash = () => {
    const hash = window.location.hash;
    if (!hash) return;
    document.querySelectorAll('.navbar .nav-link[href^="#"]').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });
  };
  setActiveByHash();
  window.addEventListener('hashchange', setActiveByHash);
})();
