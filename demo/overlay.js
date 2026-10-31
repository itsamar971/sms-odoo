
(() => {
  const install = () => {
    if (document.getElementById('__cursor')) return;
    const c = document.createElement('div'); c.id='__cursor';
    c.style.cssText='position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(79,70,229,.35);border:2px solid #4f46e5;pointer-events:none;transform:translate(-50%,-50%);left:-50px;top:-50px;transition:width .15s,height .15s';
    document.body.appendChild(c);
    const cap = document.createElement('div'); cap.id='__caption';
    cap.style.cssText='position:fixed;z-index:2147483646;left:50%;bottom:28px;transform:translateX(-50%);max-width:1000px;background:rgba(15,23,42,.92);color:#fff;font:600 19px/1.4 system-ui,sans-serif;padding:12px 22px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);pointer-events:none;text-align:center;display:none';
    document.body.appendChild(cap);
    const t = sessionStorage.getItem('__cap'); if (t) { cap.textContent = t; cap.style.display='block'; }
    window.addEventListener('mousemove', e => { c.style.left=e.clientX+'px'; c.style.top=e.clientY+'px'; }, true);
    window.addEventListener('mousedown', () => { c.style.width='34px'; c.style.height='34px'; }, true);
    window.addEventListener('mouseup', () => { c.style.width='22px'; c.style.height='22px'; }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  setInterval(install, 300);
})();