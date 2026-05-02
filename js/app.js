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
        // --- THE BLIND CODE FIX ---
        if (inputCode) {
            // Check if ANY user exists with this familyId
            const familyCheck = await firebase.firestore()
                .collection("users")
                .where("familyId", "==", inputCode)
                .limit(1)
                .get();
            
            if (familyCheck.empty) {
                // Stop registration immediately if code is fake/typo
                throw new Error("Invalid Family Code. Please check for typos or leave it blank to create a new family group.");
            }
            familyId = inputCode;
        } else {
            // Generate new code only if input was intentionally left blank
            familyId = "FAM-" + Math.floor(10000 + Math.random() * 90000);
        }

        btn.innerText = "Creating Account...";
        
        // Proceed with Firebase Auth creation
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const userData = {
            name: name,
            email: email,
            role: role,
            familyId: familyId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

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
            window.location.href = 'caregiver-dashboard.html';
        }

    } catch (error) {
        console.error("Redirect Error:", error);
    }
}