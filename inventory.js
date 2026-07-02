import { db } from './firebaseconfig.js';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Form elements
const form = document.getElementById("addItemForm");
const materialSelect = document.getElementById("material");
const newMaterialInput = document.getElementById("newMaterialInput");
const stockInput = document.getElementById("stock");
const unitSelect = document.getElementById("unit");
const newUnitInput = document.getElementById("newUnitInput");
const tableBody = document.getElementById("inventoryTableBody");

const inventoryRef = collection(db, "inventory");

// Default material to unit mapping
const materialUnitMap = {
  "Panaflex": ["sq. ft."],
  "Tarpaulin": ["sq. ft."],
  "Metal Sheet": ["sq. ft."],
  "Acrylic": ["sq. ft."]
};

// Show/Hide new material input when "Add New Material" is selected
if (materialSelect && newMaterialInput) {
  materialSelect.addEventListener("change", () => {
    if (materialSelect.value === "other") {
      newMaterialInput.style.display = "block";
      newMaterialInput.required = true;
      newMaterialInput.focus();
    } else {
      newMaterialInput.style.display = "none";
      newMaterialInput.required = false;
      newMaterialInput.value = "";
    }
  });
}

// Show/Hide new unit input when "Add New Unit" is selected
if (unitSelect && newUnitInput) {
  unitSelect.addEventListener("change", () => {
    if (unitSelect.value === "new") {
      newUnitInput.style.display = "block";
      newUnitInput.required = true;
      newUnitInput.focus();
    } else {
      newUnitInput.style.display = "none";
      newUnitInput.required = false;
      newUnitInput.value = "";
    }
  });
}

// Update unit dropdown when material changes
if (materialSelect) {
  materialSelect.addEventListener("change", () => {
    const selectedMaterial = materialSelect.value;
    
    // Only update if not selecting "Add New Material"
    if (selectedMaterial !== "other") {
      unitSelect.innerHTML = '<option value="">Select Unit</option>';
      
      // Add standard units with proper display text
      const unitOptions = [
        { value: "sq. ft.", text: "Square Feet" },
        { value: "pcs", text: "Pieces" },
        { value: "roll", text: "Roll" }
      ];
      
      unitOptions.forEach((unit) => {
        const opt = document.createElement("option");
        opt.value = unit.value;
        opt.textContent = unit.text;
        unitSelect.appendChild(opt);
      });
      
      // Add "Add New Unit" option
      const newOpt = document.createElement("option");
      newOpt.value = "new";
      newOpt.textContent = "Add New Unit";
      unitSelect.appendChild(newOpt);
    }
  });
}

// Initialize unit dropdown on page load
window.addEventListener('DOMContentLoaded', () => {
  if (unitSelect) {
    unitSelect.innerHTML = '<option value="">Select Unit</option>';
    
    // Add standard units with proper display text
    const unitOptions = [
      { value: "sq. ft.", text: "Square Feet" },
      { value: "pcs", text: "Pieces" },
      { value: "roll", text: "Roll" }
    ];
    
    unitOptions.forEach((unit) => {
      const opt = document.createElement("option");
      opt.value = unit.value;
      opt.textContent = unit.text;
      unitSelect.appendChild(opt);
    });
    
    // Add "Add New Unit" option
    const newOpt = document.createElement("option");
    newOpt.value = "new";
    newOpt.textContent = "Add New Unit";
    unitSelect.appendChild(newOpt);
  }
});

// Add new inventory item
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    let selectedMaterial;
    let selectedUnit;
    
    // Determine if using existing or new material
    if (materialSelect.value === "other") {
      selectedMaterial = newMaterialInput.value.trim();
      if (!selectedMaterial) {
        alert("Please enter a new material name.");
        newMaterialInput.focus();
        return;
      }
    } else {
      selectedMaterial = materialSelect.value;
    }
    
    // Determine if using existing or new unit
    if (unitSelect.value === "new") {
      selectedUnit = newUnitInput.value.trim();
      if (!selectedUnit) {
        alert("Please enter a new unit.");
        newUnitInput.focus();
        return;
      }
    } else {
      selectedUnit = unitSelect.value;
    }
    
    const quantity = parseInt(stockInput.value);
    
    if (!selectedMaterial || isNaN(quantity) || quantity < 0 || !selectedUnit) {
      alert("Please fill in all fields correctly.");
      return;
    }

    const status = quantity <= 10 ? "LOW STOCK" : "IN STOCK";

    try {
      await addDoc(inventoryRef, {
        material: selectedMaterial,
        quantity: quantity,
        unit: selectedUnit,
        status: status,
        lastUpdated: new Date()
      });

      // Reset form
// Reset form after successful submission
form.reset();

// Reset unit dropdown with proper display text
unitSelect.innerHTML = '<option value="">Select Unit</option>';

const unitOptions = [
  { value: "sq. ft.", text: "Square Feet" },
  { value: "pcs", text: "Pieces" },
  { value: "roll", text: "Roll" }
];

unitOptions.forEach((unit) => {
  const opt = document.createElement("option");
  opt.value = unit.value;
  opt.textContent = unit.text;
  unitSelect.appendChild(opt);
});

const newOpt = document.createElement("option");
newOpt.value = "new";
newOpt.textContent = "Add New Unit";
unitSelect.appendChild(newOpt);
      
      // Hide and clear new input fields
      newMaterialInput.style.display = "none";
      newMaterialInput.value = "";
      newUnitInput.style.display = "none";
      newUnitInput.value = "";
      
      alert("Item added successfully!");
    } catch (error) {
      console.error("❌ Error adding item:", error);
      alert("Failed to add item.");
    }
  });
}

// Render inventory table live
if (tableBody) {
  onSnapshot(inventoryRef, (snapshot) => {
    tableBody.innerHTML = "";

    if (snapshot.empty) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No inventory items found.</td></tr>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const item = docSnap.data();
      const id = docSnap.id;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.material}</td>
        <td>
          <span class="qty-display">${item.quantity}</span>
          <input type="number" class="qty-input" min="0" value="${item.quantity}" style="display:none; width: 80px;">
        </td>
        <td>${item.unit}</td>
        <td><span class="status-text ${item.status === 'LOW STOCK' ? 'status-low-stock' : 'status-available'}">${item.status}</span></td>
        <td>
          <button class="edit-btn" data-id="${id}">Edit</button>
          <button class="save-btn" data-id="${id}" style="display:none;">Save</button>
          <button class="delete-btn" data-id="${id}">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Handle Delete
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (confirm("Are you sure you want to delete this item?")) {
          try {
            await deleteDoc(doc(db, "inventory", id));
            alert("Item deleted successfully!");
          } catch (error) {
            console.error("❌ Delete failed:", error);
            alert("Could not delete item.");
          }
        }
      });
    });

    // Handle Edit
    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest("tr");
        row.querySelector(".qty-display").style.display = "none";
        row.querySelector(".qty-input").style.display = "inline-block";
        row.querySelector(".qty-input").focus();
        btn.style.display = "none";
        row.querySelector(".save-btn").style.display = "inline-block";
      });
    });

    // Handle Save
    document.querySelectorAll(".save-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const row = btn.closest("tr");
        const input = row.querySelector(".qty-input");
        const newQty = parseInt(input.value);

        if (isNaN(newQty) || newQty < 0) {
          alert("Please enter a valid quantity.");
          input.focus();
          return;
        }

        const status = newQty <= 10 ? "LOW STOCK" : "IN STOCK";

        try {
          await updateDoc(doc(db, "inventory", id), {
            quantity: newQty,
            status: status,
            lastUpdated: new Date()
          });

          row.querySelector(".qty-display").textContent = newQty;
          row.querySelector(".status-text").textContent = status;
          row.querySelector(".status-text").className = `status-text ${status === 'LOW STOCK' ? 'status-low-stock' : 'status-available'}`;
          row.querySelector(".qty-display").style.display = "inline";
          input.style.display = "none";
          row.querySelector(".edit-btn").style.display = "inline-block";
          btn.style.display = "none";
          
          alert("Item updated successfully!");
        } catch (error) {
          console.error("❌ Update failed:", error);
          alert("Failed to update item.");
        }
      });
    });
  });
}