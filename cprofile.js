// FIXED eprofile.js and cprofile.js
import { auth, db } from './firebaseconfig.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        document.getElementById("profile-name").textContent = `${userData.firstName} ${userData.lastName}`;
        document.getElementById("profile-address").textContent = userData.address || "N/A";
        document.getElementById("profile-contact").textContent = userData.contactNumber || "N/A";
        document.getElementById("profile-email").textContent = userData.email || "N/A";
        document.getElementById("profile-role").textContent = userData.role || "N/A";
      } else {
        alert("User data not found.");
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  } else {
    window.location.href = "login.html";
  }
});