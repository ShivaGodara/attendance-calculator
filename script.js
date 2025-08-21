document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const homePage = document.getElementById('home-page');
    const resultsPage = document.getElementById('results-page');
    const loadingOverlay = document.getElementById('loading-overlay');
    const aggregateSummary = document.getElementById('aggregate-summary');
    const aggregatePercentageDisplay = document.getElementById('aggregate-percentage');
    const aggregateStatusDisplay = document.getElementById('aggregate-status');
    const aggregateBunkSummary = document.getElementById('aggregate-bunk-summary');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const uploadAreaTimetable = document.getElementById('upload-area-timetable');
    const uploadAreaAttendance = document.getElementById('upload-area-attendance');
    const timetableUploadInput = document.getElementById('timetable-upload-input');
    const attendanceUploadInput = document.getElementById('attendance-upload-input');
    const timetableStatus = document.getElementById('timetable-status');
    const attendanceStatus = document.getElementById('attendance-status');
    const clearTimetableBtn = document.getElementById('clear-timetable-btn');
    const clearAttendanceBtn = document.getElementById('clear-attendance-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const subjectsContainer = document.getElementById('subjects-container');
    const bunkContainer = document.getElementById('bunk-cards-container');
    const addSubjectBtn = document.getElementById('add-subject-btn');
    const startOverBtn = document.getElementById('start-over-btn');
    const whatIfAttendedInput = document.getElementById('what-if-attended');
    const whatIfHeldInput = document.getElementById('what-if-held');
    const whatIfResult = document.getElementById('what-if-result');
    const settingsModal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const closeModal = document.querySelector('.close');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const endDateInput = document.getElementById('end-date');
    const goalPercentageInput = document.getElementById('goal-percentage');
    const aggregateGoalPercentageInput = document.getElementById('aggregate-goal-percentage');
    
    // --- State Variables ---
    let settings = {};
    let allSubjectsData = [];
    let uploadedTimetableFile = null;
    let uploadedAttendanceFile = null;
    
    // --- Page Navigation & State ---
    const showHomePage = () => {
        resultsPage.classList.add('hidden');
        homePage.classList.remove('hidden');
        handleTimetableFile(null);
        handleAttendanceFile(null);
    };
    const showResultsPage = () => {
        homePage.classList.add('hidden');
        resultsPage.classList.remove('hidden');
    };
    const checkUploads = () => {
        timetableStatus.textContent = uploadedTimetableFile ? uploadedTimetableFile.name : 'No file selected.';
        uploadAreaTimetable.classList.toggle('uploaded', !!uploadedTimetableFile);
        timetableStatus.classList.toggle('success', !!uploadedTimetableFile);
        clearTimetableBtn.classList.toggle('hidden', !uploadedTimetableFile);
        
        attendanceStatus.textContent = uploadedAttendanceFile ? uploadedAttendanceFile.name : 'No file selected.';
        uploadAreaAttendance.classList.toggle('uploaded', !!uploadedAttendanceFile);
        attendanceStatus.classList.toggle('success', !!uploadedAttendanceFile);
        clearAttendanceBtn.classList.toggle('hidden', !uploadedAttendanceFile);
        
        analyzeBtn.disabled = !(uploadedTimetableFile && uploadedAttendanceFile);
    };
    
    // --- Core Calculation & Projection Functions ---
    const runAllCalculations = () => {
        subjectsContainer.innerHTML = '';
        allSubjectsData.forEach(subject => {
            const card = createSubjectCardDOM(subject);
            subjectsContainer.appendChild(card);
            calculateAttendanceUI(card);
        });
        calculateAggregateAttendance();
        calculateWhatIf();
    };
    
    const calculateBunkPlanner = () => {
        if (!bunkContainer) return;
        bunkContainer.innerHTML = '';
        const goalPercentage = settings.goalPercentage || 75;
        const aggregateGoalPercentage = settings.aggregateGoalPercentage || 75;
        if (allSubjectsData.length === 0) {
            bunkContainer.innerHTML = '<p style="text-align:center; color:#606770;">No subjects to plan.</p>';
            return;
        }

        let totalEffectiveAttended = 0, totalHeld = 0, totalFutureClasses = 0;
        allSubjectsData.forEach(subject => {
            totalEffectiveAttended += subject.effectiveAttended || subject.attended;
            totalHeld += subject.total;
            totalFutureClasses += countFutureClasses(subject.name);
        });
        const aggregateBuffer = Math.floor((totalEffectiveAttended - (aggregateGoalPercentage / 100) * totalHeld) + totalFutureClasses * (1 - (aggregateGoalPercentage / 100)));
        
        aggregateBunkSummary.className = '';
        const aggregateBufferText = (aggregateBuffer >= 0) ? `<span style="color: var(--safe-color);">Can miss ${aggregateBuffer} total hr(s)</span>` : `<span style="color: var(--danger-color);">Cannot miss any more classes</span>`;
        aggregateBunkSummary.innerHTML = `For Aggregate Goal (${aggregateGoalPercentage}%): ${aggregateBufferText}`;
        aggregateBunkSummary.classList.add(aggregateBuffer >= 0 ? 'status-safe' : 'status-danger');

        allSubjectsData.forEach(subject => {
            const { name, total, effectiveAttended } = subject;
            const futureClasses = countFutureClasses(name);
            const perSubjectBuffer = Math.floor((effectiveAttended - (goalPercentage / 100) * total) + futureClasses * (1 - (goalPercentage / 100)));
            const bunkCard = document.createElement('div');
            bunkCard.className = 'bunk-card';
            const subjectBufferText = (perSubjectBuffer >= 0) ? `<span style="color: var(--safe-color);">${perSubjectBuffer} hr(s)</span>` : `<span style="color: var(--danger-color);">None</span>`;
            bunkCard.innerHTML = `<div class="bunk-card-subject">${name} (Goal: ${goalPercentage}%)</div><div class="bunk-card-status">${subjectBufferText}</div>`;
            bunkContainer.appendChild(bunkCard);
        });
        calculateWhatIf();
    };

    const calculateWhatIf = () => {
        let totalAttended = 0, totalHeld = 0;
        allSubjectsData.forEach(subject => {
            totalAttended += subject.effectiveAttended || subject.attended;
            totalHeld += subject.total;
        });
        const extraAttended = parseInt(whatIfAttendedInput.value, 10) || 0;
        const extraHeld = parseInt(whatIfHeldInput.value, 10) || 0;
        const whatIfAttended = totalAttended + extraAttended;
        const whatIfHeld = totalHeld + extraHeld;
        const aggregateGoal = settings.aggregateGoalPercentage || 75;
        const whatIfPercentage = whatIfHeld > 0 ? (whatIfAttended / whatIfHeld) * 100 : 0;
        let status = '', className = '';
        if (whatIfPercentage >= aggregateGoal) {
            status = `Goal of ${aggregateGoal}% is met.`;
            className = 'status-safe';
        } else {
            const neededHrs = Math.ceil(((aggregateGoal / 100) * whatIfHeld - whatIfAttended) / (1 - (aggregateGoal / 100)));
            status = `Need ${neededHrs} more attended classes to reach ${aggregateGoal}%.`;
            className = 'status-warning';
        }
        whatIfResult.className = '';
        whatIfResult.classList.add(className);
        whatIfResult.innerHTML = `<strong>New Aggregate: ${whatIfPercentage.toFixed(2)}%</strong><br>${status}`;
    };

    const countFutureClasses = (subjectName) => {
        // ... (This function is identical to the previous version)
    };
    
    const findDateForNthClass = (subjectName, neededClasses) => {
        // ... (This function is identical to the previous version)
    };

    const calculateAggregateAttendance = () => {
        // ... (This function is identical to the previous version)
    };

    const updateAggregateUI = (result) => {
        // ... (This function is identical to the previous version)
    };

    const calculateAttendanceUI = (card) => {
        const subjectName = card.dataset.subjectName;
        const subject = allSubjectsData.find(s => s.name === subjectName);
        if (!subject) return;

        const { total, effectiveAttended } = subject;
        const goalPercentage = settings.goalPercentage || 75;
        if (total <= 0) {
            updateCardUI(card, { percentage: 0, status: "Enter valid numbers.", className: '' });
            return;
        }
        const currentPercentage = (effectiveAttended / total) * 100;
        let status = '', className = '';
        if (currentPercentage >= goalPercentage) {
            status = `Per-subject goal met.`;
            className = 'status-safe';
        } else {
            const futureClasses = countFutureClasses(subjectName);
            const maxPossibleAttended = effectiveAttended + futureClasses;
            const maxPossibleTotal = total + futureClasses;
            const maxPossiblePercentage = maxPossibleTotal > 0 ? (maxPossibleAttended / maxPossibleTotal) * 100 : 0;
            if (maxPossiblePercentage < goalPercentage) {
                const goalAttended = Math.ceil((goalPercentage / 100) * maxPossibleTotal);
                const missedByHrs = goalAttended - maxPossibleAttended;
                status = `Missed target by ${missedByHrs} hr(s).`;
                className = 'status-danger';
            } else {
                const neededHrs = Math.ceil(((goalPercentage / 100) * total - effectiveAttended) / (1 - (goalPercentage / 100)));
                const projection = findDateForNthClass(subjectName, neededHrs);
                const formattedDate = projection.date ? projection.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
                status = `${neededHrs} more hrs needed. <br>Goal reached in ~${projection.days} days (${formattedDate})`;
                className = 'status-warning';
            }
        }
        updateCardUI(card, { percentage: currentPercentage, status, className });
    };
    
    const updateCardUI = (card, result) => {
        card.className = 'subject-card';
        if (result.className) card.classList.add(result.className);
        const resultDisplay = card.querySelector('.result-display');
        resultDisplay.innerHTML = `<div class="percentage">${result.percentage.toFixed(2)}%</div><div class="status-message">${result.status}</div>`;
    };

    const createSubjectCardDOM = (data) => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.dataset.subjectName = data.name;
        card.innerHTML = `<button class="remove-btn">&times;</button><div class="subject-grid"><div class="input-group"><label>Subject Name</label><input type="text" class="subject-name-input" value="${data.name}" readonly></div><div class="input-group"><label>Attended</label><input type="number" class="attended-input" value="${data.attended}"></div><div class="input-group"><label>Total Held</label><input type="number" class="total-input" value="${data.total}"></div></div><div class="result-display"><div class="status-message">Calculating...</div></div>`;
        
        const updateDataAndRecalculate = () => {
            const subject = allSubjectsData.find(s => s.name === data.name);
            if(subject){
                subject.attended = parseInt(card.querySelector('.attended-input').value, 10) || 0;
                subject.total = parseInt(card.querySelector('.total-input').value, 10) || 0;
                saveData();
                runAllCalculations();
            }
        };
        card.querySelector('.attended-input').addEventListener('input', updateDataAndRecalculate);
        card.querySelector('.total-input').addEventListener('input', updateDataAndRecalculate);
        
        card.querySelector('.remove-btn').addEventListener('click', () => { 
            allSubjectsData = allSubjectsData.filter(s => s.name !== data.name);
            card.remove(); 
            saveData();
            runAllCalculations();
        });
        return card;
    };
    
    const saveData = () => {
        localStorage.setItem('attendanceData', JSON.stringify(allSubjectsData));
    };

    const saveSettings = () => {
        const goalPercentage = parseInt(goalPercentageInput.value, 10) || 75;
        const aggregateGoalPercentage = parseInt(aggregateGoalPercentageInput.value, 10) || 75;
        settings = { 
            endDate: endDateInput.value, 
            goalPercentage, 
            aggregateGoalPercentage, 
            timetable: settings.timetable 
        };
        localStorage.setItem('attendanceSettings', JSON.stringify(settings));
        settingsModal.style.display = 'none';
        runAllCalculations();
        if (document.querySelector('.tab-link[data-tab="bunk"]').classList.contains('active')) {
            calculateBunkPlanner();
        }
    };

    const loadSettings = () => {
        // ... (This function is identical to the previous version)
    };

    const handleAnalysis = async () => {
        // ... (This function is identical to the previous version)
    };

    const analyzeImage = (file, endpoint, type) => {
        // ... (This function is identical to the previous version)
    };
    
    const analyzeMultipleImages = (files, endpoint, type) => {
        // ... (This function is identical to the previous version)
    };

    const fileToBase64 = (file) => {
        // ... (This function is identical to the previous version)
    };
    
    const handleTimetableFile = (file) => {
        // ... (This function is identical to the previous version)
    };
    
    const handleAttendanceFile = (file) => {
        // ... (This function is identical to the previous version)
    };

    // --- Event Listeners ---
    tabs.forEach(tab => {
        // ... (This logic is identical to the previous version)
    });
    // ... (All other event listeners for uploads, clicks, etc., are identical to the previous version)
    
    loadSettings();
    checkUploads();
});
</script>
