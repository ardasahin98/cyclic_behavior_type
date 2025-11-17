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


// ------------------ GLOBAL ------------------
let currentUser = null;
let cachedQuestions = [];
let responses = {};


// ------------------ AUTH STATE LISTENER ------------------

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        console.log("Not logged in");

        document.getElementById("login-page").style.display = "block";
        document.getElementById("quiz-container").style.display = "none";
        return;
    }

    // User is logged in
    currentUser = user;
    console.log("Logged in:", user.email, "UID:", user.uid);

    // Show quiz
    document.getElementById("login-page").style.display = "none";
    document.getElementById("quiz-container").style.display = "block";

    // Load saved responses FIRST
    await loadExistingResponses();

    // Only load questions once
    if (cachedQuestions.length === 0) {
        await loadQuestions();
    }
});


// ------------------ GOOGLE LOGIN ------------------

async function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        const result = await auth.signInWithPopup(provider);
        console.log("Login successful:", result.user.email);

    } catch (error) {
        console.error("Login error:", error);
        alert("Google login failed: " + error.message);
    }
}


// ------------------ LOAD PREVIOUS RESPONSES ------------------

async function loadExistingResponses() {
    if (!currentUser) return;

    const docRef = db.collection("responses").doc(currentUser.uid);
    const snap = await docRef.get();

    if (snap.exists) {
        responses = snap.data().responses || {};
        const savedName = snap.data().name || "";
        document.getElementById("researcher-name").value = savedName;

        console.log("Loaded previous responses");
    } else {
        responses = {};
        console.log("No existing responses found");
    }
}


// ------------------ LOAD QUESTIONS ------------------

async function loadQuestions() {
    const response = await fetch("questions.json");
    cachedQuestions = await response.json();
    renderPage(-1);
}


// ------------------ PAGE NAVIGATION (UNCHANGED) ------------------

function navigatePage(index) {
    renderPage(index);
}


// ------------------ PAGE RENDERING (UNCHANGED EXCEPT LOADING) ------------------

function renderPage(index) {
    const pages = document.querySelectorAll(".page");
    pages.forEach((page) => page.classList.remove("active"));

    if (index === -1) {
        document.getElementById("page-1").classList.add("active");
        return;
    }

    if (index === cachedQuestions.length) {
        document.getElementById("last_page").classList.add("active");
        return;
    }

    const questionObj = cachedQuestions[index];
    const pageId = `question_page_${index}`;

    let pageDiv = document.getElementById(pageId);
    if (!pageDiv) {
        pageDiv = document.createElement("div");
        pageDiv.className = "page";
        pageDiv.id = pageId;
        document.getElementById("quiz-container").appendChild(pageDiv);

        pageDiv.innerHTML = `
            <div class="question-header">
                <h2>Question ${index + 1}</h2>
                <img src="${questionObj.image}" class="question-image">
            </div>

            <div class="behavior-options">
                <label><input type="radio" name="behavior_${index}" value="data not usable"> Data Not Usable</label>
                <label><input type="radio" name="behavior_${index}" value="slider"> Select Behavior Type</label>
            </div>

            <div id="slider_container_${index}" style="display:none">
                <input type="range" id="slider_${index}" min="0" max="1" step="0.01">
                <label>Std Dev:</label>
                <input type="number" id="stddev_${index}" step="0.01">
            </div>

            <textarea id="comments_${index}" placeholder="Comments"></textarea>

            <div class="navigation-buttons">
                <button onclick="navigatePage(${index - 1})">Back</button>
                <button onclick="saveAndNext(${index})">Next</button>
            </div>
        `;

        const radios = pageDiv.querySelectorAll(`input[name="behavior_${index}"]`);
        radios.forEach(r => r.addEventListener("change", () => updateSliderVisibility(index)));
    }

    loadSavedAnswer(index);
    pageDiv.classList.add("active");
}


// ------------------ SAVE & RESTORE ANSWERS ------------------

function updateSliderVisibility(q) {
    const selected = document.querySelector(`input[name="behavior_${q}"]:checked`);
    const div = document.getElementById(`slider_container_${q}`);
    div.style.display = (selected && selected.value === "slider") ? "block" : "none";
}

function saveAndNext(q) {
    saveAnswer(q);
    navigatePage(q + 1);
}

function saveAnswer(q) {
    if (!responses[q]) responses[q] = {};

    const behavior = document.querySelector(`input[name="behavior_${q}"]:checked`);
    const slider = document.getElementById(`slider_${q}`);
    const std = document.getElementById(`stddev_${q}`);
    const com = document.getElementById(`comments_${q}`);

    if (!behavior) return;

    if (behavior.value === "data not usable") {
        responses[q].behavior = "data not usable";
        responses[q].slider = "";
        responses[q].stddev = "";
    } else {
        responses[q].behavior = slider.value;
        responses[q].slider = slider.value;
        responses[q].stddev = std.value;
    }

    responses[q].comments = com.value;
}

function loadSavedAnswer(q) {
    if (!responses[q]) return;

    const r = responses[q];

    if (r.behavior === "data not usable") {
        document.querySelector(`input[name="behavior_${q}"][value="data not usable"]`).checked = true;
        updateSliderVisibility(q);
    } else {
        document.querySelector(`input[name="behavior_${q}"][value="slider"]`).checked = true;
        updateSliderVisibility(q);

        document.getElementById(`slider_${q}`).value = r.slider;
        document.getElementById(`stddev_${q}`).value = r.stddev;
    }

    document.getElementById(`comments_${q}`).value = r.comments || "";
}


// ------------------ SUBMIT TO FIRESTORE ------------------

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
        console.log("Saving to Firestore:", currentUser.uid);
        await db.collection("responses").doc(currentUser.uid).set(payload);
        alert("Your responses have been saved!");

    } catch (error) {
        console.error("Firestore error:", error);
        alert("Error saving data: " + error.message);
    }
}