export function reviewerPageHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Atlas Reviewer</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f7f9;
      color: #17202a;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; }
    button, input, textarea { font: inherit; }
    button {
      border: 1px solid #cfd6df;
      background: #ffffff;
      color: #17202a;
      border-radius: 6px;
      min-height: 36px;
      padding: 0 12px;
      cursor: pointer;
    }
    button.primary { background: #166534; color: #ffffff; border-color: #166534; }
    button.danger { background: #991b1b; color: #ffffff; border-color: #991b1b; }
    button:disabled { opacity: .55; cursor: not-allowed; }
    input, textarea {
      border: 1px solid #cfd6df;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
      color: #17202a;
      width: 100%;
    }
    textarea { min-height: 86px; resize: vertical; }
    .layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); min-height: 100vh; }
    .sidebar { border-right: 1px solid #dde3ea; background: #ffffff; padding: 16px; overflow: auto; }
    .main { padding: 20px; overflow: auto; }
    .topbar { display: grid; gap: 10px; margin-bottom: 16px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .brand { font-weight: 750; font-size: 18px; letter-spacing: 0; }
    .muted { color: #5f6f82; }
    .small { font-size: 12px; }
    .project-list { display: grid; gap: 8px; }
    .project-button { text-align: left; min-height: auto; padding: 10px; display: grid; gap: 4px; }
    .project-button.active { border-color: #155e75; outline: 2px solid #c8edf5; }
    .grid { display: grid; gap: 14px; }
    .columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .panel { border: 1px solid #dde3ea; border-radius: 8px; background: #ffffff; padding: 14px; }
    .panel h2, .panel h3 { margin: 0 0 10px; font-size: 15px; letter-spacing: 0; }
    .metric { font-size: 26px; font-weight: 760; }
    .status { display: inline-flex; align-items: center; min-height: 24px; padding: 2px 8px; border-radius: 999px; background: #eef2f6; font-size: 12px; }
    .status.ready, .status.approved_for_publish { background: #dcfce7; color: #14532d; }
    .status.blocked { background: #fee2e2; color: #7f1d1d; }
    .status.changes_requested, .status.ready_for_review { background: #fef3c7; color: #78350f; }
    .issue-list, .event-list, .approval-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .issue-list li, .event-list li, .approval-list li { border-top: 1px solid #edf1f5; padding-top: 8px; }
    .empty { border: 1px dashed #cfd6df; border-radius: 8px; padding: 20px; background: #ffffff; color: #5f6f82; }
    .message { min-height: 20px; color: #155e75; }
    .message.error { color: #991b1b; }
    @media (max-width: 920px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { border-right: 0; border-bottom: 1px solid #dde3ea; max-height: 45vh; }
      .columns { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="topbar">
        <div class="brand">Atlas Reviewer</div>
        <input id="token" type="password" placeholder="Atlas API token" autocomplete="off" />
        <div class="toolbar">
          <button id="saveToken">Save</button>
          <button id="reloadProjects">Reload</button>
        </div>
        <div id="message" class="message small"></div>
      </div>
      <div id="projects" class="project-list"></div>
    </aside>
    <main class="main">
      <div id="review" class="grid"><div class="empty">Select a project.</div></div>
    </main>
  </div>
  <script>
    const state = { projects: [], selected: null, review: null };
    const tokenInput = document.getElementById("token");
    const projectsEl = document.getElementById("projects");
    const reviewEl = document.getElementById("review");
    const messageEl = document.getElementById("message");
    tokenInput.value = localStorage.getItem("atlasReviewerToken") || "";

    document.getElementById("saveToken").addEventListener("click", () => {
      localStorage.setItem("atlasReviewerToken", tokenInput.value.trim());
      setMessage("Token saved.");
      loadProjects();
    });
    document.getElementById("reloadProjects").addEventListener("click", loadProjects);

    function headers() {
      const token = tokenInput.value.trim();
      return token ? { "Authorization": "Bearer " + token, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
    }

    async function request(path, options = {}) {
      const response = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error || response.statusText);
      return data;
    }

    function setMessage(value, isError = false) {
      messageEl.textContent = value || "";
      messageEl.classList.toggle("error", isError);
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char));
    }

    function statusClass(value) { return "status " + String(value || "").replace(/[^a-z0-9_-]/gi, "_"); }

    async function loadProjects() {
      try {
        setMessage("Loading projects...");
        const data = await request("/projects?limit=100");
        state.projects = data.projects || [];
        renderProjects();
        setMessage(state.projects.length + " projects loaded.");
        if (!state.selected && state.projects[0]) selectProject(state.projects[0].id);
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    function renderProjects() {
      projectsEl.innerHTML = state.projects.map((project) => \`
        <button class="project-button \${project.id === state.selected ? "active" : ""}" data-project="\${escapeHtml(project.id)}">
          <strong>\${escapeHtml(project.title)}</strong>
          <span class="small muted">\${escapeHtml(project.region)} - \${escapeHtml(project.category)}</span>
          <span class="\${statusClass(project.status)}">\${escapeHtml(project.status)}</span>
        </button>
      \`).join("") || \`<div class="empty">No projects.</div>\`;
      projectsEl.querySelectorAll("[data-project]").forEach((button) => {
        button.addEventListener("click", () => selectProject(button.dataset.project));
      });
    }

    async function selectProject(id) {
      try {
        state.selected = id;
        renderProjects();
        reviewEl.innerHTML = \`<div class="empty">Loading review...</div>\`;
        state.review = await request(\`/projects/\${encodeURIComponent(id)}/review\`);
        renderReview();
        setMessage("Review loaded.");
      } catch (error) {
        setMessage(error.message, true);
      }
    }

    function renderReview() {
      const review = state.review;
      const project = review.project;
      const next = review.nextAction || {};
      const issues = [...(review.qualityIssues || []), ...((review.readiness && review.readiness.issues) || [])];
      const approvals = (review.approvals && review.approvals.approvals) || [];
      const events = review.recentEvents || [];
      reviewEl.innerHTML = \`
        <section class="panel">
          <div class="toolbar" style="justify-content: space-between; gap: 12px;">
            <div>
              <h2>\${escapeHtml(project.title)}</h2>
              <div class="small muted">\${escapeHtml(project.id)}</div>
            </div>
            <span class="\${statusClass(project.status)}">\${escapeHtml(project.status)}</span>
          </div>
          <div class="toolbar" style="margin-top: 12px;">
            <button id="runWorkflow">Run workflow</button>
            \${next.type === "approve_stage" ? \`<button id="approveStage" class="primary">Approve stage</button>\` : ""}
            <button id="preparePublish" class="primary">Prepare publish</button>
            <button id="requestChanges">Request changes</button>
            <button id="blockProject" class="danger">Block</button>
          </div>
          <div class="small muted" style="margin-top: 8px;">Next: \${escapeHtml(next.label || "None")}</div>
        </section>
        <section class="columns">
          <div class="panel"><h3>Sources</h3><div class="metric">\${review.sourceSummary.total}</div><div class="small muted">official \${review.sourceSummary.officialCount}, trust \${review.sourceSummary.averageTrustScore}</div></div>
          <div class="panel"><h3>Claims</h3><div class="metric">\${review.claimSummary.total}</div><div class="small muted">needs review \${review.claimSummary.needsReview}</div></div>
          <div class="panel"><h3>Readiness</h3><div class="metric">\${review.readiness.blockingCount || 0}</div><div class="small muted">blocking issues</div></div>
        </section>
        <section class="panel">
          <h3>Issues</h3>
          <ul class="issue-list">\${issues.length ? issues.slice(0, 12).map((issue) => \`<li><strong>\${escapeHtml(issue.severity || issue.type || "issue")}</strong><div>\${escapeHtml(issue.message || issue.reason || issue.code || JSON.stringify(issue))}</div></li>\`).join("") : \`<li>No issues reported.</li>\`}</ul>
        </section>
        <section class="columns">
          <div class="panel"><h3>Approvals</h3><ul class="approval-list">\${approvals.length ? approvals.map((item) => \`<li><strong>\${escapeHtml(item.stage)}</strong><div class="small muted">\${escapeHtml(item.decision)} - \${escapeHtml(item.decidedAt)}</div></li>\`).join("") : \`<li>No approvals yet.</li>\`}</ul></div>
          <div class="panel"><h3>Artifacts</h3><div class="small">Present: \${escapeHtml(review.artifactSummary.requiredPresent.join(", ") || "none")}</div><div class="small muted" style="margin-top: 8px;">Missing: \${escapeHtml(review.artifactSummary.requiredMissing.join(", ") || "none")}</div></div>
          <div class="panel"><h3>Import</h3><div class="small">\${escapeHtml(review.importReadiness.recommendedNextAction || "No recommendation")}</div><div class="small muted" style="margin-top: 8px;">Can import: \${review.importReadiness.canImportToRouteMarket ? "yes" : "no"}</div></div>
        </section>
        <section class="panel">
          <h3>Review note</h3>
          <textarea id="reviewNote" placeholder="Reviewer note"></textarea>
        </section>
        <section class="panel">
          <h3>Recent events</h3>
          <ul class="event-list">\${events.length ? events.map((event) => \`<li><strong>\${escapeHtml(event.type)}</strong><div>\${escapeHtml(event.message)}</div><div class="small muted">\${escapeHtml(event.createdAt)}</div></li>\`).join("") : \`<li>No events.</li>\`}</ul>
        </section>
      \`;
      document.getElementById("runWorkflow").addEventListener("click", runWorkflow);
      document.getElementById("preparePublish").addEventListener("click", preparePublish);
      document.getElementById("requestChanges").addEventListener("click", () => submitReviewDecision("changes_requested"));
      document.getElementById("blockProject").addEventListener("click", () => submitReviewDecision("blocked"));
      const approveButton = document.getElementById("approveStage");
      if (approveButton) approveButton.addEventListener("click", approveStage);
    }

    function reviewNote() {
      return (document.getElementById("reviewNote")?.value || "").trim();
    }

    async function runWorkflow() {
      try {
        setMessage("Starting workflow...");
        await request(\`/projects/\${encodeURIComponent(state.selected)}/jobs/run-mvp2\`, { method: "POST", body: "{}" });
        await selectProject(state.selected);
      } catch (error) { setMessage(error.message, true); }
    }

    async function approveStage() {
      const stage = state.review.nextAction && state.review.nextAction.stage;
      if (!stage) return;
      try {
        setMessage("Approving " + stage + "...");
        await request(\`/projects/\${encodeURIComponent(state.selected)}/approvals/\${encodeURIComponent(stage)}\`, {
          method: "POST",
          body: JSON.stringify({ decision: "approved", reviewer: "Atlas Reviewer", notes: reviewNote() })
        });
        await selectProject(state.selected);
      } catch (error) { setMessage(error.message, true); }
    }

    async function submitReviewDecision(decision) {
      try {
        setMessage("Saving review decision...");
        await request(\`/projects/\${encodeURIComponent(state.selected)}/review/decision\`, {
          method: "POST",
          body: JSON.stringify({ decision, reviewer: "Atlas Reviewer", notes: reviewNote() })
        });
        await loadProjects();
        await selectProject(state.selected);
      } catch (error) { setMessage(error.message, true); }
    }

    async function preparePublish() {
      try {
        setMessage("Preparing publish payload...");
        await request(\`/projects/\${encodeURIComponent(state.selected)}/prepare-publish\`, { method: "POST", body: "{}" });
        await selectProject(state.selected);
      } catch (error) { setMessage(error.message, true); }
    }

    loadProjects();
  </script>
</body>
</html>`;
}
