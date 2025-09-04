(async () => {
  const [h, f] = await Promise.all([
    fetch('/includes/header.html').then(r => r.text()),
    fetch('/includes/footer.html').then(r => r.text())
  ]);
  document.getElementById('header-include').innerHTML = h;
  document.getElementById('footer-include').innerHTML = f;
})();
