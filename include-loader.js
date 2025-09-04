(async () => {
  // Fetch header & footer (relative path for GitHub Pages)
  const [headerHTML, footerHTML] = await Promise.all([
    fetch('includes/header.html', { cache: 'no-store' }).then(r => r.text()),
    fetch('includes/footer.html', { cache: 'no-store' }).then(r => r.text())
  ]);

  // Inject into placeholders
  const headerTarget = document.getElementById('header-include');
  const footerTarget = document.getElementById('footer-include');
  if (headerTarget) headerTarget.innerHTML = headerHTML;
  if (footerTarget) footerTarget.innerHTML = footerHTML;

  // --- Active nav link detection ---
  // Get the current file name (default index.html if empty)
  const hereFile = location.pathname.split('/').pop() || 'index.html';

  // Highlight the current page link in navbar or dropdown
  document.querySelectorAll('.navbar a[href]').forEach(a => {
    const linkFile = a.getAttribute('href').split('/').pop();
    if (linkFile === hereFile) {
      a.classList.add('active');
      // If link is inside a dropdown, mark parent toggle as active too
      const dropdown = a.closest('.dropdown');
      if (dropdown) {
        const toggle = dropdown.querySelector('.nav-link.dropdown-toggle');
        if (toggle) toggle.classList.add('active');
      }
    }
  });

  // Footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // --- Index.html section highl
