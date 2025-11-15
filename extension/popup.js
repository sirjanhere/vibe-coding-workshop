// popup.js

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function updateCountLabel(count) {
  const label = document.getElementById("count-label");
  if (!label) return;
  label.textContent = `${count} flashcard${count === 1 ? "" : "s"}`;
}

function renderCards(flashcards) {
  const container = document.getElementById("cards-container");
  const emptyState = document.getElementById("empty-state");

  if (!container || !emptyState) return;

  container.innerHTML = "";

  if (!flashcards || flashcards.length === 0) {
    emptyState.style.display = "block";
    updateCountLabel(0);
    return;
  }

  emptyState.style.display = "none";
  updateCountLabel(flashcards.length);

  flashcards.forEach((card) => {
    const outer = document.createElement("div");
    outer.className = "card-outer";

    const cardEl = document.createElement("div");
    cardEl.className = "card";

    const inner = document.createElement("div");
    inner.className = "card-inner";

    // FRONT
    const front = document.createElement("div");
    front.className = "card-face card-front";

    const qLabel = document.createElement("div");
    qLabel.className = "card-question-label";
    qLabel.textContent = "Question";

    const qText = document.createElement("p");
    qText.className = "card-question";
    qText.textContent = card.question || "";

    const metaFront = document.createElement("div");
    metaFront.className = "card-meta";

    const topic = document.createElement("span");
    topic.className = "badge badge-topic";
    topic.textContent = card.topic || "General";

    const diff = document.createElement("span");
    diff.className = "badge badge-difficulty";
    diff.textContent = card.difficulty || "unknown";

    metaFront.appendChild(topic);
    metaFront.appendChild(diff);

    front.appendChild(qLabel);
    front.appendChild(qText);
    front.appendChild(metaFront);

    // BACK
    const back = document.createElement("div");
    back.className = "card-face card-back";

    const aLabel = document.createElement("div");
    aLabel.className = "card-question-label";
    aLabel.textContent = "Answer";

    const aText = document.createElement("p");
    aText.className = "card-answer";
    aText.textContent = card.answer || "";

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = card.hint ? `Hint: ${card.hint}` : "";

    const metaBack = document.createElement("div");
    metaBack.className = "card-meta";

    const createdSpan = document.createElement("span");
    createdSpan.textContent = card.createdAt ? formatTime(card.createdAt) : "";

    metaBack.appendChild(createdSpan);

    back.appendChild(aLabel);
    back.appendChild(aText);
    if (card.hint) back.appendChild(hint);
    back.appendChild(metaBack);

    inner.appendChild(front);
    inner.appendChild(back);
    cardEl.appendChild(inner);
    outer.appendChild(cardEl);
    container.appendChild(outer);

    // flip on click
    cardEl.addEventListener("click", () => {
      cardEl.classList.toggle("flipped");
    });
  });
}

function loadFlashcards() {
  if (!chrome.storage || !chrome.storage.local) {
    console.warn("chrome.storage.local is not available. Are you running this outside an extension context?");
    return;
  }

  chrome.storage.local.get({ flashcards: [] }, (data) => {
    renderCards(data.flashcards || []);
  });
}

// SINGLE DOMContentLoaded handler
document.addEventListener("DOMContentLoaded", () => {
  // safety: only in extension context
  if (!chrome.storage || !chrome.storage.local) {
    console.warn("chrome.storage not found – popup must be opened as a Chrome extension.");
    return;
  }

  const clearBtn = document.getElementById("clear-btn");
  const exportBtn = document.getElementById("export-btn");

  // initial load
  loadFlashcards();

  // live update when background script saves a new flashcard
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.flashcards) {
      loadFlashcards();
    }
  });

  // clear all flashcards
  clearBtn?.addEventListener("click", () => {
    if (!confirm("Delete all flashcards?")) return;
    chrome.storage.local.set({ flashcards: [] }, () => {
      loadFlashcards();
    });
  });

  // export flashcards as JSON
  exportBtn?.addEventListener("click", () => {
    chrome.storage.local.get({ flashcards: [] }, (data) => {
      const json = JSON.stringify(data.flashcards || [], null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "brain-booster-flashcards.json";
      a.click();

      URL.revokeObjectURL(url);
    });
  });
});
