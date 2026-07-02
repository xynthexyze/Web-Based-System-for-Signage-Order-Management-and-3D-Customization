import { db, auth } from "./firebaseconfig.js";
import {
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("Please login to view your order history.");
    window.location.href = "login.html";
    return;
  }

  const ordersRef = collection(db, "orders");
  const userOrdersQuery = query(
    ordersRef,
    where("userId", "==", user.uid)
  );

  onSnapshot(userOrdersQuery, (snapshot) => {
    const tableBody = document.getElementById("history-table-body");
    tableBody.innerHTML = "";

    if (snapshot.empty) {
      const noData = document.createElement("tr");
      noData.innerHTML = `<td colspan="6">No orders found.</td>`;
      tableBody.appendChild(noData);
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      const completedDate = data.completedAt?.toDate()?.toLocaleString() || "N/A";
      const paymentStatus = data.paid ? 
        '<span class="status-paid">Paid</span>' : 
        '<span class="status-pending">Unpaid</span>';

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${data.projectType || data.material || "N/A"}</td>
        <td>${data.material || "N/A"}</td>
        <td>${data.quantity || 0}</td>
        <td>₱${data.totalCost || "0.00"}</td>
        <td>${paymentStatus}</td>
        <td>${completedDate}</td>
      `;
      tableBody.appendChild(row);
    });
  });
});