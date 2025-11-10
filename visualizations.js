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
        
        // Mostrar sección de simulación
        simulationSection.style.display = 'block';
        
        // Obtener suma probable de los totales
        const sumProbable = window.totalsData ? window.totalsData.sumProbable : null;
        
        // Crear visualizaciones
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
        
    } catch (error) {
        alert('Error al ejecutar simulación: ' + error.message);
        console.error('Error:', error);
        runSimulationBtn.disabled = false;
        runSimulationBtn.textContent = 'Ejecutar Simulación';
    }
}

/**
 * Crea el histograma con Chart.js
 */
function crearHistograma(results, stats, numBins = null) {
    const ctx = document.getElementById('histogramChart');
    if (!ctx) return;
    
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
        histogramChart.destroy();
    }
    
    // Calcular regiones para colorear
    // Usar currentLeftX si está definido, sino usar percentile5
    const leftX = (currentLeftX !== null && currentLeftX !== undefined) ? currentLeftX : stats.percentile5;
    const rightX = stats.percentile95;
    
    const backgroundColors = binLabels.map(label => {
        if (label <= leftX) {
            return 'rgba(255, 99, 132, 0.6)'; // Rojo para izquierda
        } else if (label >= rightX) {
            return 'rgba(255, 159, 64, 0.6)'; // Naranja para derecha
        } else {
            return 'rgba(54, 162, 235, 0.6)'; // Azul para centro
        }
    });
    
    // Crear gráfico
    histogramChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels.map(v => v.toFixed(2)),
            datasets: [{
                label: 'Frecuencia',
                data: histogram,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(c => c.replace('0.6', '1')),
                borderWidth: 1
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
                    title: {
                        display: true,
                        text: 'Valor'
                    }
                }
            }
        },
        plugins: [{
            id: 'verticalLines',
            afterDraw: (chart) => {
                const ctx = chart.ctx;
                const xScale = chart.scales.x;
                const yScale = chart.scales.y;
                
                // Línea izquierda (Izquierda X)
                const leftXPos = xScale.getPixelForValue(leftX);
                ctx.strokeStyle = 'rgb(255, 99, 132)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(leftXPos, yScale.top);
                ctx.lineTo(leftXPos, yScale.bottom);
                ctx.stroke();
                
                // Etiqueta izquierda
                ctx.fillStyle = 'rgb(255, 99, 132)';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(leftX.toFixed(2), leftXPos, yScale.top - 5);
                
                // Línea derecha (Percentil 95)
                const rightXPos = xScale.getPixelForValue(rightX);
                ctx.strokeStyle = 'rgb(255, 159, 64)';
                ctx.beginPath();
                ctx.moveTo(rightXPos, yScale.top);
                ctx.lineTo(rightXPos, yScale.bottom);
                ctx.stroke();
                
                // Etiqueta derecha
                ctx.fillStyle = 'rgb(255, 159, 64)';
                ctx.font = 'bold 12px Arial';
                ctx.fillText(rightX.toFixed(2), rightXPos, yScale.top - 5);
            }
        }]
    });
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

