try {
  const storedState = JSON.parse(localStorage.getItem("play-streamers-v17-site") || "{}");
  if (storedState.settings?.userSession || storedState.userSession) {
    document.documentElement.classList.add("ps15-session-pending");
  }
} catch {
  // Bozuk yerel veri ilk sayfa çizimini engellemez.
}
