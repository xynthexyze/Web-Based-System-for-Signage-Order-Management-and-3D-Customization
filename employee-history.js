// employee-history.js - Employee Order History
import { db, auth } from './firebaseconfig.js';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc
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
      alert("Employee data not found. Please contact administrator.");
      return;
    }
    
    const userData = userDoc.data();
    const role = userData.role;
    
    // Allow both Employee and Admin roles to access employee history
    if (role !== "Employee" && role !== "Admin") {
      console.error("Access denied. Employee or Admin role required.");
      alert("Access denied. Employee privileges required.");
      window.location.href = "login.html";
      return;
    }

    console.log("Employee history loaded for:", user.email);
    loadEmployeeOrderHistory(user.uid);
    
  } catch (error) {
    console.error("Error in employee history:", error);
    alert("Failed to load order history: " + error.message);
  }
});

// ========== LOAD EMPLOYEE ORDER HISTORY ==========
function loadEmployeeOrderHistory(employeeId) {
  const orderHistoryTable = document.getElementById("order-history");
  if (!orderHistoryTable) {
    console.error("Order history table not found.");
    return;
  }

  // Query orders completed by this employee
  const completedOrdersQuery = query(
    collection(db, "orders"),
    where("status", "==", "completed"),
    where("completedBy", "==", employeeId)
  );

  onSnapshot(completedOrdersQuery, (snapshot) => {
    console.log("Employee history snapshot received. Empty?", snapshot.empty);
    orderHistoryTable.innerHTML = "";
    
    if (snapshot.empty) {
      const noDataRow = document.createElement("tr");
      noDataRow.innerHTML = `<td colspan="4" style="text-align:center;">No completed orders found.</td>`;
      orderHistoryTable.appendChild(noDataRow);
      return;
    }

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const completedDate = order.completedAt?.toDate()?.toLocaleString() || "N/A";
      const dimensions = order.length && order.width ? 
        `${order.length} x ${order.width} ${order.unit}` : "Custom";
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${order.material || "N/A"}</td>
        <td>${order.customerEmail || "N/A"}</td>
        <td>${dimensions}</td>
        <td>${completedDate}</td>
      `;
      orderHistoryTable.appendChild(row);
    });
  }, (error) => {
    console.error("Error fetching employee order history:", error);
    alert("Failed to load order history: " + error.message);
  });
}