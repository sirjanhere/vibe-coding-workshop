function createToast(message, type = "info") {
  let container = document.getElementById("brain-booster-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "brain-booster-toast-container";
    container.style.position = "fixed";
    container.style.bottom = "24px";
    container.style.right = "24px";
    container.style.zIndex = "2147483647";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "8px";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.padding = "10px 14px";
  toast.style.borderRadius = "999px";
  toast.style.fontSize = "13px";
  toast.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.18)";
  toast.style.background = type === "error"
    ? "linear-gradient(135deg, #b91c1c, #ef4444)"
    : type === "success"
    ? "linear-gradient(135deg, #15803d, #22c55e)"
    : "linear-gradient(135deg, #1d4ed8, #3b82f6)";
  toast.style.color = "#ffffff";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(10px)";
  toast.style.transition = "opacity 0.2s ease-out, transform 0.2s ease-out";

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => {
      toast.remove();
    }, 200);
  }, 2500);
}

// Listen to messages from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "FLASHCARD_STATUS") {
    const { status, message } = msg;
    if (status === "loading") createToast(message || "Generating...", "info");
    else if (status === "success") createToast(message || "Saved!", "success");
    else createToast(message || "Error", "error");
  }
});
