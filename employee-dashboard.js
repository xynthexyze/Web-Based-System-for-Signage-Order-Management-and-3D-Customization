// Enhanced Employee Dashboard with Role-based Features
import { db, auth } from './firebaseconfig.js';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  Timestamp,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ========== AUTHENTICATION AND ROLE CHECK ==========
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.error("No user logged in. Redirecting to login.");
    window.location.href = "login.html";
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      console.error("User doc missing in Firestore.");
      showAlert("Employee data not found. Please contact administrator.", "error");
      return;
    }
    
    const userData = userDoc.data();
    const role = userData.role;
    const employeeType = userData.employeeType;
    
    // Allow both Employee and Admin roles to access employee dashboard
    if (role !== "Employee" && role !== "Admin") {
      console.error("Access denied. Employee or Admin role required.");
      showAlert("Access denied. Employee privileges required.", "error");
      window.location.href = "login.html";
      return;
    }

    console.log("Employee dashboard loaded for:", user.email, "Type:", employeeType);
    
    // Update dashboard title based on employee type
    updateDashboardTitle(employeeType);
    
    // Load appropriate data based on employee type
    if (employeeType === "Fabricator") {
      loadFabricatorOrders(user.uid);
    } else if (employeeType === "Installer") {
      loadInstallerOrders(user.uid);
    } else {
      // Default for employees without specific type
      loadPendingOrders(user.uid);
    }
    
    loadInventory();
    
  } catch (error) {
    console.error("Error in employee dashboard:", error);
    showAlert("Failed to load dashboard: " + error.message, "error");
  }
});

// ========== DASHBOARD TITLE UPDATE ==========
function updateDashboardTitle(employeeType) {
  const dashboardTitle = document.querySelector(".dashboard-box h2");
  if (dashboardTitle && employeeType) {
    dashboardTitle.textContent = `${employeeType} Dashboard`;
  }
}

// ========== FABRICATOR ORDERS ==========
function loadFabricatorOrders(employeeId) {
  const tableBody = document.getElementById("pending-orders");
  if (!tableBody) return;

  const fabricatorOrdersQuery = query(
    collection(db, "orders"),
    where("status", "==", "pending"),
    where("assignedTo", "in", [employeeId, null, ""]) // Show assigned or unassigned orders
  );

  onSnapshot(fabricatorOrdersQuery, (snapshot) => {
    tableBody.innerHTML = "";

    if (snapshot.empty) {
      const noDataRow = document.createElement("tr");
      noDataRow.innerHTML = `
        <td colspan="6" style="text-align:center; padding: 40px;">
          <div style="color: #666;">
            <p>No production orders available.</p>
            <p><small>All orders are completed or waiting for assignment.</small></p>
          </div>
        </td>
      `;
      tableBody.appendChild(noDataRow);
      return;
    }

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const confirmedDate = order.confirmedAt?.toDate()?.toLocaleDateString() || "N/A";
      const isAssigned = order.assignedTo === employeeId;
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${order.material || "N/A"}</td>
        <td>${order.customerEmail || "N/A"}</td>
        <td>${order.quantity || 0}</td>
        <td>${confirmedDate}</td>
        <td>
          <span class="status-badge ${isAssigned ? 'assigned' : 'unassigned'}">
            ${isAssigned ? '🔧 Assigned to You' : '⏳ Unassigned'}
          </span>
        </td>
        <td>
          ${isAssigned ? 
            `<button type="button" class="complete-btn" data-id="${docSnap.id}">Mark Complete</button>` :
            `<button type="button" class="assign-btn" data-id="${docSnap.id}">Assign to Me</button>`
          }
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Attach event listeners
    attachFabricatorEventListeners(employeeId);
  });
}

// ========== INSTALLER ORDERS ==========
function loadInstallerOrders(employeeId) {
  const tableBody = document.getElementById("pending-orders");
  if (!tableBody) return;

  const installerOrdersQuery = query(
    collection(db, "orders"),
    where("status", "==", "ready_for_installation"),
    where("assignedTo", "in", [employeeId, null, ""])
  );

  onSnapshot(installerOrdersQuery, (snapshot) => {
    tableBody.innerHTML = "";

    if (snapshot.empty) {
      const noDataRow = document.createElement("tr");
      noDataRow.innerHTML = `
        <td colspan="6" style="text-align:center; padding: 40px;">
          <div style="color: #666;">
            <p>No installation orders available.</p>
            <p><small>All installations are completed or waiting for assignment.</small></p>
          </div>
        </td>
      `;
      tableBody.appendChild(noDataRow);
      return;
    }

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const completedDate = order.productionCompletedAt?.toDate()?.toLocaleDateString() || "N/A";
      const isAssigned = order.installerAssignedTo === employeeId;
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${order.material || "N/A"}</td>
        <td>${order.customerEmail || "N/A"}</td>
        <td>${order.installationAddress || order.customerAddress || "N/A"}</td>
        <td>${completedDate}</td>
        <td>
          <span class="status-badge ${isAssigned ? 'assigned' : 'unassigned'}">
            ${isAssigned ? '🚗 Assigned to You' : '⏳ Unassigned'}
          </span>
        </td>
        <td>
          ${isAssigned ? 
            `<button type="button" class="complete-install-btn" data-id="${docSnap.id}">Mark Installed</button>` :
            `<button type="button" class="assign-install-btn" data-id="${docSnap.id}">Assign to Me</button>`
          }
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Attach event listeners for installer
    attachInstallerEventListeners(employeeId);
  });
}

// ========== DEFAULT ORDERS (for employees without specific type) ==========
function loadPendingOrders(employeeId) {
  const tableBody = document.getElementById("pending-orders");
  if (!tableBody) return;

  const pendingOrdersQuery = query(
    collection(db, "orders"),
    where("status", "==", "pending")
  );

  onSnapshot(pendingOrdersQuery, (snapshot) => {
    tableBody.innerHTML = "";

    if (snapshot.empty) {
      const noDataRow = document.createElement("tr");
      noDataRow.innerHTML = `<td colspan="6" style="text-align:center;">No confirmed orders available for production.</td>`;
      tableBody.appendChild(noDataRow);
      return;
    }

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const confirmedDate = order.confirmedAt?.toDate()?.toLocaleDateString() || "N/A";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${order.material || "N/A"}</td>
        <td>${order.customerEmail || "N/A"}</td>
        <td>${order.quantity || 0}</td>
        <td>${confirmedDate}</td>
        <td><span class="status-badge pending">Ready for Production</span></td>
        <td><button type="button" class="complete-btn" data-id="${docSnap.id}">Mark Complete</button></td>
      `;
      tableBody.appendChild(row);
    });

    attachDefaultEventListeners(employeeId);
  });
}

// ========== EVENT LISTENERS ==========
function attachFabricatorEventListeners(employeeId) {
  // Assign buttons
  document.querySelectorAll(".assign-btn").forEach(button => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const orderId = button.getAttribute("data-id");
      await assignOrderToMe(orderId, employeeId, "fabricator");
    });
  });

  // Complete buttons
  document.querySelectorAll(".complete-btn").forEach(button => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const orderId = button.getAttribute("data-id");
      await completeFabrication(orderId, employeeId);
    });
  });
}

function attachInstallerEventListeners(employeeId) {
  // Assign installation buttons
  document.querySelectorAll(".assign-install-btn").forEach(button => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const orderId = button.getAttribute("data-id");
      await assignInstallationToMe(orderId, employeeId);
    });
  });

  // Complete installation buttons
  document.querySelectorAll(".complete-install-btn").forEach(button => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const orderId = button.getAttribute("data-id");
      await completeInstallation(orderId, employeeId);
    });
  });
}

function attachDefaultEventListeners(employeeId) {
  document.querySelectorAll(".complete-btn").forEach(button => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const orderId = button.getAttribute("data-id");
      await completeOrder(orderId, employeeId);
    });
  });
}

// ========== ORDER ACTIONS ==========
async function assignOrderToMe(orderId, employeeId, type) {
  try {
    const updateData = type === "fabricator" ? 
      { assignedTo: employeeId, assignedAt: Timestamp.now() } :
      { installerAssignedTo: employeeId, installerAssignedAt: Timestamp.now() };
    
    await updateDoc(doc(db, "orders", orderId), updateData);
    showAlert("Order assigned to you successfully!", "success");
  } catch (error) {
    console.error("Error assigning order:", error);
    showAlert("Failed to assign order: " + error.message, "error");
  }
}

async function assignInstallationToMe(orderId, employeeId) {
  await assignOrderToMe(orderId, employeeId, "installer");
}

async function completeFabrication(orderId, employeeId) {
  if (confirm("Mark this fabrication as completed?")) {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "ready_for_installation",
        productionCompletedAt: Timestamp.now(),
        productionCompletedBy: employeeId
      });
      showAlert("Fabrication completed successfully! Order ready for installation.", "success");
    } catch (error) {
      console.error("Error completing fabrication:", error);
      showAlert("Failed to complete fabrication: " + error.message, "error");
    }
  }
}

async function completeInstallation(orderId, employeeId) {
  if (confirm("Mark this installation as completed?")) {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "completed",
        installationCompletedAt: Timestamp.now(),
        installationCompletedBy: employeeId,
        completedAt: Timestamp.now()
      });
      showAlert("Installation completed successfully! Order marked as complete.", "success");
    } catch (error) {
      console.error("Error completing installation:", error);
      showAlert("Failed to complete installation: " + error.message, "error");
    }
  }
}

async function completeOrder(orderId, employeeId) {
  if (confirm("Mark this order as completed?")) {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "completed",
        completedAt: Timestamp.now(),
        completedBy: employeeId
      });
      showAlert("Order completed successfully!", "success");
    } catch (error) {
      console.error("Error updating order:", error);
      showAlert("Failed to complete order: " + error.message, "error");
    }
  }
}

// ========== INVENTORY STATUS ==========
function loadInventory() {
  const inventoryTable = document.getElementById("inventory-status");
  if (!inventoryTable) return;

  onSnapshot(collection(db, "inventory"), (snapshot) => {
    inventoryTable.innerHTML = "";

    if (snapshot.empty) {
      inventoryTable.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; padding: 20px;">
            <div style="color: #666;">
              <p>No inventory data found.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    snapshot.forEach((doc) => {
      const item = doc.data();
      const status = item.quantity <= 5 ? "Low Stock" : "Available";
      const statusClass = item.quantity <= 5 ? "low-stock" : "available";
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.material || "N/A"}</td>
        <td>${item.quantity || 0} ${item.unit || ""}</td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
      `;
      inventoryTable.appendChild(row);
    });
  });
}

// ========== UTILITY FUNCTIONS ==========
function showAlert(message, type = "info") {
  // Remove existing alerts
  const existingAlert = document.querySelector('.custom-alert');
  if (existingAlert) {
    existingAlert.remove();
  }

  const alertDiv = document.createElement('div');
  alertDiv.className = `custom-alert alert-${type}`;
  alertDiv.innerHTML = `
    <div class="alert-content">
      <span class="alert-message">${message}</span>
      <button class="alert-close">&times;</button>
    </div>
  `;

  document.body.appendChild(alertDiv);

  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
    }
  }, 5000);

  alertDiv.querySelector('.alert-close').addEventListener('click', () => {
    alertDiv.remove();
  });
}