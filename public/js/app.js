// js/app.js - UNIFIED AUTHENTICATION (Login & Register)

// ==========================================
// 1. LOGIN LOGIC
// ==========================================
async function login(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = event.target.querySelector('button');

    const originalText = btn.innerText;
    btn.innerText = "Signing in...";
    btn.disabled = true;

    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        await handleUserRedirect(userCredential.user); 
    } catch (error) {
        console.error(error);
        if (window.showToast) {
            showToast("Login Failed", error.message, "error");
        } else {
            alert("Login Failed: " + error.message);
        }
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ==========================================
// 2. REGISTRATION LOGIC
// ==========================================

async function registerUser(event) {
    event.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    const inputCode = document.getElementById('regFamilyCode').value.trim();
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    if (password !== confirmPassword) {
        if (window.showToast) {
            showToast("Error", "Passwords do not match!", "error");
        } else {
            alert("Passwords do not match!");
        }
        return;
    }
    
    // UI Feedback to prevent double-clicks during validation
    const btn = document.getElementById('regBtn');
    const originalText = btn.innerText;
    btn.innerText = "Verifying...";
    btn.disabled = true;

    let familyId = "";

    try {
        // --- SECURE FAMILY CODE LOGIC ---
        if (inputCode) {
            // Verify code against the 'families' registry
            const familyRef = firebase.firestore().collection("families").doc(inputCode);
            const familyDoc = await familyRef.get();
            
            if (!familyDoc.exists) {
                throw new Error("Invalid Family Code. Please check for typos or leave it blank to create a new family group.");
            }
            familyId = inputCode;
        } else {
            // Generate a unique family code
            familyId = "FAM-" + Math.floor(10000 + Math.random() * 90000);
            // We'll create this family document AFTER the user is created (due to security rules)
        }

        btn.innerText = "Creating Account...";
        
        // Proceed with Firebase Auth creation
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // If we generated a NEW family ID, create it now that we are authenticated
        if (!inputCode) {
            await firebase.firestore().collection("families").doc(familyId).set({
                createdBy: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        const userData = {
            name: name,
            email: email,
            role: role,
            familyId: familyId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Initialize Deficit Score for all caregiver roles
        if (role === 'caregiver' || role === 'primary_caregiver') {
            userData.deficitScore = 0;
        }

        if (role === 'elder') {
            userData.age = ""; 
            userData.conditions = "New Account";
            userData.photo = null;
        }

        await firebase.firestore().collection("users").doc(user.uid).set(userData);
        if (window.showToast) {
            showToast("Success", `Family Code: ${familyId}`, "success");
        } else {
            alert(`Success! Family Code: ${familyId}`);
        }
        await handleUserRedirect(user);

    } catch (error) {
        console.error(error);
        if (window.showToast) {
            showToast("Error", error.message, "error");
        } else {
            alert(error.message);
        }
    } finally {
        // Reset button state regardless of success or failure
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

// ==========================================
// 3. CENTRALIZED REDIRECT (The Brain)
// ==========================================

async function handleUserRedirect(user) {
    try {
        const doc = await firebase.firestore().collection("users").doc(user.uid).get();
        
        if (!doc.exists) {
            if (window.showToast) {
                showToast("Error", "User profile not found.", "error");
            } else {
                alert("User profile not found.");
            }
            return;
        }

        const userData = doc.data();

        // ✅ CRITICAL: Ensure familyId is saved so Services can use it immediately
        localStorage.setItem('currentUser', JSON.stringify({
            uid: user.uid,
            email: user.email,
            name: userData.name || user.email,
            role: userData.role,
            familyId: userData.familyId // This is what connects the profiles
        }));
        
        localStorage.setItem('userRole', userData.role);

        // Redirect based on role
        if (userData.role === 'elder') {
            window.location.href = 'elder-dashboard.html';
        } else {
            // Both caregiver and primary_caregiver go to the same dashboard
            window.location.href = 'caregiver-dashboard.html';
        }

    } catch (error) {
        console.error("Redirect Error:", error);
    }
}