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
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    if (password !== confirmPassword) {
        if (window.showToast) {
            showToast("Error", "Passwords do not match!", "error");
        } else {
            alert("Passwords do not match!");
        }
        return;
    }

    const btn = document.getElementById('regBtn');
    const originalText = btn.innerText;
    btn.innerText = "Creating Account...";
    btn.disabled = true;

    try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await firebase.firestore().collection("users").doc(user.uid).set({
            name: name,
            email: email,
            role: "pending",
            familyId: "pending",
            emailVerified: false,
            onboardingComplete: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await user.sendEmailVerification();

        if (window.showToast) {
            showToast("Account Created", "A verification email has been sent. Please check your inbox.", "success");
        } else {
            alert("Account Created! Please verify your email.");
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

        // 1. SAVE TO LOCALSTORAGE (Essential for services)
        localStorage.setItem('currentUser', JSON.stringify({
            uid: user.uid,
            email: user.email,
            name: userData.name || user.email,
            role: userData.role,
            familyId: userData.familyId
        }));
        localStorage.setItem('userRole', userData.role);

        // 2. LEGACY BYPASS: If user existed before these rules and has no onboarding status, mark them as legacy
        if (userData.onboardingComplete === undefined) {
            await firebase.firestore().collection('users').doc(user.uid).update({
                onboardingComplete: true,
                isLegacyTestUser: true
            });
            userData.onboardingComplete = true;
        }

        // 3. AUTH & ONBOARDING ROUTING
        if (!user.emailVerified) {
            // Optional: Allow them to see a "Please verify" message/page
            // window.location.href = 'verify-email.html'; 
        }

        if (!userData.onboardingComplete) {
            window.location.href = 'onboarding.html';
            return;
        }

        // 4. ROLE-BASED DASHBOARD REDIRECT
        if (userData.role === 'elder') {
            window.location.href = 'elder-dashboard.html';
        } else {
            window.location.href = 'caregiver-dashboard.html';
        }

    } catch (error) {
        console.error("Redirect Error:", error);
    }
}