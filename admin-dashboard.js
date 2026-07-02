// admin-dashboard.js - UPDATED WITH REVIEW SUBMISSION SUPPORT
import { db } from './firebaseconfig.js';
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

// NO onAuthStateChanged here! Let LS.js handle auth

// Load data immediately when page loads
console.log("Loading admin dashboard...");

// Initialize everything
loadPendingOrders();
loadInventory();
setupNewOrderNotifications();
setupNotificationPermission();

// Add CSS for status badges and animations
const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// ========== 1. PENDING ORDERS (UPDATED FOR REVIEW SUBMISSIONS) ==========
function loadPendingOrders() {
  const tableBody = document.getElementById("pending-orders");
  if (!tableBody) return;

  // Query orders with 'pending_admin' OR 'pending_admin_review' status
  const pendingOrdersQuery = query(
    collection(db, "orders"),
    where("status", "in", ["pending_admin", "pending_admin_review"])
  );

  onSnapshot(pendingOrdersQuery, (snapshot) => {
    tableBody.innerHTML = "";
    
    if (snapshot.empty) {
      const noDataRow = document.createElement("tr");
      noDataRow.innerHTML = `<td colspan="7" style="text-align:center; padding: 30px; color: #666;">
        <div style="font-size: 50px; margin-bottom: 10px;">📭</div>
        <p style="font-size: 16px; margin: 0;">No pending orders at the moment.</p>
        <p style="font-size: 14px; color: #999;">New orders will appear here automatically.</p>
      </td>`;
      tableBody.appendChild(noDataRow);
      
      // Hide review notice when no orders
      const reviewNotice = document.getElementById('review-notice');
      if (reviewNotice) reviewNotice.style.display = 'none';
      
      // Update count badge
      updateOrderCountBadge(0);
      return;
    }

    let rowCount = 0;
    let hasReviewSubmissions = false;
    
    snapshot.forEach((docSnap) => {
      rowCount++;
      const order = docSnap.data();
      
      // Check if this is a review submission
      if (order.isReviewSubmission) {
        hasReviewSubmissions = true;
      }
      
      // Format date
      let orderDate = "N/A";
      if (order.createdAt) {
        orderDate = new Date(order.createdAt.toDate()).toLocaleDateString();
      } else if (order.orderDate) {
        orderDate = new Date(order.orderDate).toLocaleDateString();
      }
      
      // Determine material display
      const material = order.material || "Panaflex";
      const projectType = order.projectType || "Panaflex Signage";
      const signageType = order.signageType || order.type || "Custom Signage";
      
      // Determine status text
      const statusText = order.status === 'pending_admin_review' ? 
        'Pending Approval' : 'Pending Review';
      
      // Create table row
      const row = document.createElement("tr");
      
      // Add review submission class if needed
      if (order.isReviewSubmission) {
        row.classList.add('review-submission');
      }
      
      row.innerHTML = `
        <td>
          <strong>${signageType}</strong><br>
          <small style="color: #666;">${material}</small>
        </td>
        <td>${order.quantity || 1}</td>
        <td>${order.unit || "pcs"}</td>
        <td><strong>₱${order.totalPrice ? order.totalPrice.toFixed(2) : "0.00"}</strong></td>
        <td>
          <span class="status-badge pending">${statusText}</span><br>
          <small class="customer-email">${order.customerEmail || "Guest"}</small>
          ${order.isReviewSubmission ? 
            '<br><small style="color: #28a745;">(Review Submission - No Payment)</small>' : 
            ''}
          ${order.paymentMethod === 'simulated' ? '<br><small style="color: #28a745;">(Test Payment)</small>' : ''}
        </td>
        <td>${orderDate}</td>
        <td>
          <div class="action-buttons">
            <button type="button" class="action-btn confirm" data-id="${docSnap.id}" title="Confirm Order">
              Confirm
            </button>
            <button type="button" class="action-btn reject" data-id="${docSnap.id}" title="Reject Order">
              Reject
            </button>
            <button type="button" class="action-btn view" data-id="${docSnap.id}" title="View Details">
              View
            </button>
            <button type="button" class="action-btn assign" data-id="${docSnap.id}" title="Assign to Task">
              Assign
            </button>
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Update count display in the section header
    updateOrderCountBadge(rowCount);
    
    // Show/hide review notice based on review submissions
    const reviewNotice = document.getElementById('review-notice');
    if (reviewNotice) {
      reviewNotice.style.display = hasReviewSubmissions ? 'flex' : 'none';
    }

    attachOrderActionListeners();
  }, (error) => {
    console.error("Error fetching pending orders:", error);
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: red; padding: 20px;">
      <div style="font-size: 40px; margin-bottom: 10px;">⚠️</div>
      <p>Error loading orders: ${error.message}</p>
      <p><small>Please check your internet connection and try refreshing.</small></p>
    </td></tr>`;
    
    // Hide review notice on error
    const reviewNotice = document.getElementById('review-notice');
    if (reviewNotice) reviewNotice.style.display = 'none';
  });
}

// Helper function to update order count badge
function updateOrderCountBadge(count) {
  const countElement = document.querySelector(".order-count-badge");
  if (countElement) {
    countElement.textContent = count;
  }
}

// ========== ORDER ACTION HANDLERS (UPDATED) ==========
function attachOrderActionListeners() {
  // Confirm button
  document.querySelectorAll(".action-btn.confirm").forEach(button => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const orderId = button.getAttribute("data-id");
      if (confirm("Are you sure you want to confirm this order?")) {
        await updateOrderStatus(orderId, "confirmed", "Order confirmed and ready for production!");
      }
    });
  });

  // Reject button
  document.querySelectorAll(".action-btn.reject").forEach(button => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const orderId = button.getAttribute("data-id");
      const reason = prompt("Please enter reason for rejection:", "Customer requested cancellation");
      if (reason !== null) {
        await updateOrderStatus(orderId, "rejected", "Order rejected: " + reason);
      }
    });
  });

  // View button
  document.querySelectorAll(".action-btn.view").forEach(button => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const orderId = button.getAttribute("data-id");
      await viewOrderDetails(orderId);
    });
  });

  // Assign button
  document.querySelectorAll(".action-btn.assign").forEach(button => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const orderId = button.getAttribute("data-id");
      await assignOrderToTask(orderId);
    });
  });
}

async function updateOrderStatus(orderId, status, message) {
  try {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      throw new Error("Order not found");
    }
    
    const order = orderSnap.data();
    const isReviewSubmission = order.isReviewSubmission || false;
    
    const updateData = {
      status: status,
      updatedAt: Timestamp.now(),
      ...(status === "confirmed" && { 
        confirmedAt: Timestamp.now(),
        confirmedBy: "Admin",
        stage: "in_production"
      }),
      ...(status === "rejected" && { 
        rejectedAt: Timestamp.now(),
        rejectedBy: "Admin",
        stage: "cancelled"
      })
    };
    
    // If confirming a review submission, mark payment as pending
    if (status === "confirmed" && isReviewSubmission) {
      updateData.paymentStatus = "pending";
      updateData.notes = "Review submission approved. Awaiting customer payment.";
    }
    
    await updateDoc(orderRef, updateData);
    
    // Show success message with icon
    const successModal = document.createElement('div');
    successModal.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${status === 'confirmed' ? '#28a745' : '#dc3545'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease;
      max-width: 300px;
    `;
    
    successModal.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="font-size: 24px;">${status === 'confirmed' ? '✓' : '✗'}</div>
        <div>
          <strong>${status === 'confirmed' ? 'Order Confirmed!' : 'Order Rejected'}</strong>
          <p style="margin: 5px 0 0 0; font-size: 14px;">${message}</p>
          ${isReviewSubmission && status === 'confirmed' ? 
            '<p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Customer will be notified to complete payment.</p>' : ''}
        </div>
      </div>
    `;
    
    document.body.appendChild(successModal);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      successModal.style.animation = "slideOut 0.3s ease";
      setTimeout(() => successModal.remove(), 300);
    }, 5000);
    
  } catch (error) {
    console.error("Error updating order:", error);
    
    // Show error message
    const errorModal = document.createElement('div');
    errorModal.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease;
      max-width: 300px;
    `;
    
    errorModal.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="font-size: 24px;">⚠️</div>
        <div>
          <strong>Update Failed</strong>
          <p style="margin: 5px 0 0 0; font-size: 14px;">${error.message}</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(errorModal);
    
    setTimeout(() => {
      errorModal.style.animation = "slideOut 0.3s ease";
      setTimeout(() => errorModal.remove(), 300);
    }, 5000);
  }
}

// ========== VIEW ORDER DETAILS (UPDATED) ==========
async function viewOrderDetails(orderId) {
  try {
    const docRef = doc(db, "orders", orderId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const order = docSnap.data();
      
      // Format dates
      let createdAt = "N/A";
      let updatedAt = "N/A";
      let confirmedAt = "N/A";
      
      if (order.createdAt) createdAt = new Date(order.createdAt.toDate()).toLocaleString();
      if (order.updatedAt) updatedAt = new Date(order.updatedAt.toDate()).toLocaleString();
      if (order.confirmedAt) confirmedAt = new Date(order.confirmedAt.toDate()).toLocaleString();
      
      // Determine status display
      const statusText = order.status === 'pending_admin_review' ? 
        'Pending Approval (Review Submission)' : 
        order.status === 'pending_admin' ? 'Pending Review' : order.status;
      
      const statusClass = order.status === 'pending_admin_review' ? 'pending' : order.status;
      
      // Show order details in a modal
      const modalHTML = `
        <div id="order-details-modal" style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        ">
          <div style="
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 700px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h2 style="margin: 0; color: #333;">Order Details</h2>
              <button onclick="this.closest('#order-details-modal').remove()" style="
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
              ">×</button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4 style="margin-top: 0; color: #555;">Order Information</h4>
                <p><strong>Order ID:</strong> ${order.orderId || "N/A"}</p>
                <p><strong>Firebase ID:</strong> ${orderId}</p>
                <p><strong>Customer:</strong> ${order.customerEmail || "Guest"}</p>
                <p><strong>Customer Name:</strong> ${order.customerName || "N/A"}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod === 'simulated' ? 'Test Payment' : 
                  order.isReviewSubmission ? 'Pending (Review Submission)' : 'PayPal'}</p>
                ${order.isReviewSubmission ? 
                  '<p><strong>Type:</strong> <span style="color: #28a745; font-weight: bold;">Review Submission</span></p>' : 
                  ''}
              </div>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4 style="margin-top: 0; color: #555;">Status & Dates</h4>
                <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${statusText}</span></p>
                <p><strong>Created:</strong> ${createdAt}</p>
                <p><strong>Updated:</strong> ${updatedAt}</p>
                <p><strong>Confirmed:</strong> ${confirmedAt}</p>
              </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h4 style="margin-top: 0; color: #555;">Signage Details</h4>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                  <p><strong>Signage Type:</strong> ${order.signageType || "N/A"}</p>
                  <p><strong>Material:</strong> ${order.material || "Panaflex"}</p>
                  <p><strong>Project Type:</strong> ${order.projectType || "Panaflex Signage"}</p>
                </div>
                <div>
                  <p><strong>Quantity:</strong> ${order.quantity || 1} ${order.unit || "pcs"}</p>
                  <p><strong>Shape Type:</strong> ${order.shapeType || "Custom"}</p>
                  <p><strong>Design Elements:</strong> ${order.textElements || 0} text, ${order.imageElements || 0} images</p>
                </div>
              </div>
              
              ${order.dimensions ? `
              <div style="background: white; padding: 15px; border-radius: 5px; margin-top: 10px;">
                <h5 style="margin-top: 0;">Dimensions</h5>
                <p><strong>Width:</strong> ${order.dimensions.width || "N/A"} ft</p>
                <p><strong>Height:</strong> ${order.dimensions.height || "N/A"} ft</p>
                <p><strong>Area:</strong> ${order.dimensions.area || "N/A"} sq. ft.</p>
              </div>
              ` : ''}
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h4 style="margin-top: 0; color: #555;">Pricing</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                  <p><strong>Total Price:</strong> ₱${order.totalPrice ? order.totalPrice.toFixed(2) : "0.00"}</p>
                  <p><strong>Test Payment Amount:</strong> ₱${order.testPaymentAmount ? order.testPaymentAmount.toFixed(2) : "10.00"}</p>
                </div>
                <div>
                  <p><strong>Payment Status:</strong> ${order.paymentStatus || (order.isReviewSubmission ? "Pending" : "N/A")}</p>
                  <p><strong>Payment ID:</strong> ${order.paymentId ? order.paymentId.substring(0, 20) + "..." : "N/A"}</p>
                </div>
              </div>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
              <button onclick="this.closest('#order-details-modal').remove()" style="
                padding: 10px 20px;
                background: #6c757d;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
              ">Close</button>
              
              ${order.status === 'pending_admin' || order.status === 'pending_admin_review' ? `
              <button onclick="confirmOrderFromModal('${orderId}')" style="
                padding: 10px 20px;
                background: #28a745;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
              ">Confirm Order</button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      // Add global function for confirming from modal
      window.confirmOrderFromModal = async function(orderId) {
        if (confirm("Are you sure you want to confirm this order?")) {
          await updateOrderStatus(orderId, "confirmed", "Order confirmed from details view!");
          document.getElementById('order-details-modal').remove();
        }
      };
    }
  } catch (error) {
    console.error("Error fetching order details:", error);
    alert("Could not load order details: " + error.message);
  }
}

// ========== ASSIGN ORDER TO TASK ==========
async function assignOrderToTask(orderId) {
  try {
    const docRef = doc(db, "orders", orderId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const order = docSnap.data();
      
      // Show assignment modal
      const modalHTML = `
        <div id="assign-order-modal" style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        ">
          <div style="
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 500px;
            width: 90%;
          ">
            <h2 style="margin-top: 0; color: #333;">Assign Order to Task</h2>
            
            <div style="margin-bottom: 20px;">
              <p><strong>Order:</strong> ${order.signageType || "Panaflex Signage"}</p>
              <p><strong>Customer:</strong> ${order.customerEmail || "Guest"}</p>
              ${order.isReviewSubmission ? 
                '<p style="color: #28a745; font-weight: bold;">⚠️ This is a review submission (no payment yet)</p>' : 
                ''}
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600;">Select Employee</label>
              <select id="employee-select" style="
                width: 100%;
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 5px;
                font-size: 14px;
              ">
                <option value="">-- Select Employee --</option>
                <option value="employee1">John Doe (Production)</option>
                <option value="employee2">Jane Smith (Assembly)</option>
                <option value="employee3">Bob Wilson (Quality Control)</option>
              </select>
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600;">Task Deadline</label>
              <input type="date" id="task-deadline" style="
                width: 100%;
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 5px;
                font-size: 14px;
              " value="${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button onclick="this.closest('#assign-order-modal').remove()" style="
                padding: 10px 20px;
                background: #6c757d;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
              ">Cancel</button>
              <button id="assign-task-btn" style="
                padding: 10px 20px;
                background: #d00000;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
              ">Assign Task</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      // Add event listener for assign button
      document.getElementById('assign-task-btn').addEventListener('click', async function() {
        const employee = document.getElementById('employee-select').value;
        const deadline = document.getElementById('task-deadline').value;
        
        if (!employee) {
          alert("Please select an employee");
          return;
        }
        
        try {
          await updateDoc(docRef, {
            status: "assigned",
            assignedTo: employee,
            assignedAt: Timestamp.now(),
            deadline: deadline,
            stage: "in_production",
            updatedAt: Timestamp.now()
          });
          
          document.getElementById('assign-order-modal').remove();
          alert("Order assigned successfully!");
        } catch (error) {
          console.error("Error assigning order:", error);
          alert("Failed to assign order: " + error.message);
        }
      });
    }
  } catch (error) {
    console.error("Error loading order for assignment:", error);
    alert("Could not load order: " + error.message);
  }
}

// ========== 3. INVENTORY STATUS ==========
function loadInventory() {
  const inventoryTable = document.getElementById("inventory-status");
  if (!inventoryTable) return;

  onSnapshot(collection(db, "inventory"), (snapshot) => {
    inventoryTable.innerHTML = "";
    
    if (snapshot.empty) {
      inventoryTable.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color: #666;">
        <div style="font-size: 40px; margin-bottom: 10px;">📦</div>
        <p>No inventory data available.</p>
      </td></tr>`;
      
      // Update inventory badge
      updateInventoryBadge(0);
      return;
    }

    let lowStockCount = 0;
    snapshot.forEach((doc) => {
      const item = doc.data();
      const status = item.quantity <= 5 ? "Low Stock" : "Available";
      const statusClass = item.quantity <= 5 ? "low-stock" : "available";
      
      if (item.quantity <= 5) lowStockCount++;
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${item.material || "N/A"}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div>${item.quantity || 0}</div>
            ${item.quantity <= 5 ? 
              '<div style="width: 10px; height: 10px; background: #dc3545; border-radius: 50%;"></div>' : 
              '<div style="width: 10px; height: 10px; background: #28a745; border-radius: 50%;"></div>'
            }
          </div>
        </td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
      `;
      inventoryTable.appendChild(row);
    });

    // Update inventory badge
    updateInventoryBadge(lowStockCount);
  }, (error) => {
    console.error("Error fetching inventory:", error);
    inventoryTable.innerHTML = `<tr><td colspan="3" style="text-align:center; color: red;">
      Error loading inventory data
    </td></tr>`;
    
    // Update inventory badge on error
    updateInventoryBadge(0);
  });
}

// Helper function to update inventory badge
function updateInventoryBadge(lowStockCount) {
  const inventoryBadge = document.querySelector(".inventory-count-badge");
  if (inventoryBadge) {
    if (lowStockCount > 0) {
      inventoryBadge.textContent = `${lowStockCount} low`;
      inventoryBadge.style.backgroundColor = '#dc3545';
    } else {
      inventoryBadge.textContent = 'All good';
      inventoryBadge.style.backgroundColor = '#28a745';
    }
  }
}

// ========== 4. REAL-TIME NEW ORDER NOTIFICATIONS ==========
function setupNewOrderNotifications() {
  const newOrdersQuery = query(
    collection(db, "orders"),
    where("status", "in", ["pending_admin", "pending_admin_review"])
  );
  
  let lastCount = 0;
  let isFirstLoad = true;
  
  onSnapshot(newOrdersQuery, (snapshot) => {
    const currentCount = snapshot.size;
    
    // Show notification when new order arrives (not on first load)
    if (currentCount > lastCount && !isFirstLoad) {
      showNewOrderNotification(currentCount);
    }
    
    lastCount = currentCount;
    isFirstLoad = false;
  });
}

function showNewOrderNotification(count) {
  // Play notification sound
  try {
    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3');
    audio.volume = 0.3;
    audio.play().catch(e => console.log("Audio play failed:", e));
  } catch (e) {
    console.log("Audio notification not supported");
  }
  
  // Show browser notification
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("📦 New Order Received!", {
      body: `You have ${count} pending order${count > 1 ? 's' : ''} waiting for review`,
      icon: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    });
  }
  
  // Show in-page notification
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #d00000, #ff3333);
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    animation: slideIn 0.3s ease;
    max-width: 300px;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="font-size: 24px;">📦</div>
      <div>
        <strong>New Order Received!</strong>
        <p style="margin: 5px 0 0 0; font-size: 14px;">You have ${count} pending order${count > 1 ? 's' : ''} to review.</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// ========== 5. NOTIFICATION PERMISSION ==========
function setupNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    // Show a subtle prompt after 5 seconds
    setTimeout(() => {
      const permissionModal = document.createElement('div');
      permissionModal.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999;
        max-width: 300px;
        animation: slideIn 0.3s ease;
      `;
      
      permissionModal.innerHTML = `
        <p style="margin: 0 0 10px 0; font-size: 14px;">
          <strong>🔔 Get order notifications?</strong><br>
          Enable browser notifications for new orders.
        </p>
        <div style="display: flex; gap: 10px;">
          <button id="enable-notifications" style="
            padding: 8px 15px;
            background: #d00000;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            flex: 1;
          ">Enable</button>
          <button id="dismiss-notifications" style="
            padding: 8px 15px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            flex: 1;
          ">Dismiss</button>
        </div>
      `;
      
      document.body.appendChild(permissionModal);
      
      document.getElementById('enable-notifications').addEventListener('click', function() {
        Notification.requestPermission().then(permission => {
          console.log("Notification permission:", permission);
          permissionModal.remove();
        });
      });
      
      document.getElementById('dismiss-notifications').addEventListener('click', function() {
        permissionModal.remove();
      });
      
      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        if (document.body.contains(permissionModal)) {
          permissionModal.style.animation = "slideOut 0.3s ease";
          setTimeout(() => permissionModal.remove(), 300);
        }
      }, 10000);
    }, 5000);
  }
}

// ========== 6. AUTO-REFRESH SAFETY ==========
// Prevent multiple Firebase listeners
let isDashboardLoaded = false;

// Function to safely reload dashboard
function reloadDashboard() {
  if (!isDashboardLoaded) {
    loadPendingOrders();
    loadInventory();
    isDashboardLoaded = true;
  }
}

// Listen for page visibility changes
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    reloadDashboard();
  }
});

// Initial load
reloadDashboard();