// customer-dashboard.js - UPDATED WITH REVIEW SUBMISSION SUPPORT
document.addEventListener('DOMContentLoaded', function() {
    console.log('Customer dashboard loaded');
    loadOrdersFromLocalStorage();
    setupFilterTabs();
    
    // Listen for new order events from other pages
    window.addEventListener('newOrderSaved', function(event) {
        console.log('New order saved event received:', event.detail);
        loadOrdersFromLocalStorage();
    });
    
    // Check if we need to add a test order (for demonstration)
    if (localStorage.getItem('testOrders') === null) {
        console.log('No orders in localStorage');
    }
});

function setupFilterTabs() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    if (!filterTabs.length) return;
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            filterTabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Get filter value
            const filter = this.getAttribute('data-filter');
            
            // Load orders with filter
            loadOrdersFromLocalStorage(filter);
        });
    });
}

function loadOrdersFromLocalStorage(filter = 'all') {
    const tableBody = document.getElementById("order-table-body");
    const noOrdersMessage = document.getElementById("no-orders-message");
    
    if (!tableBody || !noOrdersMessage) {
        console.error("Required elements not found");
        return;
    }
    
    console.log('Loading orders from localStorage with filter:', filter);
    
    try {
        const ordersData = localStorage.getItem('testOrders');
        const orders = ordersData ? JSON.parse(ordersData) : [];
        
        console.log('Found orders:', orders.length);
        
        if (orders.length === 0) {
            tableBody.innerHTML = '';
            noOrdersMessage.style.display = 'block';
            return;
        }
        
        // Hide no orders message
        noOrdersMessage.style.display = 'none';
        
        // Sort newest first
        orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        tableBody.innerHTML = '';

        let displayedCount = 0;
        orders.forEach((order, index) => {
            // Apply filter
            if (!matchesFilter(order, filter)) {
                return;
            }
            
            displayedCount++;
            console.log('Displaying order #' + (index + 1) + ':', order);

            // Get dimension
            let dimension = "Custom Size";

            if (order.design?.dimensions?.width && order.design?.dimensions?.height) {
                dimension = `${order.design.dimensions.width.toFixed(1)} x ${order.design.dimensions.height.toFixed(1)} ft`;
            } else if (order.length && order.width) {
                dimension = `${order.length} x ${order.width} ${order.unit || 'ft'}`;
            } else if (order.dimensions?.width && order.dimensions?.height) {
                dimension = `${order.dimensions.width} x ${order.dimensions.height} ft`;
            }

            // Signage type
            let type = order.design?.signageTypeDescription || order.type || 'Panaflex Signage';

            const calculatedPrice = order.calculatedPrice || order.totalCost || 0;
            const testAmount = order.testAmount || 10.00;

            // Date formatting
            let orderDate = 'Recent';
            if (order.date) {
                orderDate = new Date(order.date).toLocaleDateString();
            } else if (order.timestamp) {
                orderDate = new Date(order.timestamp).toLocaleDateString();
            }
            
            // Get status and payment status
            const statusText = getStatusText(order.status);
            const statusClass = getStatusClass(order.status);
            const isReviewSubmission = order.isReviewSubmission || false;
            
            // Payment status
            let paymentStatus = '';
            let paymentStatusClass = '';
            if (isReviewSubmission) {
                if (order.status === 'confirmed') {
                    paymentStatus = 'Payment Pending';
                    paymentStatusClass = 'payment-pending';
                } else {
                    paymentStatus = 'Awaiting Approval';
                    paymentStatusClass = 'payment-awaiting';
                }
            } else {
                paymentStatus = 'Paid';
                paymentStatusClass = 'payment-paid';
            }

            const row = document.createElement("tr");
            row.className = isReviewSubmission ? 'review-submission' : '';
            
            row.innerHTML = `
                <td>
                    <strong>${order.orderId || 'ORDER-' + (index + 1)}</strong><br>
                    <small style="color: #666;">${orderDate}</small>
                    ${isReviewSubmission ? '<br><small class="review-tag">📝 Review Submission</small>' : ''}
                </td>
                <td>${type}</td>
                <td>${dimension}</td>
                <td>
                    <strong>₱${calculatedPrice.toFixed(2)}</strong><br>
                    <small class="test-amount">${isReviewSubmission ? 'No payment yet' : `Test Paid: ₱${testAmount.toFixed(2)}`}</small>
                </td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td><span class="payment-status ${paymentStatusClass}">${paymentStatus}</span></td>
                <td>
                    <button class="view-order-btn" data-index="${index}" title="View Order Details">
                        View
                    </button>
                    ${(order.status === 'pending_admin' || order.status === 'pending_admin_review') ? 
                        `<button class="cancel-order-btn" data-index="${index}" title="Cancel Order">
                            Cancel
                        </button>` : 
                        ''
                    }
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // If no orders match the filter, show message
        if (displayedCount === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding: 40px;">
                        <div style="color: #666;">
                            <p>No ${filter !== 'all' ? filter + ' ' : ''}orders found.</p>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        // Attach event listeners to buttons
        attachOrderButtonListeners(orders);

    } catch (error) {
        console.error("Error loading orders:", error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding: 40px; color: #d00000;">
                    <p>Error loading orders: ${error.message}</p>
                    <p><small>LocalStorage might be corrupted or empty.</small></p>
                </td>
            </tr>
        `;
        noOrdersMessage.style.display = 'none';
    }
}

function matchesFilter(order, filter) {
    if (filter === 'all') return true;
    if (filter === 'pending') {
        return order.status === 'pending_admin' || order.status === 'pending_admin_review';
    }
    if (filter === 'review') {
        return order.isReviewSubmission === true;
    }
    if (filter === 'completed') {
        return order.status === 'completed' || order.status === 'confirmed';
    }
    return true;
}

function attachOrderButtonListeners(orders) {
    // View order buttons
    document.querySelectorAll('.view-order-btn').forEach(button => {
        button.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            showOrderDetails(orders[index], index);
        });
    });
    
    // Cancel order buttons
    document.querySelectorAll('.cancel-order-btn').forEach(button => {
        button.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            cancelOrder(orders[index], index);
        });
    });
}

function showOrderDetails(order, index) {
    // Get dimension
    let dimension = "Custom Size";
    if (order.design?.dimensions?.width && order.design?.dimensions?.height) {
        dimension = `${order.design.dimensions.width.toFixed(1)} x ${order.design.dimensions.height.toFixed(1)} ft`;
    }
    
    // Date formatting
    let orderDate = 'N/A';
    if (order.date) {
        orderDate = new Date(order.date).toLocaleString();
    }
    
    const modal = document.getElementById('order-details-modal');
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Order Details</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="order-info-grid">
                    <div class="info-section">
                        <h4>Order Information</h4>
                        <p><strong>Order ID:</strong> ${order.orderId || 'ORDER-' + (index + 1)}</p>
                        <p><strong>Date:</strong> ${orderDate}</p>
                        <p><strong>Type:</strong> ${order.design?.signageTypeDescription || order.type || 'Panaflex Signage'}</p>
                        ${order.isReviewSubmission ? 
                            '<p><strong>Submission Type:</strong> <span class="review-tag">Review Submission</span></p>' : 
                            ''
                        }
                    </div>
                    
                    <div class="info-section">
                        <h4>Status</h4>
                        <p><strong>Order Status:</strong> <span class="status-badge ${getStatusClass(order.status)}">${getStatusText(order.status)}</span></p>
                        <p><strong>Payment Status:</strong> <span class="payment-status ${order.isReviewSubmission ? 'payment-awaiting' : 'payment-paid'}">
                            ${order.isReviewSubmission ? 
                                (order.status === 'confirmed' ? 'Payment Pending' : 'Awaiting Approval') : 
                                'Paid'
                            }
                        </span></p>
                    </div>
                </div>
                
                <div class="info-section">
                    <h4>Signage Details</h4>
                    <div class="details-grid">
                        <div>
                            <p><strong>Dimensions:</strong> ${dimension}</p>
                            <p><strong>Material:</strong> ${order.material || 'Panaflex'}</p>
                            <p><strong>Quantity:</strong> ${order.quantity || 1} ${order.unit || 'pcs'}</p>
                        </div>
                        <div>
                            <p><strong>Design Elements:</strong> ${order.design?.textCount || 0} text, ${order.design?.imageCount || 0} images</p>
                            <p><strong>Shape Type:</strong> ${order.design?.shapeType || 'Custom'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="info-section">
                    <h4>Pricing</h4>
                    <div class="pricing-grid">
                        <div>
                            <p><strong>Total Price:</strong> ₱${(order.calculatedPrice || order.totalCost || 0).toFixed(2)}</p>
                        </div>
                        <div>
                            <p><strong>Payment:</strong> ${order.isReviewSubmission ? 
                                'No payment required yet' : 
                                `Test Payment: ₱${(order.testAmount || 10.00).toFixed(2)}`
                            }</p>
                        </div>
                    </div>
                </div>
                
                ${order.isReviewSubmission ? `
                <div class="info-section review-notice">
                    <h4>📝 Review Submission Information</h4>
                    <p>Your design has been submitted for admin review. The admin will:</p>
                    <ul>
                        <li>Review your design for feasibility</li>
                        <li>Contact you for payment confirmation</li>
                        <li>Provide final pricing if any changes are needed</li>
                        <li>Begin production once payment is confirmed</li>
                    </ul>
                    <p><em>You will receive an email notification when your order status changes.</em></p>
                </div>
                ` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn-secondary modal-close">Close</button>
                ${(order.status === 'pending_admin' || order.status === 'pending_admin_review') ? 
                    `<button class="btn-danger" onclick="cancelOrderFromModal(${index})">Cancel Order</button>` : 
                    ''
                }
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
    
    // Add close event listeners
    modal.querySelectorAll('.modal-close').forEach(button => {
        button.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function cancelOrder(order, index) {
    if (!confirm("Are you sure you want to cancel this order?")) {
        return;
    }
    
    try {
        const ordersData = localStorage.getItem('testOrders');
        const orders = ordersData ? JSON.parse(ordersData) : [];
        
        if (index < orders.length) {
            // Update order status
            orders[index].status = 'cancelled';
            orders[index].cancelledAt = new Date().toISOString();
            orders[index].updatedAt = Date.now();
            
            // Save back to localStorage
            localStorage.setItem('testOrders', JSON.stringify(orders));
            
            // Show success message
            showNotification('Order cancelled successfully', 'success');
            
            // Reload orders
            loadOrdersFromLocalStorage();
            
            // Close modal if open
            const modal = document.getElementById('order-details-modal');
            if (modal) {
                modal.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error cancelling order:', error);
        showNotification('Error cancelling order', 'error');
    }
}

// Global function for cancelling from modal
window.cancelOrderFromModal = function(index) {
    const ordersData = localStorage.getItem('testOrders');
    const orders = ordersData ? JSON.parse(ordersData) : [];
    
    if (index < orders.length) {
        cancelOrder(orders[index], index);
    }
};

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// NEW FUNCTION: Save order to localStorage
function saveOrderToLocalStorage(orderData) {
    try {
        // Get existing orders from localStorage
        const existingOrdersJSON = localStorage.getItem('testOrders');
        const existingOrders = existingOrdersJSON ? JSON.parse(existingOrdersJSON) : [];
        
        // Ensure the order has a timestamp for sorting
        if (!orderData.timestamp) {
            orderData.timestamp = Date.now();
        }
        
        // Ensure the order has a date
        if (!orderData.date) {
            orderData.date = new Date().toISOString();
        }
        
        // Ensure the order has an ID
        if (!orderData.orderId) {
            orderData.orderId = 'ORDER-' + Date.now();
        }
        
        // Ensure the order has a status
        if (!orderData.status) {
            orderData.status = orderData.isReviewSubmission ? 'pending_admin_review' : 'pending_admin';
        }
        
        // Add new order to the array
        existingOrders.push(orderData);
        
        // Save back to localStorage
        localStorage.setItem('testOrders', JSON.stringify(existingOrders));
        
        console.log('Order saved to localStorage:', orderData);
        
        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('newOrderSaved', { 
            detail: { orderId: orderData.orderId } 
        }));
        
        return true;
    } catch (error) {
        console.error('Error saving order to localStorage:', error);
        return false;
    }
}

// NEW FUNCTION: Add a sample order for testing
function addSampleOrder() {
    const sampleOrder = {
        orderId: 'ORDER-' + Date.now(),
        timestamp: Date.now(),
        date: new Date().toISOString(),
        status: 'pending_admin_review',
        isReviewSubmission: true,
        calculatedPrice: 1500.00,
        testAmount: 0.00,
        type: 'Panaflex Signage',
        design: {
            signageTypeDescription: 'Panaflex Signage',
            dimensions: {
                width: 5.0,
                height: 3.0
            },
            textCount: 2,
            imageCount: 1,
            shapeType: 'Square'
        },
        material: 'Panaflex',
        quantity: 1,
        unit: 'pcs'
    };
    
    saveOrderToLocalStorage(sampleOrder);
}

function getStatusText(status) {
    switch(status) {
        case "pending_admin": return "Pending Review";
        case "pending_admin_review": return "Pending Approval";
        case "confirmed": return "Confirmed";
        case "processing": return "In Production";
        case "assigned": return "Assigned";
        case "completed": return "Completed";
        case "rejected": return "Rejected";
        case "cancelled": return "Cancelled";
        default: return "Pending";
    }
}

function getStatusClass(status) {
    switch(status) {
        case "pending_admin": 
        case "pending_admin_review": 
            return "pending";
        case "confirmed":
        case "processing":
        case "assigned":
            return "processing";
        case "completed": 
            return "completed";
        case "rejected": 
        case "cancelled": 
            return "rejected";
        default: 
            return "pending";
    }
}

// Add CSS for status badges, payment status, and other elements
const style = document.createElement('style');
style.textContent = `
    /* Status Badges */
    .status-badge {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.85em;
        font-weight: 600;
        display: inline-block;
    }
    
    .status-badge.pending {
        background-color: #fff3cd;
        color: #856404;
        border: 1px solid #ffeaa7;
    }
    
    .status-badge.processing {
        background-color: #cce5ff;
        color: #004085;
        border: 1px solid #b8daff;
    }
    
    .status-badge.completed {
        background-color: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
    }
    
    .status-badge.rejected {
        background-color: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
    }
    
    /* Payment Status */
    .payment-status {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.85em;
        font-weight: 600;
        display: inline-block;
    }
    
    .payment-status.payment-paid {
        background-color: #d4edda;
        color: #155724;
    }
    
    .payment-status.payment-pending {
        background-color: #fff3cd;
        color: #856404;
    }
    
    .payment-status.payment-awaiting {
        background-color: #e2e3e5;
        color: #383d41;
    }
    
    /* Review Submission Styling */
    .review-submission {
        background-color: #f0f9ff;
    }
    
    .review-submission:hover {
        background-color: #e6f4ff;
    }
    
    .review-tag {
        color: #28a745;
        font-size: 0.8em;
        font-weight: 600;
    }
    
    /* Filter Tabs */
    .order-filter-tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        flex-wrap: wrap;
    }
    
    .filter-tab {
        padding: 8px 16px;
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s;
    }
    
    .filter-tab:hover {
        background: #e9ecef;
    }
    
    .filter-tab.active {
        background: #d00000;
        color: white;
        border-color: #d00000;
    }
    
    /* Action Buttons */
    .action-btn {
        padding: 10px 20px;
        background-color: #d00000;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s;
    }
    
    .action-btn:hover {
        background-color: #b00000;
    }
    
    .create-btn {
        margin-top: 15px;
        padding: 12px 24px;
        font-size: 16px;
    }
    
    /* Table Action Buttons */
    .view-order-btn, .cancel-order-btn {
        padding: 4px 8px;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        margin: 2px;
    }
    
    .view-order-btn {
        background: #17a2b8;
        color: white;
    }
    
    .cancel-order-btn {
        background: #dc3545;
        color: white;
    }
    
    .view-order-btn:hover {
        background: #138496;
    }
    
    .cancel-order-btn:hover {
        background: #c82333;
    }
    
    /* No Orders Message */
    .no-orders-message {
        text-align: center;
        padding: 50px 20px;
        background: #f8f9fa;
        border-radius: 8px;
        margin: 20px 0;
    }
    
    .no-orders-icon {
        font-size: 48px;
        margin-bottom: 15px;
    }
    
    .no-orders-message h3 {
        margin: 0 0 10px 0;
        color: #333;
    }
    
    .no-orders-message p {
        color: #666;
        margin-bottom: 20px;
    }
    
    /* Info Box */
    .info-box {
        background: #e7f3ff;
        border: 1px solid #c3e6cb;
        border-radius: 8px;
        padding: 15px;
        margin: 20px 0;
        display: flex;
        gap: 15px;
    }
    
    .info-icon {
        font-size: 24px;
        flex-shrink: 0;
    }
    
    .info-content h4 {
        margin: 0 0 8px 0;
        color: #155724;
    }
    
    .info-content p {
        margin: 0;
        color: #555;
        font-size: 14px;
        line-height: 1.5;
    }
    
    /* Modal Styles */
    .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    
    .modal-content {
        background: white;
        border-radius: 10px;
        max-width: 700px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #dee2e6;
    }
    
    .modal-header h3 {
        margin: 0;
    }
    
    .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    }
    
    .modal-body {
        padding: 20px;
    }
    
    .info-section {
        margin-bottom: 20px;
    }
    
    .info-section h4 {
        margin: 0 0 15px 0;
        color: #333;
    }
    
    .order-info-grid, .details-grid, .pricing-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
    }
    
    @media (max-width: 768px) {
        .order-info-grid, .details-grid, .pricing-grid {
            grid-template-columns: 1fr;
            gap: 15px;
        }
    }
    
    .modal-footer {
        padding: 20px;
        border-top: 1px solid #dee2e6;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    }
    
    .btn-secondary, .btn-danger {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    }
    
    .btn-secondary {
        background: #6c757d;
        color: white;
    }
    
    .btn-danger {
        background: #dc3545;
        color: white;
    }
    
    /* Review Notice in Modal */
    .review-notice {
        background: #e7f3ff;
        border-radius: 8px;
        padding: 15px;
        margin-top: 20px;
    }
    
    .review-notice ul {
        margin: 10px 0;
        padding-left: 20px;
    }
    
    .review-notice li {
        margin-bottom: 5px;
        color: #555;
    }
    
    /* Notifications */
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1001;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
    }
    
    .notification.show {
        transform: translateX(0);
        opacity: 1;
    }
    
    .notification-success {
        background: #d4edda;
        border-left: 4px solid #28a745;
    }
    
    .notification-error {
        background: #f8d7da;
        border-left: 4px solid #dc3545;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    /* Test Amount Styling */
    .test-amount {
        color: #666;
        font-size: 0.85em;
    }
    
    /* Table Wrapper */
    .table-wrapper {
        overflow-x: auto;
        border-radius: 8px;
        margin-bottom: 20px;
    }
`;
document.head.appendChild(style);

// Make the saveOrderToLocalStorage function available globally
window.saveOrderToLocalStorage = saveOrderToLocalStorage;