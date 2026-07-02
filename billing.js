import { db, auth } from './firebaseconfig.js';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.error("No user logged in.");
    window.location.href = "login.html";
    return;
  }

  try {
    loadPendingInvoices(user.uid, user.email);
    loadPaymentHistory(user.uid, user.email);
    
  } catch (error) {
    console.error("Error in billing page:", error);
    alert("Failed to load billing information: " + error.message);
  }
});

async function loadPendingInvoices(userId, userEmail) {
  const pendingInvoices = document.getElementById('pendingInvoices');
  if (!pendingInvoices) return;
  
  const invoicesQuery = query(
    collection(db, "orders"),
    where("userId", "==", userId),
    where("status", "in", ["pending_admin", "pending", "completed"]),
    where("paid", "==", false)
  );

  onSnapshot(invoicesQuery, (snapshot) => {
    pendingInvoices.innerHTML = "";
    
    if (snapshot.empty) {
      pendingInvoices.innerHTML = `
        <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <p>No pending invoices found.</p>
          <p><small>All your orders are paid or you haven't created any orders yet.</small></p>
          <button class="action-btn" onclick="window.location.href='order-type.html'" style="max-width: 200px; margin-top: 10px;">
            Create New Order
          </button>
        </div>
      `;
      return;
    }

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const invoiceDiv = document.createElement('div');
      invoiceDiv.className = 'invoice-item';
      invoiceDiv.style.border = '1px solid #ddd';
      invoiceDiv.style.padding = '15px';
      invoiceDiv.style.marginBottom = '10px';
      invoiceDiv.style.borderRadius = '5px';
      invoiceDiv.style.borderLeft = '4px solid #3498db';
      
      invoiceDiv.innerHTML = `
        <h4>Order: ${docSnap.id.slice(-8).toUpperCase()}</h4>
        <p><strong>Project:</strong> ${order.material || "N/A"}</p>
        <p><strong>Dimensions:</strong> ${order.length || 0} ft × ${order.width || 0} ft</p>
        <p><strong>Quantity:</strong> ${order.quantity || 1}</p>
        <p><strong>Status:</strong> ${getStatusText(order.status)}</p>
        <p><strong>Amount Due:</strong> ₱${order.totalCost || "0.00"}</p>
        <button class="pay-invoice-btn" data-id="${docSnap.id}" data-amount="${order.totalCost}" data-material="${order.material}">
          Pay Now - ₱${order.totalCost || "0.00"}
        </button>
      `;
      pendingInvoices.appendChild(invoiceDiv);
    });

    // Attach event listeners to pay buttons
    document.querySelectorAll('.pay-invoice-btn').forEach(button => {
      button.addEventListener('click', function() {
        const invoiceId = this.getAttribute('data-id');
        const amount = this.getAttribute('data-amount');
        const material = this.getAttribute('data-material');
        processPayment(invoiceId, amount, userId, userEmail, material);
      });
    });
  });
}

async function loadPaymentHistory(userId, userEmail) {
  const paymentHistory = document.getElementById('paymentHistory');
  if (!paymentHistory) return;
  
  const paymentsQuery = query(
    collection(db, "payments"),
    where("userId", "==", userId),
    orderBy("timestamp", "desc")
  );

  onSnapshot(paymentsQuery, (snapshot) => {
    paymentHistory.innerHTML = "";
    
    if (snapshot.empty) {
      paymentHistory.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
          <p>No payment records found.</p>
          <p><small>Your payment history will appear here after you make payments.</small></p>
        </div>
      `;
      return;
    }

    snapshot.forEach((docSnap) => {
      const payment = docSnap.data();
      const time = payment.timestamp?.toDate()?.toLocaleString() || "N/A";
      
      const div = document.createElement('div');
      div.style.borderBottom = "1px solid #eee";
      div.style.padding = "15px 0";
      div.style.marginBottom = "10px";
      
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <strong>Order ID:</strong> ${payment.invoiceId.slice(-8).toUpperCase()}<br>
            <strong>Project:</strong> ${payment.material || "Signage Order"}<br>
            <strong>Amount:</strong> ₱${payment.amount}<br>
            <strong>Status:</strong> <span style="color: green; font-weight: bold;">${payment.status}</span><br>
            <strong>Date:</strong> ${time}<br>
            <strong>Payment Method:</strong> ${payment.method}
          </div>
          <div style="text-align: right;">
            <span style="background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 12px; font-size: 12px;">
              PAID
            </span>
          </div>
        </div>
      `;
      paymentHistory.appendChild(div);
    });
  });
}

function processPayment(invoiceId, amount, userId, userEmail, material) {
  const paypalContainer = document.getElementById('paypal-button-container');
  if (!paypalContainer) return;
  
  const invoiceIdShort = invoiceId.slice(-8).toUpperCase();
  
  paypalContainer.innerHTML = `
    <div class="payment-details" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h4>Payment Details</h4>
      <p><strong>Order ID:</strong> ${invoiceIdShort}</p>
      <p><strong>Project:</strong> ${material}</p>
      <p><strong>Amount to Pay:</strong> ₱${amount}</p>
      <p>Click the PayPal button below to complete your payment.</p>
      <div id="dynamic-paypal-buttons" style="margin-top: 15px;"></div>
      <button onclick="cancelPayment()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin-top: 10px; cursor: pointer;">
        Cancel Payment
      </button>
    </div>
  `;

  // Check if PayPal SDK is loaded
  if (typeof paypal === 'undefined') {
    paypalContainer.innerHTML = `
      <div style="color: red; text-align: center;">
        <p>❌ PayPal SDK not loaded. Please check your Client ID.</p>
        <p><small>Make sure you replaced "YOUR_ACTUAL_CLIENT_ID_HERE" with your actual PayPal Client ID.</small></p>
      </div>
    `;
    return;
  }

  // Render PayPal buttons
  paypal.Buttons({
    style: {
      color: "blue",
      shape: "rect",
      label: "pay",
      height: 45
    },

    createOrder: function(data, actions) {
      return actions.order.create({
        purchase_units: [{
          reference_id: invoiceId,
          description: `V.A. Erni's Signage - ${material}`,
          amount: {
            currency_code: "PHP",
            value: amount
          }
        }]
      });
    },

    onApprove: async function(data, actions) {
      try {
        const order = await actions.order.capture();
        console.log("Payment successful:", order);

        // Save payment record
        await addDoc(collection(db, "payments"), {
          userId: userId,
          userEmail: userEmail,
          invoiceId: invoiceId,
          material: material,
          amount: parseFloat(amount),
          method: "PayPal",
          status: "Paid",
          transactionId: order.id,
          payerName: order.payer.name.given_name + " " + order.payer.name.surname,
          payerEmail: order.payer.email_address,
          timestamp: serverTimestamp()
        });

        // Update order status to mark as paid
        await updateDoc(doc(db, "orders", invoiceId), {
          paid: true,
          paymentDate: serverTimestamp(),
          paymentMethod: "PayPal",
          transactionId: order.id
        });

        alert("✅ Payment successful! Thank you for your payment.");
        
        // Reload the page to show updated status
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        
      } catch (error) {
        console.error("Error processing payment:", error);
        alert("❌ Payment processing failed: " + error.message);
      }
    },

    onCancel: function() {
      alert("⚠️ Payment cancelled by user.");
      paypalContainer.innerHTML = '<p>Payment cancelled. You can try again by selecting an invoice above.</p>';
    },

    onError: function(err) {
      console.error("PayPal error:", err);
      alert("❌ Payment failed. Please try again later.");
      paypalContainer.innerHTML = '<p style="color: red;">Payment failed. Please try again.</p>';
    }
  }).render("#dynamic-paypal-buttons");
}

// Global function for cancel button
window.cancelPayment = function() {
  const paypalContainer = document.getElementById('paypal-button-container');
  if (paypalContainer) {
    paypalContainer.innerHTML = '<p>Select an invoice above to make a payment.</p>';
  }
};

function getStatusText(status) {
  switch(status) {
    case "pending_admin": return "🟡 Waiting Confirmation";
    case "pending": return "🔵 Ready for Production";
    case "completed": return "🟢 Completed - Ready for Pickup";
    case "rejected": return "🔴 Rejected";
    default: return "⚪ Pending";
  }
}