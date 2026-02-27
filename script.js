// Firebase CDN imports (important for GitHub Pages)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB4wZzceKofQAiVeQMbrkTZBZLXcB9Z5OI",
  authDomain: "mrr-bhajan-finland.firebaseapp.com",
  projectId: "mrr-bhajan-finland",
  storageBucket: "mrr-bhajan-finland.firebasestorage.app",
  messagingSenderId: "913989931388",
  appId: "1:913989931388:web:c9be6b50f662ffe65394f9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Form submission
const form = document.getElementById("messageForm");
const successMessage = document.getElementById("successMessage");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const message = document.getElementById("message").value;

    try {
      await addDoc(collection(db, "messages"), {
        text: message,
        createdAt: new Date()
      });

      form.reset();
      successMessage.classList.remove("hidden");

    } catch (error) {
      alert("Error sending message: " + error.message);
    }
  });
}