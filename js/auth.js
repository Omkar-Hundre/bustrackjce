import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from './config/firebase-config.js';

class AuthService {
    constructor() {
        this.initializeListeners();
    }

    initializeListeners() {
        // Tab switching logic
        const tabBtns = document.querySelectorAll('.tab-btn');
        const forms = document.querySelectorAll('.auth-form');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                forms.forEach(f => f.classList.add('hidden'));
                
                btn.classList.add('active');
                document.getElementById(`${btn.dataset.tab}-login-form`).classList.remove('hidden');
            });
        });

        // Admin Login Form
        const adminForm = document.getElementById('admin-login-form');
        if (adminForm) {
            adminForm.addEventListener('submit', (e) => this.handleAdminLogin(e));
        }

        // Driver Login Form
        const driverForm = document.getElementById('driver-login-form');
        if (driverForm) {
            driverForm.addEventListener('submit', (e) => this.handleDriverLogin(e));
        }
    }

    async handleAdminLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        const loading = document.getElementById('loading');
        const errorMsg = document.getElementById('error-message');

        try {
            loading.classList.remove('hidden');
            errorMsg.style.display = 'none';

            // Sign in with Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            // Check if user is admin
            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                // Admin login successful
                window.location.href = 'admin.html';
            } else {
                // Not an admin
                await auth.signOut();
                throw new Error('Not authorized as admin');
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMsg.textContent = this.getErrorMessage(error);
            errorMsg.style.display = 'block';
        } finally {
            loading.classList.add('hidden');
        }
    }

    async handleDriverLogin(e) {
        e.preventDefault();
        
        const passcode = document.getElementById('driver-passcode').value;
        const loading = document.getElementById('loading');
        const errorMsg = document.getElementById('error-message');

        try {
            loading.classList.remove('hidden');
            errorMsg.style.display = 'none';

            // Query drivers collection
            const driversRef = collection(db, 'drivers');
            const q = query(driversRef, where("passcode", "==", passcode));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                throw new Error('Invalid passcode');
            }

            const driverDoc = querySnapshot.docs[0];
            const driverData = driverDoc.data();

            // Store driver info in session
            sessionStorage.setItem('driverId', driverDoc.id);
            sessionStorage.setItem('driverName', driverData.name);
            
            // Get assigned bus if any
            if (driverData.assignedBus) {
                sessionStorage.setItem('busId', driverData.assignedBus);
            }

            // Redirect to driver dashboard
            window.location.href = 'driver.html';
        } catch (error) {
            console.error('Login error:', error);
            errorMsg.textContent = this.getErrorMessage(error);
            errorMsg.style.display = 'block';
        } finally {
            loading.classList.add('hidden');
        }
    }

    getErrorMessage(error) {
        switch (error.code) {
            case 'auth/invalid-email':
                return 'Invalid email address';
            case 'auth/user-disabled':
                return 'This account has been disabled';
            case 'auth/user-not-found':
                return 'Email or password is incorrect';
            case 'auth/wrong-password':
                return 'Email or password is incorrect';
            default:
                return error.message || 'An error occurred during login';
        }
    }
}

// Create instance
const authService = new AuthService();
export { authService }; 
