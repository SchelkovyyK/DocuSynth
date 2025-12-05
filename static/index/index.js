const form = document.getElementById("form");
const fileInput = document.getElementById("zipfile");
const status = document.getElementById("status");
const dl = document.getElementById("downloadLink");
const loader = document.querySelector(".loader"); // loader element
const submitBtn = document.getElementById("submit");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const f = fileInput.files[0];
  if (!f) return alert("Select a zip file");

  status.textContent = "Uploading...";
  dl.style.display = "none";

  submitBtn.disabled = true;
  loader.style.display = "grid"; // show loader

  const fd = new FormData();
  fd.append("project", f);

  try {
    const resp = await fetch("http://127.0.0.1:8001/upload-zip", {
      method: "POST",
      body: fd,
    });

    if (!resp.ok) throw new Error("Server error");

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
    loader.style.display = "none"; // hide loader
  }
});
