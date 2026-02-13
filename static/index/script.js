(function () {
  const modal = document.getElementById("modal");
  const btnNew = document.getElementById("btnNewProject");
  const btnCreate = document.getElementById("createProject");
  const modalClose = document.getElementById("modalClose");
  const modalCancel = document.getElementById("modalCancel");
  const projectForm = document.getElementById("projectForm");
  const projectsEl = document.getElementById("projects");

  const projectsStore = [];


  function openModal() {
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  btnNew.onclick = openModal;
  btnCreate.onclick = openModal;
  modalClose.onclick = closeModal;
  modalCancel.onclick = closeModal;


  async function loadProjects() {
    const res = await fetch("/projects");
    const list = await res.json();

    list.forEach((p) => {
      const project = {
        id: p.name,
        name: p.name,
        source: "Saved project",
        status: "ready",
        docsBlob: null,
      };
      projectsStore.push(project);
      addOrUpdateCard(project);
    });
  }

  loadProjects();


  projectForm.onsubmit = async (e) => {
    e.preventDefault();

    const zipInput = document.getElementById("zipFile");
    const zip = zipInput.files.length ? zipInput.files[0] : null;

    const repoUrl = document.getElementById("repoUrl").value.trim();
    const name = document.getElementById("projectName").value.trim();

    if (!name) {
      alert("Project name is required");
      return;
    }

    if (!zip && !repoUrl) {
      alert("Provide either a ZIP file or a GitHub URL");
      return;
    }

    if (zip && repoUrl) {
      alert("Choose ZIP OR GitHub URL, not both");
      return;
    }

    const source = zip ? zip.name : repoUrl;

    const project = {
      id: name,
      name,
      source,
      status: "pending",
      docsBlob: null,
    };

    projectsStore.push(project);
    addOrUpdateCard(project);
    closeModal();

    try {
      let res;

      if (zip) {
        const fd = new FormData();
        fd.append("project", zip);

        res = await fetch("/upload-zip", {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch("/upload-github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoUrl,
            projectName: name,
          }),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Server error");
      }

      project.docsBlob = await res.blob();
      project.status = "ready";
      addOrUpdateCard(project);
    } catch (err) {
      project.status = "error";
      project.error = err.message;
      addOrUpdateCard(project);
    }
  };


  function addOrUpdateCard(p) {
    let card = projectsEl.querySelector(`[data-id="${p.id}"]`);
    if (!card) {
      const empty = projectsEl.querySelector(".empty-state");
      if (empty) empty.remove();

      card = document.createElement("article");
      card.className = "project-card";
      card.dataset.id = p.id;
      projectsEl.appendChild(card);
    }

    card.innerHTML = renderCard(p);

    if (p.status === "ready") {
      card.onclick = () => downloadDocs(p);
    }
  }

  function renderCard(p) {
    if (p.status === "pending") {
      return `
        <div class="card-inner loading">
          <h3>${p.name}</h3>
          <div class="project-loader"></div>
          <span>Analyzing project…</span>
        </div>
      `;
    }

    if (p.status === "error") {
      return `<div class="card-inner error">❌ ${p.error}</div>`;
    }

    return `
      <div class="card-inner">
        <h3>${p.name}</h3>
        <button class="btn btn-outline">Download Docs</button>
      </div>
    `;
  }


  function downloadDocs(p) {
    if (p.docsBlob) {
      const url = URL.createObjectURL(p.docsBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${p.name}_docs.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      window.location.href = `/projects/${p.name}/download`;
    }
  }
})();
