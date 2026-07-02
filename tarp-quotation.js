import { auth, db } from './firebaseconfig.js';
import {
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const addItemForm = document.getElementById("addItemForm");
if (addItemForm) {
  addItemForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const length = parseFloat(document.getElementById("length").value);
    const width = parseFloat(document.getElementById("width").value);
    const quantity = parseInt(document.getElementById("quantity").value);
    const withLights = document.getElementById("withLights").checked;

    if (isNaN(length) || isNaN(width) || isNaN(quantity)) {
      alert("Please enter valid numeric values for length, width, and quantity.");
      return;
    }

    const area = length * width;
    if (area < 1) {
      alert("Minimum area is 1 sq. ft.");
      return;
    }

    const basePrice = withLights ? 1 : 1; // 400 with light, 300 without
const unitCost = area * basePrice;
let totalCost = unitCost * quantity;

// Apply minimum price of 4000
if (totalCost < 1) {
  totalCost = 1;
}

    const outputDiv = document.getElementById("quotationOutput");
    outputDiv.style.display = "block";
    outputDiv.innerHTML = `
      <div class="quotation-details">
        <h3>Quotation Details</h3>
        <p><strong>Material:</strong> Tarpaulin Signage</p>
        <p><strong>Dimensions:</strong> ${length} ft x ${width} ft</p>
        <p><strong>Total Area:</strong> ${area.toFixed(2)} sq. ft.</p>
        <p><strong>Quantity:</strong> ${quantity}</p>
        <p><strong>Includes Lights:</strong> ${withLights ? "Yes (+₱100)" : "No"}</p>
        <p><strong>Base Price:</strong> ₱${unitCost.toFixed(2)}</p>
        ${totalCost === 1? '<p><strong>Note:</strong> Minimum price applied</p>' : ''}
        <p><strong>Total Price:</strong> ₱${totalCost.toFixed(2)}</p>
        <button id="confirmOrderBtn" class="action-btn">Confirm Order</button>
      </div>
    `;

    const confirmOrderBtn = document.getElementById("confirmOrderBtn");
    if (confirmOrderBtn) {
      confirmOrderBtn.addEventListener("click", () => {
        onAuthStateChanged(auth, async (user) => {
          if (!user) {
            alert("You must be logged in to confirm an order.");
            return;
          }

          try {
            const orderData = {
              userId: user.uid,
              customerEmail: user.email,
              material: "Tarpaulin Signage",
              length,
              width,
              area: area.toFixed(2),
              unit: "sq. ft.",
              quantity,
              withLights,
              basePrice: basePrice,
              unitCost: unitCost.toFixed(2),
              totalCost: totalCost.toFixed(2),
              status: "pending_admin",
              paid: false,
              createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, "orders"), orderData);
            alert("Order submitted successfully! Waiting for admin confirmation.");
            window.location.href = "customer-dashboard.html";
          } catch (error) {
            console.error("Error confirming order:", error);
            alert("Failed to submit order: " + error.message);
          }
        });
      });
    }
  });
}