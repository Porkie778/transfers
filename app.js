import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, STORE_PASSWORD_HASH } from "./firebase-config.js";

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
let itemRowCount = 0;

// Inline "edit items" state — only one transfer can be in edit mode at a time
let editingId = null;
let editingDraftItems = null;

// ---------- Password hashing ----------
async function hashPassword(candidate) {
  const enc = new TextEncoder().encode(candidate);
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
// Exposed so you can generate a new hash from the browser console:
// await hashPassword("your-new-password")
window.hashPassword = hashPassword;

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

gateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = gateForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const value = document.getElementById("gate-password").value;
  const candidateHash = await hashPassword(value);
  submitBtn.disabled = false;

  if (candidateHash === STORE_PASSWORD_HASH) {
    sessionStorage.setItem("stock-transfers-unlocked", "true");
    gateError.hidden = true;
    document.getElementById("gate-password").value = "";
    unlock();
  } else {
    gateError.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  sessionStorage.removeItem("stock-transfers-unlocked");
  location.reload();
});

// ---------- Item rows (New transfer modal) ----------
const itemsList = document.getElementById("items-list");

function buildItemRow(values = {}) {
  itemRowCount++;
  const row = document.createElement("div");
  row.className = "item-row";
  row.dataset.rowId = itemRowCount;
  row.innerHTML = `
    <div class="item-row-head">
      <span class="item-row-label"></span>
      <button type="button" class="item-row-remove">Remove</button>
    </div>
    <div class="item-row-fields">
      <label class="field"><span>Product</span><input type="text" class="i-product" value="${escapeAttr(values.product || "")}" required /></label>
      <label class="field"><span>SKU</span><input type="text" class="i-sku" value="${escapeAttr(values.sku || "")}" /></label>
      <label class="field"><span>Size</span><input type="text" class="i-size" value="${escapeAttr(values.size || "")}" /></label>
      <label class="field"><span>Colour</span><input type="text" class="i-colour" value="${escapeAttr(values.colorCode || "")}" /></label>
      <label class="field"><span>Qty</span><input type="number" class="i-qty" min="1" value="${values.quantity || 1}" required /></label>
    </div>
  `;
  row.querySelector(".item-row-remove").addEventListener("click", () => {
    row.remove();
    renumberRows(itemsList);
  });
  return row;
}

function renumberRows(container) {
  Array.from(container.querySelectorAll(".item-row")).forEach((row, idx) => {
    row.querySelector(".item-row-label").textContent = `Item ${idx + 1}`;
    const removeBtn = row.querySelector(".item-row-remove");
    removeBtn.style.visibility = container.querySelectorAll(".item-row").length > 1 ? "visible" : "hidden";
  });
}

function addItemRow(values = {}) {
  const row = buildItemRow(values);
  itemsList.appendChild(row);
  renumberRows(itemsList);
}

document.getElementById("add-item-btn").addEventListener("click", () => addItemRow());

function resetItemRows() {
  itemsList.innerHTML = "";
  addItemRow();
}

function collectItems(container) {
  return Array.from(container.querySelectorAll(".item-row")).map((row) => ({
    product: row.querySelector(".i-product").value.trim(),
    sku: row.querySelector(".i-sku").value.trim(),
    size: row.querySelector(".i-size").value.trim(),
    colorCode: row.querySelector(".i-colour").value.trim(),
    quantity: Number(row.querySelector(".i-qty").value) || 1,
    notFound: row.dataset.notFound === "true"
  }));
}

// ---------- New transfer modal ----------
const modalOverlay = document.getElementById("modal-overlay");
const transferForm = document.getElementById("transfer-form");

document.getElementById("new-transfer-btn").addEventListener("click", () => {
  transferForm.reset();
  resetItemRows();
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
  const items = collectItems(itemsList);

  if (items.length === 0 || items.some((i) => !i.product)) {
    alert("Each item needs at least a product name.");
    return;
  }

  const submitBtn = transferForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging…";

  try {
    await addDoc(transfersRef, {
      items,
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

// ---------- Not found toggle ----------
async function toggleNotFound(transferId, itemIndex) {
  const transfer = allTransfers.find((t) => t.id === transferId);
  if (!transfer) return;
  const items = (transfer.items || []).map((item, idx) =>
    idx === itemIndex ? { ...item, notFound: !item.notFound } : item
  );
  try {
    await updateDoc(doc(db, "transfers", transferId), { items });
  } catch (err) {
    console.error(err);
    alert("Couldn't update that item. Try again.");
  }
}

// ---------- Remove transfer ----------
async function removeTransfer(transferId) {
  if (!confirm("Remove this transfer? This can't be undone.")) return;
  try {
    await deleteDoc(doc(db, "transfers", transferId));
  } catch (err) {
    console.error(err);
    alert("Couldn't remove that transfer. Try again.");
  }
}

// ---------- Inline item editing ----------
function startEditing(transferId) {
  const transfer = allTransfers.find((t) => t.id === transferId);
  if (!transfer) return;
  editingId = transferId;
  editingDraftItems = (transfer.items || []).map((i) => ({ ...i }));
  render();
}

function cancelEditing() {
  editingId = null;
  editingDraftItems = null;
  render();
}

async function saveEditing(transferId, container) {
  const items = collectItems(container);
  if (items.length === 0 || items.some((i) => !i.product)) {
    alert("Each item needs at least a product name.");
    return;
  }
  try {
    await updateDoc(doc(db, "transfers", transferId), { items });
    editingId = null;
    editingDraftItems = null;
  } catch (err) {
    console.error(err);
    alert("Couldn't save changes. Try again.");
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
      const itemText = (t.items || [])
        .map((i) => [i.product, i.sku, i.size, i.colorCode].join(" "))
        .join(" ");
      const haystack = [itemText, t.customerName, t.customerContact]
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
    const isEditing = editingId === t.id;

    const [fromDot, toDot] =
      t.direction === "dundrum_to_trinity"
        ? ["", "dot-trinity"]
        : ["dot-trinity", ""];

    const hasNotFound = (t.items || []).some((i) => i.notFound);

    tr.innerHTML = `
      <td data-label="Items"></td>
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
      <td data-label="Actions"></td>
    `;

    // ---- Items cell ----
    const itemsCell = tr.querySelector('td[data-label="Items"]');
    if (isEditing) {
      const editList = document.createElement("div");
      editList.className = "item-edit-list";
      (editingDraftItems || []).forEach((item) => {
        const row = buildItemRow({ ...item, colorCode: item.colorCode });
        row.dataset.notFound = item.notFound ? "true" : "false";
        editList.appendChild(row);
      });
      renumberRows(editList);
      itemsCell.appendChild(editList);

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn-link";
      addBtn.textContent = "+ Add item";
      addBtn.style.marginTop = "8px";
      addBtn.addEventListener("click", () => {
        const row = buildItemRow();
        editList.appendChild(row);
        renumberRows(editList);
      });
      itemsCell.appendChild(addBtn);

      const actions = document.createElement("div");
      actions.className = "item-edit-actions";
      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "btn btn-primary btn-sm";
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", () => saveEditing(t.id, editList));
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-secondary btn-sm";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", cancelEditing);
      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);
      itemsCell.appendChild(actions);
    } else {
      (t.items || []).forEach((item, idx) => {
        const line = document.createElement("div");
        line.className = "item-line" + (item.notFound ? " not-found" : "");
        const parts = [];
        if (item.sku) parts.push(`SKU ${escapeHtml(item.sku)}`);
        if (item.size) parts.push(`Size ${escapeHtml(item.size)}`);
        if (item.colorCode) parts.push(escapeHtml(item.colorCode));
        const meta = parts.length ? ` <span class="cell-sub">(${parts.join(", ")})</span>` : "";
        line.innerHTML = `
          <span class="item-line-main">${escapeHtml(item.product)}</span>${meta}
          <span class="qty">× ${item.quantity}</span>
          ${item.notFound ? '<span class="not-found-badge">Not found</span>' : ""}
        `;
        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "not-found-toggle" + (item.notFound ? " is-active" : "");
        toggleBtn.textContent = item.notFound ? "Mark found" : "Not found";
        toggleBtn.addEventListener("click", () => toggleNotFound(t.id, idx));
        line.appendChild(toggleBtn);
        itemsCell.appendChild(line);
      });
      if (!t.items || t.items.length === 0) {
        itemsCell.textContent = "—";
      }
    }

    // ---- Status cell ----
    if (!isEditing) {
      const statusCell = tr.querySelector('td[data-label="Status"]');
      const select = document.createElement("select");
      select.className = `status-select status-${t.status}`;
      Object.entries(STATUS_LABELS).forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        if (value === "received" && hasNotFound) {
          opt.disabled = true;
          opt.textContent += " (resolve not-found items first)";
        }
        if (value === t.status) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener("change", () => {
        select.className = `status-select status-${select.value}`;
        updateStatus(t.id, select.value);
      });
      statusCell.appendChild(select);
    } else {
      tr.querySelector('td[data-label="Status"]').innerHTML =
        `<span class="cell-sub">Editing items…</span>`;
    }

    // ---- Actions cell ----
    if (!isEditing) {
      const actionsCell = tr.querySelector('td[data-label="Actions"]');
      actionsCell.className = "actions-cell";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-secondary btn-sm";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => startEditing(t.id));
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-danger btn-sm";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeTransfer(t.id));
      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(removeBtn);
    } else {
      tr.querySelector('td[data-label="Actions"]').innerHTML = "";
    }

    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}
