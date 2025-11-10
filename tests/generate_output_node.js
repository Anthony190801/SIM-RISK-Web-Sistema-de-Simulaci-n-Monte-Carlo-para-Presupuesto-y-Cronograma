// Script Node.js para generar output_sample.json
// Ejecutar con: node tests/generate_output_node.js

const fs = require('fs');
const path = require('path');

// Implementación completa de las funciones (copiada de script.js adaptada para Node.js)

function createSeededRNG(seed) {
    let state = seed || Math.floor(Math.random() * 0x7FFFFFFF);
    
    return function() {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        state = state >>> 0;
        return (state / 0xFFFFFFFF);
    };
}

function gammaRandom(k, theta, rng) {
    theta = theta || 1;
    
    if (k < 1) {
        const u = rng();
        return gammaRandom(1 + k, theta, rng) * Math.pow(u, 1 / k);
    }
    
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    
    let x, v;
    do {
        let u1, u2, s;
        do {
            u1 = rng();
            u2 = rng();
            s = u1 * u1 + u2 * u2;
        } while (s >= 1 || s === 0);
        
        const multiplier = Math.sqrt(-2 * Math.log(s) / s);
        x = u1 * multiplier;
        
        v = 1 + c * x;
    } while (v <= 0);
    
    v = v * v * v;
    const u = rng();
    
    if (u < 1 - 0.0331 * (x * x) * (x * x)) {
        return d * v * theta;
    }
    
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v * theta;
    }
    
    return gammaRandom(k, theta, rng);
}

function betaRandom(alpha, beta, rng) {
    const g1 = gammaRandom(alpha, 1, rng);
    const g2 = gammaRandom(beta, 1, rng);
    const sum = g1 + g2;
    
    if (sum === 0) {
        return 0.5;
    }
    
    return g1 / sum;
}

function calcularParametrosBetaPERT(a, m, b) {
    if (Math.abs(b - a) < 1e-10) {
        return { alpha: 0, beta: 0, isConstant: true, constantValue: a };
    }
    
    if (a > m || m > b) {
        throw new Error(`Valores inválidos: a (${a}) <= m (${m}) <= b (${b}) no se cumple`);
    }
    
    const alpha = 1 + 4 * (m - a) / (b - a);
    const beta = 1 + 4 * (b - m) / (b - a);
    
    return { alpha, beta, isConstant: false };
}

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

function getStatistics(results) {
    if (!results || results.length === 0) {
        throw new Error('El array de resultados está vacío');
    }
    
    const n = results.length;
    const sorted = [...results].sort((a, b) => a - b);
    
    const min = sorted[0];
    const max = sorted[n - 1];
    const mean = results.reduce((sum, val) => sum + val, 0) / n;
    
    const median = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];
    
    const histogram = {};
    results.forEach(val => {
        const key = Math.round(val * 100) / 100;
        histogram[key] = (histogram[key] || 0) + 1;
    });
    let mode = mean;
    let maxFreq = 0;
    for (const [key, freq] of Object.entries(histogram)) {
        if (freq > maxFreq) {
            maxFreq = freq;
            mode = parseFloat(key);
        }
    }
    
    const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const sd = Math.sqrt(variance);
    
    const skewness = n > 1
        ? results.reduce((sum, val) => sum + Math.pow((val - mean) / sd, 3), 0) / n
        : 0;
    
    const kurtosis = n > 1
        ? results.reduce((sum, val) => sum + Math.pow((val - mean) / sd, 4), 0) / n - 3
        : 0;
    
    const percentile5 = sorted[Math.floor(n * 0.05)];
    const percentile50 = median;
    const percentile95 = sorted[Math.floor(n * 0.95)];
    
    const ic90_halfWidth = 1.645 * (sd / Math.sqrt(n));
    
    return {
        min,
        max,
        mean,
        median,
        mode,
        sd,
        skewness,
        kurtosis,
        percentile5,
        percentile50,
        percentile95,
        ic90_halfWidth
    };
}

async function runMonteCarlo(iterations, items, options = {}) {
    const startTime = Date.now();
    
    if (!Number.isInteger(iterations) || iterations <= 0) {
        throw new Error('El número de iteraciones debe ser un entero positivo');
    }
    
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('El array de items no puede estar vacío');
    }
    
    const validatedItems = items.map((item, index) => {
        const a = parseFloat(item.a);
        const m = parseFloat(item.m);
        const b = parseFloat(item.b);
        
        if (isNaN(a) || isNaN(m) || isNaN(b)) {
            throw new Error(`Item ${index + 1} (id: ${item.id || 'sin id'}): valores a, m, b deben ser números válidos`);
        }
        
        if (a > m || m > b) {
            throw new Error(`Item ${index + 1} (id: ${item.id || 'sin id'}): no se cumple a (${a}) <= m (${m}) <= b (${b})`);
        }
        
        return { a, m, b, id: item.id || `item_${index + 1}` };
    });
    
    const sumaMinimos = validatedItems.reduce((sum, item) => sum + item.a, 0);
    const sumaMaximos = validatedItems.reduce((sum, item) => sum + item.b, 0);
    
    const parametrosPERT = validatedItems.map(item => {
        const params = calcularParametrosBetaPERT(item.a, item.m, item.b);
        return { ...params, a: item.a, b: item.b, id: item.id };
    });
    
    const rng = options.seed !== undefined 
        ? createSeededRNG(options.seed)
        : () => Math.random();
    
    const results = new Array(iterations);
    const perItemSamples = options.perItemSamples 
        ? validatedItems.map(() => new Array(iterations))
        : undefined;
    
    const progressCallback = options.progressCallback;
    const progressInterval = iterations > 2000 ? Math.max(100, Math.floor(iterations / 100)) : iterations;
    let lastProgressUpdate = 0;
    
    for (let i = 0; i < iterations; i++) {
        let total = 0;
        
        for (let j = 0; j < validatedItems.length; j++) {
            const param = parametrosPERT[j];
            let sample;
            
            if (param.isConstant) {
                sample = param.constantValue;
            } else {
                const u = betaRandom(param.alpha, param.beta, rng);
                sample = param.a + (param.b - param.a) * u;
                
                if (sample < param.a - 1e-10 || sample > param.b + 1e-10) {
                    sample = Math.max(param.a, Math.min(param.b, sample));
                }
            }
            
            total += sample;
            
            if (perItemSamples) {
                perItemSamples[j][i] = sample;
            }
        }
        
        results[i] = total;
        
        if (progressCallback && (i - lastProgressUpdate >= progressInterval || i === iterations - 1)) {
            const progress = ((i + 1) / iterations) * 100;
            progressCallback(progress, i + 1, iterations);
            lastProgressUpdate = i;
        }
    }
    
    const minResult = Math.min(...results);
    const maxResult = Math.max(...results);
    
    if (minResult < sumaMinimos - 1e-10 || maxResult > sumaMaximos + 1e-10) {
        console.warn(`Advertencia: resultados fuera del rango esperado. Min: ${minResult} (esperado >= ${sumaMinimos}), Max: ${maxResult} (esperado <= ${sumaMaximos})`);
    }
    
    const hasNaN = results.some(val => isNaN(val));
    if (hasNaN) {
        throw new Error('Se generaron valores NaN en los resultados.');
    }
    
    const stats = getStatistics(results);
    const elapsed_ms = Date.now() - startTime;
    
    const resultado = {
        results,
        stats
    };
    
    if (perItemSamples) {
        resultado.perItemSamples = perItemSamples;
    }
    
    return { ...resultado, elapsed_ms };
}

// Ejecutar simulación
async function main() {
    const sampleItems = [
        { a: 10, m: 15, b: 20, id: '1' },
        { a: 20, m: 25, b: 35, id: '2' },
        { a: 8, m: 12, b: 18, id: '3' },
        { a: 5, m: 8, b: 12, id: '4' },
        { a: 6, m: 10, b: 15, id: '5' },
        { a: 3, m: 5, b: 8, id: '6' },
        { a: 4, m: 6, b: 10, id: '7' },
        { a: 5, m: 7, b: 12, id: '8' }
    ];
    
    console.log('Ejecutando simulación Monte Carlo...');
    console.log(`Iteraciones: 5000`);
    console.log(`Items: ${sampleItems.length}`);
    console.log(`Seed: 12345`);
    
    try {
        const resultado = await runMonteCarlo(5000, sampleItems, {
            seed: 12345,
            perItemSamples: false,
            progressCallback: (progress) => {
                if (progress % 10 === 0 || progress === 100) {
                    process.stdout.write(`\rProgreso: ${Math.round(progress)}%`);
                }
            }
        });
        
        console.log('\n✓ Simulación completada');
        console.log(`Tiempo: ${resultado.elapsed_ms} ms`);
        console.log(`Resultados: ${resultado.results.length} iteraciones`);
        console.log(`Min: ${resultado.stats.min.toFixed(4)}`);
        console.log(`Max: ${resultado.stats.max.toFixed(4)}`);
        console.log(`Media: ${resultado.stats.mean.toFixed(4)}`);
        
        // Calcular sumas de items
        const sumMin = sampleItems.reduce((sum, item) => sum + item.a, 0);
        const sumProbable = sampleItems.reduce((sum, item) => sum + item.m, 0);
        const sumMax = sampleItems.reduce((sum, item) => sum + item.b, 0);
        const sumPert = sampleItems.reduce((sum, item) => {
            return sum + (item.a + 4 * item.m + item.b) / 6;
        }, 0);
        
        // Calcular métricas finales
        const sorted = [...resultado.results].sort((a, b) => a - b);
        const certeza95 = percentile(sorted, 0.95);
        const countBelowProbable = resultado.results.filter(r => r <= sumProbable).length;
        const probCumplimientoPct = (countBelowProbable / resultado.results.length) * 100;
        const contingencia = certeza95 - sumProbable;
        
        // Crear resumen para JSON
        const summary = {
            stats: resultado.stats,
            elapsed_ms: resultado.elapsed_ms
        };
        
        // Guardar en archivo
        const outputPath = path.join(__dirname, 'output_sample.json');
        fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');
        
        console.log(`\n✓ Archivo generado: ${outputPath}`);
        
        // Generar archivo de métricas
        const metrics = {
            sumMin: sumMin,
            sumProbable: sumProbable,
            sumMax: sumMax,
            sumPert: sumPert,
            certeza95: certeza95,
            probCumplimientoPct: probCumplimientoPct,
            contingencia: contingencia,
            elapsed_ms: resultado.elapsed_ms
        };
        
        const metricsPath = path.join(__dirname, 'output_sample_metrics.json');
        fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), 'utf8');
        
        console.log(`✓ Archivo de métricas generado: ${metricsPath}`);
        console.log('\nMétricas finales:');
        console.log(`  Suma Mínimo: ${sumMin.toFixed(2)}`);
        console.log(`  Suma Probable: ${sumProbable.toFixed(2)}`);
        console.log(`  Suma Máximo: ${sumMax.toFixed(2)}`);
        console.log(`  Suma PERT: ${sumPert.toFixed(2)}`);
        console.log(`  Certeza 95%: ${certeza95.toFixed(2)}`);
        console.log(`  Prob. Cumplimiento: ${probCumplimientoPct.toFixed(2)}%`);
        console.log(`  Contingencia: ${contingencia.toFixed(2)}`);
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();

