const canvas = document.getElementById("routeCanvas");
const ctx = canvas.getContext("2d");

let convergenceChart;
let points = [];
let benchmarkResults = [];
let isRunning = false;
let isComparing = false;
let initialRoute = [];
let route = [];

const generateBtn = document.getElementById("generateBtn");
const startBtn = document.getElementById("startBtn");
const compareBtn = document.getElementById("compareBtn");
const resetBtn = document.getElementById("resetBtn");

/* =========================================
   CANVAS RESIZING & HUD LAYOUT
========================================= */

function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    drawRoute();
}

window.addEventListener("resize", resizeCanvas);

/* =========================================
   STATE MANAGEMENT
========================================= */

function setSimulationState(state) {
    const statusIndicator = document.getElementById("statusIndicator");
    const statusText = document.getElementById("statusText");
    const canvasBadge = document.getElementById("canvasBadge");
    
    const controls = [
        document.getElementById("pointCount"),
        document.getElementById("algorithm"),
        document.getElementById("temperature"),
        document.getElementById("saCoolingRate"),
        document.getElementById("saMaxIterations"),
        document.getElementById("populationSize"),
        document.getElementById("mutationRate"),
        document.getElementById("generations"),
        generateBtn,
        startBtn,
        compareBtn
    ];

    // Reset status classes
    statusIndicator.className = "status-indicator";

    if (state === "idle") {
        isRunning = false;
        statusIndicator.classList.add("idle");
        statusText.textContent = "System Ready";
        canvasBadge.textContent = route.length > 0 ? `${route.length} Points Ready` : "Empty Map";
        controls.forEach(control => {
            if (control) control.disabled = false;
        });
    } else if (state === "running") {
        isRunning = true;
        statusIndicator.classList.add("running");
        const selectedAlgorithm = document.getElementById("algorithm").value;
        statusText.textContent = `Running: ${selectedAlgorithm}`;
        canvasBadge.textContent = "Optimizing Route...";
        controls.forEach(control => {
            if (control) control.disabled = true;
        });
    } else if (state === "comparing") {
        isRunning = true;
        statusIndicator.classList.add("comparing");
        statusText.textContent = "Comparing Algorithms...";
        canvasBadge.textContent = "Benchmarking...";
        controls.forEach(control => {
            if (control) control.disabled = true;
        });
    }
}

/* =========================================
   GENERATE RANDOM DELIVERY POINTS
========================================= */

function generatePoints(totalPoints) {
    points = [];

    for (let i = 0; i < totalPoints; i++) {
        const point = {
            // Give margin to avoid points clipped on edge
            x: Math.random() * (canvas.width - 60) + 30,
            y: Math.random() * (canvas.height - 60) + 30
        };
        points.push(point);
    }

    route = [...points];
    initialRoute = [...route];

    if (convergenceChart) {
        convergenceChart.data.labels = [];
        convergenceChart.data.datasets[0].data = [];
        convergenceChart.update();
    }

    drawRoute();
    updateDistance();
    
    // Reset individual metric panels
    document.getElementById("iterationValue").textContent = "0";
    document.getElementById("timeValue").textContent = "0.00 s";
    
    setSimulationState("idle");
}

/* =========================================
   HUD & CANVAS DRAWING FUNCTIONS
========================================= */

function drawArrow(context, fromX, fromY, toX, toY, color) {
    const headlen = 7; // length of head in pixels
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    
    // Arrow position is 60% of the way along the line segment
    const arrowX = fromX + dx * 0.6;
    const arrowY = fromY + dy * 0.6;
    
    context.beginPath();
    context.moveTo(arrowX, arrowY);
    context.lineTo(arrowX - headlen * Math.cos(angle - Math.PI / 6), arrowY - headlen * Math.sin(angle - Math.PI / 6));
    context.moveTo(arrowX, arrowY);
    context.lineTo(arrowX - headlen * Math.cos(angle + Math.PI / 6), arrowY - headlen * Math.sin(angle + Math.PI / 6));
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.stroke();
}

function drawRoute() {
    if (route.length === 0) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Subtle Tech Grid Background
    ctx.fillStyle = "#090e18";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(99, 102, 241, 0.04)";
    const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 2. Draw Glow Layer (thick blur line behind path)
    ctx.beginPath();
    ctx.moveTo(route[0].x, route[0].y);
    for (let i = 1; i < route.length; i++) {
        ctx.lineTo(route[i].x, route[i].y);
    }
    ctx.lineTo(route[0].x, route[0].y);
    ctx.strokeStyle = "rgba(16, 185, 129, 0.12)";
    ctx.lineWidth = 6;
    ctx.stroke();

    // 3. Draw Active Path
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 4. Draw Directional Flow Arrows
    for (let i = 0; i < route.length; i++) {
        const nextPoint = route[(i + 1) % route.length];
        drawArrow(ctx, route[i].x, route[i].y, nextPoint.x, nextPoint.y, "rgba(255, 255, 255, 0.55)");
    }

    // 5. Draw Nodes (Depot & Deliveries)
    for (let i = 0; i < route.length; i++) {
        const point = route[i];
        
        if (i === 0) {
            // DEPOT (Larger orange glowing ring)
            ctx.beginPath();
            ctx.arc(point.x, point.y, 11, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
            ctx.fill();
            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = "#f59e0b";
            ctx.fill();

            // Label 'D' for Depot
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 9px Inter";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("D", point.x, point.y);
            
            // Label above depot
            ctx.fillStyle = "#f59e0b";
            ctx.font = "bold 10px 'Outfit'";
            ctx.fillText("DEPOT", point.x, point.y - 16);
        } else {
            // CUSTOMER POINTS (Purple/indigo glowing ring with solid center)
            ctx.beginPath();
            ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(99, 102, 241, 0.15)";
            ctx.fill();
            ctx.strokeStyle = "#6366f1";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();

            // Number Labels for Customer points
            ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
            ctx.font = "9px Inter";
            ctx.textAlign = "center";
            ctx.fillText(i, point.x, point.y - 12);
        }
    }
}

/* =========================================
   MATH UTILS & METRIC CALCULATIONS
========================================= */

function calculateDistance(pointA, pointB) {
    const dx = pointA.x - pointB.x;
    const dy = pointA.y - pointB.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function getTotalDistance(route) {
    if (route.length === 0) return 0;
    let total = 0;

    for (let i = 0; i < route.length - 1; i++) {
        total += calculateDistance(route[i], route[i + 1]);
    }

    // Connect back to depot
    total += calculateDistance(route[route.length - 1], route[0]);
    return total;
}

function updateDistance() {
    const totalDistance = getTotalDistance(route);
    document.getElementById("distanceValue").textContent = totalDistance.toFixed(2);
}

function updateExecutionTime(time) {
    document.getElementById("timeValue").textContent = time.toFixed(3) + " s";
}

function swapPoints(route, indexA, indexB) {
    const newRoute = [...route];
    const temp = newRoute[indexA];
    newRoute[indexA] = newRoute[indexB];
    newRoute[indexB] = temp;
    return newRoute;
}

function getRandomIndices(length) {
    const indexA = Math.floor(Math.random() * length);
    let indexB = Math.floor(Math.random() * length);
    while (indexA === indexB) {
        indexB = Math.floor(Math.random() * length);
    }
    return [indexA, indexB];
}

function shuffleRoute(route) {
    const shuffled = [...route];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/* =========================================
   GENETIC ALGORITHM UTILS
========================================= */

function generatePopulation(size) {
    const population = [];
    for (let i = 0; i < size; i++) {
        population.push(shuffleRoute(route));
    }
    return population;
}

function calculateFitness(route) {
    return 1 / getTotalDistance(route);
}

function selectParent(population) {
    let best = population[0];
    for (let individual of population) {
        if (calculateFitness(individual) > calculateFitness(best)) {
            best = individual;
        }
    }
    return best;
}

function crossover(parentA, parentB) {
    const start = Math.floor(Math.random() * parentA.length);
    const end = Math.floor(Math.random() * parentA.length);
    const child = new Array(parentA.length).fill(null);

    for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        child[i] = parentA[i];
    }

    let currentIndex = 0;
    for (let point of parentB) {
        if (!child.includes(point)) {
            while (child[currentIndex] !== null) {
                currentIndex++;
            }
            child[currentIndex] = point;
        }
    }
    return child;
}

function mutate(route, mutationRate) {
    const mutated = [...route];
    for (let i = 0; i < mutated.length; i++) {
        if (Math.random() < mutationRate) {
            const randomIndex = Math.floor(Math.random() * mutated.length);
            [mutated[i], mutated[randomIndex]] = [mutated[randomIndex], mutated[i]];
        }
    }
    return mutated;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* =========================================
   CHART SETUP & METRICS
========================================= */

function initializeChart() {
    const chartCanvas = document.getElementById("convergenceChart");
    const chartCtx = chartCanvas.getContext("2d");

    // Line gradient fill
    const chartGradient = chartCtx.createLinearGradient(0, 0, 0, 240);
    chartGradient.addColorStop(0, "rgba(99, 102, 241, 0.35)");
    chartGradient.addColorStop(1, "rgba(99, 102, 241, 0.01)");

    convergenceChart = new Chart(chartCanvas, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "Distance",
                data: [],
                borderColor: "#6366f1",
                borderWidth: 2,
                pointBackgroundColor: "#6366f1",
                pointBorderColor: "#ffffff",
                pointRadius: 0,
                pointHoverRadius: 5,
                fill: true,
                backgroundColor: chartGradient,
                tension: 0.25
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: "rgba(13, 21, 39, 0.95)",
                    titleFont: { family: "Outfit", size: 12 },
                    bodyFont: { family: "Inter", size: 12 },
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: "rgba(255, 255, 255, 0.04)",
                        drawBorder: false
                    },
                    ticks: {
                        color: "#94a3b8",
                        font: { family: "Inter", size: 10 },
                        maxTicksLimit: 15
                    },
                    title: {
                        display: true,
                        text: "Iteration",
                        color: "#64748b",
                        font: { family: "Inter", size: 11 }
                    }
                },
                y: {
                    grid: {
                        color: "rgba(255, 255, 255, 0.04)",
                        drawBorder: false
                    },
                    ticks: {
                        color: "#94a3b8",
                        font: { family: "Inter", size: 10 },
                        maxTicksLimit: 8
                    },
                    title: {
                        display: true,
                        text: "Distance (px)",
                        color: "#64748b",
                        font: { family: "Inter", size: 11 }
                    }
                }
            }
        }
    });
}

function resetChart() {
    if (convergenceChart) {
        convergenceChart.data.labels = [];
        convergenceChart.data.datasets[0].data = [];
        convergenceChart.update();
    }
}

function resetRunState() {
    route = [...initialRoute];
    document.getElementById("iterationValue").textContent = "0";
    resetChart();
    drawRoute();
    updateDistance();
}

function updateChart(iteration, distance) {
    if (!convergenceChart) return;
    convergenceChart.data.labels.push(iteration);
    convergenceChart.data.datasets[0].data.push(distance);
    convergenceChart.update();
}

function saveBenchmarkResult(algorithm, distance, iterations, executionTime) {
    // Prevent duplicate entries of the same algorithm in a single run
    const existingIndex = benchmarkResults.findIndex(r => r.algorithm === algorithm);
    const newResult = {
        algorithm,
        distance: distance.toFixed(2),
        iterations,
        executionTime: executionTime.toFixed(4)
    };

    if (existingIndex !== -1 && isComparing) {
        // If we are comparing, append/replace
        benchmarkResults[existingIndex] = newResult;
    } else {
        benchmarkResults.push(newResult);
    }
    updateBenchmarkTable();
}

function updateBenchmarkTable() {
    const tableBody = document.querySelector("#benchmarkTable tbody");
    tableBody.innerHTML = "";

    if (benchmarkResults.length === 0) return;

    // Find winning distance
    const minDistance = Math.min(...benchmarkResults.map(r => parseFloat(r.distance)));

    for (let result of benchmarkResults) {
        const isWinner = parseFloat(result.distance) === minDistance;
        const winnerClass = isWinner ? "winner-row" : "";
        const trophy = isWinner ? '<i class="fa-solid fa-trophy" style="color: #f59e0b; margin-right: 6px;"></i>' : "";
        
        let badgeClass = "hill-climbing";
        if (result.algorithm === "Simulated Annealing") badgeClass = "simulated-annealing";
        if (result.algorithm === "Genetic Algorithm") badgeClass = "genetic-algorithm";

        const row = `
            <tr class="${winnerClass}">
                <td>${trophy}<span class="alg-badge ${badgeClass}">${result.algorithm}</span></td>
                <td style="font-weight: ${isWinner ? '700' : '400'}; color: ${isWinner ? '#10b981' : '#f8fafc'}">${result.distance}</td>
                <td>${result.iterations}</td>
                <td>${parseFloat(result.executionTime).toFixed(3)} s</td>
            </tr>
        `;
        tableBody.innerHTML += row;
    }
}

function toggleParameters() {
    const selectedAlgorithm = document.getElementById("algorithm").value;
    const saParameters = document.getElementById("saParameters");
    const gaParameters = document.getElementById("gaParameters");

    saParameters.style.display = "none";
    gaParameters.style.display = "none";

    if (selectedAlgorithm === "Simulated Annealing") {
        saParameters.style.display = "flex";
    } else if (selectedAlgorithm === "Genetic Algorithm") {
        gaParameters.style.display = "flex";
    }
}

/* =========================================
   HILL CLIMBING ALGORITHM
========================================= */

async function hillClimbing() {
    if (route.length === 0) return;
    if (!isComparing) setSimulationState("running");

    let currentRoute = [...route];
    let currentDistance = getTotalDistance(currentRoute);

    let improved = true;
    let iteration = 0;
    const startTime = performance.now();
    const maxIterations = 200;

    while (improved) {
        if (iteration >= maxIterations) break;
        improved = false;

        for (let i = 1; i < currentRoute.length; i++) {
            for (let j = i + 1; j < currentRoute.length; j++) {
                const newRoute = swapPoints(currentRoute, i, j);
                const newDistance = getTotalDistance(newRoute);

                if (newDistance < currentDistance) {
                    currentRoute = newRoute;
                    currentDistance = newDistance;
                    route = [...currentRoute];

                    drawRoute();
                    updateDistance();

                    iteration++;
                    updateChart(iteration, currentDistance);

                    document.getElementById("iterationValue").textContent = iteration;
                    improved = true;
                    await sleep(35); // Speed up slightly from 100ms for snappier feedback
                }
            }
        }
    }

    route = currentRoute;
    drawRoute();
    updateDistance();

    const endTime = performance.now();
    const executionTime = (endTime - startTime) / 1000;

    saveBenchmarkResult("Hill Climbing", currentDistance, iteration, executionTime);
    updateExecutionTime(executionTime);
    
    if (!isComparing) setSimulationState("idle");
}

/* =========================================
   SIMULATED ANNEALING ALGORITHM
========================================= */

async function simulatedAnnealing() {
    if (route.length === 0) return;
    if (!isComparing) setSimulationState("running");

    let currentRoute = [...route];
    let currentDistance = getTotalDistance(currentRoute);

    let bestRoute = [...currentRoute];
    let bestDistance = currentDistance;

    let temperature = parseFloat(document.getElementById("temperature").value);
    const coolingRate = parseFloat(document.getElementById("saCoolingRate").value);
    const maxIterations = parseInt(document.getElementById("saMaxIterations").value);
    
    let iteration = 0;
    const startTime = performance.now();

    while (temperature > 1 && iteration < maxIterations) {
        const [indexA, indexB] = getRandomIndices(currentRoute.length);
        const newRoute = swapPoints(currentRoute, indexA, indexB);
        const newDistance = getTotalDistance(newRoute);
        const delta = newDistance - currentDistance;

        // Accept better solution
        if (delta < 0) {
            currentRoute = newRoute;
            currentDistance = newDistance;
        }
        // Accept worse solution probabilistically
        else if (Math.random() < Math.exp(-delta / temperature)) {
            currentRoute = newRoute;
            currentDistance = newDistance;
        }

        // Update best overall
        if (currentDistance < bestDistance) {
            bestRoute = [...currentRoute];
            bestDistance = currentDistance;
        }

        route = [...currentRoute];
        drawRoute();
        updateDistance();

        iteration++;
        updateChart(iteration, currentDistance);
        document.getElementById("iterationValue").textContent = iteration;

        temperature *= coolingRate;
        await sleep(15); // Speed up slightly from 30ms for responsiveness
    }

    route = [...bestRoute];
    drawRoute();
    updateDistance();

    const endTime = performance.now();
    const executionTime = (endTime - startTime) / 1000;

    saveBenchmarkResult("Simulated Annealing", bestDistance, iteration, executionTime);
    updateExecutionTime(executionTime);

    if (!isComparing) setSimulationState("idle");
}

/* =========================================
   GENETIC ALGORITHM
========================================= */

async function geneticAlgorithm() {
    if (route.length === 0) return;
    if (!isComparing) setSimulationState("running");

    const populationSize = parseInt(document.getElementById("populationSize").value);
    const mutationRate = parseFloat(document.getElementById("mutationRate").value);
    const generations = parseInt(document.getElementById("generations").value);

    let population = generatePopulation(populationSize);
    let bestRoute = population[0];
    let bestDistance = getTotalDistance(bestRoute);

    let iteration = 0;
    const startTime = performance.now();

    for (let generation = 0; generation < generations; generation++) {
        const newPopulation = [];

        for (let i = 0; i < populationSize; i++) {
            const parentA = selectParent(population);
            const parentB = selectParent(population);
            let child = crossover(parentA, parentB);
            child = mutate(child, mutationRate);
            newPopulation.push(child);
        }

        population = newPopulation;

        for (let individual of population) {
            const distance = getTotalDistance(individual);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestRoute = [...individual];
            }
        }

        route = [...bestRoute];
        drawRoute();
        updateDistance();

        iteration++;
        updateChart(iteration, bestDistance);
        document.getElementById("iterationValue").textContent = iteration;

        await sleep(25); // Speed up from 50ms
    }

    route = [...bestRoute];
    drawRoute();
    updateDistance();

    const endTime = performance.now();
    const executionTime = (endTime - startTime) / 1000;

    saveBenchmarkResult("Genetic Algorithm", bestDistance, iteration, executionTime);
    updateExecutionTime(executionTime);

    if (!isComparing) setSimulationState("idle");
}

/* =========================================
   COMPARE ALGORITHMS
========================================= */

async function compareAlgorithms() {
    if (isRunning) return;
    isComparing = true;
    setSimulationState("comparing");

    benchmarkResults = [];
    updateBenchmarkTable();

    // 1. Hill Climbing
    resetRunState();
    await hillClimbing();
    await sleep(400);

    // 2. Simulated Annealing
    resetRunState();
    await simulatedAnnealing();
    await sleep(400);

    // 3. Genetic Algorithm
    resetRunState();
    await geneticAlgorithm();

    isComparing = false;
    setSimulationState("idle");
}

/* =========================================
   RESET CANVAS
========================================= */

function resetCanvas() {
    points = [];
    route = [];
    benchmarkResults = [];
    
    updateBenchmarkTable();
    resetChart();
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw basic background tech grid even when empty
    ctx.fillStyle = "#090e18";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(99, 102, 241, 0.04)";
    const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    document.getElementById("distanceValue").textContent = "0.00";
    document.getElementById("iterationValue").textContent = "0";
    document.getElementById("timeValue").textContent = "0.00 s";
    
    setSimulationState("idle");
}

/* =========================================
   EVENT LISTENERS
========================================= */

generateBtn.addEventListener("click", () => {
    const totalPoints = parseInt(document.getElementById("pointCount").value);
    generatePoints(totalPoints);
});

resetBtn.addEventListener("click", resetCanvas);

startBtn.addEventListener("click", async () => {
    const selectedAlgorithm = document.getElementById("algorithm").value;
    if (selectedAlgorithm === "Hill Climbing") {
        await hillClimbing();
    } else if (selectedAlgorithm === "Simulated Annealing") {
        await simulatedAnnealing();
    } else if (selectedAlgorithm === "Genetic Algorithm") {
        await geneticAlgorithm();
    }
});

compareBtn.addEventListener("click", () => {
    compareAlgorithms();
});

document.getElementById("algorithm").addEventListener("change", toggleParameters);

// Initialization sequence
initializeChart();
toggleParameters();
resizeCanvas();

// Initial point generation on load
setTimeout(() => {
    generatePoints(15);
}, 200);