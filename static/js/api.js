// Thin wrapper around the 4 REST endpoints.
const API = {
  async listTickets(status, search) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    const res = await fetch(`/api/tickets?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to load tickets");
    return res.json();
  },

  async createTicket(data) {
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create ticket");
    return res.json();
  },

  async getTicket(ticketId) {
    const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`);
    if (!res.ok) throw new Error("Ticket not found");
    return res.json();
  },

  async updateTicket(ticketId, data) {
    const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update ticket");
    return res.json();
  },

    async deleteTicket(ticketId) {
    const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete ticket");
    return res.json();
  },
};


function statusBadgeClasses(status) {
  switch (status) {
    case "Open": return "bg-amber-100 text-amber-700";
    case "In Progress": return "bg-blue-100 text-blue-700";
    case "Closed": return "bg-emerald-100 text-emerald-700";
    default: return "bg-slate-100 text-slate-700";
  }
}

function priorityBadgeClasses(priority) {
  switch (priority) {
    case "Urgent": return "bg-red-100 text-red-700";
    case "High": return "bg-orange-100 text-orange-700";
    case "Low": return "bg-slate-100 text-slate-500";
    default: return "bg-slate-100 text-slate-600";
  }
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
