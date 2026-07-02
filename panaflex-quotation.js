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
    const faceType = document.querySelector('input[name="faceType"]:checked').value;

    if (isNaN(length) || isNaN(width) || isNaN(quantity)) {
      alert("Please enter valid numeric values for length, width, and quantity.");
      return;
    }

    const area = length * width;
    if (area < 1) {
      alert("Minimum area is 1 sq. ft.");
      return;
    }

    // Pricing logic for Panaflex
    let basePrice;
    if (faceType === "one") {
      basePrice = withLights ? 700 : 500; // One face: 700 with light, 500 without
    } else {
      basePrice = withLights ? 1000 : 800; // Two face: 1000 with light, 800 without
    }

    const unitCost = area * basePrice;
    let totalCost = unitCost * quantity;

    // Check if below minimum price of ₱4,000
    if (totalCost < 4000) {
      alert("❌ Minimum order amount is ₱4,000.\n\nYour current quotation is only ₱" + totalCost.toFixed(2) + 
            "\n\nPlease increase your dimensions or quantity to meet the minimum order requirement.");
      return; // Stop here, don't generate quotation
    }

    const outputDiv = document.getElementById("quotationOutput");
    outputDiv.style.display = "block";
    outputDiv.innerHTML = `
      <div class="quotation-details">
        <h3>Quotation Details</h3>
        <p><strong>Material:</strong> Panaflex Signage (${faceType === "one" ? "One-faced" : "Two-faced"})</p>
        <p><strong>Dimensions:</strong> ${length} ft x ${width} ft</p>
        <p><strong>Total Area:</strong> ${area.toFixed(2)} sq. ft.</p>
        <p><strong>Quantity:</strong> ${quantity}</p>
        <p><strong>Includes Lights:</strong> ${withLights ? "Yes (+₱200)" : "No"}</p>
        <p><strong>Base Price per sq.ft.:</strong> ₱${basePrice}</p>
        <p><strong>Unit Cost:</strong> ₱${unitCost.toFixed(2)}</p>
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
              material: `Panaflex Signage (${faceType === "one" ? "One-faced" : "Two-faced"})`,
              length,
              width,
              area: area.toFixed(2),
              unit: "sq. ft.",
              quantity,
              withLights,
              faceType,
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