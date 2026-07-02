// create-employee.js - Complete Fixed Version
import { auth, db } from './firebaseconfig.js';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  setDoc, 
  doc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Show alert function
function showAlert(message, type = "info") {
  // Remove existing alerts
  const existingAlert = document.querySelector('.custom-alert');
  if (existingAlert) existingAlert.remove();

  const alertDiv = document.createElement('div');
  alertDiv.className = `custom-alert alert-${type}`;
  alertDiv.innerHTML = `
    <div class="alert-content">
      <span class="alert-message">${message}</span>
      <button class="alert-close">&times;</button>
    </div>
  `;

  // Add styles if not already added
  if (!document.querySelector('#alert-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'alert-styles';
    styleSheet.textContent = `
      .custom-alert {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        min-width: 300px;
        max-width: 500px;
        animation: slideIn 0.3s ease;
      }
      .alert-content {
        padding: 15px 20px;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
      .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
      .alert-warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
      .alert-info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
      .alert-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        margin-left: 15px;
        color: inherit;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(styleSheet);
  }

  document.body.appendChild(alertDiv);

  setTimeout(() => {
    if (alertDiv.parentNode) alertDiv.remove();
  }, 5000);

  alertDiv.querySelector('.alert-close').addEventListener('click', () => {
    alertDiv.remove();
  });
}

// Main form handler
const createEmployeeForm = document.getElementById('create-employee-form');

if (createEmployeeForm) {
  createEmployeeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    console.log("Starting employee creation process...");
    
    // Get form values
    const firstName = document.getElementById('first_name').value.trim();
    const lastName = document.getElementById('last_name').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm').value;
    const contact = document.getElementById('contact').value.trim();
    const address = document.getElementById('address').value.trim();
    const employeeRole = document.getElementById('employeeRole').value;

    // Validation
    if (!firstName || !lastName || !email || !password || !confirmPassword || !contact || !address || !employeeRole) {
      showAlert("Please fill in all required fields!", "error");
      return;
    }

    if (password !== confirmPassword) {
      showAlert("Passwords do not match!", "error");
      return;
    }

    if (password.length < 6) {
      showAlert("Password must be at least 6 characters!", "error");
      return;
    }

    if (!validateEmail(email)) {
      showAlert("Please enter a valid email address!", "error");
      return;
    }

    if (!validatePhone(contact)) {
      showAlert("Please enter a valid phone number!", "error");
      return;
    }

    if (!["Fabricator", "Installer"].includes(employeeRole)) {
      showAlert("Please select a valid employee role!", "error");
      return;
    }

    try {
      // Disable button and show loading
      const submitBtn = createEmployeeForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner"></div> Creating Employee Account...';

      console.log("1. Creating user in Firebase Authentication...");
      
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("✅ Auth user created with UID:", user.uid);

      // 2. Send email verification
      try {
        await sendEmailVerification(user);
        console.log("✅ Verification email sent");
      } catch (verificationError) {
        console.warn("⚠️ Could not send verification email:", verificationError);
      }

      // 3. Create user document in Firestore
      console.log("2. Creating Firestore document...");
      
      const userData = {
        firstName: firstName,
        lastName: lastName,
        email: email,
        contactNumber: contact,
        address: address,
        role: "Employee", // CRITICAL: This must be "Employee"
        employeeRole: employeeRole, // "Fabricator" or "Installer"
        employeeType: employeeRole,
        emailVerified: false,
        createdAt: new Date(),
        createdBy: auth.currentUser ? auth.currentUser.uid : "system",
        isActive: true,
        lastLogin: null
      };
      
      console.log("User data to save:", userData);
      
      // Save to users collection
      await setDoc(doc(db, "users", user.uid), userData);
      console.log("✅ Firestore document created in 'users' collection");

      // 4. Optional: Also save to employees collection
      try {
        const employeeData = {
          ...userData,
          userId: user.uid,
          status: "Active",
          createdAt: new Date()
        };
        await setDoc(doc(db, "employees", user.uid), employeeData);
        console.log("✅ Additional document created in 'employees' collection");
      } catch (employeesError) {
        console.warn("⚠️ Could not create employees collection document:", employeesError.message);
        // This is okay - not all systems need a separate employees collection
      }

      // 5. Show success message
      showAlert(`✅ Employee account created successfully!<br><br>
        📧 Email: ${email}<br>
        👤 Name: ${firstName} ${lastName}<br>
        🛠️ Role: ${employeeRole}<br><br>
        Verification email has been sent to the employee.`, "success");

      console.log("✅ Employee creation process completed successfully!");

      // 6. Reset form
      createEmployeeForm.reset();

      // 7. Optional: Redirect back to employees list after 3 seconds
      setTimeout(() => {
        window.location.href = "employee.html";
      }, 3000);

    } catch (error) {
      console.error("❌ Error creating employee:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      
      // Re-enable button
      const submitBtn = createEmployeeForm.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      
      // Show error message
      let errorMessage = "Failed to create employee account: ";
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = "❌ Email already in use. Please use a different email address.";
          break;
        case 'auth/invalid-email':
          errorMessage = "❌ Invalid email address format.";
          break;
        case 'auth/weak-password':
          errorMessage = "❌ Password is too weak. Please use at least 6 characters.";
          break;
        case 'auth/operation-not-allowed':
          errorMessage = "❌ Email/password accounts are not enabled. Please contact administrator.";
          break;
        case 'permission-denied':
          errorMessage = "❌ Permission denied. You don't have admin privileges to create employees.<br><br>Make sure:<br>1. You are logged in as Admin<br>2. Firestore rules allow admin to create users<br>3. You have proper permissions in Firebase Console";
          break;
        case 'auth/network-request-failed':
          errorMessage = "❌ Network error. Please check your internet connection.";
          break;
        default:
          errorMessage += error.message;
      }
      
      showAlert(errorMessage, "error");
    }
  });
}

// Validation functions
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePhone(phone) {
  // Allow various phone formats
  const re = /^[\+]?[1-9][\d]{0,15}$/;
  return re.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// Log when script loads
console.log("create-employee.js loaded successfully");

