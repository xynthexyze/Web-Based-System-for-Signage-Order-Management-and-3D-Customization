// customers.js - Fixed
import { db } from './firebaseconfig.js';
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const customersTableBody = document.getElementById("customers-table-body");

const q = query(collection(db, "users"), where("role", "==", "Customer"));

onSnapshot(q, (snapshot) => {
  customersTableBody.innerHTML = "";
  snapshot.forEach((doc) => {
    const data = doc.data();
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${data.firstName} ${data.lastName}</td>
      <td>${data.email}</td>
      <td>${data.contactNumber || "N/A"}</td>
      <td>${data.address || "N/A"}</td>
      <td>${data.verified ? "✔️ Verified" : "❌ Unverified"}</td>
    `;
    customersTableBody.appendChild(row);
  });
});