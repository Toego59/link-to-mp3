const state = { format: "mp4" };
const urlInput = document.querySelector("#url-input");
const resultPanel = document.querySelector("#result-panel");
const resultTitle = document.querySelector("#result-title");
const resultMessage = document.querySelector("#result-message");
const resultLabel = document.querySelector("#result-label");
const resultIcon = document.querySelector("#result-icon");
const downloadButton = document.querySelector("#download-button");

function showResult(label, title, message, type = "info") {
  resultPanel.hidden = false;
  resultLabel.textContent = label;
  resultTitle.textContent = title;
  resultMessage.textContent = message;
  resultIcon.textContent = type === "ready" ? "✓" : "i";
  resultIcon.style.background = type === "ready" ? "var(--lime)" : "var(--coral)";
}

document.querySelector("#clear-button").addEventListener("click", () => {
  urlInput.value = "";
  document.querySelector("#input-hint").textContent = "Your link is sent only when you press convert.";
});
urlInput.addEventListener("input", () => {
  document.querySelector("#input-hint").textContent = urlInput.value.trim() ? "Ready to convert." : "Your link is sent only when you press convert.";
});

document.querySelectorAll(".format-option").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".format-option").forEach((option) => option.classList.remove("selected"));
  button.classList.add("selected");
  state.format = button.dataset.format;
}));

document.querySelector("#convert-button").addEventListener("click", () => {
  const source = urlInput.value.trim();
  downloadButton.hidden = true;
  if (!source) { showResult("NEEDS A LINK", "Paste a link first.", "Add a public video URL before starting the conversion."); return; }
  if (!/^https?:\/\//i.test(source)) { showResult("INVALID LINK", "That link needs an address.", "Use a full URL beginning with http:// or https://."); return; }
  const button = document.querySelector("#convert-button");
  button.disabled = true;
  button.querySelector("span").textContent = "Converting...";
  showResult("WORKING", `Preparing your ${state.format.toUpperCase()}.`, "Fetching the link and converting the media now.");
  fetch("/api/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: source, format: state.format }) })
    .then(async (response) => { if (!response.ok) throw new Error((await response.json()).error || "Conversion failed."); return response.blob(); })
    .then((blob) => { downloadButton.href = URL.createObjectURL(blob); downloadButton.download = `reelcut.${state.format}`; downloadButton.hidden = false; showResult("READY TO DOWNLOAD", `Your ${state.format.toUpperCase()} is ready.`, "The conversion finished successfully.", "ready"); })
    .catch((error) => showResult("COULD NOT CONVERT", "That link did not work.", error.message))
    .finally(() => { button.disabled = false; button.querySelector("span").textContent = "Convert link"; });
});