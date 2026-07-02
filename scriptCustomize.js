let scene, camera, renderer, controls;
let objects = [];            // keep track of draggable objects
let currentModel = null;
let dragControls = null;     // DragControls instance

// ---------------- TEXT SYSTEM VARIABLES ----------------
let textMeshes = [];
let selectedTextMesh = null; // Track currently selected text
let selectedModel = null;    // Track currently selected model
let selectedImage = null;    // Track currently selected image
const fontLoader = new THREE.FontLoader();

// ---------------- FONT SYSTEM VARIABLES ----------------
const fontUrls = {
    'helvetiker': 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
    'optimer': 'https://threejs.org/examples/fonts/optimer_regular.typeface.json',
    'gentilis': 'https://threejs.org/examples/fonts/gentilis_regular.typeface.json',
    'droid sans': 'https://threejs.org/examples/fonts/droid/droid_sans_regular.typeface.json',
    'droid serif': 'https://threejs.org/examples/fonts/droid/droid_serif_regular.typeface.json',
    'opensans': 'https://threejs.org/examples/fonts/opensans/opensans_regular.typeface.json',
    'robotothin': 'https://threejs.org/examples/fonts/roboto/roboto_thin.typeface.json'
};

// ---------------- IMAGE SYSTEM VARIABLES ----------------
let imageMeshes = [];
let imageUploadInput = null;
let cropOverlay = null;
let isCropping = false;
let cropStart = { x: 0, y: 0 };
let cropEnd = { x: 0, y: 0 };

// Default slider values
let textPosX = 0;
let textPosY = 1;

// Auto-detected front Z position
let textFrontZ = 0.2;

// Selection highlight materials
const highlightMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00ff00, 
    wireframe: true,
    transparent: true,
    opacity: 0.8
});
const textHighlightMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffff00, 
    wireframe: true,
    transparent: true,
    opacity: 0.8
});
const imageHighlightMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff00ff, 
    wireframe: true,
    transparent: true,
    opacity: 0.8
});

let selectionBox = null; // For model selection outline
let textSelectionBox = null; // For text selection outline
let imageSelectionBox = null; // For image selection outline

// --------------------------------------------------------

// ---------------- PAYPAL SDK LOADER (FIXED) ----------------
let paypalSDKLoaded = false;
let paypalSDKLoading = false;

function loadPayPalSDK(callback) {
    if (typeof paypal !== 'undefined' && paypalSDKLoaded) {
        console.log('PayPal SDK already loaded');
        if (callback) callback();
        return;
    }
    
    if (paypalSDKLoading) {
        console.log('PayPal SDK loading in progress, waiting...');
        setTimeout(function() {
            loadPayPalSDK(callback);
        }, 500);
        return;
    }
    
    console.log('Starting PayPal SDK load...');
    paypalSDKLoading = true;
    
    const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
    existingScripts.forEach(script => script.remove());
    
    const script = document.createElement('script');
    script.src = 'https://www.paypal.com/sdk/js?client-id=AY9vrhgnoRfRoo2iTb-RRs6dLnvDeAB5NsBWtKFLHLrrgrddSRlEoGIxvh50VK1I2eNygATTFyqH8xjq&currency=PHP&intent=capture';
    script.async = true;
    script.defer = true;
    
    script.onload = function() {
        console.log('PayPal SDK loaded successfully');
        paypalSDKLoaded = true;
        paypalSDKLoading = false;
        if (callback) callback();
    };
    
    script.onerror = function(error) {
        console.error('PayPal SDK load error:', error);
        paypalSDKLoading = false;
        paypalSDKLoaded = true;
        if (callback) callback();
    };
    
    document.head.appendChild(script);
}

// ---------------- ORDER SAVING TO FIREBASE (UPDATED) ----------------
async function saveTestOrderToDatabase(paymentData, designData, paymentAmount, isReviewSubmission = false) {
    try {
        console.log('Saving order to Firebase...');
        
        // Get Firebase config and functions
        const { db } = await import('./firebaseconfig.js');
        const { collection, addDoc, Timestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        
        // Get customer information
        let customerEmail = "guest@example.com";
        let customerId = null;
        let customerName = "Guest Customer";
        
        try {
            // Try to get authenticated user info
            const { auth } = await import('./firebaseconfig.js');
            if (auth.currentUser) {
                customerEmail = auth.currentUser.email || "guest@example.com";
                customerId = auth.currentUser.uid;
                customerName = auth.currentUser.displayName || "Customer";
            }
        } catch (error) {
            console.log("No authenticated user, using guest info");
        }
        
        // Generate order ID
        const orderId = 'ORDER_' + Date.now();
        
        // Create order object for Firebase
        const newOrder = {
            // Basic order info
            orderId: orderId,
            customerEmail: customerEmail,
            customerId: customerId,
            customerName: customerName,
            
            // Signage details
            signageType: designData.signageTypeDescription,
            projectType: "Panaflex Signage",
            material: "Panaflex",
            quantity: 1,
            unit: "pcs",
            
            // Dimensions
            dimensions: {
                width: designData.dimensions.width,
                height: designData.dimensions.height,
                area: designData.dimensions.area
            },
            
            // Pricing
            totalPrice: designData.totalCost,
            testPaymentAmount: paymentAmount,
            paid: isReviewSubmission ? false : true,
            paymentId: paymentData.id,
            
            // Design elements
            textElements: designData.textCount || 0,
            imageElements: designData.imageCount || 0,
            shapeType: designData.shapeType || "Custom",
            
            // Status tracking - CRITICAL: This is what admin looks for
            status: isReviewSubmission ? "pending_admin_review" : "pending_admin",
            stage: isReviewSubmission ? "awaiting_approval" : "awaiting_confirmation",
            
            // Timestamps
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            orderDate: new Date().toISOString(),
            
            // Payment details
            paymentStatus: isReviewSubmission ? "pending" : "completed",
            paymentMethod: paymentData.id.includes('SIMULATED') ? "simulated" : "paypal",
            paymentDetails: paymentData,
            isReviewSubmission: isReviewSubmission
        };
        
        console.log('Saving order to Firebase Firestore:', newOrder);
        
        // Save to Firestore
        const docRef = await addDoc(collection(db, "orders"), newOrder);
        console.log('✅ Order saved to Firebase! Document ID:', docRef.id);
        
        // Also save to localStorage for customer dashboard
        saveToLocalStorageBackup(newOrder, docRef.id, isReviewSubmission);
        
        // Show success message
        showOrderSuccessMessage(orderId, docRef.id, isReviewSubmission);
        
        return { orderId, firebaseId: docRef.id };
        
    } catch (error) {
        console.error('❌ Error saving order to Firebase:', error);
        
        // Fallback to localStorage
        alert('⚠️ Firebase connection failed. Saving order locally.');
        return saveToLocalStorageFallback(paymentData, designData, paymentAmount, isReviewSubmission);
    }
}

// Backup to localStorage - UPDATED
function saveToLocalStorageBackup(order, firebaseId, isReviewSubmission = false) {
    try {
        // Save to Firebase backup list
        let firebaseOrders = JSON.parse(localStorage.getItem('firebase_orders') || '[]');
        order.firebaseId = firebaseId;
        order.isReviewSubmission = isReviewSubmission;
        firebaseOrders.push(order);
        localStorage.setItem('firebase_orders', JSON.stringify(firebaseOrders));
        
        // Also save to customer dashboard localStorage
        const customerOrder = {
            id: order.paymentId || 'REVIEW_' + Date.now(),
            orderId: order.orderId,
            firebaseId: firebaseId,
            testAmount: order.testPaymentAmount || 0,
            calculatedPrice: order.totalPrice,
            design: {
                signageTypeDescription: order.signageType,
                dimensions: order.dimensions
            },
            paymentData: order.paymentDetails,
            date: order.orderDate,
            status: order.status,
            type: order.signageType,
            material: order.material,
            quantity: order.quantity,
            totalCost: order.totalPrice,
            paid: !isReviewSubmission,
            timestamp: Date.now(),
            isReviewSubmission: isReviewSubmission
        };
        
        // Save to testOrders for customer dashboard
        let testOrders = JSON.parse(localStorage.getItem('testOrders') || '[]');
        testOrders.push(customerOrder);
        localStorage.setItem('testOrders', JSON.stringify(testOrders));
        
        console.log('Order backed up to localStorage for customer dashboard');
        
        // Trigger event to notify customer dashboard if it's open
        window.dispatchEvent(new CustomEvent('newOrderSaved', { 
            detail: { orderId: order.orderId } 
        }));
        
    } catch (error) {
        console.error('Error backing up to localStorage:', error);
    }
}

// Fallback function - UPDATED
function saveToLocalStorageFallback(paymentData, designData, paymentAmount, isReviewSubmission = false) {
    try {
        console.log('Saving order to localStorage (fallback)...');
        
        let orders = JSON.parse(localStorage.getItem('testOrders') || '[]');
        const orderId = 'ORDER_' + Date.now();
        
        const newOrder = {
            id: paymentData.id,
            orderId: orderId,
            testAmount: paymentAmount,
            calculatedPrice: designData.totalCost,
            design: designData,
            paymentData: paymentData,
            date: new Date().toISOString(),
            status: isReviewSubmission ? 'pending_admin_review' : 'pending_admin',
            type: designData.signageTypeDescription,
            material: "Panaflex",
            quantity: 1,
            totalCost: designData.totalCost,
            paid: !isReviewSubmission,
            timestamp: Date.now(),
            isReviewSubmission: isReviewSubmission
        };
        
        orders.push(newOrder);
        localStorage.setItem('testOrders', JSON.stringify(orders));
        
        alert(`⚠️ Order saved locally (Firebase failed).\nOrder ID: ${orderId}`);
        
        return { orderId, firebaseId: null };
        
    } catch (error) {
        console.error('Error saving order to localStorage:', error);
        alert('❌ Error saving order. Please contact support.');
        return null;
    }
}

// Update success message to show Firebase ID - UPDATED
function showOrderSuccessMessage(orderId, firebaseId = null, isReviewSubmission = false) {
    const successModal = document.createElement('div');
    successModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10002;
    `;
    
    const reviewText = isReviewSubmission ? 
        `<p style="color: #28a745; font-weight: bold;">✓ Submitted for Admin Review (No Payment Required)</p>` :
        '';
    
    const firebaseInfo = firebaseId ? 
        `<p><strong>Firebase ID:</strong> ${firebaseId}</p>` : 
        `<p><strong>Note:</strong> Saved locally only</p>`;
    
    successModal.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 500px;
            width: 90%;
            text-align: center;
        ">
            <div style="font-size: 50px; color: green; margin-bottom: 20px;">✓</div>
            <h2 style="margin-top: 0; color: #333;">Order ${isReviewSubmission ? 'Submitted' : 'Created'} Successfully!</h2>
            ${reviewText}
            <p>Your signage design has been ${isReviewSubmission ? 'submitted for review' : 'submitted for production'}.</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Order ID:</strong> ${orderId}</p>
                ${firebaseInfo}
                <p><strong>Status:</strong> <span style="color: orange; font-weight: bold;">${isReviewSubmission ? 'Pending Admin Review' : 'Pending Admin Confirmation'}</span></p>
            </div>
            
            <p style="color: #666; font-size: 0.9em;">
                ${isReviewSubmission ? 
                    'The admin will review your design and contact you for payment confirmation.' :
                    'The admin will review your order shortly. You can track it in your dashboard.'
                }
            </p>
            
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 25px;">
                <button id="view-dashboard" style="
                    padding: 12px 24px;
                    background: #d00000;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                    flex: 1;
                ">
                    Go to Dashboard
                </button>
                <button id="close-success" style="
                    padding: 12px 24px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                    flex: 1;
                ">
                    Continue Designing
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(successModal);
    
    document.getElementById('view-dashboard').addEventListener('click', function() {
        window.location.href = 'customer-dashboard.html';
    });
    
    document.getElementById('close-success').addEventListener('click', function() {
        successModal.remove();
    });
}

// ---------------- NEW: SUBMIT DESIGN FOR REVIEW FUNCTION ----------------
function submitDesignForReview(designData) {
    console.log('Submitting design for review...');
    
    // Create a simulated payment data for review submission
    const reviewData = {
        id: 'REVIEW_SUBMISSION_' + Date.now(),
        status: 'SUBMITTED_FOR_REVIEW',
        create_time: new Date().toISOString(),
        isReviewSubmission: true
    };
    
    const paymentAmount = 0.00; // No payment for review submission
    
    // Save to Firebase as pending review
    saveTestOrderToDatabase(reviewData, designData, paymentAmount, true);
}

// ---------------- DRAG CONTROL SETUP ----------------
function enableDrag() {
    if (dragControls) {
        try { dragControls.deactivate(); } catch(e){}
        try { dragControls.dispose(); } catch(e){}
        dragControls = null;
    }

    if (!objects || objects.length === 0) return;

    dragControls = new THREE.DragControls(objects, camera, renderer.domElement);

    dragControls.addEventListener("dragstart", (event) => {
        if (controls) controls.enabled = false;
        
        if (event.object.userData && event.object.userData.isText) {
            selectTextMesh(event.object.parent);
        } else if (event.object.userData && event.object.userData.isImage) {
            selectImageMesh(event.object);
        } else {
            selectModel(event.object);
        }
    });

    dragControls.addEventListener("dragend", () => {
        if (controls) controls.enabled = true;
    });
}

// Initialize Three.js scene
function init() {
    const container = document.getElementById("viewer-container");
    if (!container) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 2, 8);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    renderer.domElement.addEventListener('click', onCanvasClick);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;

    createSelectionBoxes();

    window.addEventListener('resize', onWindowResize);

    render();
    setupEventListeners();
}

// ---------------- SELECTION BOXES ----------------
function createSelectionBoxes() {
    const modelBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
    selectionBox = new THREE.Mesh(modelBoxGeometry, highlightMaterial);
    selectionBox.visible = false;
    scene.add(selectionBox);

    const textBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
    textSelectionBox = new THREE.Mesh(textBoxGeometry, textHighlightMaterial);
    textSelectionBox.visible = false;
    scene.add(textSelectionBox);

    const imageBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
    imageSelectionBox = new THREE.Mesh(imageBoxGeometry, imageHighlightMaterial);
    imageSelectionBox.visible = false;
    scene.add(imageSelectionBox);
}

function updateSelectionBox(box, object) {
    if (!object || !box) return;
    
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    const padding = 0.1;
    box.scale.set(size.x + padding, size.y + padding, size.z + padding);
    box.position.copy(center);
    box.visible = true;
}

function hideSelectionBoxes() {
    if (selectionBox) selectionBox.visible = false;
    if (textSelectionBox) textSelectionBox.visible = false;
    if (imageSelectionBox) imageSelectionBox.visible = false;
}

// ---------------- OBJECT SELECTION ----------------
function onCanvasClick(event) {
    const mouse = new THREE.Vector2();
    const rect = renderer.domElement.getBoundingClientRect();
    
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    
    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        
        let textGroup = clickedObject;
        while (textGroup.parent && !textMeshes.includes(textGroup)) {
            textGroup = textGroup.parent;
        }
        
        if (textMeshes.includes(textGroup)) {
            selectTextMesh(textGroup);
            return;
        }
        
        if (clickedObject.userData && clickedObject.userData.isImage) {
            selectImageMesh(clickedObject);
            return;
        }
        
        if (clickedObject === currentModel || (currentModel && currentModel.children.includes(clickedObject))) {
            selectModel(currentModel);
            return;
        }
    }
    
    deselectAll();
}

function selectModel(model) {
    deselectAll();
    selectedModel = model;
    
    if (selectionBox && model) {
        updateSelectionBox(selectionBox, model);
    }
    
    updateModelPropertiesUI();
    console.log("Model selected");
}

function selectTextMesh(textMesh) {
    deselectAll();
    selectedTextMesh = textMesh;
    
    if (textSelectionBox && textMesh) {
        updateSelectionBox(textSelectionBox, textMesh);
    }
    
    updateTextPropertiesUI(textMesh);
    console.log("Text selected");
}

function selectImageMesh(imageMesh) {
    deselectAll();
    selectedImage = imageMesh;
    
    if (imageSelectionBox && imageMesh) {
        updateSelectionBox(imageSelectionBox, imageMesh);
    }
    
    updateImagePropertiesUI(imageMesh);
    console.log("Image selected");
}

function deselectAll() {
    hideSelectionBoxes();
    selectedModel = null;
    selectedTextMesh = null;
    selectedImage = null;
    resetPropertiesUI();
}

function updateModelPropertiesUI() {
    const shapeWidthSlider = document.getElementById("shape-width");
    const shapeHeightSlider = document.getElementById("shape-height");
    const shapeWidthValue = document.getElementById("shape-width-value");
    const shapeHeightValue = document.getElementById("shape-height-value");
    
    if (selectedModel && shapeWidthSlider && shapeHeightSlider) {
        shapeWidthSlider.value = selectedModel.scale.x;
        shapeHeightSlider.value = selectedModel.scale.y;
        if (shapeWidthValue) shapeWidthValue.textContent = selectedModel.scale.x.toFixed(1);
        if (shapeHeightValue) shapeHeightValue.textContent = selectedModel.scale.y.toFixed(1);
    }
}

function updateTextPropertiesUI(textMesh) {
    if (textMesh && currentModel) {
        const box = new THREE.Box3().setFromObject(currentModel);
        const center = box.getCenter(new THREE.Vector3());
        
        const textPosXSlider = document.getElementById("text-pos-x");
        const textPosYSlider = document.getElementById("text-pos-y");
        const fontSizeDropdown = document.getElementById("font-size");
        const fontFamilyDropdown = document.getElementById("font-family");
        
        if (textPosXSlider) {
            textPosX = textMesh.position.x - center.x;
            textPosXSlider.value = textPosX;
        }
        
        if (textPosYSlider) {
            textPosY = textMesh.position.y - center.y;
            textPosYSlider.value = textPosY;
        }
        
        if (fontSizeDropdown) {
            const scale = textMesh.scale.x;
            const fontSize = Math.round(scale * 24);
            fontSizeDropdown.value = fontSize;
        }
        
        if (fontFamilyDropdown && textMesh.userData.fontFamily) {
            fontFamilyDropdown.value = textMesh.userData.fontFamily;
        }
    }
}

function updateImagePropertiesUI(imageMesh) {
    const imageWidthSlider = document.getElementById("image-width");
    const imageHeightSlider = document.getElementById("image-height");
    const imageWidthValue = document.getElementById("image-width-value");
    const imageHeightValue = document.getElementById("image-height-value");
    
    if (imageMesh && imageWidthSlider && imageHeightSlider) {
        imageWidthSlider.value = imageMesh.scale.x;
        imageHeightSlider.value = imageMesh.scale.y;
        if (imageWidthValue) imageWidthValue.textContent = imageMesh.scale.x.toFixed(1);
        if (imageHeightValue) imageHeightValue.textContent = imageMesh.scale.y.toFixed(1);
    }
}

function resetPropertiesUI() {
    resetTextPropertiesUI();
    resetImagePropertiesUI();
    
    const shapeWidthSlider = document.getElementById("shape-width");
    const shapeHeightSlider = document.getElementById("shape-height");
    const shapeWidthValue = document.getElementById("shape-width-value");
    const shapeHeightValue = document.getElementById("shape-height-value");
    
    if (shapeWidthSlider) shapeWidthSlider.value = 1;
    if (shapeHeightSlider) shapeHeightSlider.value = 1;
    if (shapeWidthValue) shapeWidthValue.textContent = "1";
    if (shapeHeightValue) shapeHeightValue.textContent = "1";
}

function resetTextPropertiesUI() {
    const textPosXSlider = document.getElementById("text-pos-x");
    const textPosYSlider = document.getElementById("text-pos-y");
    const fontFamilyDropdown = document.getElementById("font-family");
    
    if (textPosXSlider) textPosXSlider.value = 0;
    if (textPosYSlider) textPosYSlider.value = 1;
    if (fontFamilyDropdown) fontFamilyDropdown.value = "helvetiker";
    
    textPosX = 0;
    textPosY = 1;
}

function resetImagePropertiesUI() {
    const imageWidthSlider = document.getElementById("image-width");
    const imageHeightSlider = document.getElementById("image-height");
    const imageWidthValue = document.getElementById("image-width-value");
    const imageHeightValue = document.getElementById("image-height-value");
    
    if (imageWidthSlider) imageWidthSlider.value = 1;
    if (imageHeightSlider) imageHeightSlider.value = 1;
    if (imageWidthValue) imageWidthValue.textContent = "1";
    if (imageHeightValue) imageHeightValue.textContent = "1";
}

// ---------------- TEXT CREATION ----------------
function getTextFromMesh(textMesh) {
    return textMesh.userData.originalText || "Text";
}

function getTextColorFromMesh(textMesh) {
    let color = "#ffffff";
    textMesh.traverse((child) => {
        if (child.isMesh && child.material && child.material.color) {
            color = `#${child.material.color.getHexString()}`;
        }
    });
    return color;
}

function changeTextFont(textMesh, newFontFamily) {
    if (!textMesh || !fontUrls[newFontFamily]) return;
    
    const text = getTextFromMesh(textMesh);
    const fontSize = parseInt(document.getElementById("font-size").value || 24);
    const color = getTextColorFromMesh(textMesh);
    const position = textMesh.position.clone();
    const scale = textMesh.scale.clone();
    
    scene.remove(textMesh);
    const textIndex = textMeshes.indexOf(textMesh);
    if (textIndex !== -1) textMeshes.splice(textIndex, 1);
    const objIndex = objects.indexOf(textMesh);
    if (objIndex !== -1) objects.splice(objIndex, 1);
    
    const fontUrl = fontUrls[newFontFamily];
    fontLoader.load(fontUrl, (font) => {
        createTextMeshWithProperties(font, text, newFontFamily, fontSize, color, position, scale);
    }, undefined, (error) => {
        console.error("Error loading font:", error);
    });
}

function createTextMeshWithProperties(font, text, fontFamily, fontSize, color, position, scale) {
    const lines = text.split("\n");
    const lineHeight = fontSize * 0.06;

    const group = new THREE.Group();
    group.userData.isText = true;
    group.userData.fontFamily = fontFamily;
    group.userData.originalText = text;

    lines.forEach((line, index) => {
        if (!line.trim()) return;
        
        const geometry = new THREE.TextGeometry(line, {
            font: font,
            size: fontSize * 0.05,
            height: 0.01,
            curveSegments: 12,
            bevelEnabled: false
        });

        geometry.computeBoundingBox();
        const textWidth = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
        const textHeight = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
        
        geometry.translate(-textWidth / 2, -textHeight / 2 - index * lineHeight, 0);

        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            transparent: true
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.isText = true;
        mesh.userData.originalText = line;
        group.add(mesh);
    });

    group.position.copy(position);
    group.scale.copy(scale);
    
    scene.add(group);
    textMeshes.push(group);
    objects.push(group);
    
    selectTextMesh(group);
    enableDrag();
    updateSaveResetButtonState();
}

function createTextMesh(font, text, fontFamily = null) {
    const fontSize = parseInt(document.getElementById("font-size").value || 24);
    const color = document.getElementById("font-color").value || "#ffffff";
    const selectedFontFamily = fontFamily || document.getElementById("font-family").value;

    const scale = new THREE.Vector3(1, 1, 1);
    const position = new THREE.Vector3(0, 0, 0);
    
    createTextMeshWithProperties(font, text, selectedFontFamily, fontSize, color, position, scale);
    
    const newText = textMeshes[textMeshes.length - 1];
    positionTextToAvoidOverlap(newText);
}

// ---------------- IMAGE UPLOAD AND MANAGEMENT ----------------
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
        alert('Please upload an image file (JPEG, PNG, GIF, etc.)');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        createImageMesh(e.target.result);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function createImageMesh(imageUrl) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageUrl, function(texture) {
        const aspectRatio = texture.image.width / texture.image.height;
        const geometry = new THREE.PlaneGeometry(aspectRatio, 1);
        const material = new THREE.MeshBasicMaterial({ 
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const imageMesh = new THREE.Mesh(geometry, material);
        imageMesh.userData.isImage = true;
        imageMesh.userData.originalTexture = texture;
        imageMesh.userData.aspectRatio = aspectRatio;
        
        positionImageToAvoidOverlap(imageMesh);
        
        scene.add(imageMesh);
        imageMeshes.push(imageMesh);
        objects.push(imageMesh);
        
        selectImageMesh(imageMesh);
        
        enableDrag();
        updateSaveResetButtonState();
    });
}

function positionImageToAvoidOverlap(newImageMesh) {
    if (!currentModel) return;

    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    
    newImageMesh.updateMatrixWorld(true);
    const newImageBounds = new THREE.Box3().setFromObject(newImageMesh);
    const newImageSize = newImageBounds.getSize(new THREE.Vector3());
    
    let bestPosition = { x: center.x, y: center.y };
    let hasOverlap = true;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (hasOverlap && attempts < maxAttempts) {
        hasOverlap = false;
        
        const allObjects = [...imageMeshes, ...textMeshes];
        for (const existingObject of allObjects) {
            if (existingObject === newImageMesh) continue;
            
            existingObject.updateMatrixWorld(true);
            const existingBounds = new THREE.Box3().setFromObject(existingObject);
            
            const candidateBounds = newImageBounds.clone();
            candidateBounds.translate(new THREE.Vector3(
                bestPosition.x - newImageMesh.position.x,
                bestPosition.y - newImageMesh.position.y,
                0
            ));
            
            if (candidateBounds.intersectsBox(existingBounds)) {
                hasOverlap = true;
                const signSize = box.getSize(new THREE.Vector3());
                bestPosition.x = center.x + (Math.random() - 0.5) * (signSize.x - newImageSize.x);
                bestPosition.y = center.y + (Math.random() - 0.5) * (signSize.y - newImageSize.y);
                break;
            }
        }
        
        attempts++;
    }
    
    newImageMesh.position.set(
        bestPosition.x,
        bestPosition.y,
        box.max.z + 0.001
    );
}

function resizeImage(width, height) {
    if (!selectedImage) return;
    
    selectedImage.scale.set(width, height, 1);
    
    if (imageSelectionBox && selectedImage) {
        updateSelectionBox(imageSelectionBox, selectedImage);
    }
}

function cropImage(cropX, cropY, cropWidth, cropHeight) {
    if (!selectedImage || !selectedImage.userData.originalTexture) return;
    
    const originalTexture = selectedImage.userData.originalTexture;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    
    ctx.drawImage(
        originalTexture.image,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
    );
    
    const croppedTexture = new THREE.CanvasTexture(canvas);
    selectedImage.material.map = croppedTexture;
    selectedImage.material.needsUpdate = true;
    
    const newAspectRatio = cropWidth / cropHeight;
    selectedImage.geometry.dispose();
    selectedImage.geometry = new THREE.PlaneGeometry(newAspectRatio, 1);
    selectedImage.userData.aspectRatio = newAspectRatio;
}

function deleteSelectedImage() {
    if (!selectedImage) return;
    
    scene.remove(selectedImage);
    
    const imageIndex = imageMeshes.indexOf(selectedImage);
    if (imageIndex !== -1) imageMeshes.splice(imageIndex, 1);
    
    const objIndex = objects.indexOf(selectedImage);
    if (objIndex !== -1) objects.splice(objIndex, 1);
    
    hideSelectionBoxes();
    selectedImage = null;
    
    enableDrag();
    updateSaveResetButtonState();
}

function clearAllImages() {
    imageMeshes.forEach(mesh => {
        scene.remove(mesh);
        const objIndex = objects.indexOf(mesh);
        if (objIndex !== -1) objects.splice(objIndex, 1);
    });
    
    imageMeshes = [];
    deselectAll();
    enableDrag();
    updateSaveResetButtonState();
}

// ---------------- SIMPLE CROPPING UI ----------------
function setupCroppingUI() {
    const cropModal = document.createElement('div');
    cropModal.id = 'crop-modal';
    cropModal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 1000;
        display: none;
    `;
    
    cropModal.innerHTML = `
        <h3 style="margin-top: 0;">Crop Image</h3>
        <div style="margin-bottom: 15px;">
            <label>Crop X: <input type="number" id="crop-x" value="0" min="0" style="width: 60px;"></label>
            <label style="margin-left: 10px;">Crop Y: <input type="number" id="crop-y" value="0" min="0" style="width: 60px;"></label>
        </div>
        <div style="margin-bottom: 15px;">
            <label>Width: <input type="number" id="crop-width" value="100" min="1" style="width: 60px;"></label>
            <label style="margin-left: 10px;">Height: <input type="number" id="crop-height" value="100" min="1" style="width: 60px;"></label>
        </div>
        <div>
            <button id="apply-crop" style="margin-right: 10px;">Apply Crop</button>
            <button id="cancel-crop">Cancel</button>
        </div>
    `;
    
    document.body.appendChild(cropModal);
    
    document.getElementById('apply-crop').addEventListener('click', function() {
        const cropX = parseInt(document.getElementById('crop-x').value);
        const cropY = parseInt(document.getElementById('crop-y').value);
        const cropWidth = parseInt(document.getElementById('crop-width').value);
        const cropHeight = parseInt(document.getElementById('crop-height').value);
        
        cropImage(cropX, cropY, cropWidth, cropHeight);
        cropModal.style.display = 'none';
    });
    
    document.getElementById('cancel-crop').addEventListener('click', function() {
        cropModal.style.display = 'none';
    });
    
    return cropModal;
}

function openCropModal() {
    if (!selectedImage) {
        alert('Please select an image first');
        return;
    }
    
    const cropModal = document.getElementById('crop-modal') || setupCroppingUI();
    cropModal.style.display = 'block';
    
    if (selectedImage.userData.originalTexture) {
        const texture = selectedImage.userData.originalTexture;
        document.getElementById('crop-width').value = texture.image.width;
        document.getElementById('crop-height').value = texture.image.height;
    }
}

function detectFrontFace(model) {
    if (!model) return;
    const box = new THREE.Box3().setFromObject(model);
    textFrontZ = box.max.z + 0.01;
}

function createFallbackGeometry() {
    const signGeometry = new THREE.BoxGeometry(4, 2, 0.2);
    const signMaterial = new THREE.MeshStandardMaterial({ color: 0x007bff });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.y = 1;

    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = -1.5;

    const fallbackModel = new THREE.Group();
    fallbackModel.add(sign);
    fallbackModel.add(pole);

    if (currentModel) {
        scene.remove(currentModel);
        const idx = objects.indexOf(currentModel);
        if (idx !== -1) objects.splice(idx, 1);
        currentModel = null;
    }

    currentModel = fallbackModel;
    scene.add(currentModel);
    objects.push(currentModel);
    enableDrag();
    detectFrontFace(currentModel);
}

const gltfLoader = new THREE.GLTFLoader();

function removeCurrentModelFromObjects() {
    if (!currentModel) return;
    const idx = objects.indexOf(currentModel);
    if (idx !== -1) objects.splice(idx, 1);
}

// ---------------- LOAD MODELS ----------------
function loadSquareSignage() {
    const path = "3d-customizer/square.glb";
    gltfLoader.load(
        path,
        (gltf) => {
            if (currentModel) {
                scene.remove(currentModel);
                removeCurrentModelFromObjects();
                currentModel = null;
            }

            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);
            model.position.y = 0;
            model.scale.set(1, 1, 1);
            scene.add(model);
            objects.push(model);
            currentModel = model;
            detectFrontFace(currentModel);
            enableDrag();
            updateSaveResetButtonState();
            
            selectModel(currentModel);
        },
        undefined,
        (err) => console.error("Failed to load square.glb:", err)
    );
}

function loadCircleSignage() {
    const path = "3d-customizer/circle.glb";
    gltfLoader.load(
        path,
        (gltf) => {
            if (currentModel) {
                scene.remove(currentModel);
                removeCurrentModelFromObjects();
                currentModel = null;
            }

            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);
            model.position.y = 0;
            model.scale.set(1, 1, 1);
            scene.add(model);
            objects.push(model);
            currentModel = model;
            detectFrontFace(currentModel);
            enableDrag();
            updateSaveResetButtonState();
            
            selectModel(currentModel);
        },
        undefined,
        (err) => console.error("Failed to load circle.glb:", err)
    );
}

// ---------------- SHAPE COLOR ----------------
const shapeColorPicker = document.getElementById("shape-color");
if (shapeColorPicker) {
    shapeColorPicker.addEventListener("input", () => {
        const newColor = shapeColorPicker.value;
        scene.traverse(obj => {
            if (obj.isMesh && obj.material && !obj.userData.isText && !obj.userData.isImage) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.color.set(newColor));
                } else {
                    obj.material.color.set(newColor);
                }
                obj.material.needsUpdate = true;
            }
        });
    });
}

// ---------------- POSITION TEXT TO AVOID OVERLAP ----------------
function positionTextToAvoidOverlap(newTextGroup) {
    if (!currentModel) return;

    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    
    newTextGroup.updateMatrixWorld(true);
    const newTextBounds = new THREE.Box3().setFromObject(newTextGroup);
    const newTextSize = newTextBounds.getSize(new THREE.Vector3());
    
    let bestPosition = { x: center.x, y: center.y + 1 };
    let hasOverlap = true;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (hasOverlap && attempts < maxAttempts) {
        hasOverlap = false;
        
        const allObjects = [...textMeshes, ...imageMeshes];
        for (const existingObject of allObjects) {
            if (existingObject === newTextGroup) continue;
            
            existingObject.updateMatrixWorld(true);
            const existingBounds = new THREE.Box3().setFromObject(existingObject);
            
            const candidateBounds = newTextBounds.clone();
            candidateBounds.translate(new THREE.Vector3(
                bestPosition.x - newTextGroup.position.x,
                bestPosition.y - newTextGroup.position.y,
                0
            ));
            
            if (candidateBounds.intersectsBox(existingBounds)) {
                hasOverlap = true;
                const signSize = box.getSize(new THREE.Vector3());
                bestPosition.x = center.x + (Math.random() - 0.5) * (signSize.x - newTextSize.x);
                bestPosition.y = center.y + (Math.random() - 0.5) * (signSize.y - newTextSize.y);
                break;
            }
        }
        
        attempts++;
    }
    
    newTextGroup.position.set(
        bestPosition.x,
        bestPosition.y,
        box.max.z + 0.001
    );
}

// ---------------- UPDATE TEXT POSITION ----------------
function updateTextPosition(mesh) {
    if (!mesh || !currentModel) return;

    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());

    mesh.position.set(
        center.x + textPosX,
        center.y + textPosY,
        box.max.z + 0.001
    );

    mesh.rotation.set(0, 0, 0);
}

// ---------------- CLEAR ALL TEXT FUNCTION ----------------
function clearAllText() {
    textMeshes.forEach(mesh => {
        scene.remove(mesh);
        const objIndex = objects.indexOf(mesh);
        if (objIndex !== -1) objects.splice(objIndex, 1);
    });
    
    textMeshes = [];
    deselectAll();
    enableDrag();
    updateSaveResetButtonState();
}

// ---------------- SAVE & RESET BUTTON STATE ----------------
function updateSaveResetButtonState() {
    const saveBtn = document.getElementById("save-design");
    const resetBtn = document.getElementById("reset-design");

    if (!saveBtn || !resetBtn) return;

    const shapeExists = currentModel !== null;
    const textExists = textMeshes.length > 0;
    const imageExists = imageMeshes.length > 0;

    if (shapeExists && (textExists || imageExists)) {
        saveBtn.style.backgroundColor = "#d00000";
        saveBtn.style.color = "#ffffff";
        resetBtn.style.backgroundColor = "#d00000";
        resetBtn.style.color = "#ffffff";
    } else {
        saveBtn.style.backgroundColor = "";
        saveBtn.style.color = "";
        resetBtn.style.backgroundColor = "";
        resetBtn.style.color = "";
    }
}

// ---------------- CLEAR SCENE ----------------
function clearScene() {
    objects.forEach(obj => scene.remove(obj));
    objects = [];

    textMeshes.forEach(mesh => scene.remove(mesh));
    textMeshes = [];

    imageMeshes.forEach(mesh => scene.remove(mesh));
    imageMeshes = [];

    currentModel = null;
    selectedModel = null;
    selectedTextMesh = null;
    selectedImage = null;

    hideSelectionBoxes();

    if (dragControls) {
        try { dragControls.deactivate(); } catch(e){}
        try { dragControls.dispose(); } catch(e){}
        dragControls = null;
    }

    updateSaveResetButtonState();
}

// ---------------- DELETE SELECTED TEXT ----------------
function deleteSelectedText() {
    if (!selectedTextMesh) return;
    
    scene.remove(selectedTextMesh);
    
    const textIndex = textMeshes.indexOf(selectedTextMesh);
    if (textIndex !== -1) textMeshes.splice(textIndex, 1);
    
    const objIndex = objects.indexOf(selectedTextMesh);
    if (objIndex !== -1) objects.splice(objIndex, 1);
    
    hideSelectionBoxes();
    selectedTextMesh = null;
    
    enableDrag();
    updateSaveResetButtonState();
}

// ---------------- QUOTATION GENERATION ----------------
function generateQuotation() {
    if (!currentModel) {
        alert("Please create a signage first by adding a square or circle.");
        return;
    }

    const shapeWidth = parseFloat(document.getElementById("shape-width").value) || 1;
    const shapeHeight = parseFloat(document.getElementById("shape-height").value) || 1;
    
    const area = shapeWidth * shapeHeight;
    const effectiveArea = Math.max(1, area);
    
    showSignageTypeModal(shapeWidth, shapeHeight, effectiveArea);
}

function showSignageTypeModal(width, height, area) {
    const modalHTML = `
        <div id="signageTypeModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        ">
            <div style="
                background: white;
                padding: 30px;
                border-radius: 10px;
                max-width: 500px;
                width: 90%;
            ">
                <h2 style="margin-top: 0; color: #333;">Select Signage Type</h2>
                
                <div style="margin-bottom: 20px;">
                    <p><strong>Dimensions:</strong> ${width.toFixed(1)} ft × ${height.toFixed(1)} ft</p>
                    <p><strong>Total Area:</strong> ${area.toFixed(2)} sq. ft.</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4>Single Face Panaflex</h4>
                    <label style="display: block; margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                        <input type="radio" name="signageType" value="single_without_light" checked>
                        <strong>Without Light</strong> - ₱500/sq.ft.
                    </label>
                    <label style="display: block; margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                        <input type="radio" name="signageType" value="single_with_light">
                        <strong>With Light</strong> - ₱700/sq.ft. (+₱200 for lighting)
                    </label>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4>Double Face Panaflex</h4>
                    <label style="display: block; margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                        <input type="radio" name="signageType" value="double_without_light">
                        <strong>Without Light</strong> - ₱800/sq.ft.
                    </label>
                    <label style="display: block; margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                        <input type="radio" name="signageType" value="double_with_light">
                        <strong>With Light</strong> - ₱1,000/sq.ft. (+₱200 for lighting)
                    </label>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancelSignageType" style="
                        padding: 10px 20px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Cancel</button>
                    <button id="calculateQuotation" style="
                        padding: 10px 20px;
                        background: #d00000;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Calculate Quotation</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    document.getElementById('cancelSignageType').addEventListener('click', function() {
        document.getElementById('signageTypeModal').remove();
    });
    
    document.getElementById('calculateQuotation').addEventListener('click', function() {
        const selectedType = document.querySelector('input[name="signageType"]:checked').value;
        document.getElementById('signageTypeModal').remove();
        calculateFinalQuotation(width, height, area, selectedType);
    });
    
    document.getElementById('signageTypeModal').addEventListener('click', function(e) {
        if (e.target.id === 'signageTypeModal') {
            this.remove();
        }
    });
}

function calculateFinalQuotation(width, height, area, signageType) {
    let pricePerSqFt;
    let typeDescription;
    
    switch(signageType) {
        case 'single_without_light':
            pricePerSqFt = 500;
            typeDescription = 'Single Face Panaflex (Without Light)';
            break;
        case 'single_with_light':
            pricePerSqFt = 700;
            typeDescription = 'Single Face Panaflex (With Light)';
            break;
        case 'double_without_light':
            pricePerSqFt = 800;
            typeDescription = 'Double Face Panaflex (Without Light)';
            break;
        case 'double_with_light':
            pricePerSqFt = 1000;
            typeDescription = 'Double Face Panaflex (With Light)';
            break;
        default:
            pricePerSqFt = 500;
            typeDescription = 'Single Face Panaflex (Without Light)';
    }
    
    let totalCost = area * pricePerSqFt;
    
    if (totalCost < pricePerSqFt) {
        totalCost = pricePerSqFt;
    }
    
    const textCount = textMeshes.length;
    const imageCount = imageMeshes.length;
    
    showFinalQuotationModal(width, height, area, typeDescription, textCount, imageCount, totalCost, signageType);
}

// ---------------- UPDATED QUOTATION MODAL WITH SUBMIT BUTTON ----------------
function showFinalQuotationModal(width, height, area, typeDescription, textCount, imageCount, totalCost, signageType) {
    const designData = {
        shapeType: currentModel ? getModelType() : 'Unknown',
        dimensions: { width, height, area },
        signageType: signageType,
        signageTypeDescription: typeDescription,
        textCount,
        imageCount,
        totalCost,
        actualPayment: 10.00,
        timestamp: new Date().toISOString()
    };
    
    let basePricePerSqFt;
    let lightingCost = 0;
    
    switch(signageType) {
        case 'single_without_light':
            basePricePerSqFt = 500;
            break;
        case 'single_with_light':
            basePricePerSqFt = 500;
            lightingCost = area * 200;
            break;
        case 'double_without_light':
            basePricePerSqFt = 800;
            break;
        case 'double_with_light':
            basePricePerSqFt = 800;
            lightingCost = area * 200;
            break;
    }
    
    const baseCost = area * basePricePerSqFt;
    
    const modalHTML = `
        <div id="quotationModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        ">
            <div style="
                background: white;
                padding: 30px;
                border-radius: 10px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <h2 style="margin-top: 0; color: #333; text-align: center;">Panaflex Signage Quotation</h2>
                
                <div style="margin-bottom: 20px; background: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <h4 style="margin-top: 0; color: #555;">Order Summary</h4>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span><strong>Signage Type:</strong></span>
                        <span style="text-align: right;">${typeDescription}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span><strong>Dimensions:</strong></span>
                        <span>${width.toFixed(1)} ft × ${height.toFixed(1)} ft</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span><strong>Total Area:</strong></span>
                        <span>${area.toFixed(2)} sq. ft.</span>
                    </div>
                    
                    <hr style="margin: 15px 0; border-color: #ddd;">
                    
                    <div style="margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>Base Price (${basePricePerSqFt}/sq.ft.):</span>
                            <span>₱${baseCost.toFixed(2)}</span>
                        </div>
                        
                        ${lightingCost > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>Lighting (+₱200):</span>
                            <span>₱${lightingCost.toFixed(2)}</span>
                    </div>
                    ` : ''}
                        
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #666;">
                            <span>Text Elements (${textCount}):</span>
                            <span>FREE</span>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #666;">
                            <span>Images (${imageCount}):</span>
                            <span>FREE</span>
                        </div>
                    </div>
                    
                    <hr style="margin: 15px 0; border-color: #ddd;">
                    
                    <div style="display: flex; justify-content: space-between; font-size: 1.3em; font-weight: bold; color: #d00000;">
                        <span>Calculated Price:</span>
                        <span>₱${totalCost.toFixed(2)}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; font-size: 1.1em; font-weight: bold; color: #28a745; margin-top: 10px; padding: 10px; background: #d4edda; border-radius: 5px;">
                        <span>TEST PAYMENT AMOUNT:</span>
                        <span>₱10.00</span>
                    </div>
                    
                    ${totalCost <= basePricePerSqFt ? `
                    <p style="color: #666; font-size: 0.9em; text-align: center; margin-top: 10px; background: #fff3cd; padding: 8px; border-radius: 4px;">
                        <em>Minimum price for ${typeDescription} applied</em>
                    </p>
                    ` : ''}
                    
                    <p style="color: #666; font-size: 0.9em; text-align: center; margin-top: 15px; background: #e7f3ff; padding: 10px; border-radius: 5px;">
                        <strong>⚠️ TEST MODE:</strong> You will only be charged <strong>₱10.00</strong> for testing purposes.
                    </p>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="closeQuotation" style="
                        padding: 12px 24px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        flex: 1;
                    ">Cancel</button>
                    <button id="submitQuotation" style="
                        padding: 12px 24px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: bold;
                        flex: 1;
                    ">
                        Submit for Review
                    </button>
                    <button id="confirmQuotation" style="
                        padding: 12px 24px;
                        background: #d00000;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: bold;
                        flex: 1;
                    ">
                        <i class="fab fa-paypal" style="margin-right: 8px;"></i>
                        Pay Test Amount (₱10.00)
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Event listeners for the three buttons
    document.getElementById('closeQuotation').addEventListener('click', function() {
        document.getElementById('quotationModal').remove();
    });
    
    // NEW: Submit for Review button
    document.getElementById('submitQuotation').addEventListener('click', function() {
        document.getElementById('quotationModal').remove();
        submitDesignForReview(designData);
    });
    
    // Existing: Pay Test Amount button
    document.getElementById('confirmQuotation').addEventListener('click', function() {
        document.getElementById('quotationModal').remove();
        setupPayPalPayment(designData);
    });
    
    document.getElementById('quotationModal').addEventListener('click', function(e) {
        if (e.target.id === 'quotationModal') {
            this.remove();
        }
    });
}

function getModelType() {
    if (!currentModel) return 'Unknown';
    
    const modelName = currentModel.name || '';
    if (modelName.toLowerCase().includes('square') || 
        document.getElementById('add-square').classList.contains('active')) {
        return 'Square Signage';
    } else if (modelName.toLowerCase().includes('circle') || 
               document.getElementById('add-circle').classList.contains('active')) {
        return 'Circle Signage';
    }
    return 'Custom Signage';
}

// ---------------- FIXED PAYPAL PAYMENT INTEGRATION ----------------
function setupPayPalPayment(designData) {
    console.log('Setting up PayPal payment...');
    
    loadPayPalSDK(function() {
        console.log('PayPal SDK loaded, proceeding with payment setup');
        setupPayPalPaymentInternal(designData);
    });
}

function setupPayPalPaymentInternal(designData) {
    const paymentAmount = 10.00;
    
    const existingContainer = document.getElementById('paypal-payment-container');
    if (existingContainer) existingContainer.remove();
    
    const paymentContainer = document.createElement('div');
    paymentContainer.id = 'paypal-payment-container';
    paymentContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10001;
    `;
    
    paymentContainer.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            text-align: center;
        ">
            <h2 style="margin-top: 0; color: #333;">Complete Test Payment</h2>
            
            <div style="margin-bottom: 20px;">
                <p><strong>Order Summary:</strong></p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Signage Type:</strong> ${designData.signageTypeDescription}</p>
                    <p><strong>Dimensions:</strong> ${designData.dimensions.width.toFixed(1)} ft × ${designData.dimensions.height.toFixed(1)} ft</p>
                    <p><strong>Calculated Price:</strong> ₱${designData.totalCost.toFixed(2)}</p>
                    <p style="font-size: 1.2em; font-weight: bold; color: #28a745; margin-top: 10px; padding: 10px;">
                        <strong>TEST PAYMENT AMOUNT:</strong> ₱${paymentAmount.toFixed(2)}
                    </p>
                </div>
            </div>
            
            <div id="paypal-button-container" style="margin: 20px 0; min-height: 100px;">
                <p>Loading payment options...</p>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                <button id="simulate-payment" style="
                    padding: 12px 24px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                ">
                    Simulate Test Payment (₱${paymentAmount.toFixed(2)})
                </button>
                
                <button id="cancel-payment" style="
                    padding: 12px 24px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                ">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(paymentContainer);
    
    document.getElementById('cancel-payment').addEventListener('click', function() {
        paymentContainer.remove();
    });
    
    document.getElementById('simulate-payment').addEventListener('click', function() {
        paymentContainer.remove();
        handleSuccessfulPayment({
            id: 'SIMULATED_PAYMENT_' + Date.now(),
            status: 'COMPLETED',
            create_time: new Date().toISOString()
        }, designData, paymentAmount);
    });
    
    renderPayPalButton(paymentAmount, designData);
}

function renderPayPalButton(paymentAmount, designData) {
    const container = document.getElementById('paypal-button-container');
    if (!container) return;
    
    if (typeof paypal === 'undefined') {
        container.innerHTML = `
            <div style="color: #666; text-align: center; padding: 20px;">
                <p>⚠️ PayPal integration unavailable</p>
                <p><small>Using simulated payment for testing</small></p>
            </div>
        `;
        return;
    }
    
    try {
        container.innerHTML = '';
        
        paypal.Buttons({
            style: {
                layout: 'vertical',
                color: 'blue',
                shape: 'rect',
                label: 'pay'
            },
            
            createOrder: function(data, actions) {
                console.log('Creating PayPal order for:', paymentAmount);
                return actions.order.create({
                    purchase_units: [{
                        description: `V.A. Erni's Signage - ${designData.signageTypeDescription}`,
                        amount: {
                            currency_code: "PHP",
                            value: paymentAmount.toFixed(2)
                        }
                    }]
                });
            },
            
            onApprove: function(data, actions) {
                console.log('Payment approved:', data);
                return actions.order.capture().then(function(details) {
                    console.log('Payment captured:', details);
                    
                    const paymentContainer = document.getElementById('paypal-payment-container');
                    if (paymentContainer) paymentContainer.remove();
                    
                    handleSuccessfulPayment(details, designData, paymentAmount);
                });
            },
            
            onError: function(err) {
                console.error('PayPal error:', err);
                container.innerHTML = `
                    <div style="color: red; text-align: center; padding: 20px;">
                        <p>❌ Payment Error</p>
                        <p><small>${err.message || 'Please try the simulated payment option'}</small></p>
                `;
            }
            
        }).render('#paypal-button-container');
        
    } catch (error) {
        console.error('Error rendering PayPal button:', error);
        container.innerHTML = `
            <div style="color: #666; text-align: center; padding: 20px;">
                <p>⚠️ Payment system error</p>
                <p><small>Please use the simulated payment option</small></p>
            </div>
        `;
    }
}

function handleSuccessfulPayment(paymentData, designData, paymentAmount) {
    console.log('Payment successful! Saving order...');
    
    // Save to Firebase (updated function)
    const result = saveTestOrderToDatabase(paymentData, designData, paymentAmount, false);
    
    if (result && result.orderId) {
        showOrderSuccessMessage(result.orderId, result.firebaseId, false);
    } else {
        // Fallback message
        const successModal = document.createElement('div');
        successModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10002;
        `;
        
        successModal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 10px;
                max-width: 400px;
                width: 90%;
                text-align: center;
            ">
                <div style="font-size: 50px; color: green; margin-bottom: 20px;">✓</div>
                <h2 style="margin-top: 0; color: #333;">Payment Successful!</h2>
                <p>Thank you for your test order.</p>
                <p><strong>Order saved locally.</strong></p>
                <button id="close-success" style="
                    padding: 10px 20px;
                    background: #d00000;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 20px;
                    font-size: 14px;
                ">Close</button>
            </div>
        `;
        
        document.body.appendChild(successModal);
        
        document.getElementById('close-success').addEventListener('click', function() {
            successModal.remove();
        });
    }
}

// ---------------- WINDOW RESIZE ----------------
function onWindowResize() {
    const container = document.getElementById("viewer-container");
    if (!container || !camera || !renderer) return;

    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// ---------------- EVENT LISTENERS ----------------
function setupEventListeners() {
    const addSquareBtn = document.getElementById('add-square');
    const addCircleBtn = document.getElementById('add-circle');
    const clearSceneBtn = document.getElementById('clear-scene');
    const resetDesignBtn = document.getElementById('reset-design');
    const addTextBtn = document.getElementById("add-text");
    const deleteTextBtn = document.getElementById("delete-text");
    const clearTextBtn = document.getElementById("clear-text");
    const textInput = document.getElementById("text-input");
    const fontSizeDropdown = document.getElementById("font-size");
    const fontFamilyDropdown = document.getElementById("font-family");
    const textColorPicker = document.getElementById("font-color");
    const textPosXSlider = document.getElementById("text-pos-x");
    const textPosYSlider = document.getElementById("text-pos-y");
    const shapeWidthSlider = document.getElementById("shape-width");
    const shapeHeightSlider = document.getElementById("shape-height");
    const shapeWidthValue = document.getElementById("shape-width-value");
    const shapeHeightValue = document.getElementById("shape-height-value");
    
    const imageUploadInput = document.getElementById("image-upload");
    const deleteImageBtn = document.getElementById("delete-image");
    const clearImagesBtn = document.getElementById("clear-images");
    const cropImageBtn = document.getElementById("crop-image");
    const imageWidthSlider = document.getElementById("image-width");
    const imageHeightSlider = document.getElementById("image-height");
    const imageWidthValue = document.getElementById("image-width-value");
    const imageHeightValue = document.getElementById("image-height-value");

    const generateQuotationBtn = document.getElementById('generate-quotation');
    if (generateQuotationBtn) {
        generateQuotationBtn.addEventListener('click', generateQuotation);
    }

    if (addSquareBtn) addSquareBtn.addEventListener('click', () => { loadSquareSignage(); updateSaveResetButtonState(); });
    if (addCircleBtn) addCircleBtn.addEventListener('click', () => { loadCircleSignage(); updateSaveResetButtonState(); });
    if (clearSceneBtn) clearSceneBtn.addEventListener('click', () => { clearScene(); });

    if (clearTextBtn) clearTextBtn.addEventListener('click', clearAllText);
    if (deleteTextBtn) deleteTextBtn.addEventListener('click', deleteSelectedText);

    if (imageUploadInput) imageUploadInput.addEventListener('change', handleImageUpload);
    if (deleteImageBtn) deleteImageBtn.addEventListener('click', deleteSelectedImage);
    if (clearImagesBtn) clearImagesBtn.addEventListener('click', clearAllImages);
    if (cropImageBtn) cropImageBtn.addEventListener('click', openCropModal);

    if (imageWidthSlider && imageHeightSlider) {
        function updateImageDimensions() {
            if (selectedImage) {
                const w = parseFloat(imageWidthSlider.value);
                const h = parseFloat(imageHeightSlider.value);
                resizeImage(w, h);
                if (imageWidthValue) imageWidthValue.textContent = w.toFixed(1);
                if (imageHeightValue) imageHeightValue.textContent = h.toFixed(1);
            }
        }
        imageWidthSlider.addEventListener("input", updateImageDimensions);
        imageHeightSlider.addEventListener("input", updateImageDimensions);
    }

    if (fontFamilyDropdown) {
        fontFamilyDropdown.addEventListener('change', () => {
            const selectedFont = fontFamilyDropdown.value;
            if (selectedTextMesh) {
                changeTextFont(selectedTextMesh, selectedFont);
            }
        });
    }

    if (resetDesignBtn) resetDesignBtn.addEventListener('click', () => {
        clearScene();
        if (textPosXSlider) textPosXSlider.value = 0;
        if (textPosYSlider) textPosYSlider.value = 1;
        if (shapeWidthSlider) shapeWidthSlider.value = 1;
        if (shapeHeightSlider) shapeHeightSlider.value = 1;
        if (shapeWidthValue) shapeWidthValue.textContent = 1;
        if (shapeHeightValue) shapeHeightValue.textContent = 1;
        if (imageWidthSlider) imageWidthSlider.value = 1;
        if (imageHeightSlider) imageHeightSlider.value = 1;
        if (imageWidthValue) imageWidthValue.textContent = 1;
        if (imageHeightValue) imageHeightValue.textContent = 1;
        if (fontFamilyDropdown) fontFamilyDropdown.value = "helvetiker";
    });

    if (shapeWidthSlider && shapeHeightSlider) {
        function updateShapeDimensions() {
            if (selectedModel) {
                const w = parseFloat(shapeWidthSlider.value);
                const h = parseFloat(shapeHeightSlider.value);
                selectedModel.scale.set(w, h, 1);
                if (shapeWidthValue) shapeWidthValue.textContent = w.toFixed(1);
                if (shapeHeightValue) shapeHeightValue.textContent = h.toFixed(1);
                
                if (selectionBox && selectedModel) {
                    updateSelectionBox(selectionBox, selectedModel);
                }
            }
        }
        shapeWidthSlider.addEventListener("input", updateShapeDimensions);
        shapeHeightSlider.addEventListener("input", updateShapeDimensions);
    }

    if (fontSizeDropdown) {
        fontSizeDropdown.addEventListener('change', () => {
            const selectedSize = parseInt(fontSizeDropdown.value);
            
            if (selectedTextMesh) {
                const scale = selectedSize / 24;
                selectedTextMesh.scale.set(scale, scale, scale);
                
                if (textSelectionBox && selectedTextMesh) {
                    updateSelectionBox(textSelectionBox, selectedTextMesh);
                }
            } else {
                const scale = selectedSize / 24;
                textMeshes.forEach(mesh => mesh.scale.set(scale, scale, scale));
            }
        });
    }

    if (textColorPicker) {
        textColorPicker.addEventListener('input', () => {
            if (selectedTextMesh) {
                selectedTextMesh.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.color.set(textColorPicker.value);
                    }
                });
            } else {
                textMeshes.forEach(mesh => {
                    mesh.traverse(child => {
                        if (child.isMesh && child.material) {
                            child.material.color.set(textColorPicker.value);
                        }
                    });
                });
            }
        });
    }

    if (addTextBtn && textInput) {
        addTextBtn.addEventListener("click", () => {
            const text = textInput.value.trim();
            if (!text) {
                alert("Please enter some text");
                return;
            }
            
            const fontFamily = document.getElementById("font-family").value;
            const fontUrl = fontUrls[fontFamily];
            
            if (!fontUrl) {
                console.error("Font not found:", fontFamily);
                alert("Selected font is not available");
                return;
            }
            
            fontLoader.load(fontUrl, 
                font => { 
                    createTextMesh(font, text, fontFamily); 
                },
                undefined,
                (error) => {
                    console.error("Error loading font:", error);
                    alert("Error loading font. Please try another font.");
                }
            );
        });
    }

    if (textInput) {
        textInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && e.ctrlKey) {
                e.preventDefault();

                const start = textInput.selectionStart;
                const end = textInput.selectionEnd;
                const value = textInput.value;

                textInput.value = value.slice(0, start) + "\n" + value.slice(end);
                textInput.selectionStart = textInput.selectionEnd = start + 1;

                const newText = textInput.value.trim();
                if (!newText) return;

                const fontFamily = document.getElementById("font-family").value;
                const fontUrl = fontUrls[fontFamily];

                if (!fontUrl) {
                    console.error("Font not found:", fontFamily);
                    alert("Selected font is not available");
                    return;
                }

                fontLoader.load(fontUrl, 
                    (font) => {
                        createTextMesh(font, newText, fontFamily);
                        updateSaveResetButtonState();
                    },
                    undefined,
                    (error) => {
                        console.error("Error loading font:", error);
                        alert("Error loading font. Please try another font.");
                    }
                );
            }
        });
    }

    if (textPosXSlider) textPosXSlider.addEventListener("input", () => {
        textPosX = parseFloat(textPosXSlider.value);
        if (selectedTextMesh) {
            updateTextPosition(selectedTextMesh);
            
            if (textSelectionBox && selectedTextMesh) {
                updateSelectionBox(textSelectionBox, selectedTextMesh);
            }
        } else {
            textMeshes.forEach(mesh => updateTextPosition(mesh));
        }
    });

    if (textPosYSlider) textPosYSlider.addEventListener("input", () => {
        textPosY = parseFloat(textPosYSlider.value);
        if (selectedTextMesh) {
            updateTextPosition(selectedTextMesh);
            
            if (textSelectionBox && selectedTextMesh) {
                updateSelectionBox(textSelectionBox, selectedTextMesh);
            }
        } else {
            textMeshes.forEach(mesh => updateTextPosition(mesh));
        }
    });

    window.addEventListener('focus', enableDrag);
}

// ---------------- RENDER LOOP ----------------
function render() {
    requestAnimationFrame(render);
    if (controls) controls.update();
    renderer.render(scene, camera);
}

function checkFontLoading() {
    console.log("Available fonts:", Object.keys(fontUrls));
}

checkFontLoading();

// Initialize
window.addEventListener('load', init);