// js/guard.js - THE ROUTE PROTECTOR
// This script ensures only authenticated and onboarded users can access clinical pages.

(function() {
    // 1. Initial Quick Check (Local Only)
    const localUser = JSON.parse(localStorage.getItem('currentUser'));
    const path = window.location.pathname;
    
    // Pages that DON'T need a guard
    const publicPages = ['login.html', 'register.html', 'index.html', 'onboarding.html'];
    const isPublic = publicPages.some(page => path.includes(page));

    if (!localUser && !isPublic) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Deep Firebase Verification
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            if (!isPublic) window.location.href = 'login.html';
            return;
        }

        // --- SMART CACHE OPTIMIZATION ---
        const CACHE_DURATION = 5 * 60 * 1000; // 5 Minutes
        const now = Date.now();
        const stored = JSON.parse(localStorage.getItem('currentUser'));

        // If we have a fresh cache, skip the Firestore read
        if (stored && stored.uid === user.uid && stored.lastFetched && (now - stored.lastFetched < CACHE_DURATION)) {
            return; // Trust the local state
        }

        // Fetch fresh profile data
        try {
            const doc = await firebase.firestore().collection('users').doc(user.uid).get();
            if (!doc.exists) {
                if (!isPublic) window.location.href = 'login.html';
                return;
            }

            const data = doc.data();

            // If it's a legacy user, they are always complete
            if (data.onboardingComplete === undefined && !isPublic) {
                 // Trigger legacy update if they logged in via a guarded page
                 await firebase.firestore().collection('users').doc(user.uid).update({
                    onboardingComplete: true,
                    isLegacyTestUser: true
                 });
                 return;
            }

            // Enforce onboarding unless they are already there or on a public page
            if (!data.onboardingComplete && !path.includes('onboarding.html') && !isPublic) {
                window.location.href = 'onboarding.html';
                return;
            }

            // Sync localStorage with fresh data and timestamp
            localStorage.setItem('currentUser', JSON.stringify({
                uid: user.uid,
                email: user.email,
                name: data.name || user.email,
                role: data.role,
                familyId: data.familyId,
                lastFetched: now // Track when this was fetched
            }));
            localStorage.setItem('userRole', data.role);

        } catch (e) {
            console.error("Guard Error:", e);
        }
    });
})();
