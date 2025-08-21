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
    const uploadAreaLeaves = document.getElementById('upload-area-leaves');
    const timetableUploadInput = document.getElementById('timetable-upload-input');
    const attendanceUploadInput = document.getElementById('attendance-upload-input');
    const leavesUploadInput = document.getElementById('leaves-upload-input');
    const timetableStatus = document.getElementById('timetable-status');
    const attendanceStatus = document.getElementById('attendance-status');
    const leaveFilesList = document.getElementById('leave-files-list');
    const clearTimetableBtn = document.getElementById('clear-timetable-btn');
    const clearAttendanceBtn = document.getElementById('clear-attendance-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const addLeaveFileBtn = document.getElementById('add-leave-file-btn');
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
    let uploadedLeaveFiles = [];
    
    // --- Page Navigation & State ---
    const showHomePage = () => {
        resultsPage.classList.add('hidden');
        homePage.classList.remove('hidden');
        handleTimetableFile(null);
        handleAttendanceFile(null);
        uploadedLeaveFiles = [];
        checkUploads();
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
        
        leaveFilesList.innerHTML = '';
        if (uploadedLeaveFiles.length > 0) {
            const list = document.createElement('ul');
            uploadedLeaveFiles.forEach((file, index) => {
                const li = document.createElement('li');
                li.textContent = file.name;
                const removeBtn = document.createElement('button');
                removeBtn.textContent = '×';
                removeBtn.className = 'clear-btn';
                removeBtn.onclick = () => {
                    uploadedLeaveFiles.splice(index, 1);
                    checkUploads();
                };
                li.appendChild(removeBtn);
                list.appendChild(li);
            });
            leaveFilesList.appendChild(list);
        }

        analyzeBtn.disabled = !(uploadedTimetableFile && uploadedAttendanceFile);
    };

    // --- Holiday Calculation Logic ---
    const isThirdSaturday = (date) => (date.getDay() === 6 && date.getDate() >= 15 && date.getDate() <= 21);
    const isHoliday = (date) => (isThirdSaturday(date));

    // --- Core Calculation & Projection Functions ---
    const countFutureClasses = (subjectName) => {
        if (!settings.endDate || !settings.timetable || !subjectName) return 0;
        let classCount = 0;
        const today = new Date();
        const endDate = new Date(settings.endDate);
        for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
            if (isHoliday(d)) continue;
            const dayName = d.toLocaleString('en-US', { weekday: 'long' });
            const classesToday = settings.timetable[dayName] || [];
            for (const subject of classesToday) {
                if (subject.toUpperCase() === subjectName.toUpperCase()) classCount++;
            }
        }
        return classCount;
    };
    
    const findDateForNthClass = (subjectName, neededClasses) => {
        if (!settings.endDate || !settings.timetable || !subjectName || neededClasses <= 0) return { date: null, days: Infinity };
        let classCount = 0, daysCount = 0;
        const today = new Date();
        const endDate = new Date(settings.endDate);
        for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
            daysCount++;
            if (isHoliday(d)) continue;
            const dayName = d.toLocaleString('en-US', { weekday: 'long' });
            const classesToday = settings.timetable[dayName] || [];
            for (const subject of classesToday) {
                if (subject.toUpperCase() === subjectName.toUpperCase()) classCount++;
            }
            if (classCount >= neededClasses) return { date: d, days: daysCount };
        }
        return { date: null, days: Infinity };
    };

    // --- Main Calculation Orchestrator ---
    const runAllCalculations = () => {
        if (allSubjectsData.length === 0) return;

        let totalAttended = 0, totalHeld = 0, totalFutureClasses = 0;
        let totalCcLeaves = 0, totalMedicalLeaves = 0;
        
        allSubjectsData.forEach(subject => {
            totalAttended += subject.attended;
            totalHeld += subject.total;
            totalFutureClasses += countFutureClasses(subject.name);
            totalCcLeaves += subject.cc_leaves || 0;
            totalMedicalLeaves += subject.medical_leaves || 0;
        });

        const prelimFinalAttended = totalAttended + totalCcLeaves + totalFutureClasses;
        const prelimFinalTotal = totalHeld + totalFutureClasses;
        const prelimFinalPercent = prelimFinalTotal > 0 ? (prelimFinalAttended / prelimFinalTotal) * 100 : 0;

        const medicalLeavesAreValid = (prelimFinalPercent >= 75 && prelimFinalPercent <= 85);

        allSubjectsData.forEach(subject => {
            let effectiveAttended = subject.attended + (subject.cc_leaves || 0);
            if (medicalLeavesAreValid) {
                effectiveAttended += subject.medical_leaves || 0;
            }
            subject.effectiveAttended = effectiveAttended;
        });
        
        subjectsContainer.innerHTML = '';
        allSubjectsData.forEach(subject => {
            const card = createSubjectCardDOM(subject);
            subjectsContainer.appendChild(card);
            calculateAttendanceUI(card);
        });

        calculateAggregateAttendance();
        calculateWhatIf();
    };
    
    // --- UI Update & Calculation Functions ---
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

    const calculateAggregateAttendance = () => {
        let totalEffectiveAttended = 0, totalHeld = 0, totalFutureClasses = 0;
        allSubjectsData.forEach(subject => {
            totalEffectiveAttended += subject.effectiveAttended || subject.attended;
            totalHeld += subject.total;
            totalFutureClasses += countFutureClasses(subject.name);
        });

        const aggregateGoal = settings.aggregateGoalPercentage || 75;
        const currentAggregatePercentage = totalHeld > 0 ? (totalEffectiveAttended / totalHeld) * 100 : 0;
        let status = '', className = '';
        if (currentAggregatePercentage >= aggregateGoal) {
            status = `Aggregate criteria is met.`;
            className = 'status-safe';
        } else {
            const maxPossibleAttended = totalEffectiveAttended + totalFutureClasses;
            const maxPossibleTotal = totalHeld + totalFutureClasses;
            const maxPossiblePercentage = maxPossibleTotal > 0 ? (maxPossibleAttended / maxPossibleTotal) * 100 : 0;
            if (maxPossiblePercentage < aggregateGoal) {
                const goalAttended = Math.ceil((aggregateGoal / 100) * maxPossibleTotal);
                const missedByHrs = goalAttended - maxPossibleAttended;
                status = `Impossible. You missed the aggregate goal by ${missedByHrs} hr(s).`;
                className = 'status-danger';
            } else {
                const neededHrs = Math.ceil(((aggregateGoal / 100) * totalHeld - totalEffectiveAttended) / (1 - (aggregateGoal / 100)));
                status = `${neededHrs} total hours are needed to maintain the aggregate goal.`;
                className = 'status-warning';
            }
        }
        updateAggregateUI({ percentage: currentAggregatePercentage, status, className });
    };

    const updateAggregateUI = (result) => {
        aggregateSummary.className = '';
        if (result.className) aggregateSummary.classList.add(result.className);
        aggregatePercentageDisplay.textContent = `${result.percentage.toFixed(2)}%`;
        aggregateStatusDisplay.textContent = result.status;
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
        const savedSettings = JSON.parse(localStorage.getItem('attendanceSettings'));
        settings = savedSettings || { goalPercentage: 75, aggregateGoalPercentage: 75, timetable: null };
        goalPercentageInput.value = settings.goalPercentage || 75;
        aggregateGoalPercentageInput.value = settings.aggregateGoalPercentage || 75;
        endDateInput.value = settings.endDate || '';
    };

    const handleAnalysis = async () => {
        if (!uploadedTimetableFile || !uploadedAttendanceFile) return;
        loadingOverlay.style.display = 'flex';
        try {
            const timetableData = await analyzeImage(uploadedTimetableFile, '/api/analyze-timetable', 'Timetable');
            settings.timetable = timetableData;

            const subjectCodeMap = {};
            Object.values(timetableData).forEach(daySchedule => {
                daySchedule.forEach(subjectString => {
                    const parts = subjectString.split('\n');
                    if(parts.length === 2) {
                        subjectCodeMap[parts[1].trim()] = parts[0].trim();
                    }
                });
            });

            const attendanceData = await analyzeImage(uploadedAttendanceFile, '/api/analyze-attendance', 'Attendance');
            
            let leavesData = {};
            if (uploadedLeaveFiles.length > 0) {
                leavesData = await analyzeMultipleImages(uploadedLeaveFiles, '/api/analyze-leaves', 'Leaves');
            }

            allSubjectsData = attendanceData.map(subject => {
                const subjectCode = Object.keys(subjectCodeMap).find(code => subjectCodeMap[code] === subject.name);
                const subjectLeaves = leavesData[subjectCode] || { cc_leaves: 0, medical_leaves: 0 };
                return { ...subject, ...subjectLeaves };
            });

            saveData();
            showResultsPage();
            runAllCalculations();
        } catch (error) {
            alert(error.message);
        } finally {
            loadingOverlay.style.display = 'none';
        }
    };

    const analyzeImage = (file, endpoint, type) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Image = reader.result.split(',')[1];
                try {
                    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64Image, mimeType: file.type }) });
                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(`${type} analysis failed: ${err.details || err.error}`);
                    }
                    const data = await response.json();
                    resolve(data);
                } catch (error) { reject(error); }
            };
            reader.onerror = (error) => reject(new Error("Failed to read the file."));
        });
    };

    const analyzeMultipleImages = (files, endpoint, type) => {
        return new Promise(async (resolve, reject) => {
            try {
                const imagePayloads = await Promise.all(files.map(file => fileToBase64(file).then(b64 => ({ image: b64.split(',')[1], mimeType: file.type }))));
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ images: imagePayloads })
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(`${type} analysis failed: ${err.details || err.error}`);
                }
                const data = await response.json();
                resolve(data);
            } catch (error) {
                reject(error);
            }
        });
    };

    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
        });
    };
    
    const handleTimetableFile = (file) => {
        uploadedTimetableFile = file;
        timetableUploadInput.value = '';
        checkUploads();
    };
    const handleAttendanceFile = (file) => {
        uploadedAttendanceFile = file;
        attendanceUploadInput.value = '';
        checkUploads();
    };

    // --- Event Listeners ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.dataset.tab + '-content';
            tabContents.forEach(content => { content.classList.toggle('active', content.id === targetId); });
            if (tab.dataset.tab === 'bunk') {
                calculateBunkPlanner();
            }
        });
    });
    uploadAreaTimetable.addEventListener('click', (e) => { if (e.detail === 3) timetableUploadInput.click(); });
    timetableUploadInput.addEventListener('change', (e) => handleTimetableFile(e.target.files[0]));
    uploadAreaAttendance.addEventListener('click', (e) => { if (e.detail === 3) attendanceUploadInput.click(); });
    attendanceUploadInput.addEventListener('change', (e) => handleAttendanceFile(e.target.files[0]));
    addLeaveFileBtn.addEventListener('click', () => leavesUploadInput.click());
    leavesUploadInput.addEventListener('change', (e) => {
        for (const file of e.target.files) { uploadedLeaveFiles.push(file); }
        checkUploads();
    });
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { document.body.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false); });
    uploadAreaTimetable.addEventListener('drop', (e) => handleTimetableFile(e.dataTransfer.files[0]));
    uploadAreaAttendance.addEventListener('drop', (e) => handleAttendanceFile(e.dataTransfer.files[0]));
    uploadAreaLeaves.addEventListener('drop', (e) => {
        for (const file of e.dataTransfer.files) { uploadedLeaveFiles.push(file); }
        checkUploads();
    });
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        let imageFile = null;
        for (const item of items) { if (item.type.indexOf('image') !== -1) { imageFile = item.getAsFile(); break; } }
        if (!imageFile) return;
        if (!uploadedTimetableFile) { handleTimetableFile(imageFile); } 
        else if (!uploadedAttendanceFile) { handleAttendanceFile(imageFile); }
        else { uploadedLeaveFiles.push(imageFile); checkUploads(); }
        e.preventDefault();
    });
    clearTimetableBtn.addEventListener('click', () => handleTimetableFile(null));
    clearAttendanceBtn.addEventListener('click', () => handleAttendanceFile(null));
    analyzeBtn.addEventListener('click', handleAnalysis);
    startOverBtn.addEventListener('click', showHomePage);
    addSubjectBtn.addEventListener('click', () => { 
        const newSubjectName = prompt("Enter new subject name:");
        if (newSubjectName && !allSubjectsData.find(s => s.name === newSubjectName.toUpperCase())) {
            allSubjectsData.push({ name: newSubjectName.toUpperCase(), attended: 0, total: 0, cc_leaves: 0, medical_leaves: 0, effectiveAttended: 0 });
            runAllCalculations();
            saveData();
        }
    });
    settingsBtn.addEventListener('click', () => { loadSettings(); settingsModal.style.display = 'block'; });
    closeModal.addEventListener('click', () => settingsModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target == settingsModal) settingsModal.style.display = 'none'; });
    saveSettingsBtn.addEventListener('click', saveSettings);
    whatIfAttendedInput.addEventListener('input', calculateWhatIf);
    whatIfHeldInput.addEventListener('input', calculateWhatIf);

    loadSettings();
    checkUploads();
});
</script>
