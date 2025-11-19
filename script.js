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

// ------------------ EMAIL-ONLY LOGIN (NO AUTH) ------------------

function generateFakeUID() {
    return "local_" + Math.random().toString(36).substr(2, 9) + Date.now();
}

async function emailOnlyLogin() {
    const email = document.getElementById("email-login").value.trim();
    const errorDiv = document.getElementById("email-error");

    // Basic email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        errorDiv.textContent = "Please enter a valid email address.";
        errorDiv.style.visibility = "visible";
        return;
    } else {
        errorDiv.style.visibility = "hidden";
    }

    // Create local-only user object
    currentUser = {
        email: email,
        uid: generateFakeUID(),
        isLocalUser: true
    };

    console.log("Email-only login:", currentUser);

    // Load previous responses
    await loadExistingResponsesByEmail(email);

    // SHOW QUIZ
    document.getElementById("login-page").style.display = "none";
    document.getElementById("quiz-container").style.display = "block";

    // Load questions if not loaded yet
    if (cachedQuestions.length === 0) {
        await loadQuestions();
    }
}

// Load previous email-only responses
async function loadExistingResponsesByEmail(email) {
    const snap = await db
        .collection("responses")
        .where("email", "==", email)
        .limit(1)
        .get();

    if (!snap.empty) {
        const data = snap.docs[0].data();
        responses = data.responses || {};

        // reuse old uid to keep consistency
        currentUser.uid = data.uid;

        document.getElementById("researcher-name").value = data.name || "";
        console.log("Loaded saved email-only responses.");
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
    console.log(`Navigating to index: ${index}`);
    if (index >= 0 && index < cachedQuestions.length) {
        renderPage(index);
    } else if (index === -1) {
        renderPage(-1);
    } else if (index === -2) {
        renderPage(-2);
    } else {
        console.error(`Invalid navigation request. Index: ${index}`);
    }
}

// ------------------ PAGE RENDERING (UNCHANGED EXCEPT LOADING) ------------------

function renderPage(index) {
    if (index === -1) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById('page-1').classList.add('active');
    } else if (index === -2) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById('last_page').classList.add('active');
    } else if (index >= 0 && index < cachedQuestions.length) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const container = document.getElementById('quiz-container');
        const question = cachedQuestions[index];
        container.querySelector('.dynamic-question')?.remove();

        const savedBehavior = responses[question.questionNumber]?.behavior || "";
        const savedComments = responses[question.questionNumber]?.comments || "";
        const savedSliderValue = responses[question.questionNumber]?.sliderValue || 0.5;
        const savedStdDev = responses[question.questionNumber]?.standardDeviation || 0.1;

        const questionDiv = document.createElement('div');
        questionDiv.className = 'page active dynamic-question';

        questionDiv.innerHTML = `
            <div class="question-header">
                <h2>Question ${question.questionNumber}/57</h2>
            </div>

            <div class="navigation-buttons">
                <button onclick="goToPage(${question.questionNumber}, 0)"
                        style="margin-left: 20px; background:#4CAF50; color:white;">
                    Go to First Question
                </button>

                <button onclick="goToPage(${question.questionNumber}, ${index - 1})"
                        ${index === 0 ? "disabled" : ""}>Back</button>

                <button onclick="goToPage(${question.questionNumber}, 
                        ${index === cachedQuestions.length - 1 ? -2 : index + 1})">
                    ${index === cachedQuestions.length - 1 ? "Submit Page" : "Next"}
                </button>

                <button onclick="goToPage(${question.questionNumber}, ${cachedQuestions.length - 1})"
                        style="margin-left: 20px; background:#4CAF50; color:white;">
                    Go to Last Question
                </button>
            </div>

            <div style="justify-items:center">
                <div class="image-container">

                    <div style="text-align:center; margin-bottom:10px;">
                        <select id="strain_select_${question.questionNumber}" class="strain-selector" style="position:static;">
                            <option value="3_Strain_Cycle">3% Strain</option>
                            <option value="4_Strain_Cycle">4% Strain</option>
                            <option value="5_Strain_Cycle">5% Strain</option>
                            <option value="6_Strain_Cycle">6% Strain</option>
                            <option value="Last_Cycle">Last Cycle</option>
                        </select>
                    </div>

                    <!-- ⭐ NEW RESIZABLE WRAPPER -->
                    <div class="resizable-wrapper"
                        style="display:inline-block; position:relative; resize:both; overflow:hidden; 
                                border:1px solid #ddd; width:450px; height:650px; margin-bottom:20px;">

                        <img id="strain_image_${question.questionNumber}"
                            src=""
                            alt="Strain Cycle Image"
                            style="width:100%; height:100%; object-fit:contain; display:none;">

                    </div>

                    <div id="missing_image_${question.questionNumber}"
                        style="display:none; color:#a00; font-size:18px; font-weight:bold; text-align:center; margin:20px;">
                    </div>

                </div>
            </div>

            <div style="display:flex; margin-top:-40px">
                <div class="multiple-choice" style="padding-left:10%">
                    <p>Please select the behavior type:</p>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <label>Clay-like (0.01)</label>
                        <input type="range" id="slider_${question.questionNumber}" min="0.01" max="0.99" step="0.01"
                            value="${savedSliderValue}"
                            ${savedBehavior === "data not usable" ? "disabled" : ""}>
                        <label>Sand-like (0.99)</label>
                    </div>

                    <p>Current Value: 
                        <input type="number" id="slider_input_${question.questionNumber}"
                            value="${savedSliderValue}" min="0.01" max="0.99" step="0.01"
                            style="width: 60px;"
                            ${savedBehavior === "data not usable" ? "disabled" : ""}>
                        <span id="mean_range_${question.questionNumber}" style="margin-left:10px; font-size: 14px; color: #888;"></span>
                    </p>

                    <label>
                        <input type="checkbox" name="behavior_${question.questionNumber}" value="data not usable"
                            ${savedBehavior === "data not usable" ? "checked" : ""}>
                        Data is not usable
                    </label>

                    <div style="margin-top:10px">
                        <label><b>Standard Deviation:</b></label>
                        <input type="number" id="stddev_${question.questionNumber}"
                            value="${savedStdDev}" min="0.01" step="0.01" style="width:100px;"
                            ${savedBehavior === "data not usable" ? "disabled" : ""}>
                        <span id="max_stddev_${question.questionNumber}" style="margin-left:10px; font-size: 14px; color: #888;"></span>
                    </div>
                </div>

                <div id="plot_${question.questionNumber}"
                    style="width:500px;height:300px;margin:30px;">
                </div>

                <div class="comments-section" style="margin-right: auto; width: 400px;">
                    <h3>Comments</h3>
                    <textarea id="comments_${question.questionNumber}" rows="5" placeholder="Enter your comments here...">${savedComments}</textarea>
                </div>
            </div>

            <div class="navigation-buttons" style="margin-top:-10px">
                <button onclick="goToPage(${question.questionNumber}); navigatePage(${index - 1})"
                        ${index === 0 ? 'disabled' : ''}>Back</button>
                <button onclick="goToPage(${question.questionNumber},
                        ${index === cachedQuestions.length - 1 ? -2 : index + 1})">
                    ${index === cachedQuestions.length - 1 ? "Submit Page" : "Next"}
                </button>
            </div>
        `;
        container.appendChild(questionDiv);

        const slider = document.getElementById(`slider_${question.questionNumber}`);
        const sliderInput = document.getElementById(`slider_input_${question.questionNumber}`);
        const stddevInput = document.getElementById(`stddev_${question.questionNumber}`);
        const radioButton = document.querySelector(`input[name="behavior_${question.questionNumber}"][value="data not usable"]`);

        const maxStdSpan = document.getElementById(`max_stddev_${question.questionNumber}`);

        const strainSelect = document.getElementById(`strain_select_${question.questionNumber}`);

        // Default selection = 3% strain (already selected)
        updateStrainImage(question.questionNumber, question.testNumber);

        // Change image automatically when the user selects a different strain
        strainSelect.addEventListener("change", () => {
            updateStrainImage(question.questionNumber, question.testNumber);
        });

        // ----- IMAGE UPDATE FUNCTION -----
        function updateStrainImage(qNum, testNum) {
            const strainFolder = document.getElementById(`strain_select_${qNum}`).value;
            const imgPath = `/images/${strainFolder}/Test_Number_${testNum}.png`;

            const imgEl = document.getElementById(`strain_image_${qNum}`);
            const msgEl = document.getElementById(`missing_image_${qNum}`);

            // Try loading the image
            imgEl.onload = function () {
                imgEl.style.display = "block";
                msgEl.style.display = "none";
            };

            imgEl.onerror = function () {
                imgEl.style.display = "none";
                msgEl.style.display = "block";
                msgEl.textContent = `${strainFolder.replace("_", " ").replace("_", " ")} is not available for this test`;
            };

            imgEl.src = imgPath;
        }

        function updateMaxStddevDisplay() {
            const mean = parseFloat(slider.value);
            if (!isNaN(mean) && mean > 0 && mean < 1) {
                const maxStdev = getMaxStd(mean);
                maxStdSpan.textContent = `(max: ${maxStdev.toFixed(3)})`;
                stddevInput.max = maxStdev.toFixed(3);

                const currentStd = parseFloat(stddevInput.value);
                if (!isNaN(currentStd) && currentStd > maxStdev) {
                    stddevInput.value = maxStdev.toFixed(3);  // auto-correct stddev
                }
            } else {
                maxStdSpan.textContent = "";
                stddevInput.removeAttribute("max");
            }
        }
 

        slider.addEventListener('input', () => (sliderInput.value = slider.value));
        sliderInput.addEventListener('input', () => (slider.value = sliderInput.value));
        slider.addEventListener('input', updateMaxStddevDisplay);
        sliderInput.addEventListener('input', updateMaxStddevDisplay);
        updateMaxStddevDisplay();  // call once on load
        
        radioButton.addEventListener('change', (event) => {
            const isDisabled = event.target.checked;
            slider.disabled = isDisabled;
            sliderInput.disabled = isDisabled;
            stddevInput.disabled = isDisabled;
        });

    slider.addEventListener('input', () => {
        sliderInput.value = slider.value;
        plotBeta(question.questionNumber);
    });

    sliderInput.addEventListener('input', () => {
        slider.value = sliderInput.value;
        plotBeta(question.questionNumber);
    });

    stddevInput.addEventListener('input', () => {
        plotBeta(question.questionNumber);
    });
    stddevInput.addEventListener('input', () => {
        const mean = parseFloat(slider.value);
        const maxStd = getMaxStd(mean);
        const enteredStd = parseFloat(stddevInput.value);
        if (!isNaN(enteredStd) && enteredStd > maxStd) {
            stddevInput.value = maxStd.toFixed(3);
        }
    });
    plotBeta(question.questionNumber);
    } else {
        console.error(`Invalid page index: ${index}`);
    }

}

function getMaxStd(mean) {
    let bestStd = 0;
    for (let alpha = 1.01; alpha <= 100; alpha += 0.05) {
        const beta = alpha * (1 - mean) / mean;
        if (beta <= 1) continue;
        const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
        const std = Math.sqrt(variance);
        if (std > bestStd) bestStd = std;
    }
    return bestStd;
}

function plotBeta(questionNumber) {
    const meanInput = document.getElementById(`slider_${questionNumber}`);
    const stddevInput = document.getElementById(`stddev_${questionNumber}`);
    const plotDiv = document.getElementById(`plot_${questionNumber}`);

    if (!meanInput || !stddevInput || !plotDiv) return;

    const mean = parseFloat(meanInput.value);
    const userStd = parseFloat(stddevInput.value);
    const maxStd = getMaxStd(mean);
    const stddev = Math.min(userStd, maxStd);

    if (isNaN(mean) || isNaN(stddev) || stddev <= 0 || mean <= 0 || mean >= 1) {
        // alert("Please provide a valid mean (0–1) and a positive standard deviation.");
        return;
    }
    
    const variance = stddev ** 2;

    // Compute alpha and beta parameters
    const common = (mean * (1 - mean) / variance - 1);
    const alpha = mean * common;
    const beta = (1 - mean) * common;

    if (alpha <= 1 || beta <= 1) {
        Plotly.newPlot(plotDiv, [{
            x: [0.5],
            y: [0.5],
            mode: 'text',
            text: [`Invalid parameters:<br>α = ${alpha.toFixed(2)}, β = ${beta.toFixed(2)}<br>Please adjust mean or std.`],
            textposition: 'middle center',
            type: 'scatter'
        }], {
            xaxis: { visible: false },
            yaxis: { visible: false },
            margin: { t: 10, r: 30 },
            showlegend: false
        });
        return;
    }

    const x = [];
    const y = [];

    for (let i = 0; i <= 1000; i++) {
        const xi = i / 1000;
        const yi = jStat.beta.pdf(xi, alpha, beta);
        x.push(xi);  // convert to percentage for plotting on 0–100 scale
        y.push(yi);
    }

    Plotly.newPlot(plotDiv, [
        {
            x: x,
            y: y,
            mode: 'lines',
            line: { color: 'black', width: 3 },
            name: `Beta PDF`,
        },
    ], {
        margin: { t: 5, r: 10 },
        xaxis: {
            title: 'Cyclic Behavior Type, CBT',
            range: [-0.05, 1.05],
            tickmode: 'linear',
            tick0: 0,
            dtick: 0.1  // or 5 for finer ticks
        },
        yaxis: {
                title: 'Density',
                range: [0, Math.max(...y) * 1.1]
            },
        legend: {
            title: {
                    text: `Mean: ${mean.toFixed(2)} | Std: ${stddev.toFixed(2)}<br>Alpha: ${alpha.toFixed(2)} | Beta: ${beta.toFixed(2)}` },
            x: -0.3,
            y: -0.5
        },
        showlegend: true
    });
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

    // single checkbox for "data not usable"
    const unusableCheckbox = document.querySelector(`input[name="behavior_${q}"]`);
    const slider = document.getElementById(`slider_${q}`);
    const std = document.getElementById(`stddev_${q}`);
    const com = document.getElementById(`comments_${q}`);

    const isUnusable = unusableCheckbox && unusableCheckbox.checked;

    if (isUnusable) {
        // data not usable case
        responses[q].behavior = "data not usable";
        responses[q].slider = "";
        responses[q].stddev = "";
    } else {
        // normal slider case
        responses[q].behavior = slider ? slider.value : "";
        responses[q].slider = slider ? slider.value : "";
        responses[q].stddev = std ? std.value : "";
    }

    responses[q].comments = com ? com.value : "";
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
        console.log("SUBMIT ATTEMPT UID:", currentUser.uid);
        await db.collection("responses").doc(currentUser.uid).set(payload);
        alert("Your responses have been saved!");

    } catch (error) {
        console.error("Firestore error:", error);
        alert("Error saving data: " + error.message);
    }
}

function goToPage(currentQuestionNumber, nextPageIndex) {
    // Save only if current question is valid
    if (currentQuestionNumber >= 1 && currentQuestionNumber <= 57) {
        saveAnswer(currentQuestionNumber);
    }
    navigatePage(nextPageIndex);
}

function downloadExcel() {
    if (!currentUser || !responses) {
        alert("Please submit responses first.");
        return;
    }

    // Create array for Excel
    const excelData = [];

    excelData.push(["Researcher Name", document.getElementById("researcher-name").value]);
    excelData.push(["Email", currentUser.email]);
    excelData.push([]);
    excelData.push(["Question #", "Behavior", "Slider", "Std Dev", "Comments"]);

    // Loop through each question
    Object.keys(responses).forEach(q => {
        excelData.push([
            q,
            responses[q].behavior || "",
            responses[q].slider || "",
            responses[q].stddev || "",
            responses[q].comments || ""
        ]);
    });

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Responses");

    // Generate file name
    const fileName = `responses_${currentUser.uid}.xlsx`;

    // Trigger download
    XLSX.writeFile(workbook, fileName);
}