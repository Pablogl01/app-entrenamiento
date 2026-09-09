// Modo de color antes del primer pintado: ajuste guardado o sistema.
// Fichero externo (no inline) para que la CSP no necesite 'unsafe-inline'.
;(function () {
  var theme = 'system'
  try {
    theme = localStorage.getItem('theme') || 'system'
  } catch (e) {}
  var dark = theme === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : theme === 'dark'
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = dark ? '#121315' : '#f8f7f4'
})()
