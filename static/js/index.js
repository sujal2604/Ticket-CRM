const ticketRows = document.getElementById("ticketRows");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const modalOverlay = document.getElementById("modalOverlay");
const ticketForm = document.getElementById("ticketForm");

let debounceTimer = null;

function renderTickets(tickets) {
  ticketRows.innerHTML = "";
  emptyState.classList.toggle("hidden", tickets.length > 0);

  for (const t of tickets) {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 cursor-pointer";
    tr.onclick = () => (window.location.href = `/ticket?id=${encodeURIComponent(t.ticket_id)}`);
    tr.innerHTML = `
      <td class="px-4 py-3 font-mono text-xs text-indigo-600">${escapeHtml(t.ticket_id)}</td>
      <td class="px-4 py-3">
        <div class="font-medium text-slate-800">${escapeHtml(t.customer_name)}</div>
        <div class="text-xs text-slate-400">${escapeHtml(t.customer_email)}</div>
      </td>
      <td class="px-4 py-3 hidden md:table-cell text-slate-600">${escapeHtml(t.subject)}</td>
      <td class="px-4 py-3">
        <span class="text-xs font-medium px-2 py-1 rounded-full ${statusBadgeClasses(t.status)}">${escapeHtml(t.status)}</span>
      </td>
      <td class="px-4 py-3 hidden sm:table-cell">
        <span class="text-xs font-medium px-2 py-1 rounded-full ${priorityBadgeClasses(t.priority || "Normal")}">${escapeHtml(t.priority || "Normal")}</span>
      </td>
      <td class="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">${escapeHtml(t.assigned_to || "—")}</td>
      <td class="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">${formatDate(t.created_at)}</td>
    `;
    ticketRows.appendChild(tr);
  }
}

async function loadTickets() {
  try {
    const tickets = await API.listTickets(statusFilter.value, searchInput.value.trim());
    renderTickets(tickets);
  } catch (err) {
    ticketRows.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-red-500 text-sm">${escapeHtml(err.message)}</td></tr>`;
  }
}

searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadTickets, 250);
});

statusFilter.addEventListener("change", loadTickets);

document.getElementById("newTicketBtn").onclick = () => modalOverlay.classList.remove("hidden");
document.getElementById("cancelBtn").onclick = () => modalOverlay.classList.add("hidden");
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.add("hidden");
});

ticketForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(ticketForm);
  const payload = Object.fromEntries(formData.entries());
  const fileInput = document.getElementById("createFileInput");
  const files = fileInput.files;

  try {
    console.log("Creating ticket...");
    const result = await API.createTicket(payload);
    const ticketId = result.ticket_id;
    console.log("Ticket created:", ticketId);

    if (files.length > 0) {
      console.log(`Uploading ${files.length} file(s)...`);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Uploading file ${i + 1}/${files.length}: ${file.name}`);
        
        const uploadData = new FormData();
        uploadData.append("file", file);
        
        const uploadRes = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/upload`, {
          method: "POST",
          body: uploadData,
        });
        
        console.log(`Upload response status: ${uploadRes.status}`);
        
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({ detail: "Unknown error" }));
          console.error("Upload error:", err);
          throw new Error(err.detail || "Screenshot upload failed");
        }
        console.log(`File ${i + 1} uploaded successfully`);
      }
      console.log("All files uploaded");
    } else {
      console.log("No files selected");
    }

    ticketForm.reset();
    fileInput.value = "";
    modalOverlay.classList.add("hidden");
    await loadTickets();
  } catch (err) {
    console.error("Error:", err);
    alert("Error: " + err.message);
  }
});

loadTickets();