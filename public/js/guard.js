// js/guard.js

(function() {
    const localUser = JSON.parse(localStorage.getItem('currentUser'));
    const path = window.location.pathname;
    
    const publicPages = ['login.html', 'register.html', 'index.html', 'onboarding.html'];
    const isPublic = publicPages.some(page => path.includes(page));

    if (!localUser && !isPublic) {
        window.location.href = 'login.html';
        return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            if (!isPublic) window.location.href = 'login.html';
            return;
        }

        const CACHE_DURATION = 5 * 60 * 1000;
        const now = Date.now();
        const stored = JSON.parse(localStorage.getItem('currentUser'));

        if (stored && stored.uid === user.uid && stored.lastFetched && (now - stored.lastFetched < CACHE_DURATION)) {
            return;
        }

        try {
            const doc = await firebase.firestore().collection('users').doc(user.uid).get();
            if (!doc.exists) {
                if (!isPublic) window.location.href = 'login.html';
                return;
            }

            const data = doc.data();

            if (data.onboardingComplete === undefined && !isPublic) {
                 await firebase.firestore().collection('users').doc(user.uid).update({
                    onboardingComplete: true,
                    isLegacyTestUser: true
                 });
                 return;
            }

            if (!data.onboardingComplete && !path.includes('onboarding.html') && !isPublic) {
                window.location.href = 'onboarding.html';
                return;
            }

            localStorage.setItem('currentUser', JSON.stringify({
                uid: user.uid,
                email: user.email,
                name: data.name || user.email,
                role: data.role,
                familyId: data.familyId,
                photo: data.photo || null,
                lastFetched: now
            }));
            localStorage.setItem('userRole', data.role);

            const nameElem = document.getElementById('userName');
            const avatarElem = document.getElementById('userAvatar');
            if (nameElem) {
                nameElem.textContent = data.name || user.email.split('@')[0];
            }
            if (avatarElem) {
                if (data.photo) {
                    avatarElem.innerHTML = `<img src="${data.photo}" alt="U" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                } else {
                    avatarElem.textContent = (data.name || "U").charAt(0).toUpperCase();
                }
            }

        } catch (e) {
            console.error("Guard Error:", e);
        }
    });
})();
