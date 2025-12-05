const form = document.getElementById("form");
const fileInput = document.getElementById("zipfile");
const status = document.getElementById("status");
const dl = document.getElementById("downloadLink");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const f = fileInput.files[0];
  if (!f) return alert("Select a zip file");

  status.textContent = "Uploading...";
  progressBar.value = 0;
  progressText.textContent = "";

  const fd = new FormData();
  fd.append("project", f);

  const submitBtn = document.getElementById("submit");
  submitBtn.disabled = true;

  // Simulated progress while backend processes
  let progress = 0;
  const fakeTotal = 10; // rough estimation
  const interval = setInterval(() => {
    progress++;
    const percent = Math.min(100, (progress / fakeTotal) * 100);
    progressBar.value = percent;
    progressText.textContent = `Processing files... ${percent.toFixed(0)}%`;
    if (percent >= 100) clearInterval(interval);
  }, 1000); // 1 second per step

  try {
    const resp = await fetch("http://127.0.0.1:8001/upload-zip", {
      method: "POST",
      body: fd,
    });

    if (!resp.ok) throw new Error("Server error");

    clearInterval(interval); // stop fake progress
    progressBar.value = 100;
    progressText.textContent = "Processing complete";

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);

    dl.href = url;
    dl.download = f.name.replace(/\.zip$/i, "_docs.zip");
    dl.style.display = "inline-block";

    status.textContent = "Done — download below";
  } catch (err) {
    console.error(err);
    status.textContent = "Error: " + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});
