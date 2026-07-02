// profile.js - Consolidated Profile Handler
import { auth, db } from './firebaseconfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { uiHelper } from './shared/ui-helper.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeProfile();
});

async function initializeProfile() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    try {
      uiHelper.showLoading('Loading profile...');
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        throw new Error("Profile not found");
      }

      const userData = userDoc.data();
      
      // Update all profile elements
      const elements = {
        'profile-name': `${userData.firstName} ${userData.lastName}`,
        'profile-email': userData.email,
        'profile-role': userData.role,
        'profile-address': userData.address || 'N/A',
        'profile-contact': userData.contactNumber || 'N/A',
        'profile-employee-type': userData.employeeType || 'N/A'
      };

      for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = value;
          } else {
            element.textContent = value;
          }
        }
      }

      // Update email verification status
      const emailStatus = document.getElementById('email-status');
      if (emailStatus) {
        emailStatus.innerHTML = user.emailVerified ? 
          '<span style="color:green">✅ Verified</span>' : 
          '<span style="color:orange">⚠️ Not Verified</span>';
      }

    } catch (error) {
      console.error("Profile error:", error);
      uiHelper.showAlert("Failed to load profile", "error");
    } finally {
      uiHelper.hideLoading();
    }
  });
}