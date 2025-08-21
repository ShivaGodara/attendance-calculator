document.addEventListener('DOMContentLoaded', () => {
        // All element references
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

        let settings = {};
        let uploadedTimetableFile = null;
        let uploadedAttendanceFile = null;

        // --- UPDATED: Hardcoded Holiday Data ---
        const FIXED_HOLIDAYS = new Set([
            '2025-06-07', // Bakrid
            '2025-08-15', // Independence Day
            '2025-08-27', // Ganesh Chaturthi
            '2025-09-05', // Eid Milad
            '2025-10-01', // Maha Navami
            '2025-10-02', // Gandhi Jayanthi
            '2025-10-07', // Valmiki Jayanthi
            '2025-10-20', // Naraka Chaturdashi
            '2025-10-22', // Balipadyami
            '2025-11-01', // Kannada Rajyotsava
            '2025-11-08', // Kanakadasa Jayanthi
            '2026-03-20', // Ugadi
            '2026-03-21', // Idul Fitr
            '2026-03-31', // Mahavir Jayanthi
            '2026-04-03', // Good Friday
            '2026-04-14', // Dr Ambedkar Jayanthi
            '2026-04-20', // Basava Jayanthi
            '2026-05-01', // May Day
            '2026-05-27'  // Bakrid
        ]);

        // --- Helper function to check for the third Saturday ---
        const isThirdSaturday = (date) => {
            const dayOfMonth = date.getDate();
            const dayOfWeek = date.getDay(); // Sunday = 0, Saturday = 6
            return dayOfWeek === 6 && dayOfMonth >= 15 && dayOfMonth <= 21;
        };

        const isHoliday = (date) => {
            const dateString = date.toISOString().slice(0, 10); // Format as YYYY-MM-DD
            return FIXED_HOLIDAYS.has(dateString) || isThirdSaturday(date);
        };

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

        const calculateBunkPlanner = () => {
            if (!bunkContainer) return;
            bunkContainer.innerHTML = '';
            const subjectCards = document.querySelectorAll('.subject-card');
            const goalPercentage = settings.goalPercentage || 75;
            const aggregateGoalPercentage = settings.aggregateGoalPercentage || 75;
            if (subjectCards.length === 0) {
                bunkContainer.innerHTML = '<p style="text-align:center; color:#606770;">No subjects to plan.</p>';
                return;
            }
            let totalAttended = 0, totalHeld = 0, totalFutureClasses = 0;
            subjectCards.forEach(card => {
                totalAttended += parseInt(card.querySelector('.attended-input').value, 10) || 0;
                totalHeld += parseInt(card.querySelector('.total-input').value, 10) || 0;
                totalFutureClasses += countFutureClasses(card.querySelector('.subject-name-input').value);
            });
            const aggregateBuffer = Math.floor((totalAttended - (aggregateGoalPercentage / 100) * totalHeld) + totalFutureClasses * (1 - (aggregateGoalPercentage / 100)));
            aggregateBunkSummary.className = '';
            const aggregateBufferText = (aggregateBuffer >= 0) ? `<span style="color: var(--safe-color);">Can miss ${aggregateBuffer} total hr(s)</span>` : `<span style="color: var(--danger-color);">Cannot miss any more classes</span>`;
            aggregateBunkSummary.innerHTML = `For Aggregate Goal (${aggregateGoalPercentage}%): ${aggregateBufferText}`;
            aggregateBunkSummary.classList.add(aggregateBuffer >= 0 ? 'status-safe' : 'status-danger');
            subjectCards.forEach(card => {
                const subjectName = card.querySelector('.subject-name-input').value;
                const attended = parseInt(card.querySelector('.attended-input').value, 10) || 0;
                const total = parseInt(card.querySelector('.total-input').value, 10) || 0;
                const futureClasses = countFutureClasses(subjectName);
                const perSubjectBuffer = Math.floor((attended - (goalPercentage / 100) * total) + futureClasses * (1 - (goalPercentage / 100)));
                const bunkCard = document.createElement('div');
                bunkCard.className = 'bunk-card';
                const subjectBufferText = (perSubjectBuffer >= 0) ? `<span style="color: var(--safe-color);">${perSubjectBuffer} hr(s)</span>` : `<span style="color: var(--danger-color);">None</span>`;
                bunkCard.innerHTML = `<div class="bunk-card-subject">${subjectName} (Goal: ${goalPercentage}%)</div><div class="bunk-card-status">${subjectBufferText}</div>`;
                bunkContainer.appendChild(bunkCard);
            });
            calculateWhatIf();
        };

        const calculateWhatIf = () => {
            let totalAttended = 0, totalHeld = 0;
            document.querySelectorAll('.subject-card').forEach(card => {
                totalAttended += parseInt(card.querySelector('.attended-input').value, 10) || 0;
                totalHeld += parseInt(card.querySelector('.total-input').value, 10) || 0;
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
            if (!settings.endDate || !settings.timetable || !subjectName) return 0;
            let classCount = 0;
            const today = new Date();
            const endDate = new Date(settings.endDate);
            for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
                if (isHoliday(d)) continue; // Use the new holiday checker
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
                if (isHoliday(d)) continue; // Use the new holiday checker
                const dayName = d.toLocaleString('en-US', { weekday: 'long' });
                const classesToday = settings.timetable[dayName] || [];
                for (const subject of classesToday) {
                    if (subject.toUpperCase() === subjectName.toUpperCase()) classCount++;
                }
                if (classCount >= neededClasses) return { date: d, days: daysCount };
            }
            return { date: null, days: Infinity };
        };

        const calculateAggregateAttendance = () => {
            let totalAttended = 0, totalHeld = 0, totalFutureClasses = 0;
            document.querySelectorAll('.subject-card').forEach(card => {
                totalAttended += parseInt(card.querySelector('.attended-input').value, 10) || 0;
                totalHeld += parseInt(card.querySelector('.total-input').value, 10) || 0;
                totalFutureClasses += countFutureClasses(card.querySelector('.subject-name-input').value);
            });
            const aggregateGoal = settings.aggregateGoalPercentage || 75;
            const currentAggregatePercentage = totalHeld > 0 ? (totalAttended / totalHeld) * 100 : 0;
            let status = '', className = '';
            if (currentAggregatePercentage >= aggregateGoal) {
                status = `Aggregate criteria is met.`;
                className = 'status-safe';
            } else {
                const maxPossibleAttended = totalAttended + totalFutureClasses;
                const maxPossibleTotal = totalHeld + totalFutureClasses;
                const maxPossiblePercentage = maxPossibleTotal > 0 ? (maxPossibleAttended / maxPossibleTotal) * 100 : 0;
                if (maxPossiblePercentage < aggregateGoal) {
                    const goalAttended = Math.ceil((aggregateGoal / 100) * maxPossibleTotal);
                    const missedByHrs = goalAttended - maxPossibleAttended;
                    status = `Impossible. You missed the aggregate goal by ${missedByHrs} hr(s).`;
                    className = 'status-danger';
                } else {
                    const neededHrs = Math.ceil(((aggregateGoal / 100) * totalHeld - totalAttended) / (1 - (aggregateGoal / 100)));
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

        const calculateAttendance = (card) => {
            const attended = parseInt(card.querySelector('.attended-input').value, 10) || 0;
            const total = parseInt(card.querySelector('.total-input').value, 10) || 0;
            const subjectName = card.querySelector('.subject-name-input').value;
            const goalPercentage = settings.goalPercentage || 75;
            if (total <= 0) {
                updateCardUI(card, { percentage: 0, status: "Enter valid numbers.", className: '' });
                return;
            }
            const currentPercentage = (attended / total) * 100;
            let status = '', className = '';
            if (currentPercentage >= goalPercentage) {
                status = `Per-subject goal met.`;
                className = 'status-safe';
            } else {
                const futureClasses = countFutureClasses(subjectName);
                const maxPossibleAttended = attended + futureClasses;
                const maxPossibleTotal = total + futureClasses;
                const maxPossiblePercentage = maxPossibleTotal > 0 ? (maxPossibleAttended / maxPossibleTotal) * 100 : 0;
                if (maxPossiblePercentage < goalPercentage) {
                    const goalAttended = Math.ceil((goalPercentage / 100) * maxPossibleTotal);
                    const missedByHrs = goalAttended - maxPossibleAttended;
                    status = `Missed target by ${missedByHrs} hr(s).`;
                    className = 'status-danger';
                } else {
                    const neededHrs = Math.ceil(((goalPercentage / 100) * total - attended) / (1 - (goalPercentage / 100)));
                    const projection = findDateForNthClass(subjectName, neededHrs);
                    const formattedDate = projection.date ? projection.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
                    status = `${neededHrs} more hrs needed. <br>Goal reached in ~${projection.days} days (${formattedDate})`;
                    className = 'status-warning';
                }
            }
            updateCardUI(card, { percentage: currentPercentage, status, className });
            saveData();
            calculateAggregateAttendance();
            calculateWhatIf();
        };

        const updateCardUI = (card, result) => {
            card.className = 'subject-card';
            if (result.className) card.classList.add(result.className);
            const resultDisplay = card.querySelector('.result-display');
            resultDisplay.innerHTML = `<div class="percentage">${result.percentage.toFixed(2)}%</div><div class="status-message">${result.status}</div>`;
        };
        const createSubjectCard = (data = { name: '', attended: '', total: '' }) => {
            const card = document.createElement('div');
            card.className = 'subject-card';
            card.innerHTML = `<button class="remove-btn">&times;</button><div class="subject-grid"><div class="input-group"><label>Subject Name</label><input type="text" class="subject-name-input" value="${data.name}"></div><div class="input-group"><label>Attended</label><input type="number" class="attended-input" min="0" value="${data.attended}"></div><div class="input-group"><label>Total Held</label><input type="number" class="total-input" min="0" value="${data.total}"></div></div><div class="result-display"><div class="status-message">Enter values to calculate.</div></div>`;
            card.addEventListener('input', () => calculateAttendance(card));
            card.querySelector('.remove-btn').addEventListener('click', () => { card.remove(); saveData(); calculateAggregateAttendance(); calculateWhatIf(); });
            subjectsContainer.appendChild(card);
            if (data.attended || data.total) calculateAttendance(card);
        };
        const populateAllCards = (subjectsData) => {
            subjectsContainer.innerHTML = '';
            subjectsData.forEach(createSubjectCard);
            calculateAggregateAttendance();
            calculateWhatIf();
        };
        const saveData = () => {
            const subjects = Array.from(document.querySelectorAll('.subject-card')).map(card => ({ name: card.querySelector('.subject-name-input').value, attended: card.querySelector('.attended-input').value, total: card.querySelector('.total-input').value }));
            localStorage.setItem('attendanceData', JSON.stringify(subjects));
        };
        const saveSettings = () => {
            const goalPercentage = parseInt(goalPercentageInput.value, 10) || 75;
            const aggregateGoalPercentage = parseInt(aggregateGoalPercentageInput.value, 10) || 75;
            const timetable = settings.timetable || null;
            settings = {
                endDate: endDateInput.value,
                goalPercentage,
                aggregateGoalPercentage,
                timetable
            };
            localStorage.setItem('attendanceSettings', JSON.stringify(settings));
            settingsModal.style.display = 'none';
            document.querySelectorAll('.subject-card').forEach(calculateAttendance);
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
                localStorage.setItem('attendanceSettings', JSON.stringify(settings));
                const attendanceData = await analyzeImage(uploadedAttendanceFile, '/api/analyze-attendance', 'Attendance');
                populateAllCards(attendanceData);
                saveData();
                showResultsPage();
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
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { document.body.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false); });
        uploadAreaTimetable.addEventListener('drop', (e) => handleTimetableFile(e.dataTransfer.files[0]));
        uploadAreaAttendance.addEventListener('drop', (e) => handleAttendanceFile(e.dataTransfer.files[0]));
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            let imageFile = null;
            for (const item of items) { if (item.type.indexOf('image') !== -1) { imageFile = item.getAsFile(); break; } }
            if (!imageFile) return;
            if (!uploadedTimetableFile) { handleTimetableFile(imageFile); }
            else { handleAttendanceFile(imageFile); }
            e.preventDefault();
        });
        clearTimetableBtn.addEventListener('click', () => handleTimetableFile(null));
        clearAttendanceBtn.addEventListener('click', () => handleAttendanceFile(null));
        analyzeBtn.addEventListener('click', handleAnalysis);
        startOverBtn.addEventListener('click', showHomePage);
        addSubjectBtn.addEventListener('click', () => { createSubjectCard(); calculateAggregateAttendance(); });
        settingsBtn.addEventListener('click', () => { loadSettings(); settingsModal.style.display = 'block'; });
        closeModal.addEventListener('click', () => settingsModal.style.display = 'none');
        window.addEventListener('click', (e) => { if (e.target == settingsModal) settingsModal.style.display = 'none'; });
        saveSettingsBtn.addEventListener('click', saveSettings);
        whatIfAttendedInput.addEventListener('input', calculateWhatIf);
        whatIfHeldInput.addEventListener('input', calculateWhatIf);

        // --- Initial Load ---
        loadSettings();
        checkUploads();
    });
