const SUPABASE_URL = 'https://briqzyxfxsvulyizzbiu.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_go1nlzqVr9Q9FHvWXvZduQ_sPLWs2tn';

// We attach it to window so dashboard.js can see it
window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const mainBtn = document.getElementById('main-auth-btn');
    const toggleBtn = document.getElementById('toggle-auth-btn');
    const signupFields = document.getElementById('signup-fields');
    const authTitle = document.getElementById('auth-title');
    const logoutBtn = document.getElementById('logout-btn');
    const forgotPasswordBtn = document.getElementById('forgot-password-btn');
    const updatePasswordBtn = document.getElementById('update-password-btn');

    // FIX 2: Explicitly check the URL for the recovery hash right on load to prevent bypassing the reset screen
    let isRecoveringPassword = window.location.hash.includes('type=recovery');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isLogin = (mainBtn.innerText === 'LOGIN');
            signupFields.classList.toggle('hidden', !isLogin);
            mainBtn.innerText = isLogin ? 'SIGN UP' : 'LOGIN';
            authTitle.innerText = isLogin ? 'Account Registration' : 'Operations Login';
            toggleBtn.innerText = isLogin ? 'Back to Login' : 'Create Account';
        });
    }

    // --- MAIN LOGIN / SIGNUP LOGIC ---
    mainBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        if (!email || !password) {
            alert("Please enter both your email and password.");
            return;
        }

        const originalText = mainBtn.innerText;
        mainBtn.innerText = 'AUTHENTICATING...';
        mainBtn.disabled = true;

        if (originalText === 'SIGN UP') {
            const fullName = document.getElementById('user-name').value.trim();
            const { error } = await window._supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
            
            // Success text change for disabled email verification
            if (error) {
                alert("Signup Error: " + error.message);
            } else {
                alert("Success, you may log in now.");
                // Automatically switch back to the login view for them
                toggleBtn.click(); 
            }
        } else {
            const { error } = await window._supabase.auth.signInWithPassword({ email, password });
            if (error) alert("Login Error: " + error.message);
        }
        
        mainBtn.innerText = originalText;
        mainBtn.disabled = false;
    });

    // --- FORGOT PASSWORD LOGIC ---
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            
            if (!email) {
                alert("Please enter your email address in the field above first, then click 'Forgot Password?'.");
                return;
            }

            forgotPasswordBtn.innerText = 'SENDING LINK...';
            forgotPasswordBtn.disabled = true;

            // IMPROVEMENT: Added redirectTo to ensure GitHub Pages sub-folder compatibility
            const { error } = await window._supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'https://mjmelon.github.io/MJM-AI/'
            });
            
            if (error) {
                alert("Error: " + error.message);
            } else {
                alert("Password reset link sent! Please check your email inbox to reset your password.");
            }
            
            forgotPasswordBtn.innerText = 'FORGOT PASSWORD?';
            forgotPasswordBtn.disabled = false;
        });
    }

    // --- UPDATE PASSWORD LOGIC ---
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('new-password').value;

            if (!newPassword || newPassword.length < 6) {
                alert("Please enter a new password (minimum 6 characters).");
                return;
            }

            updatePasswordBtn.innerText = 'UPDATING...';
            updatePasswordBtn.disabled = true;

            const { error } = await window._supabase.auth.updateUser({ password: newPassword });

            if (error) {
                alert("Error updating password: " + error.message);
                updatePasswordBtn.innerText = 'SAVE NEW PASSWORD';
                updatePasswordBtn.disabled = false;
            } else {
                alert("Password updated successfully! Redirecting to dashboard...");
                isRecoveringPassword = false;
                // Clean the URL hash and reload cleanly to the login screen
                window.location.href = window.location.pathname; 
            }
        });
    }

    // --- AUTH STATE MONITORING ---
    window._supabase.auth.onAuthStateChange(async (event, session) => {
        const authSection = document.getElementById('auth-section');
        const dashboard = document.getElementById('dashboard');
        const chatBox = document.getElementById('chat-box');
        
        // POCKET TRIGGER FIX
        const pocketTrigger = document.getElementById('pocket-trigger');
        
        const standardFields = document.getElementById('standard-auth-fields');
        const recoveryFields = document.getElementById('recovery-auth-fields');

        if (event === 'PASSWORD_RECOVERY') {
            isRecoveringPassword = true;
        }

        if (isRecoveringPassword) {
            authSection.classList.remove('hidden');
            dashboard.classList.add('hidden');
            standardFields.classList.add('hidden');
            recoveryFields.classList.remove('hidden');
            document.getElementById('auth-title').innerText = 'Reset Password';
            
            if (pocketTrigger) pocketTrigger.classList.add('hidden');
            return; 
        }

        if (session) {
            authSection.classList.add('hidden');
            dashboard.classList.remove('hidden');
            
            // Show pocket safely only when authenticated
            if (pocketTrigger) pocketTrigger.classList.remove('hidden');

            if (logoutBtn) {
                logoutBtn.onclick = async () => {
                    window.__isLoggingOut = true; 
                    if(chatBox) chatBox.innerHTML = ''; 
                    localStorage.removeItem('mjm_chat_history'); 
                    await window._supabase.auth.signOut();
                    window.location.reload(); 
                };
            }
            
            if (chatBox && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
                const name = session.user.user_metadata?.full_name || ""; 
                const greeting = name.trim() !== "" ? `Hi ${name}, ` : "Hi, ";

                chatBox.innerHTML = `
                    <div class="bg-white/80 p-5 rounded-2xl rounded-tl-none border border-slate-200 max-w-[90%] text-slate-800 shadow-sm mb-4">
                        <strong>${greeting}I'm Elon, your MJM-AI Analyst.</strong><br><br>
                        I am now online and synchronized with your <strong>Data Bookshelf</strong>. 
                        How can I assist your operations today?
                    </div>
                    <div class="text-center text-[10px] text-slate-400 uppercase tracking-widest my-4">
                        — Uplink Secure • History Cleared —
                    </div>`;
                
                if (window.loadBookshelf) window.loadBookshelf();
            }
        } else {
            authSection.classList.remove('hidden');
            dashboard.classList.add('hidden');
            
            // Strictly hide the pocket folder from the login page
            if (pocketTrigger) pocketTrigger.classList.add('hidden');
        }
    });
});
