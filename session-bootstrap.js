try {
  const storedState = JSON.parse(localStorage.getItem("play-streamers-v17-site") || "{}");
  if (storedState.settings?.userSession || storedState.userSession) {
    document.documentElement.classList.add("ps15-session-pending");
    if (sessionStorage.getItem("ps-second-dashboard") === "1") {
      document.documentElement.dataset.psDashboardRestore = "1";
    }
  }
} catch {
  // Bozuk yerel veri ilk sayfa çizimini engellemez.
}
