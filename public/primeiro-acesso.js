const form = document.getElementById("bootstrap-form");
const email = document.getElementById("email");
const password = document.getElementById("password");
const token = document.getElementById("token");
const submit = document.getElementById("submit");
const message = document.getElementById("message");

function showMessage(text, kind) {
  message.hidden = false;
  message.className = `message ${kind}`;
  message.textContent = text;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.hidden = true;
  submit.disabled = true;

  try {
    const response = await fetch("/api/auth/set-initial-password", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-admin-bootstrap-token": token.value,
      },
      body: JSON.stringify({
        email: email.value.trim(),
        password: password.value,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      showMessage(data.error || "Não foi possível cadastrar a primeira senha.", "error");
      return;
    }

    password.value = "";
    token.value = "";
    showMessage("Primeira senha cadastrada com sucesso. Você será encaminhado para o login.", "success");
    setTimeout(() => { window.location.assign("/"); }, 1800);
  } catch {
    showMessage("Não foi possível conectar ao servidor. Tente novamente.", "error");
  } finally {
    submit.disabled = false;
  }
});
