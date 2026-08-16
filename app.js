import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, STORE_PASSWORD } from "./firebase-config.js";

// ---------- Firebase setup ----------
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const transfersRef = collection(db, "transfers");

// ---------- Constants ----------
const DIRECTION_LABELS = {
  dundrum_to_trinity: "Dundrum → Trinity St.",
  trinity_to_dundrum: "Trinity St. → Dundrum"
};

const STATUS_LABELS = {
  pending: "Pending",
  in_transit: "In transit",
  received: "Received"
};

let allTransfers = [];

// ---------- Gate ----------
const gate = document.getElementById("gate");
const app = document.getElementById("app");
const gateForm = document.getElementById("gate-form");
const gateError = document.getElementById("gate-error");

function unlock() {
  gate.hidden = true;
  app.hidden = false;
  startListening();
}

if (sessionStorage.getItem("stock-transfers-unlocked") === "true") {
  unlock();
}

gateForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = document.getElementById("gate-password").value;
  if (value === STORE_PASSWORD) {
    sessionStorage.setItem("stock-transfers-unlocked", "true");
    gateError.hidden = true;
    unlock();
  } else {
    gateError.hidden = false;
  }
});

// ---------- Modal ----------
const modalOverlay = document.getElementById("modal-overlay");
const transferForm = document.getElementById("transfer-form");

document.getElementById("new-transfer-btn").addEventListener("click", () => {
  transferForm.reset();
  modalOverlay.hidden = false;
});
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-cancel").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

function closeModal() {
  modalOverlay.hidden = true;
}

transferForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = transferForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging…";

  try {
    await addDoc(transfersRef, {
      product: document.getElementById("f-product").value.trim(),
      quantity: Number(document.getElementById("f-quantity").value),
      direction: document.getElementById("f-direction").value,
      customerName: document.getElementById("f-customer-name").value.trim(),
      customerContact: document.getElementById("f-customer-contact").value.trim(),
      notes: document.getElementById("f-notes").value.trim(),
      status: "pending",
      createdAt: serverTimestamp()
    });
    closeModal();
  } catch (err) {
    console.error(err);
    alert("Couldn't log the transfer. Check your connection and Firebase setup, then try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log transfer";
  }
});

// ---------- Live data ----------
function startListening() {
  const q = query(transfersRef, orderBy("createdAt", "desc"));
  onSnapshot(
    q,
    (snapshot) => {
      allTransfers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => {
      console.error(err);
      document.getElementById("empty-state").hidden = false;
      document.getElementById("empty-state").textContent =
        "Couldn't load transfers. Check your Firebase config and Firestore security rules.";
    }
  );
}

// ---------- Status update ----------
async function updateStatus(id, status) {
  try {
    await updateDoc(doc(db, "transfers", id), { status });
  } catch (err) {
    console.error(err);
    alert("Couldn't update status. Try again.");
  }
}

// ---------- Filters ----------
const searchInput = document.getElementById("filter-search");
const statusFilter = document.getElementById("filter-status");
const directionFilter = document.getElementById("filter-direction");

[searchInput, statusFilter, directionFilter].forEach((el) =>
  el.addEventListener("input", render)
);

function getFiltered() {
  const search = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const direction = directionFilter.value;

  return allTransfers.filter((t) => {
    if (status && t.status !== status) return false;
    if (direction && t.direction !== direction) return false;
    if (search) {
      const haystack = [t.product, t.customerName, t.customerContact]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

// ---------- Render ----------
function formatTimestamp(ts) {
  if (!ts || !ts.toDate) return "just now";
  const d = ts.toDate();
  return d.toLocaleDateString("en-IE", { day: "2-digit", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
}

function render() {
  // Dashboard counts (based on all transfers, not filtered)
  const counts = { pending: 0, in_transit: 0, received: 0 };
  allTransfers.forEach((t) => {
    if (counts[t.status] !== undefined) counts[t.status]++;
  });
  document.getElementById("stat-pending").textContent = counts.pending;
  document.getElementById("stat-transit").textContent = counts.in_transit;
  document.getElementById("stat-received").textContent = counts.received;
  document.getElementById("stat-total").textContent = allTransfers.length;

  // Table
  const rows = getFiltered();
  const tbody = document.getElementById("transfers-body");
  const emptyState = document.getElementById("empty-state");

  tbody.innerHTML = "";

  if (rows.length === 0) {
    emptyState.hidden = false;
    emptyState.textContent = allTransfers.length === 0
      ? 'No transfers logged yet. Click "New transfer" to add the first one.'
      : "No transfers match your filters.";
    return;
  }
  emptyState.hidden = true;

  rows.forEach((t) => {
    const tr = document.createElement("tr");

    const [fromDot, toDot] =
      t.direction === "dundrum_to_trinity"
        ? ["dot-dundrum", "dot-trinity"]
        : ["dot-trinity", "dot-dundrum"];

    tr.innerHTML = `
      <td data-label="Product">
        <div class="cell-product">${escapeHtml(t.product || "—")}</div>
      </td>
      <td data-label="Qty"><span class="qty">${t.quantity ?? "—"}</span></td>
      <td data-label="Route">
        <span class="route-cell">
          <span class="dot ${fromDot}"></span>
          ${DIRECTION_LABELS[t.direction] || "—"}
        </span>
      </td>
      <td data-label="Customer">
        <div>${escapeHtml(t.customerName || "—")}</div>
        ${t.customerContact ? `<div class="cell-sub">${escapeHtml(t.customerContact)}</div>` : ""}
      </td>
      <td data-label="Notes">${escapeHtml(t.notes || "—")}</td>
      <td data-label="Logged"><span class="timestamp">${formatTimestamp(t.createdAt)}</span></td>
      <td data-label="Status"></td>
    `;

    const statusCell = tr.querySelector('td[data-label="Status"]');
    const select = document.createElement("select");
    select.className = `status-select status-${t.status}`;
    Object.entries(STATUS_LABELS).forEach(([value, label]) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      if (value === t.status) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      select.className = `status-select status-${select.value}`;
      updateStatus(t.id, select.value);
    });
    statusCell.appendChild(select);

    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
