const BACKEND_URL = "http://127.0.0.1:8000/flashcard";

// Log when service worker starts
console.log("Brain Booster service worker loaded");

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "brainBoosterGenerate",
    title: "Generate Flashcard with Brain Booster",
    contexts: ["selection"]
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "brainBoosterGenerate" || !info.selectionText) return;

  // Wrap everything in an async function — MV3 safe
  (async () => {
    const selectedText = info.selectionText.trim();

    // Send "Generating..." toast
    if (tab?.id !== undefined) {
      chrome.tabs.sendMessage(tab.id, {
        type: "FLASHCARD_STATUS",
        status: "loading",
        message: "Generating flashcard..."
      });
    }

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Backend error: ${res.status} - ${errText}`);
      }

      const flashcard = await res.json();

      // Save flashcard
      chrome.storage.local.get({ flashcards: [] }, (data) => {
        const updated = [
          {
            ...flashcard,
            createdAt: Date.now()
          },
          ...data.flashcards
        ];

        chrome.storage.local.set({ flashcards: updated }, () => {
          if (tab?.id !== undefined) {
            chrome.tabs.sendMessage(tab.id, {
              type: "FLASHCARD_STATUS",
              status: "success",
              message: "Flashcard saved!"
            });
          }
        });
      });
    } catch (err) {
      console.error("Error generating flashcard:", err);
      if (tab?.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, {
          type: "FLASHCARD_STATUS",
          status: "error",
          message: "Failed to generate flashcard."
        });
      }
    }
  })();
});
