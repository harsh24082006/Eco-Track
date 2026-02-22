document.addEventListener('DOMContentLoaded', function() {
    // --- View Selection ---
    const allViews = document.querySelectorAll('.view');
    const introView = document.getElementById('intro-view');
    const calculatorView = document.getElementById('calculator-view');
    const resultsView = document.getElementById('results-view');
    const historyView = document.getElementById('history-view');
    const loader = document.getElementById('loader');

    // --- Button Selection ---
    const startBtn = document.getElementById('start-btn');
    const recalculateBtn = document.getElementById('recalculate-btn');
    const introHistoryBtn = document.getElementById('intro-history-btn');
    const resultsHistoryBtn = document.getElementById('results-history-btn');
    const historyBackBtn = document.getElementById('history-back-btn');

    // --- Form-specific Elements ---
    const form = document.getElementById('carbon-form');
    const nextButtons = document.querySelectorAll('.btn-next');
    const prevButtons = document.querySelectorAll('.btn-prev');
    const formSteps = document.querySelectorAll('.form-step');
    const progressBar = document.getElementById('progress-bar');

    let currentStep = 0;
    let lastView = introView;
    let footprintChart = null;
    let historyChart = null;

    // --- Universal View Switcher ---
    function switchView(targetView) {
        const currentActiveView = document.querySelector('.view.active');
        if (currentActiveView) { lastView = currentActiveView; }
        allViews.forEach(view => view.classList.remove('active'));
        targetView.classList.add('active');
    }

    // --- EVENT LISTENERS ---
    startBtn.addEventListener('click', () => switchView(calculatorView));

    [introHistoryBtn, resultsHistoryBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            fetchAndShowHistory();
            switchView(historyView);
        });
    });

    historyBackBtn.addEventListener('click', () => switchView(lastView));

    recalculateBtn.addEventListener('click', () => {
        document.body.classList.remove('results-active');
        resetForm();
        switchView(calculatorView);
    });

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        if (validateStep(currentStep)) {
            switchView(loader);
            const footprintData = calculateFootprint();
            fetch('http://localhost:3000/api/footprint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(footprintData.forBackend)
            }).catch(error => console.error('Error connecting to server:', error));
            setTimeout(() => {
                displayResults(footprintData.total);
                switchView(resultsView);
                document.body.classList.add('results-active');
            }, 1500);
        }
    });

    nextButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (validateStep(currentStep)) {
                currentStep++;
                updateFormSteps();
                updateProgressBar();
            }
        });
    });

    prevButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentStep--;
            updateFormSteps();
            updateProgressBar();
        });
    });

    // --- HELPER FUNCTIONS ---

    function updateFormSteps() { formSteps.forEach((step, index) => step.classList.toggle('active', index === currentStep)); }

    function updateProgressBar() { if (progressBar) { const progress = ((currentStep + 1) / formSteps.length) * 100;
            progressBar.style.width = `${progress}%`; } }

    function validateStep(stepIndex) { let isValid = true; const currentStepFields = formSteps[stepIndex].querySelectorAll('input[required]');
        currentStepFields.forEach(input => { input.classList.remove('invalid'); const errorMessage = input.nextElementSibling; if (errorMessage && errorMessage.classList.contains('error-message')) { errorMessage.classList.remove('visible'); } if (!input.value.trim()) { isValid = false;
                input.classList.add('invalid'); if (errorMessage) errorMessage.classList.add('visible'); } }); return isValid; }

    async function fetchAndShowHistory() {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '<p class="no-history">Loading history...</p>';
        try {
            const response = await fetch('http://localhost:3000/api/history');
            if (!response.ok) throw new Error('Network response was not ok');
            const historyData = await response.json();

            if (historyData.length === 0) {
                historyList.innerHTML = '<p class="no-history">No past calculations found.</p>';
                if (historyChart) { historyChart.destroy();
                    historyChart = null; }
                const ctx = document.getElementById('history-chart').getContext('2d');
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                return;
            }
            historyList.innerHTML = '';
            historyData.forEach(item => {
                // THIS IS THE CORRECTED LINE
                const date = new Date(item.createdAt).toLocaleDateString('en-IN');
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `<div><div class="footprint">${item.totalFootprint.toFixed(2)} tonnes</div><div class="date">Calculated on ${date}</div></div>`;
                historyList.appendChild(historyItem);
            });
            displayHistoryChart(historyData);
        } catch (error) {
            console.error('Failed to fetch history:', error);
            historyList.innerHTML = '<p class="no-history">Could not connect to server to get history.</p>';
            if (historyChart) { historyChart.destroy();
                historyChart = null; }
        }
    }

    function displayHistoryChart(data) {
        const ctx = document.getElementById('history-chart').getContext('2d');
        if (historyChart) { historyChart.destroy(); }
        const reversedData = [...data].reverse();
        const barColors = ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)'];
        historyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: reversedData.map(item => new Date(item.createdAt).toLocaleDateString('en-IN')),
                datasets: [{
                    label: 'Total CO2e Footprint (in tonnes)',
                    data: reversedData.map(item => item.totalFootprint),
                    backgroundColor: barColors,
                    borderColor: barColors.map(color => color.replace('0.7', '1')),
                    borderWidth: 1,
                    borderRadius: 6,
                }]
            },
            options: { scales: { y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#f5f5f5' } }, x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#f5f5f5' } } }, plugins: { legend: { labels: { color: '#f5f5f5' } } } }
        });
    }

    function calculateFootprint() {
        const electricityBill = parseFloat(document.getElementById('electricity').value) || 0;
        const lpgCylinders = parseInt(document.getElementById('cylinders').value) || 0;
        const carDistance = parseFloat(document.getElementById('car-distance').value) || 0;
        const domesticFlights = parseInt(document.getElementById('domestic-flights').value) || 0;
        const internationalFlights = parseInt(document.getElementById('international-flights').value) || 0;
        const factors = { electricity: 0.71, lpg: 2.983, car: 0.17, domesticFlight: 0.133, internationalFlight: 0.102 };
        const assumptions = { electricityPrice: 7.5, lpgWeight: 14.2, domesticDistance: 1100, internationalDistance: 6000 };
        const electricityKwh = electricityBill / assumptions.electricityPrice;
        const footprints = { electricity: (electricityKwh * factors.electricity * 12) / 1000, lpg: (lpgCylinders * assumptions.lpgWeight * factors.lpg) / 1000, car: (carDistance * factors.car * 12) / 1000, domestic: (domesticFlights * assumptions.domesticDistance * factors.domesticFlight) / 1000, international: (internationalFlights * assumptions.internationalDistance * factors.internationalFlight) / 1000 };
        const totalFootprint = Object.values(footprints).reduce((sum, val) => sum + val, 0);
        return {
            total: { footprints, totalFootprint },
            forBackend: { electricityBill, lpgCylinders, carDistance, domesticFlights, internationalFlights, totalFootprint }
        };
    }

    function displayResults(data) {
        document.getElementById('total-footprint-value').textContent = data.totalFootprint.toFixed(2);
        const comparisonTextElement = document.getElementById('comparison-text');
        const indiaAverage = 1.9;
        if (data.totalFootprint < indiaAverage) {
            comparisonTextElement.textContent = `You're below the national average. Great job!`;
            comparisonTextElement.style.color = '#00e676';
        } else {
            comparisonTextElement.textContent = `You're above the national average. Let's see how we can improve.`;
            comparisonTextElement.style.color = '#ff8a80';
        }
        displayChart(Object.values(data.footprints).map(v => v.toFixed(2)));
        generateTips(data.footprints);
    }

    function displayChart(data) {
        const ctx = document.getElementById('footprint-chart').getContext('2d');
        if (!ctx) return;
        if (footprintChart) footprintChart.destroy();
        footprintChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Electricity', 'LPG', 'Car', 'Domestic Flights', 'International Flights'],
                datasets: [{ data: data, backgroundColor: ['#4caf50', '#ffeb3b', '#f44336', '#2196f3', '#9c27b0'], borderWidth: 0 }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#111111' }
                    }
                }
            }
        });
    }

    function generateTips(footprints) {
        const tipsList = document.getElementById('personalized-tips');
        if (!tipsList) return;
        tipsList.innerHTML = '';
        const maxContributor = Object.keys(footprints).reduce((a, b) => footprints[a] > footprints[b] ? a : b);
        const tips = { electricity: 'Switch to energy-efficient (5-star rated) appliances and use LED bulbs to save electricity.', lpg: 'Use a pressure cooker to cook faster and save gas. Explore options like induction stoves.', car: 'Consider using public transport or carpooling. Service your vehicle regularly for better mileage.', domestic: 'For shorter inter-city trips, trains are a much greener and more economical alternative to flights in India.', international: 'Choose direct flights to reduce emissions from takeoff and landing, and always pack light.' };
        const mainTipElement = document.createElement('li');
        mainTipElement.textContent = `Your highest impact is from ${maxContributor}. ${tips[maxContributor]}`;
        tipsList.appendChild(mainTipElement);
        const generalTipElement = document.createElement('li');
        generalTipElement.textContent = 'Adopting a more plant-based diet and reducing food waste can significantly cut your carbon footprint.';
        tipsList.appendChild(generalTipElement);
    }

    function resetForm() {
        form.reset();
        currentStep = 0;
        updateFormSteps();
        updateProgressBar();
        document.querySelectorAll('input.invalid').forEach(el => el.classList.remove('invalid'));
        document.querySelectorAll('.error-message.visible').forEach(el => el.classList.remove('visible'));
    }
});