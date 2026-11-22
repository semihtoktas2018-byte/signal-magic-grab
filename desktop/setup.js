const form = document.getElementById("form");
const input = document.getElementById("webUrl");
const button = document.getElementById("save");
const message = document.getElementById("message");

window.keltosDesktop.getWebUrl().then((url) => {
  if (url) input.value = url;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  button.disabled = true;

  try {
    const result = await window.keltosDesktop.saveWebUrl(input.value);
    if (!result?.saved) throw new Error("Bağlantı kaydedilemedi.");
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : "Bağlantı kaydedilemedi.";
    button.disabled = false;
  }
});
