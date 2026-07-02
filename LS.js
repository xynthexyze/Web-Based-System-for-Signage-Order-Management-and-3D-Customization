// LS.js - Complete Authentication Handler
console.log("🔥 LS.js loading...");

import { auth, db } from './firebaseconfig.js';
console.log("✅ Imported Firebase config");

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
console.log("✅ Firebase Auth imported");

import { 
  setDoc, 
  doc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
console.log("✅ Firestore imported");


// ========== SIGNUP FUNCTION ==========
const registerForm = document.getElementById('register-form');
if (registerForm) {
  console.log("✅ Register form found, attaching listener...");
  
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log("📝 Signup form submitted");
    
    const firstName = document.getElementById('first_name').value.trim();
    const lastName = document.getElementById('last_name').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm').value;
    const contact = document.getElementById('contact').value.trim();
    const address = document.getElementById('address').value.trim();
    
    console.log("Form data:", { firstName, lastName, email, contact, address });
    
    if (password !== confirmPassword) {
      showAlert("❌ Passwords do not match!", "error");
      return;
    }
    if (password.length < 6) {
      showAlert("❌ Password must be at least 6 characters long!", "error");
      return;
    }
    if (!validateEmail(email)) {
      showAlert("❌ Please enter a valid email address!", "error");
      return;
    }
    
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating Account...';
      
      console.log("Step 1: Creating Firebase Auth user...");
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("✅ Auth user created! UID:", user.uid);
      
      console.log("Step 2: Saving user data to Firestore...");
      
      const userData = {
        firstName,
        lastName,
        email,
        contactNumber: contact,
        address,
        role: "Customer",
        employeeType: "None",
        verified: false,
        emailVerified: false,
        createdAt: new Date(),
        lastLogin: null
      };
      
      await setDoc(doc(db, "users", user.uid), userData);
      console.log("✅ User data saved to Firestore!");
      
      console.log("Step 3: Sending verification email...");
      
      await sendEmailVerification(user);
      console.log("✅ Verification email sent!");
      
      showAlert(`
        <div style="text-align: center; padding: 10px;">
          <h3 style="color: #28a745; margin-bottom: 10px;">✅ Account Created Successfully!</h3>
          <p><strong>Email:</strong> ${email}</p>
          <p style="color: #666; font-size: 0.9em; margin-top: 10px;">
            📧 Verification email has been sent.<br>
            Please check your inbox AND spam folder.
          </p>
          <p style="color: #666; font-size: 0.9em;">
            You will be redirected to login page in 5 seconds...
          </p>
        </div>
      `, "success");
      
      console.log("Step 4: Signing out user...");
      
      await signOut(auth);
      console.log("✅ User signed out");
      
      setTimeout(() => {
        console.log("Redirecting to login page...");
        window.location.href = "login.html";
      }, 5000);
      
    } catch (error) {
      console.error("❌ Signup error:", error);

      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign Up';
      
      let errorMessage = "";
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = "This email is already registered.";
          break;
        case 'auth/invalid-email':
          errorMessage = "The email address is invalid.";
          break;
        case 'auth/weak-password':
          errorMessage = "The password is too weak.";
          break;
        default:
          errorMessage = "Signup failed: " + error.message;
      }
      showAlert("❌ " + errorMessage, "error");
    }
  });
} else {
  console.log("⚠️ Register form NOT found (might be on login page)");
}



// ========== LOGIN FUNCTION ==========
const loginForm = document.getElementById('login-form');
if (loginForm) {
  console.log("✅ Login form found, attaching listener...");
  
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log("📝 Login form submitted");
    
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
      showAlert("Please fill in all fields!", "error");
      return;
    }
    
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        await signOut(auth);
        showAlert("User data not found.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
        return;
      }
      
      const userData = userDoc.data();
      const role = userData.role || "Customer";
      
      if (!user.emailVerified && role === "Customer") {
        await signOut(auth);

        const resend = confirm(
          `Your email (${email}) is not verified.\n\nClick OK to resend verification email.`
        );
        
        if (resend) {
          try {
            await sendEmailVerification(user);
            showAlert(`✅ New verification email sent to: ${email}`, "success");
          } catch (err) {
            showAlert("Failed to resend verification email.", "error");
          }
        }
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
        return;
      }
      
      await setDoc(doc(db, "users", user.uid), {
        lastLogin: new Date(),
        emailVerified: user.emailVerified
      }, { merge: true });
      
      let redirectUrl = "customer-dashboard.html";
      if (role === "Admin") redirectUrl = "admin-dashboard.html";
      if (role === "Employee") redirectUrl = "employee-dashboard.html";
      
      showAlert("✅ Login successful! Redirecting...", "success");
      
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 2000);
      
    } catch (error) {
      console.error("❌ Login error:", error);

      submitBtn.disabled = false;
      submitBtn.textContent = 'Login';
      
      let errorMessage = "";
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = "No account found with this email.";
          break;
        case 'auth/wrong-password':
          errorMessage = "Incorrect password.";
          break;
        case 'auth/invalid-email':
          errorMessage = "Invalid email.";
          break;
        default:
          errorMessage = "Login failed: " + error.message;
      }
      showAlert("❌ " + errorMessage, "error");
    }
  });
}



// ========== FORGOT PASSWORD ==========
const forgotPasswordLink = document.getElementById('forgot-password');
if (forgotPasswordLink) {
  console.log("✅ Forgot password link found");
  
  forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    
    let email = document.getElementById('email')?.value;
    
    if (!email) {
      email = prompt("Enter your email for password reset:");
      if (!email) {
        showAlert("Email is required.", "error");
        return;
      }
    }
    
    if (!validateEmail(email)) {
      showAlert("Invalid email!", "error");
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, email);
      showAlert(`📧 Password reset email sent to: ${email}`, "success");
    } catch (error) {
      showAlert("Failed to send reset email: " + error.message, "error");
    }
  });
}



// ========== HELPER FUNCTIONS ==========
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showAlert(message, type = "info") {
  const existing = document.querySelector('.custom-alert');
  if (existing) existing.remove();
  
  const alertDiv = document.createElement('div');
  alertDiv.className = `custom-alert alert-${type}`;
  alertDiv.innerHTML = `
    <div class="alert-content">
      <div class="alert-message">${message}</div>
      <button class="alert-close">&times;</button>
    </div>
  `;
  
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
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(styleSheet);
  }
  
  document.body.appendChild(alertDiv);

  alertDiv.querySelector('.alert-close').onclick = () => alertDiv.remove();
  setTimeout(() => alertDiv.remove(), 5000);
}



onAuthStateChanged(auth, (user) => {
  if (user) console.log("👤 Auth state: Signed in", user.email);
  else console.log("👤 Auth state: No user signed in");
});

console.log("🚀 LS.js setup complete!");