export async function copyToClipboard(text, buttonEl) {
  try {
    await navigator.clipboard.writeText(text || '');
    if (buttonEl) {
      const original = buttonEl.innerHTML;
      buttonEl.innerHTML = '<i class="fa-solid fa-check mr-2"></i>Copied!';
      buttonEl.classList.add('copy-success');
      setTimeout(() => {
        buttonEl.innerHTML = original;
        buttonEl.classList.remove('copy-success');
      }, 1500);
    }
    return true;
  } catch {
    return false;
  }
}


