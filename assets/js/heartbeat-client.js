<!-- assets/js/heartbeat-client.js -->
<script>
(function(){
  // Persisted device/browser id (same logic as gate.html)
  const getClientId = () => {
    let id = localStorage.getItem('clientId');
    if (!id) {
      id = (crypto.randomUUID?.() || (Date.now()+'-'+Math.random()));
      localStorage.setItem('clientId', id);
    }
    return id;
  };

  const clientId = getClientId();

  async function ping() {
    try {
      const res = await fetch('/.netlify/functions/heartbeat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId })
      });

      if (!res.ok) {
        // 401/403 => token invalid or key inactive/deleted
        location.href = '/gate.html';
      }
    } catch (e) {
      // Network errors: ignore or decide to redirect if you prefer
      // console.warn('heartbeat failed', e);
    }
  }

  // First ping ~3s after load, then every 30s
  setTimeout(ping, 3000);
  setInterval(ping, 30000);

  // Mark session inactive on unload (optional)
  window.addEventListener('beforeunload', () => {
    try {
      navigator.sendBeacon?.(
        '/.netlify/functions/heartbeat',
        JSON.stringify({ clientId, inactive: true })
      );
    } catch {}
  });
})();
</script>
