// ------------------ FIREBASE INIT ------------------

const firebaseConfig = {
  apiKey: "AIzaSyAEw8RECWhK4HHkpgUF9_A423aRtWWoihk",
  authDomain: "cyclic-behavior-type-data.firebaseapp.com",
  projectId: "cyclic-behavior-type-data",
  storageBucket: "cyclic-behavior-type-data.firebasestorage.app",
  messagingSenderId: "266042564140",
  appId: "1:266042564140:web:c2db487fd1e60094f0fb89",
  measurementId: "G-L458F78KEN"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ------------------ GLOBAL STATE ------------------

let currentUser = null;
let cachedQuestions = [];
let responses = {};  // Will load previous submissions if exist

// ------------------ GOOGLE LOGIN ------------------

async function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        currentUser = result.user;
        console.log("Logged in:", currentUser.email);

        document.getElementById("login-page").style.display = "none";
        document.getElementById("quiz-container").style.display = "block";

        await loadExistingResponses();
        loadQuestions();
    } catch (err) {
        alert("Login failed: " + err.message);
    }
}

// Auto-login if user was already logged in previously
auth.onAuthStateChanged(async (user) => {
    if (user) {

        currentUser = user;
        console.log("Auth State Changed: Logged in as", user.email);

        // Hide login, show quiz
        document.getElementById("login-page").style.display = "none";
        document.getElementById("quiz-container").style.display = "block";

        // Load user data FIRST
        await loadExistingResponses();

        // THEN load the quiz
        if (cachedQuestions.length === 0) {
            await loadQuestions();
        }
    } else {
        console.log("Not logged in");
    }
});

// ------------------ LOAD PREVIOUS RESPONSES ------------------

async function loadExistingResponses() {
    const docRef = db.collection("responses").doc(currentUser.uid);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
        responses = docSnap.data().responses || {};
        document.getElementById("researcher-name").value = docSnap.data().name || "";
        console.log("Loaded previous responses.");
    } else {
        responses = {};
        console.log("No previous responses.");
    }
}

// ------------------ QUESTION LOADING (UNCHANGED) ------------------

async function loadQuestions() {
    const response = await fetch('questions.json');
    cachedQuestions = await response.json();
    renderPage(-1);
}

// (your entire renderPage(), plotting code, sliders, etc. stay EXACTLY the same)
// —————————— KEEP YOUR FULL ORIGINAL renderPage() CODE UNCHANGED ——————————

// ------------------ SAVE ANSWERS LOCALLY (UNCHANGED) ------------------

function saveAnswer(questionNumber) {
    const selectedBehavior = document.querySelector(`input[name="behavior_${questionNumber}"]:checked`);
    const slider = document.getElementById(`slider_${questionNumber}`);
    const stddevInput = document.getElementById(`stddev_${questionNumber}`);
    const commentInput = document.getElementById(`comments_${questionNumber}`);

    if (!responses[questionNumber]) responses[questionNumber] = {};

    if (selectedBehavior && selectedBehavior.value === "data not usable") {
        responses[questionNumber].behavior = "data not usable";
        responses[questionNumber].sliderValue = "";
        responses[questionNumber].standardDeviation = "";
    } else {
        responses[questionNumber].behavior = slider?.value || "";
        responses[questionNumber].sliderValue = slider?.value || "";
        responses[questionNumber].standardDeviation = stddevInput?.value || "";
    }

    responses[questionNumber].comments = commentInput?.value || "";
}

// ------------------ FIRESTORE SUBMIT ------------------

async function submitForm() {
    if (!currentUser) {
        alert("Please sign in first.");
        return;
    }

    const name = document.getElementById("researcher-name").value.trim();

    const payload = {
        uid: currentUser.uid,
        email: currentUser.email,
        name: name,
        responses: responses,
        submittedAt: new Date().toISOString()
    };

    try {
        await db.collection("responses").doc(currentUser.uid).set(payload);
        alert("Your responses have been saved!");
    } catch (err) {
        alert("Error saving responses: " + err.message);
    }
}

function navigatePage(index) {
    if (index >= 0 && index < cachedQuestions.length) renderPage(index);
    else if (index === -1) renderPage(-1);
    else if (index === -2) renderPage(-2);
}