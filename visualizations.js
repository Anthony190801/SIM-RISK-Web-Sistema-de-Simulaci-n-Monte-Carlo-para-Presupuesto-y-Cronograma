// SIM-RISK Web - Módulo 3: Visualizaciones
// Maneja histograma, panel estadístico y gráfico Tornado

/**
 * Calcula el percentil p (0..1) de un array ordenado con interpolación simple
 * @param {number[]} sortedArray - Array ordenado de números
 * @param {number} p - Percentil (0..1)
 * @returns {number} Valor del percentil
 */
function percentile(sortedArray, p) {
    if (!sortedArray || sortedArray.length === 0) return 0;
    if (p <= 0) return sortedArray[0];
    if (p >= 1) return sortedArray[sortedArray.length - 1];
    
    const n = sortedArray.length;
    const index = p * (n - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (lower === upper) {
        return sortedArray[lower];
    }
    
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

/**
 * Calcula las métricas finales de la simulación
 * @param {number[]} results - Array de resultados de la simulación
 * @param {number} sumProbable - Suma de valores probables
 * @returns {Object} Objeto con {certeza95, probCumplimientoPct, contingencia}
 */
function computeFinalMetrics(results, sumProbable) {
    if (!results || results.length === 0) {
        return { certeza95: 0, probCumplimientoPct: 0, contingencia: 0 };
    }
    
    const sorted = [...results].sort((a, b) => a - b);
    
    // Certeza 95% = percentil 95
    const certeza95 = percentile(sorted, 0.95);
    
    // Probabilidad de cumplimiento = % de resultados ≤ sumProbable
    const countBelowProbable = results.filter(r => r <= sumProbable).length;
    const probCumplimientoPct = (countBelowProbable / results.length) * 100;
    
    // Contingencia = Certeza(95%) - Suma Probable
    const contingencia = certeza95 - sumProbable;
    
    return { certeza95, probCumplimientoPct, contingencia };
}

/**
 * Actualiza los resultados finales en la UI
 * @param {Object} metrics - Objeto con {certeza95, probCumplimientoPct, contingencia}
 */
function actualizarResultadosFinales(metrics) {
    const formatoNumero = (num) => {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return num.toLocaleString('es-PE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };
    
    const certeza95El = document.getElementById('certeza95_value');
    const probCumplimientoEl = document.getElementById('probCumplimiento_value');
    const contingenciaEl = document.getElementById('contingencia_value');
    const finalResultsDiv = document.getElementById('finalResults');
    
    if (certeza95El) {
        certeza95El.textContent = formatoNumero(metrics.certeza95);
    }
    
    if (probCumplimientoEl) {
        probCumplimientoEl.textContent = formatoNumero(metrics.probCumplimientoPct) + '%';
    }
    
    if (contingenciaEl) {
        contingenciaEl.textContent = formatoNumero(metrics.contingencia);
    }
    
    if (finalResultsDiv) {
        finalResultsDiv.style.display = 'block';
    }
}

let histogramChart = null;
let tornadoChart = null;
let currentSimulationResult = null;
let currentLeftX = null;
let currentBins = null;

// Sincronizar variables globales para acceso desde otros scripts
window.currentSimulationResult = null;
window.currentLeftX = null;
window.currentBins = null;

// Referencias a elementos del DOM
const runSimulationBtn = document.getElementById('runSimulationBtn');
const iterationsInput = document.getElementById('iterationsInput');
const binsInput = document.getElementById('binsInput');
const leftXInput = document.getElementById('leftXInput');
const leftPValue = document.getElementById('leftPValue');
const statsTable = document.getElementById('statsTable');
const simulationSection = document.getElementById('simulationSection');
const tornadoArea = document.getElementById('tornadoArea');

// Event listeners
if (runSimulationBtn) {
    runSimulationBtn.addEventListener('click', ejecutarSimulacion);
}

if (leftXInput) {
    leftXInput.addEventListener('input', actualizarIzquierdaX);
}

// Usar loadedData global de app.js

/**
 * Prepara los datos para la simulación
 */
function prepararDatosParaSimulacion() {
    const loadedData = window.loadedData || [];
    
    if (!loadedData || loadedData.length === 0) {
        throw new Error('No hay datos cargados. Por favor, carga un archivo primero.');
    }
    
    return loadedData
        .filter(item => item.pert !== null)
        .map(item => ({
            a: parseFloat(item.minimo),
            m: parseFloat(item.probable),
            b: parseFloat(item.maximo),
            id: item.item,
            descripcion: item.descripcion
        }));
}

/**
 * Ejecuta la simulación Monte Carlo
 */
async function ejecutarSimulacion() {
    try {
        const items = prepararDatosParaSimulacion();
        
        if (items.length === 0) {
            alert('No hay items válidos para simular.');
            return;
        }
        
        const iterations = parseInt(iterationsInput.value) || 5000;
        const numBins = binsInput.value ? parseInt(binsInput.value) : null;
        
        runSimulationBtn.disabled = true;
        runSimulationBtn.textContent = 'Ejecutando...';
        
        // Ejecutar simulación con perItemSamples para el tornado
        const resultado = await runMonteCarlo(iterations, items, {
            seed: 12345,
            perItemSamples: true,
            progressCallback: (progress) => {
                runSimulationBtn.textContent = `Ejecutando... ${Math.round(progress)}%`;
            }
        });
        
        currentSimulationResult = resultado;
        currentBins = numBins;
        window.currentSimulationResult = resultado; // Sincronizar global
        window.currentBins = numBins; // Sincronizar global
        
        // Inicializar Izquierda X con percentile5
        currentLeftX = resultado.stats.percentile5;
        window.currentLeftX = currentLeftX; // Sincronizar global
        leftXInput.value = currentLeftX.toFixed(2);
        
        // Mostrar sección de simulación primero para que el canvas tenga dimensiones
        simulationSection.style.display = 'block';
        
        // Forzar reflow para que el navegador calcule las dimensiones del canvas
        simulationSection.offsetHeight;
        
        // Obtener suma probable de los totales
        const sumProbable = window.totalsData ? window.totalsData.sumProbable : null;
        
        // Crear visualizaciones después de que el DOM esté listo
        // Usar setTimeout para asegurar que el canvas tenga dimensiones calculadas
        setTimeout(() => {
            crearHistograma(resultado.results, resultado.stats, numBins);
            actualizarPanelEstadistico(resultado.stats, resultado.results.length);
            calcularIzquierdaP(resultado.results, currentLeftX);
            
            // Calcular y mostrar métricas finales
            if (sumProbable !== null && !isNaN(sumProbable)) {
                const finalMetrics = computeFinalMetrics(resultado.results, sumProbable);
                actualizarResultadosFinales(finalMetrics);
                
                // Guardar métricas en el resultado para acceso posterior
                resultado.finalMetrics = finalMetrics;
                resultado.sumProbable = sumProbable;
            }
            
            // Crear gráfico Tornado si hay perItemSamples
            if (resultado.perItemSamples && items.length > 0) {
                crearTornado(resultado.results, resultado.perItemSamples, items);
            }
            
            runSimulationBtn.disabled = false;
            runSimulationBtn.textContent = 'Ejecutar Simulación';
        }, 100);
        
    } catch (error) {
        alert('Error al ejecutar simulación: ' + error.message);
        console.error('Error:', error);
        runSimulationBtn.disabled = false;
        runSimulationBtn.textContent = 'Ejecutar Simulación';
    }
}

// Variables globales para interactividad del histograma
let histogramResults = null;
let histogramStats = null;
let histogramBins = null;
let isDraggingLeft = false;
let isDraggingRight = false;
let dragStartX = 0;
let dragStartValue = 0;
let histogramEventListenersAttached = false; // Flag para evitar duplicar listeners

// Almacenar referencias a los event listeners para poder removerlos
let histogramMouseDownHandler = null;
let histogramMouseMoveHandler = null;
let histogramMouseUpHandler = null;
let histogramMouseLeaveHandler = null;

/**
 * Crea el histograma interactivo con Chart.js (estilo @Risk)
 * @param {number[]} results - Array de resultados de la simulación
 * @param {Object} stats - Estadísticas calculadas
 * @param {number|null} numBins - Número de bins (null para auto)
 */
function crearHistograma(results, stats, numBins = null) {
    const ctx = document.getElementById('histogramChart');
    if (!ctx) {
        console.warn('Canvas histogramChart no encontrado en el DOM');
        return;
    }
    
    // Verificar que el canvas tenga dimensiones
    if (ctx.offsetWidth === 0 || ctx.offsetHeight === 0) {
        console.warn('Canvas no tiene dimensiones, esperando...');
        setTimeout(() => crearHistograma(results, stats, numBins), 100);
        return;
    }
    
    // Guardar datos para uso en interactividad
    histogramResults = results;
    histogramStats = stats;
    histogramBins = numBins;
    
    // Calcular bins automáticamente si no se especifica
    const bins = numBins || Math.ceil(Math.sqrt(results.length));
    
    // Calcular histograma
    const min = stats.min;
    const max = stats.max;
    const binWidth = (max - min) / bins;
    
    const histogram = new Array(bins).fill(0);
    const binLabels = [];
    
    for (let i = 0; i < bins; i++) {
        const binStart = min + i * binWidth;
        const binEnd = binStart + binWidth;
        binLabels.push((binStart + binEnd) / 2);
    }
    
    results.forEach(value => {
        let binIndex = Math.floor((value - min) / binWidth);
        if (binIndex >= bins) binIndex = bins - 1;
        if (binIndex < 0) binIndex = 0;
        histogram[binIndex]++;
    });
    
    // Destruir gráfico anterior si existe
    if (histogramChart) {
        // Remover event listeners antes de destruir
        const oldCanvas = histogramChart.canvas;
        if (oldCanvas) {
            if (histogramMouseDownHandler) oldCanvas.removeEventListener('mousedown', histogramMouseDownHandler);
            if (histogramMouseMoveHandler) oldCanvas.removeEventListener('mousemove', histogramMouseMoveHandler);
            if (histogramMouseUpHandler) oldCanvas.removeEventListener('mouseup', histogramMouseUpHandler);
            if (histogramMouseLeaveHandler) oldCanvas.removeEventListener('mouseleave', histogramMouseLeaveHandler);
        }
        histogramEventListenersAttached = false; // Resetear flag
        histogramChart.destroy();
        histogramChart = null;
    }
    
    // Calcular regiones para colorear
    // Usar currentLeftX si está definido, sino usar percentile5
    const leftX = (currentLeftX !== null && currentLeftX !== undefined) ? currentLeftX : stats.percentile5;
    const rightX = stats.percentile95;
    
    // Calcular porcentajes actuales
    const sorted = [...results].sort((a, b) => a - b);
    const leftP = (results.filter(r => r <= leftX).length / results.length) * 100;
    const rightP = 100 - leftP;
    const centerP = 100 - (leftP + rightP);
    
    const backgroundColors = binLabels.map(label => {
        if (label <= leftX) {
            return 'rgba(255, 99, 132, 0.5)'; // Rojo claro para izquierda
        } else if (label >= rightX) {
            return 'rgba(54, 162, 235, 0.5)'; // Azul claro para derecha
        } else {
            return 'rgba(200, 200, 200, 0.5)'; // Gris suave para centro
        }
    });
    
    // Crear gráfico con escala lineal en X para poder usar getPixelForValue correctamente
    // Usar scatter chart con barras personalizadas o mantener bar pero con datos numéricos
    histogramChart = new Chart(ctx, {
        type: 'bar',
        data: {
            datasets: [{
                label: 'Frecuencia',
                data: histogram.map((freq, idx) => ({
                    x: binLabels[idx],
                    y: freq
                })),
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(c => c.replace('0.5', '0.8')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 30,
                    bottom: 25,
                    left: 10,
                    right: 10
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Frecuencia: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Frecuencia'
                    }
                },
                x: {
                    type: 'linear',
                    position: 'bottom',
                    min: min,
                    max: max,
                    title: {
                        display: true,
                        text: 'Valor'
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        callback: function(value) {
                            return value.toLocaleString('es-PE', {minimumFractionDigits:0, maximumFractionDigits:0});
                        }
                    }
                }
            },
            onHover: (event, activeElements) => {
                const canvas = event.native.target;
                if (isDraggingLeft || isDraggingRight) {
                    canvas.style.cursor = 'grabbing';
                } else {
                    // Verificar si está cerca de una línea
                    const rect = canvas.getBoundingClientRect();
                    const x = event.clientX - rect.left;
                    const xScale = histogramChart.scales.x;
                    const DRAG_THRESHOLD = 5;
                    
                    const leftXPos = xScale.getPixelForValue(leftX);
                    const rightXPos = xScale.getPixelForValue(rightX);
                    
                    if (Math.abs(x - leftXPos) < DRAG_THRESHOLD || Math.abs(x - rightXPos) < DRAG_THRESHOLD) {
                        canvas.style.cursor = 'ew-resize';
                    } else {
                        canvas.style.cursor = 'default';
                    }
                }
            }
        },
        plugins: [{
            id: 'interactiveLines',
            afterDraw: (chart) => {
                try {
                    // Usar las variables globales guardadas
                    const currentResults = histogramResults || results;
                    const currentStats = histogramStats || stats;
                    
                    if (!currentResults || !currentStats) {
                        console.warn('Datos no disponibles para dibujar líneas', {currentResults, currentStats});
                        return;
                    }
                    
                    if (!chart.scales || !chart.scales.x || !chart.scales.y) {
                        console.warn('Escalas no disponibles para dibujar líneas', chart.scales);
                        return;
                    }
                    
                    const ctx = chart.ctx;
                    const xScale = chart.scales.x;
                    const yScale = chart.scales.y;
                    
                    const currentLeftX = (window.currentLeftX !== null && window.currentLeftX !== undefined) 
                        ? window.currentLeftX 
                        : currentStats.percentile5;
                    const currentRightX = currentStats.percentile95;
                    
                    // Calcular posición manualmente si la escala es categórica
                    // Obtener el rango de valores del gráfico
                    const chartMin = currentStats.min;
                    const chartMax = currentStats.max;
                    const chartWidth = xScale.right - xScale.left;
                    
                    // Calcular posición X manualmente basándose en el rango
                    let leftXPos;
                    if (xScale.type === 'category') {
                        // Si es categórica, calcular manualmente
                        const normalizedLeft = (currentLeftX - chartMin) / (chartMax - chartMin);
                        leftXPos = xScale.left + (normalizedLeft * chartWidth);
                    } else {
                        // Si es lineal, usar getPixelForValue
                        try {
                            leftXPos = xScale.getPixelForValue(currentLeftX);
                        } catch (e) {
                            console.warn('Error al obtener posición de Izquierda X:', e);
                            const normalizedLeft = (currentLeftX - chartMin) / (chartMax - chartMin);
                            leftXPos = xScale.left + (normalizedLeft * chartWidth);
                        }
                    }
                    
                    if (!isNaN(leftXPos) && isFinite(leftXPos) && leftXPos >= xScale.left && leftXPos <= xScale.right) {
                        ctx.save();
                        ctx.strokeStyle = isDraggingLeft ? 'rgb(200, 0, 0)' : 'rgb(255, 99, 132)';
                        ctx.lineWidth = isDraggingLeft ? 3 : 2;
                        ctx.beginPath();
                        ctx.moveTo(leftXPos, yScale.top);
                        ctx.lineTo(leftXPos, yScale.bottom);
                        ctx.stroke();
                        console.log('Línea izquierda dibujada en:', leftXPos, 'valor:', currentLeftX, 'rango X:', xScale.left, '-', xScale.right);
                        
                        // Solo el valor numérico arriba de la línea
                        ctx.fillStyle = 'rgb(255, 99, 132)';
                        ctx.font = 'bold 11px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        const valueText = currentLeftX.toLocaleString('es-PE', {minimumFractionDigits:0, maximumFractionDigits:0});
                        // Dibujar fondo semi-transparente para mejor legibilidad
                        const textMetrics = ctx.measureText(valueText);
                        const labelPadding = 4;
                        const labelHeight = 14;
                        const labelY = Math.max(yScale.top - 3, chart.chartArea.top + 2);
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                        ctx.fillRect(leftXPos - textMetrics.width / 2 - labelPadding, labelY - labelHeight, textMetrics.width + labelPadding * 2, labelHeight);
                        ctx.fillStyle = 'rgb(255, 99, 132)';
                        ctx.fillText(valueText, leftXPos, labelY);
                        ctx.restore();
                    }
                    
                    // Línea derecha (Derecha X)
                    let rightXPos;
                    if (xScale.type === 'category') {
                        // Si es categórica, calcular manualmente
                        const normalizedRight = (currentRightX - chartMin) / (chartMax - chartMin);
                        rightXPos = xScale.left + (normalizedRight * chartWidth);
                    } else {
                        // Si es lineal, usar getPixelForValue
                        try {
                            rightXPos = xScale.getPixelForValue(currentRightX);
                        } catch (e) {
                            console.warn('Error al obtener posición de Derecha X:', e);
                            const normalizedRight = (currentRightX - chartMin) / (chartMax - chartMin);
                            rightXPos = xScale.left + (normalizedRight * chartWidth);
                        }
                    }
                    
                    if (!isNaN(rightXPos) && isFinite(rightXPos) && rightXPos >= xScale.left && rightXPos <= xScale.right) {
                        ctx.save();
                        ctx.strokeStyle = isDraggingRight ? 'rgb(0, 0, 200)' : 'rgb(54, 162, 235)';
                        ctx.lineWidth = isDraggingRight ? 3 : 2;
                        ctx.beginPath();
                        ctx.moveTo(rightXPos, yScale.top);
                        ctx.lineTo(rightXPos, yScale.bottom);
                        ctx.stroke();
                        console.log('Línea derecha dibujada en:', rightXPos, 'valor:', currentRightX, 'rango X:', xScale.left, '-', xScale.right);
                        
                        // Solo el valor numérico arriba de la línea
                        ctx.fillStyle = 'rgb(54, 162, 235)';
                        ctx.font = 'bold 11px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        const valueText = currentRightX.toLocaleString('es-PE', {minimumFractionDigits:0, maximumFractionDigits:0});
                        // Dibujar fondo semi-transparente para mejor legibilidad
                        const textMetrics = ctx.measureText(valueText);
                        const labelPadding = 4;
                        const labelHeight = 14;
                        const labelY = Math.max(yScale.top - 3, chart.chartArea.top + 2);
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                        ctx.fillRect(rightXPos - textMetrics.width / 2 - labelPadding, labelY - labelHeight, textMetrics.width + labelPadding * 2, labelHeight);
                        ctx.fillStyle = 'rgb(54, 162, 235)';
                        ctx.fillText(valueText, rightXPos, labelY);
                        ctx.restore();
                    }
                    
                    // Dibujar porcentajes centrados en cada región del histograma
                    const leftP = (currentResults.filter(r => r <= currentLeftX).length / currentResults.length) * 100;
                    const rightP = (currentResults.filter(r => r >= currentRightX).length / currentResults.length) * 100;
                    const centerP = 100 - leftP - rightP;
                    
                    // Porcentaje izquierdo - centrado en la región izquierda
                    if (leftXPos > xScale.left) {
                        ctx.save();
                        ctx.fillStyle = 'rgb(0, 0, 0)';
                        ctx.font = 'bold 12px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const leftRegionCenterX = (xScale.left + leftXPos) / 2;
                        const leftRegionCenterY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                        ctx.fillText(`${leftP.toFixed(1)}%`, leftRegionCenterX, leftRegionCenterY);
                        ctx.restore();
                    }
                    
                    // Porcentaje central - centrado en la región central
                    if (rightXPos > leftXPos) {
                        ctx.save();
                        ctx.fillStyle = 'rgb(0, 0, 0)';
                        ctx.font = 'bold 12px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const centerRegionCenterX = (leftXPos + rightXPos) / 2;
                        const centerRegionCenterY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                        ctx.fillText(`${centerP.toFixed(1)}%`, centerRegionCenterX, centerRegionCenterY);
                        ctx.restore();
                    }
                    
                    // Porcentaje derecho - centrado en la región derecha
                    if (rightXPos < xScale.right) {
                        ctx.save();
                        ctx.fillStyle = 'rgb(0, 0, 0)';
                        ctx.font = 'bold 12px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const rightRegionCenterX = (rightXPos + xScale.right) / 2;
                        const rightRegionCenterY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                        ctx.fillText(`${rightP.toFixed(1)}%`, rightRegionCenterX, rightRegionCenterY);
                        ctx.restore();
                    }
                } catch (error) {
                    console.error('Error al dibujar líneas:', error);
                }
            }
        }]
    });
    
    // Agregar eventos de mouse para arrastrar líneas
    // Usar requestAnimationFrame para asegurar que el canvas esté completamente renderizado
    requestAnimationFrame(() => {
        // Esperar un frame más para asegurar que Chart.js haya terminado de renderizar
        requestAnimationFrame(() => {
            const canvas = histogramChart.canvas;
            
            if (canvas && !histogramEventListenersAttached) {
                // Agregar eventos de mouse para arrastrar líneas
                const onLeftCutChangeFn = setupHistogramInteractivity(canvas, results, stats);
                
                // Guardar función para uso en actualizarIzquierdaX
                if (onLeftCutChangeFn) {
                    window.onLeftCutChange = onLeftCutChangeFn;
                    histogramEventListenersAttached = true;
                    console.log('✓ Event listeners del histograma agregados');
                }
            } else if (canvas && histogramEventListenersAttached) {
                // Si ya hay listeners, solo actualizar la función
                const onLeftCutChangeFn = setupHistogramInteractivity(canvas, results, stats);
                if (onLeftCutChangeFn) {
                    window.onLeftCutChange = onLeftCutChangeFn;
                }
            } else {
                console.warn('Canvas no disponible para agregar event listeners');
            }
        });
    });
}

/**
 * Configura la interactividad del histograma (arrastrar líneas)
 * @param {HTMLCanvasElement} canvas - Elemento canvas del gráfico
 * @param {number[]} results - Array de resultados
 * @param {Object} stats - Estadísticas
 */
function setupHistogramInteractivity(canvas, results, stats) {
    if (!canvas || !histogramChart) {
        console.warn('No se puede configurar interactividad: canvas o histogramChart no disponible');
        return null;
    }
    
    // Remover listeners anteriores si existen
    if (histogramMouseDownHandler && canvas) {
        canvas.removeEventListener('mousedown', histogramMouseDownHandler);
    }
    if (histogramMouseMoveHandler && canvas) {
        canvas.removeEventListener('mousemove', histogramMouseMoveHandler);
    }
    if (histogramMouseUpHandler && canvas) {
        canvas.removeEventListener('mouseup', histogramMouseUpHandler);
    }
    if (histogramMouseLeaveHandler && canvas) {
        canvas.removeEventListener('mouseleave', histogramMouseLeaveHandler);
    }
    
    const DRAG_THRESHOLD = 8; // Píxeles de tolerancia para detectar línea (aumentado para mejor detección)
    
    // Usar el canvas pasado como parámetro (que es histogramChart.canvas)
    const chartCanvas = canvas;
    
    // Función para verificar si el mouse está cerca de una línea
    function isNearLine(event, chart, leftX, rightX) {
        if (!chart || !chart.scales || !chart.scales.x) return false;
        const xScale = chart.scales.x;
        const rect = chartCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        
        // Calcular posiciones manualmente si la escala es categórica
        const chartMin = histogramStats ? histogramStats.min : stats.min;
        const chartMax = histogramStats ? histogramStats.max : stats.max;
        const chartWidth = xScale.right - xScale.left;
        
        let leftXPos, rightXPos;
        if (xScale.type === 'category') {
            const normalizedLeft = (leftX - chartMin) / (chartMax - chartMin);
            leftXPos = xScale.left + (normalizedLeft * chartWidth);
            const normalizedRight = (rightX - chartMin) / (chartMax - chartMin);
            rightXPos = xScale.left + (normalizedRight * chartWidth);
        } else {
            try {
                leftXPos = xScale.getPixelForValue(leftX);
                rightXPos = xScale.getPixelForValue(rightX);
            } catch (e) {
                const normalizedLeft = (leftX - chartMin) / (chartMax - chartMin);
                leftXPos = xScale.left + (normalizedLeft * chartWidth);
                const normalizedRight = (rightX - chartMin) / (chartMax - chartMin);
                rightXPos = xScale.left + (normalizedRight * chartWidth);
            }
        }
        
        // Solo considerar si está cerca de la línea cuando el Y está en el área del gráfico
        // No considerar el área del texto arriba
        const y = event.clientY - rect.top;
        const isInChartArea = y >= chart.chartArea.top && y <= chart.chartArea.bottom;
        
        return isInChartArea && (Math.abs(x - leftXPos) < DRAG_THRESHOLD || Math.abs(x - rightXPos) < DRAG_THRESHOLD);
    }
    
    // Función que se ejecuta cuando cambia Izquierda X
    function onLeftCutChange(newLeftX, updateChart = true) {
        // Validar rango
        if (newLeftX < stats.min || newLeftX > stats.max) return;
        
        // Actualizar currentLeftX
        currentLeftX = newLeftX;
        window.currentLeftX = newLeftX;
        
        // Recalcular Izquierda P
        const leftP = (results.filter(r => r <= newLeftX).length / results.length) * 100;
        
        // Actualizar input de Izquierda X
        const leftXInput = document.getElementById('leftXInput');
        if (leftXInput) {
            leftXInput.value = newLeftX.toFixed(2);
        }
        
        // Actualizar Izquierda P
        calcularIzquierdaP(results, newLeftX);
        
        // Recalcular métricas finales si hay suma probable
        if (window.totalsData && window.totalsData.sumProbable) {
            const finalMetrics = computeFinalMetrics(results, window.totalsData.sumProbable);
            actualizarResultadosFinales(finalMetrics);
        }
        
        // Redibujar histograma con nuevos colores solo si se solicita
        if (updateChart) {
            crearHistograma(results, stats, histogramBins);
        } else {
            // Solo actualizar el gráfico sin recrearlo completamente
            if (histogramChart) {
                histogramChart.update('none'); // Actualización sin animación
            }
        }
    }
    
    // Crear handlers y guardarlos para poder removerlos después
    histogramMouseDownHandler = (e) => {
        if (!histogramChart || !histogramChart.scales || !histogramChart.scales.x) {
            console.warn('HistogramChart o scales no disponibles');
            return;
        }
        
        const rect = chartCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const xScale = histogramChart.scales.x;
        
        // Solo detectar drag si está en el área del gráfico, no en el área del texto
        const isInChartArea = y >= histogramChart.chartArea.top && y <= histogramChart.chartArea.bottom;
        if (!isInChartArea) return;
        
        const currentLeftX = (window.currentLeftX !== null && window.currentLeftX !== undefined) 
            ? window.currentLeftX 
            : stats.percentile5;
        const currentRightX = stats.percentile95;
        
        // Calcular posiciones manualmente si la escala es categórica
        const chartMin = histogramStats ? histogramStats.min : stats.min;
        const chartMax = histogramStats ? histogramStats.max : stats.max;
        const chartWidth = xScale.right - xScale.left;
        
        let leftXPos, rightXPos;
        if (xScale.type === 'category') {
            const normalizedLeft = (currentLeftX - chartMin) / (chartMax - chartMin);
            leftXPos = xScale.left + (normalizedLeft * chartWidth);
            const normalizedRight = (currentRightX - chartMin) / (chartMax - chartMin);
            rightXPos = xScale.left + (normalizedRight * chartWidth);
        } else {
            try {
                leftXPos = xScale.getPixelForValue(currentLeftX);
                rightXPos = xScale.getPixelForValue(currentRightX);
            } catch (e) {
                const normalizedLeft = (currentLeftX - chartMin) / (chartMax - chartMin);
                leftXPos = xScale.left + (normalizedLeft * chartWidth);
                const normalizedRight = (currentRightX - chartMin) / (chartMax - chartMin);
                rightXPos = xScale.left + (normalizedRight * chartWidth);
            }
        }
        
        // Verificar si se está arrastrando la línea izquierda
        if (Math.abs(x - leftXPos) < DRAG_THRESHOLD) {
            isDraggingLeft = true;
            dragStartX = x;
            dragStartValue = currentLeftX;
            chartCanvas.style.cursor = 'grabbing';
            e.preventDefault();
            e.stopPropagation();
        }
        // Verificar si se está arrastrando la línea derecha (solo lectura por ahora)
        else if (Math.abs(x - rightXPos) < DRAG_THRESHOLD) {
            // La línea derecha se mantiene en percentil 95 por ahora
            chartCanvas.style.cursor = 'not-allowed';
        }
    };
    
    histogramMouseMoveHandler = (e) => {
        if (!histogramChart || !histogramChart.scales || !histogramChart.scales.x) return;
        
        const rect = chartCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const xScale = histogramChart.scales.x;
        
        if (isDraggingLeft) {
            // Obtener nuevo valor desde la posición X
            let newValue;
            if (xScale.type === 'category') {
                // Si es categórica, calcular manualmente
                const chartMin = histogramStats.min;
                const chartMax = histogramStats.max;
                const chartWidth = xScale.right - xScale.left;
                const normalizedX = (x - xScale.left) / chartWidth;
                newValue = chartMin + (normalizedX * (chartMax - chartMin));
            } else {
                // Si es lineal, usar getValueForPixel
                try {
                    newValue = xScale.getValueForPixel(x);
                } catch (e) {
                    const chartMin = histogramStats.min;
                    const chartMax = histogramStats.max;
                    const chartWidth = xScale.right - xScale.left;
                    const normalizedX = (x - xScale.left) / chartWidth;
                    newValue = chartMin + (normalizedX * (chartMax - chartMin));
                }
            }
            
            // Validar rango
            if (newValue >= stats.min && newValue <= stats.max) {
                // Actualizar en tiempo real sin recrear el gráfico completo
                currentLeftX = newValue;
                window.currentLeftX = newValue;
                
                // Actualizar input
                const leftXInput = document.getElementById('leftXInput');
                if (leftXInput) {
                    leftXInput.value = newValue.toFixed(2);
                }
                
                // Actualizar Izquierda P
                calcularIzquierdaP(results, newValue);
                
                // Redibujar solo las líneas
                histogramChart.update('none');
            }
        } else {
            // Cambiar cursor si está cerca de una línea
            const currentLeftX = (window.currentLeftX !== null && window.currentLeftX !== undefined) 
                ? window.currentLeftX 
                : stats.percentile5;
            const currentRightX = stats.percentile95;
            
            if (isNearLine(e, histogramChart, currentLeftX, currentRightX)) {
                chartCanvas.style.cursor = 'ew-resize';
            } else {
                chartCanvas.style.cursor = 'default';
            }
        }
    };
    
    histogramMouseUpHandler = (e) => {
        if (isDraggingLeft) {
            isDraggingLeft = false;
            chartCanvas.style.cursor = 'default';
            
            // Recalcular métricas finales y redibujar completamente
            if (window.totalsData && window.totalsData.sumProbable) {
                const finalMetrics = computeFinalMetrics(results, window.totalsData.sumProbable);
                actualizarResultadosFinales(finalMetrics);
            }
            
            // Redibujar histograma completo con nuevos colores
            crearHistograma(results, stats, histogramBins);
        }
        if (isDraggingRight) {
            isDraggingRight = false;
            chartCanvas.style.cursor = 'default';
        }
    };
    
    histogramMouseLeaveHandler = (e) => {
        if (isDraggingLeft || isDraggingRight) {
            isDraggingLeft = false;
            isDraggingRight = false;
            chartCanvas.style.cursor = 'default';
        }
    };
    
    // Agregar event listeners
    chartCanvas.addEventListener('mousedown', histogramMouseDownHandler);
    chartCanvas.addEventListener('mousemove', histogramMouseMoveHandler);
    chartCanvas.addEventListener('mouseup', histogramMouseUpHandler);
    chartCanvas.addEventListener('mouseleave', histogramMouseLeaveHandler);
    
    // Exportar función para uso externo
    window.onLeftCutChange = onLeftCutChange;
    
    // Retornar función para uso en crearHistograma
    return onLeftCutChange;
}

/**
 * Actualiza el panel estadístico lateral
 * @param {Object} stats - Estadísticas
 * @param {number} iterations - Número de iteraciones
 */
function actualizarPanelEstadistico(stats, iterations) {
    if (!statsTable) return;
    
    const formatoNumero = (num, decimals = 2) => {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return num.toLocaleString('es-ES', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };
    
    const html = `
        <div class="stat-row">
            <span class="stat-key">Mínimo</span>
            <span class="stat-val">${formatoNumero(stats.min)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-key">Máximo</span>
            <span class="stat-val">${formatoNumero(stats.max)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-key">Media</span>
            <span class="stat-val">${formatoNumero(stats.mean)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-key">Moda</span>
            <span class="stat-val">${formatoNumero(stats.mode)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-key">Mediana</span>
            <span class="stat-val">${formatoNumero(stats.median)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-key">Desv. Estándar</span>
            <span class="stat-val">${formatoNumero(stats.sd)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-key">Asimetría</span>
            <span class="stat-val">${formatoNumero(stats.skewness, 4)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-key">Curtosis</span>
            <span class="stat-val">${formatoNumero(stats.kurtosis, 4)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-key">IC 90%</span>
            <span class="stat-val">± ${formatoNumero(stats.ic90_halfWidth)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-key">Iteraciones</span>
            <span class="stat-val">${iterations.toLocaleString('es-ES')}</span>
        </div>
        <div class="stat-row">
            <span class="stat-key">Errores</span>
            <span class="stat-val">0</span>
        </div>
        <div class="stat-row">
            <span class="stat-key">Filtrados</span>
            <span class="stat-val">0</span>
        </div>
        <div class="stat-row">
            <span class="stat-key">Derecha X</span>
            <span class="stat-val">${formatoNumero(stats.percentile95)}</span>
        </div>
    `;
    
    statsTable.innerHTML = html;
}

/**
 * Calcula y actualiza Izquierda P basado en Izquierda X
 * @param {number[]} results - Array de resultados
 * @param {number} leftX - Valor de Izquierda X
 */
function calcularIzquierdaP(results, leftX) {
    if (!results || results.length === 0) return;
    
    const count = results.filter(r => r <= leftX).length;
    const percentage = (count / results.length) * 100;
    
    if (leftPValue) {
        leftPValue.textContent = `Izquierda P: ${percentage.toFixed(2)}%`;
    }
}

/**
 * Actualiza Izquierda X cuando el usuario edita el input
 */
function actualizarIzquierdaX() {
    if (!currentSimulationResult) return;
    
    const newLeftX = parseFloat(leftXInput.value);
    
    if (isNaN(newLeftX)) return;
    
    // Validar que esté en el rango
    if (newLeftX < currentSimulationResult.stats.min || 
        newLeftX > currentSimulationResult.stats.max) {
        alert(`El valor debe estar entre ${currentSimulationResult.stats.min.toFixed(2)} y ${currentSimulationResult.stats.max.toFixed(2)}`);
        leftXInput.value = currentLeftX.toFixed(2);
        return;
    }
    
    currentLeftX = newLeftX;
    window.currentLeftX = newLeftX; // Sincronizar global
    
    // Recalcular Izquierda P
    calcularIzquierdaP(currentSimulationResult.results, currentLeftX);
    
    // Recalcular métricas finales si hay suma probable
    if (window.totalsData && window.totalsData.sumProbable) {
        const finalMetrics = computeFinalMetrics(currentSimulationResult.results, window.totalsData.sumProbable);
        actualizarResultadosFinales(finalMetrics);
    }
    
    // Actualizar histograma (usar resultados cacheados)
    crearHistograma(currentSimulationResult.results, currentSimulationResult.stats, currentBins);
}

/**
 * Calcula la contribución a la varianza para el gráfico Tornado
 */
function calcularContribucionVarianza(totalSamples, perItemSamples) {
    const n = totalSamples.length;
    
    // Calcular varianza del total
    const meanTotal = totalSamples.reduce((sum, val) => sum + val, 0) / n;
    const varTotal = totalSamples.reduce((sum, val) => sum + Math.pow(val - meanTotal, 2), 0) / n;
    
    const contributions = [];
    
    for (let i = 0; i < perItemSamples.length; i++) {
        const itemSamples = perItemSamples[i];
        const meanItem = itemSamples.reduce((sum, val) => sum + val, 0) / n;
        
        // Calcular covarianza
        let covariance = 0;
        for (let j = 0; j < n; j++) {
            covariance += (totalSamples[j] - meanTotal) * (itemSamples[j] - meanItem);
        }
        covariance /= n;
        
        // Contribución porcentual
        const contributionPct = (covariance / varTotal) * 100;
        
        contributions.push({
            index: i,
            contribution: contributionPct,
            covariance: covariance,
            variance: itemSamples.reduce((sum, val) => sum + Math.pow(val - meanItem, 2), 0) / n
        });
    }
    
    return contributions;
}

/**
 * Crea el gráfico Tornado
 * @param {number[]} totalSamples - Muestras totales
 * @param {number[][]} perItemSamples - Muestras por item
 * @param {Array} items - Array de items con descripciones
 */
function crearTornado(totalSamples, perItemSamples, items) {
    if (!tornadoArea) return;
    
    const contributions = calcularContribucionVarianza(totalSamples, perItemSamples);
    
    // Ordenar por contribución descendente
    contributions.sort((a, b) => b.contribution - a.contribution);
    
    // Preparar datos para Chart.js
    const labels = contributions.map(c => items[c.index].descripcion || `Item ${c.index + 1}`);
    const data = contributions.map(c => c.contribution);
    const variances = contributions.map(c => c.variance);
    
    // Calcular suma
    const suma = contributions.reduce((sum, c) => sum + c.contribution, 0);
    
    // Mostrar área del tornado
    tornadoArea.style.display = 'block';
    
    // Actualizar resumen
    const summaryDiv = document.getElementById('tornadoSummary');
    if (summaryDiv) {
        summaryDiv.innerHTML = `<strong>Suma de contribuciones:</strong> ${suma.toFixed(2)}%`;
    }
    
    // Destruir gráfico anterior si existe
    const ctx = document.getElementById('tornadoChart');
    if (!ctx) return;
    
    if (tornadoChart) {
        tornadoChart.destroy();
    }
    
    // Crear gráfico de barras horizontales
    tornadoChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Contribución a la Varianza (%)',
                data: data,
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const contribution = contributions[index];
                            return [
                                `Item: ${items[contribution.index].descripcion || items[contribution.index].id}`,
                                `Contribución: ${contribution.contribution.toFixed(2)}%`,
                                `Varianza: ${contribution.variance.toFixed(4)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Contribución a la Varianza (%)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Items'
                    }
                }
            }
        }
    });
}

// Exportar funciones para uso global
window.ejecutarSimulacion = ejecutarSimulacion;
window.actualizarIzquierdaX = actualizarIzquierdaX;
window.crearHistograma = crearHistograma;
window.actualizarPanelEstadistico = actualizarPanelEstadistico;
window.calcularIzquierdaP = calcularIzquierdaP;
window.crearTornado = crearTornado;
window.percentile = percentile;
window.computeFinalMetrics = computeFinalMetrics;
window.actualizarResultadosFinales = actualizarResultadosFinales;

