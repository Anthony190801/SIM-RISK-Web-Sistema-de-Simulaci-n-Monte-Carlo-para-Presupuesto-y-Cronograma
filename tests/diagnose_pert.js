// Script de diagnóstico para comparar nuestra implementación con @Risk
// Ejecutar con: node tests/diagnose_pert.js

// Copiar funciones necesarias
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

// Implementación alternativa: método de aceptación-rechazo simple para Gamma
function gammaRandom(k, theta, rng) {
    theta = theta || 1;
    
    // Para k entero, usar suma de exponenciales
    if (Number.isInteger(k) && k > 0) {
        let sum = 0;
        for (let i = 0; i < k; i++) {
            sum -= Math.log(rng());
        }
        return sum * theta;
    }
    
    // Para k no entero o < 1, usar método aproximado
    if (k < 1) {
        const u = rng();
        return gammaRandom(1 + k, theta, rng) * Math.pow(u, 1 / k);
    }
    
    // Marsaglia-Tsang para k >= 1
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    
    let x, v, u;
    let accepted = false;
    
    while (!accepted) {
        // Generar x ~ N(0,1) usando método polar
        let u1, u2, s;
        do {
            u1 = 2 * rng() - 1;
            u2 = 2 * rng() - 1;
            s = u1 * u1 + u2 * u2;
        } while (s >= 1 || s === 0);
        
        const multiplier = Math.sqrt(-2 * Math.log(s) / s);
        x = u1 * multiplier;
        
        v = 1 + c * x;
        
        if (v <= 0) {
            continue;
        }
        
        v = v * v * v;
        u = rng();
        
        if (u < 1 - 0.0331 * Math.pow(x, 4)) {
            accepted = true;
        } else if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
            accepted = true;
        }
    }
    
    return d * v * theta;
}

function betaRandom(alpha, beta, rng) {
    const g1 = gammaRandom(alpha, 1, rng);
    const g2 = gammaRandom(beta, 1, rng);
    const sum = g1 + g2;
    if (sum === 0) return 0.5;
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

// Calcular estadísticas teóricas de PERT
function calcularEstadisticasTeoricasPERT(a, m, b) {
    const mean = (a + 4*m + b) / 6;
    const variance = ((b - a) * (b - a)) / 36;
    const sd = Math.sqrt(variance);
    
    // Calcular alpha y beta
    const alpha = 1 + 4 * (m - a) / (b - a);
    const beta = 1 + 4 * (b - m) / (b - a);
    
    // Varianza teórica de Beta: alpha * beta / ((alpha + beta)^2 * (alpha + beta + 1))
    const betaVariance = (alpha * beta) / ((alpha + beta) * (alpha + beta) * (alpha + beta + 1));
    // Escalar a [a, b]: variance = betaVariance * (b - a)^2
    const scaledVariance = betaVariance * (b - a) * (b - a);
    const scaledSD = Math.sqrt(scaledVariance);
    
    return {
        mean,
        variance: scaledVariance,
        sd: scaledSD,
        alpha,
        beta
    };
}

// Probar con un item del sample_input.csv
const testItem = { a: 765.78, m: 850.87, b: 935.96 };
const params = calcularParametrosBetaPERT(testItem.a, testItem.m, testItem.b);
const teorico = calcularEstadisticasTeoricasPERT(testItem.a, testItem.m, testItem.b);

console.log('=== DIAGNÓSTICO PERT ===');
console.log('Item de prueba:', testItem);
console.log('Parámetros Beta:', params);
console.log('Estadísticas teóricas:', teorico);

// Generar muestras
const n = 10000;
const rng = createSeededRNG(12345);
const samples = [];
for (let i = 0; i < n; i++) {
    const u = betaRandom(params.alpha, params.beta, rng);
    const sample = testItem.a + (testItem.b - testItem.a) * u;
    samples.push(sample);
}

// Calcular estadísticas empíricas
const mean = samples.reduce((s, x) => s + x, 0) / n;
const variance = samples.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / (n - 1);
const sd = Math.sqrt(variance);

console.log('\n=== RESULTADOS EMPÍRICOS (n=' + n + ') ===');
console.log('Media:', mean.toFixed(2), '(teórica:', teorico.mean.toFixed(2) + ')');
console.log('Desv. Estándar:', sd.toFixed(2), '(teórica:', teorico.sd.toFixed(2) + ')');
console.log('Varianza:', variance.toFixed(2), '(teórica:', teorico.variance.toFixed(2) + ')');

// Verificar rango
const minSample = Math.min(...samples);
const maxSample = Math.max(...samples);
console.log('Mínimo muestreado:', minSample.toFixed(2), '(esperado >=', testItem.a + ')');
console.log('Máximo muestreado:', maxSample.toFixed(2), '(esperado <=', testItem.b + ')');

