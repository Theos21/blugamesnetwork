<script>
(function(){
  // Generate/persist unique browser id
  const getClientId = () => {
    let id = localStorage.getItem('clientId');
    if (!id) {
      id = (crypto.randomUUID?.() || (Date.now()+'-'+Math.random()));
      localStorage.setItem('clientId', id);
    }
    return id;
  };

  const clientId = getClientId();

  async function heartbeat() {
    try {
      const res = await fetch("/.netlify/functions/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId })
      });

      const data = await res.json();

      if (!data.ok) {
        alert("⛔ Your access has been revoked.");
        window.location.href = "/gate.html";
      }
    } catch (err) {
      console.error("Heartbeat error:", err);
    }
  }

  // Run heartbeat every 20s
  setInterval(heartbeat, 20000);
  // Run immediately on page load
  heartbeat();

  // Optional: mark session inactive on unload
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
