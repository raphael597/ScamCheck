// Applies the saved colour theme before first paint (external file because of the strict CSP).
try {
  var t = localStorage.getItem('scamcheck-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
