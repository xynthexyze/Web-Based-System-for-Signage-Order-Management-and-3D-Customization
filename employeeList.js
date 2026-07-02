import { db } from './firebaseconfig.js';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const employeeTableBody = document.querySelector("tbody");

const q = query(collection(db, "users"), where("role", "==", "Employee"));

onSnapshot(q, (snapshot) => {
  employeeTableBody.innerHTML = "";
  
  if (snapshot.empty) {
    employeeTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 40px;">
          <div style="color: #666;">
            <p>No employees found.</p>
            <p><small>Create employee accounts to get started.</small></p>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const row = document.createElement("tr");
    
    const roleClass = (data.employeeRole || 'unknown').toLowerCase();
    
    row.innerHTML = `
      <td>${data.firstName} ${data.lastName}</td>
      <td>${data.email}</td>
      <td>${data.contactNumber || "N/A"}</td>
      <td>${data.address || "N/A"}</td>
      <td>
        <span class="role-badge role-${roleClass}">
          ${data.employeeRole || 'Not Set'}
        </span>
      </td>
      <td class="action-buttons">
        <button class="edit-btn" data-id="${docSnap.id}" data-email="${data.email}">Edit</button>
        <button class="delete-btn" data-id="${docSnap.id}" data-email="${data.email}">Delete</button>
      </td>
    `;
    employeeTableBody.appendChild(row);
  });

  addActionListeners();
});

function addActionListeners() {
  document.querySelectorAll('.edit-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const email = e.target.dataset.email;
      editEmployee(id, email, e.target);
    });
  });

  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const email = e.target.dataset.email;
      deleteEmployee(id, email, e.target);
    });
  });
}

async function editEmployee(id, email, button) {
  const newRole = prompt("Enter new role (Fabricator/Installer):", "Fabricator");
  
  if (!newRole || !["Fabricator", "Installer"].includes(newRole)) {
    alert("Invalid role. Please enter either 'Fabricator' or 'Installer'.");
    return;
  }

  try {
    const originalText = button.textContent;
    button.textContent = "Updating...";
    button.disabled = true;

    await updateDoc(doc(db, "users", id), {
      employeeRole: newRole,
      updatedAt: new Date()
    });

    await updateDoc(doc(db, "employees", id), {
      employeeRole: newRole,
      updatedAt: new Date()
    });

    alert(`✅ Employee role updated to ${newRole} successfully!`);
  } catch (error) {
    console.error("Error updating employee:", error);
    alert(`❌ Failed to update employee: ${error.message}`);
  } finally {
    button.textContent = "Edit";
    button.disabled = false;
  }
}

async function deleteEmployee(id, email, button) {
  if (!confirm(`Are you sure you want to delete employee: ${email}?\nThis action cannot be undone!`)) {
    return;
  }

  try {
    const originalText = button.textContent;
    button.textContent = "Deleting...";
    button.disabled = true;

    await deleteDoc(doc(db, "users", id));
    await deleteDoc(doc(db, "employees", id));

    alert(`✅ Employee deleted successfully from database!`);
    
  } catch (error) {
    console.error("Error deleting employee:", error);
    alert(`❌ Failed to delete employee: ${error.message}`);
  } finally {
    button.textContent = "Delete";
    button.disabled = false;
  }
}

const style = document.createElement('style');
style.textContent = `
  .role-badge {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    min-width: 90px;
    text-align: center;
  }
  .role-badge.role-fabricator {
    background: linear-gradient(135deg, #4CAF50, #2E7D32);
    color: white;
  }
  .role-badge.role-installer {
    background: linear-gradient(135deg, #2196F3, #0D47A1);
    color: white;
  }
  .role-badge.role-unknown {
    background: #6c757d;
    color: white;
  }
  .action-buttons {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .edit-btn, .delete-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s ease;
  }
  .edit-btn {
    background: linear-gradient(135deg, #007bff, #0056b3);
    color: white;
  }
  .edit-btn:hover {
    background: linear-gradient(135deg, #0056b3, #003d7a);
    transform: translateY(-2px);
  }
  .delete-btn {
    background: linear-gradient(135deg, #dc3545, #c82333);
    color: white;
  }
  .delete-btn:hover {
    background: linear-gradient(135deg, #c82333, #a71d2a);
    transform: translateY(-2px);
  }
`;
document.head.appendChild(style);
