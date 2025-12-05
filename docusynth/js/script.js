(function(){
  const modal = document.getElementById('modal');
  const btnNew = document.getElementById('btnNewProject');
  const btnCreate = document.getElementById('createProject');
  const modalClose = document.getElementById('modalClose');
  const modalCancel = document.getElementById('modalCancel');
  const projectForm = document.getElementById('projectForm');
  const btnFilter = document.getElementById('btnFilter');
  const search = document.getElementById('search');

  function openModal(){
    modal.setAttribute('aria-hidden', 'false');
    // focus first field
    const first = modal.querySelector('input');
    if(first) first.focus();
    document.body.style.overflow = 'hidden';
  }
  function closeModal(){
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    btnNew.focus();
  }

  btnNew.addEventListener('click', openModal);
  btnCreate.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modalCancel.addEventListener('click', closeModal);

  projectForm.addEventListener('submit', function(ev){
    ev.preventDefault();
    const repo = document.getElementById('repoUrl').value.trim();
    const name = document.getElementById('projectName').value.trim();
    if(!repo || !name) return;
    // Minimal client-side behaviour: simulate adding a project card
    addProject({name, repo});
    projectForm.reset();
    closeModal();
  });

  function addProject(p){
    const projects = document.getElementById('projects');
    // remove empty-state if exists
    const empty = projects.querySelector('.empty-state');
    if(empty) empty.remove();

    const card = document.createElement('article');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="card-inner">
        <h3 class="proj-title">${escapeHtml(p.name)}</h3>
        <p class="proj-sub">${escapeHtml(p.repo)}</p>
      </div>
    `;
    projects.appendChild(card);
  }

  // simple filter toggle visual
  btnFilter.addEventListener('click', function(){
    const pressed = this.getAttribute('aria-pressed') === 'true';
    this.setAttribute('aria-pressed', String(!pressed));
  });

  // search: naive filter over project cards
  search.addEventListener('input', function(){
    const q = this.value.trim().toLowerCase();
    const cards = document.querySelectorAll('.project-card');
    if(!cards.length) return;
    cards.forEach(c => {
      const t = (c.textContent || '').toLowerCase();
      c.style.display = q && t.indexOf(q) === -1 ? 'none' : '';
    });
  });

  // Utility
  function escapeHtml(s){
    return s.replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[ch];
    });
  }

  // Close modal on ESC
  window.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      const hidden = modal.getAttribute('aria-hidden') === 'true';
      if(!hidden) closeModal();
    }
  });
})();
// Docs & navigation: append to js/script.js
document.addEventListener('DOMContentLoaded', function(){
  // NAV VIEWS
  const navProjects = document.getElementById('navProjects');
  const navDocs = document.getElementById('navDocs');
  const projectsView = document.getElementById('projects-view');
  const docsView = document.getElementById('docs-view');

  function showView(view){
    const showingDocs = view === 'docs';
    // header nav styling
    navProjects.classList.toggle('active', !showingDocs);
    navDocs.classList.toggle('active', showingDocs);
    // toggle views
    projectsView.style.display = showingDocs ? 'none' : '';
    docsView.style.display = showingDocs ? '' : 'none';
    projectsView.setAttribute('aria-hidden', String(showingDocs));
    docsView.setAttribute('aria-hidden', String(!showingDocs));
    // reset doc search when switching
    const docSearch = document.getElementById('docSearch');
    if(docSearch) docSearch.value = '';
    // make focus predictable
    if(showingDocs){
      const first = docsView.querySelector('input, button, a');
      if(first) first.focus();
    } else {
      const first = projectsView.querySelector('input, button, a');
      if(first) first.focus();
    }
  }

  navDocs.addEventListener('click', function(ev){
    ev.preventDefault();
    showView('docs');
  });
  navProjects.addEventListener('click', function(ev){
    ev.preventDefault();
    showView('projects');
  });

  // If URL hash is #docs open docs view
  if(location.hash === '#docs') showView('docs');

  // DOCS TABS
  const docTabs = Array.from(document.querySelectorAll('.doc-tabs .tab-button'));
  const docPanels = Array.from(document.querySelectorAll('.doc-panel'));

  function activateDocTab(targetId){
    docTabs.forEach(t => {
      const active = t.dataset.target === targetId;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    docPanels.forEach(p => {
      const show = p.id === targetId;
      p.style.display = show ? '' : 'none';
      p.setAttribute('aria-hidden', String(!show));
    });
  }

  docTabs.forEach(t => {
    t.addEventListener('click', function(){
      activateDocTab(this.dataset.target);
      const docSearch = document.getElementById('docSearch');
      if(docSearch) docSearch.value = '';
      filterDocCards('');
    });
  });

  // default tab
  activateDocTab('doc-key');

  // DOCS SEARCH (filter visible doc-cards)
  function filterDocCards(q){
    q = (q || '').trim().toLowerCase();
    const visiblePanel = docPanels.find(p => p.style.display !== 'none');
    if(!visiblePanel) return;
    const cards = Array.from(visiblePanel.querySelectorAll('.doc-card'));
    if(!q) { cards.forEach(c => c.style.display = ''); return; }
    cards.forEach(c => {
      const text = (c.textContent || '').toLowerCase();
      c.style.display = text.indexOf(q) === -1 ? 'none' : '';
    });
  }

  const docSearchInput = document.getElementById('docSearch');
  if(docSearchInput){
    docSearchInput.addEventListener('input', function(){ filterDocCards(this.value); });
  }

  // ensure keyboard navigation: Escape from docs returns to projects
  window.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && docsView.style.display !== 'none'){
      showView('projects');
    }
  });
});

// Workflow reveal: append to js/script.js
(function(){
  // reveal workflow steps when the docs view becomes visible or on scroll
  const stepsSelector = '.workflow-step';
  let observer;

  function observeSteps(){
    const steps = Array.from(document.querySelectorAll(stepsSelector));
    if(!steps.length) return;

    if('IntersectionObserver' in window){
      observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => {
          if(e.isIntersecting){
            e.target.classList.add('visible');
            obs.unobserve(e.target);
          }
        });
      }, {threshold: 0.18});
      steps.forEach(s => {
        if(!s.classList.contains('visible')) observer.observe(s);
      });
      return;
    }

    // fallback: reveal all
    steps.forEach(s => s.classList.add('visible'));
  }

  // trigger when docs view becomes visible (nav code manages view switching)
  document.addEventListener('click', function(ev){
    const target = ev.target;
    if(target && target.matches('[data-view="docs"], #navDocs')) {
      // small timeout to allow DOM paint
      setTimeout(observeSteps, 120);
    }
  }, true);

  // also observe on initial load in case docs opened by hash
  window.addEventListener('load', function(){
    if(location.hash === '#docs' || document.getElementById('docs-view').style.display !== 'none'){
      setTimeout(observeSteps, 120);
    }
  });
})();
