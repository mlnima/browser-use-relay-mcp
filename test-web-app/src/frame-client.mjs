const form = document.querySelector('form');
form.addEventListener('submit', (event) => {
  event.preventDefault(); const value = new FormData(form).get('frame-value');
  document.querySelector('output').textContent = value;
  window.top.postMessage({ fixture: 'frame', scope: form.dataset.scope, value }, '*');
});
