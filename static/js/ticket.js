const content = document.getElementById("content");
const params = new URLSearchParams(window.location.search);
const ticketId = params.get("id");

function render(ticket) {
  const hasScreenshots = ticket.screenshots && ticket.screenshots.length > 0;
  
  let screenshotsHtml = "";
  if (hasScreenshots) {
    screenshotsHtml = ticket.screenshots
      .map(
        (ss) =>
          `<img src="/static/uploads/${ss}" class="w-full h-48 object-cover rounded-lg border border-slate-200" />`
      )
      .join("");
  }

  content.innerHTML = `
    <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div class="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div class="font-mono text-xs text-indigo-600">${escapeHtml(ticket.ticket_id)}</div>
          <h2 class="text-xl font-semibold text-slate-900 mt-1">${escapeHtml(ticket.subject)}</h2>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium px-2 py-1 rounded-full ${statusBadgeClasses(ticket.status)}">${escapeHtml(ticket.status)}</span>
          <button id="deleteBtn" class="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
            Delete
          </button>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
        <div><span class="text-slate-400">Customer:</span> ${escapeHtml(ticket.customer_name)}</div>
        <div><span class="text-slate-400">Email:</span> ${escapeHtml(ticket.customer_email)}</div>
        <div><span class="text-slate-400">Priority:</span>
          <span class="text-xs font-medium px-2 py-0.5 rounded-full ${priorityBadgeClasses(ticket.priority)}">${escapeHtml(ticket.priority || "Normal")}</span>
        </div>
        <div><span class="text-slate-400">Created:</span> ${formatDate(ticket.created_at)}</div>
      </div>

      <div class="mt-4">
        <div class="text-xs font-medium text-slate-500 mb-1">Description</div>
        <p class="text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(ticket.description)}</p>
      </div>

      <div class="grid sm:grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-100">
        <div>
          <label class="text-xs font-medium text-slate-600">Update Status</label>
          <select id="statusSelect" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1">
            ${["Open", "In Progress", "Closed"].map(s => `<option ${s === ticket.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-600">Assign To</label>
          <input id="assignInput" value="${escapeHtml(ticket.assigned_to || "")}" placeholder="agent@company.com"
            class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" />
        </div>
      </div>
      <button id="saveBtn" class="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
        Save Changes
      </button>
      <span id="saveStatus" class="text-xs text-emerald-600 ml-2"></span>
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <h3 class="text-sm font-semibold text-slate-800 mb-3">Screenshots</h3>
      
      ${hasScreenshots ? `
        <div id="screenshotList" class="grid grid-cols-2 gap-2 mb-4">
          ${screenshotsHtml}
        </div>
        <details class="mt-4">
          <summary class="text-sm text-slate-600 cursor-pointer hover:text-slate-800 font-medium">+ Add more screenshots</summary>
          <form id="uploadForm" class="flex gap-2 mt-3">
            <input id="fileInput" type="file" accept="image/*" required
              class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <button type="submit" class="bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg">Upload</button>
          </form>
          <span id="uploadStatus" class="text-xs text-red-500 mt-1 block"></span>
        </details>
      ` : `
        <div class="text-sm text-slate-400 mb-4">No screenshots yet.</div>
        <form id="uploadForm" class="flex gap-2">
          <input id="fileInput" type="file" accept="image/*" required
            class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <button type="submit" class="bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg">Upload</button>
        </form>
        <span id="uploadStatus" class="text-xs text-red-500 mt-1 block"></span>
      `}
    </div>

    <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <h3 class="text-sm font-semibold text-slate-800 mb-3">Notes / Comments</h3>
      <div id="notesList" class="space-y-2 mb-4">
        ${(ticket.notes || []).map(n => `
          <div class="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm">
            <div class="text-slate-700 whitespace-pre-wrap">${escapeHtml(n.note_text)}</div>
            <div class="text-xs text-slate-400 mt-1">${formatDate(n.created_at)}</div>
          </div>
        `).join("") || `<div class="text-sm text-slate-400">No notes yet.</div>`}
      </div>
      <form id="noteForm" class="flex gap-2">
        <input id="noteInput" placeholder="Add a note…" required
          class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <button class="bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg">Add</button>
      </form>
    </div>
  `;

  document.getElementById("saveBtn").onclick = async () => {
    const status = document.getElementById("statusSelect").value;
    const assigned_to = document.getElementById("assignInput").value.trim();
    try {
      await API.updateTicket(ticketId, { status, assigned_to });
      const saveStatus = document.getElementById("saveStatus");
      saveStatus.textContent = "Saved.";
      setTimeout(() => (saveStatus.textContent = ""), 1500);
      const fresh = await API.getTicket(ticketId);
      render(fresh);
    } catch (err) {
      alert(err.message);
    }
  };

  document.getElementById("deleteBtn").onclick = async () => {
    const confirmed = confirm(
      `Delete ticket ${ticket.ticket_id}? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await API.deleteTicket(ticketId);
      window.location.href = "/"; // back to ticket list
    } catch (err) {
      alert(err.message);
    }
  };

  document.getElementById("uploadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("fileInput");
    const uploadStatus = document.getElementById("uploadStatus");
    const file = fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      uploadStatus.textContent = "Uploading…";
      uploadStatus.classList.remove("text-red-500");
      uploadStatus.classList.add("text-slate-400");

      const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || "Upload failed");
      }

      const fresh = await API.getTicket(ticketId);
      render(fresh);
    } catch (err) {
      uploadStatus.textContent = err.message;
      uploadStatus.classList.remove("text-slate-400");
      uploadStatus.classList.add("text-red-500");
    }
  });

  document.getElementById("noteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const note_text = document.getElementById("noteInput").value.trim();
    if (!note_text) return;
    try {
      await API.updateTicket(ticketId, { note_text });
      const fresh = await API.getTicket(ticketId);
      render(fresh);
    } catch (err) {
      alert(err.message);
    }
  });
}

async function load() {
  if (!ticketId) {
    content.innerHTML = `<div class="text-sm text-red-500">No ticket ID given.</div>`;
    return;
  }
  try {
    const ticket = await API.getTicket(ticketId);
    render(ticket);
  } catch (err) {
    content.innerHTML = `<div class="text-sm text-red-500">${escapeHtml(err.message)}</div>`;
  }
}

load();