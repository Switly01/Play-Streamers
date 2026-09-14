try {
  const storedState = JSON.parse(localStorage.getItem("play-streamers-v17-site") || "{}");
  if (storedState.settings?.userSession || storedState.userSession) {
    document.documentElement.classList.add("ps15-session-pending");
    document.documentElement.dataset.psSessionTarget = sessionStorage.getItem("ps-second-dashboard") === "1" ? "dashboard" : "home";
    if (sessionStorage.getItem("ps-second-dashboard") === "1") {
      document.documentElement.dataset.psDashboardRestore = "1";
    }
  }
} catch {
  // Bozuk yerel veri ilk sayfa çizimini engellemez.
}

// Slow or blocked scripts must not keep the root pseudo-element over the page.
// This changes only paint state; authentication still belongs to the session API.
(() => {
  const release = () => {
    if (window.psIdentityCallbackPending) return;
    document.documentElement.classList.remove('ps15-session-pending','ps-i18n-booting','ps42-initial-loading');
    window.psRescueVisibleSurface?.();
  };
  window.setTimeout(release, 8000);
  window.addEventListener('pageshow', event => { if (event.persisted) window.setTimeout(release, 8000); });
})();
