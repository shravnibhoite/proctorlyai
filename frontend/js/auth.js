// Basic session management and protected routing
(function() {
    const user = JSON.parse(localStorage.getItem('proctorly_user'));
    const path = window.location.pathname;

    // Redirection logic
    if (!user && path !== '/' && path !== '/register') {
        window.location.href = "/";
    }

    if (user) {
        if (path === '/' || path === '/register') {
            window.location.href = user.role === 'admin' ? "/admin" : "/dashboard";
        }
        
        // Admin protection
        if (path === '/admin' && user.role !== 'admin') {
            window.location.href = "/dashboard";
        }
    }
})();

function logout() {
    // Select all Proctorly data to clear security history
    const keysToRemove = [];
    for(let i=0; i<localStorage.length; i++) {
        const key = localStorage.key(i);
        if(key && key.startsWith('proctorly_')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    
    window.location.href = "/";
}
