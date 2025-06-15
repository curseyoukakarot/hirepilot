chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg !== 'getCookie') return;

  chrome.cookies.get(
    { url: 'https://www.linkedin.com', name: 'li_at' },
    c => send({ li_at: c?.value ?? null, ua: navigator.userAgent })
  );

  return true; // keep the message channel open!
});
