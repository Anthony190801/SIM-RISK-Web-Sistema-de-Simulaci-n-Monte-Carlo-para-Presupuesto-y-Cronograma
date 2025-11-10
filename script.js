// SIM-RISK Web - Módulo 2: Simulación Monte Carlo
// Implementa simulación Monte Carlo con distribución Beta PERT

/**
 * Generador de números aleatorios con semilla (Xorshift32)
 * @param {number} seed - Semilla inicial
 * @returns {Function} Función que devuelve números aleatorios entre 0 y 1
 */
function createSeededRNG(seed) {
    let state = seed || Math.floor(Math.random() * 0x7FFFFFFF);
    
    return function() {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        state = state >>> 0; // Convertir a unsigned 32-bit
        return (state / 0xFFFFFFFF); // Normalizar a [0, 1)
    };
}

/**
 * Genera un número aleatorio con distribución Gamma usando el algoritmo de Marsaglia-Tsang
 * @param {number} k - Parámetro de forma (alpha)
 * @param {number} theta - Parámetro de escala (default 1)
 * @param {Function} rng - Generador de números aleatorios uniformes [0,1)
 * @returns {number} Número aleatorio con distribución Gamma
 */
function gammaRandom(k, theta, rng) {
    theta = theta || 1;
    
    if (k < 1) {
        // Para k < 1, usar el método de transformación inversa mejorado
        const u = rng();
        return gammaRandom(1 + k, theta, rng) * Math.pow(u, 1 / k);
    }
    
    // Algoritmo de Marsaglia-Tsang para k >= 1
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    
    let x, v;
    do {
        // Generar x ~ N(0,1) usando Box-Muller
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
    
    // Si falla, intentar de nuevo (recursión limitada)
    return gammaRandom(k, theta, rng);
}

/**
 * Genera un número aleatorio con distribución Beta
 * @param {number} alpha - Parámetro alpha
 * @param {number} beta - Parámetro beta
 * @param {Function} rng - Generador de números aleatorios uniformes [0,1)
 * @returns {number} Número aleatorio con distribución Beta [0,1]
 */
function betaRandom(alpha, beta, rng) {
    // Método estándar: Beta = G1 / (G1 + G2) donde G1 ~ Gamma(alpha,1) y G2 ~ Gamma(beta,1)
    const g1 = gammaRandom(alpha, 1, rng);
    const g2 = gammaRandom(beta, 1, rng);
    const sum = g1 + g2;
    
    if (sum === 0) {
        // Edge case: si ambos son 0, devolver 0.5
        return 0.5;
    }
    
    return g1 / sum;
}

/**
 * Calcula los parámetros alpha y beta para la distribución Beta PERT
 * @param {number} a - Valor mínimo
 * @param {number} m - Valor más probable
 * @param {number} b - Valor máximo
 * @returns {Object} Objeto con {alpha, beta, isConstant}
 */
function calcularParametrosBetaPERT(a, m, b) {
    // Edge case: si b === a, la distribución es constante
    if (Math.abs(b - a) < 1e-10) {
        return { alpha: 0, beta: 0, isConstant: true, constantValue: a };
    }
    
    // Validar que a <= m <= b
    if (a > m || m > b) {
        throw new Error(`Valores inválidos: a (${a}) <= m (${m}) <= b (${b}) no se cumple`);
    }
    
    // Calcular alpha y beta según la fórmula PERT
    const alpha = 1 + 4 * (m - a) / (b - a);
    const beta = 1 + 4 * (b - m) / (b - a);
    
    return { alpha, beta, isConstant: false };
}

/**
 * Calcula estadísticas descriptivas de un array de resultados
 * @param {number[]} results - Array de resultados numéricos
 * @returns {Object} Objeto con estadísticas
 */
function getStatistics(results) {
    if (!results || results.length === 0) {
        throw new Error('El array de resultados está vacío');
    }
    
    const n = results.length;
    const sorted = [...results].sort((a, b) => a - b);
    
    // Estadísticas básicas
    const min = sorted[0];
    const max = sorted[n - 1];
    const mean = results.reduce((sum, val) => sum + val, 0) / n;
    
    // Mediana
    const median = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];
    
    // Moda (aproximada usando histograma)
    const histogram = {};
    results.forEach(val => {
        const key = Math.round(val * 100) / 100; // Redondear a 2 decimales
        histogram[key] = (histogram[key] || 0) + 1;
    });
    let mode = mean; // Default
    let maxFreq = 0;
    for (const [key, freq] of Object.entries(histogram)) {
        if (freq > maxFreq) {
            maxFreq = freq;
            mode = parseFloat(key);
        }
    }
    
    // Desviación estándar
    const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const sd = Math.sqrt(variance);
    
    // Asimetría (skewness)
    const skewness = n > 1
        ? results.reduce((sum, val) => sum + Math.pow((val - mean) / sd, 3), 0) / n
        : 0;
    
    // Curtosis (kurtosis)
    const kurtosis = n > 1
        ? results.reduce((sum, val) => sum + Math.pow((val - mean) / sd, 4), 0) / n - 3
        : 0;
    
    // Percentiles
    const percentile5 = sorted[Math.floor(n * 0.05)];
    const percentile50 = median;
    const percentile95 = sorted[Math.floor(n * 0.95)];
    
    // Intervalo de confianza 90%: half-width = 1.645 * (sd / sqrt(n))
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

/**
 * Ejecuta una simulación Monte Carlo usando distribución Beta PERT
 * @param {number} iterations - Número de iteraciones
 * @param {Array<{a:number, m:number, b:number, id?:string}>} items - Array de items con valores a, m, b
 * @param {Object} options - Opciones de simulación
 * @param {number} options.seed - Semilla para reproducibilidad (opcional)
 * @param {Function} options.progressCallback - Callback de progreso (opcional)
 * @param {boolean} options.perItemSamples - Si true, almacena muestras por item (opcional)
 * @returns {Promise<{results:number[], perItemSamples?: number[][], stats:object}>}
 */
async function runMonteCarlo(iterations, items, options = {}) {
    console.time('mc');
    
    // Validaciones iniciales
    if (!Number.isInteger(iterations) || iterations <= 0) {
        throw new Error('El número de iteraciones debe ser un entero positivo');
    }
    
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('El array de items no puede estar vacío');
    }
    
    // Validar cada item antes de simular
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
    
    // Calcular suma de mínimos y máximos para validación posterior
    const sumaMinimos = validatedItems.reduce((sum, item) => sum + item.a, 0);
    const sumaMaximos = validatedItems.reduce((sum, item) => sum + item.b, 0);
    
    // Calcular parámetros Beta PERT para cada item
    const parametrosPERT = validatedItems.map(item => {
        const params = calcularParametrosBetaPERT(item.a, item.m, item.b);
        return { ...params, a: item.a, b: item.b, id: item.id };
    });
    
    // Crear generador de números aleatorios
    const rng = options.seed !== undefined 
        ? createSeededRNG(options.seed)
        : Math.random;
    
    // Inicializar arrays de resultados
    const results = new Array(iterations);
    const perItemSamples = options.perItemSamples 
        ? validatedItems.map(() => new Array(iterations))
        : undefined;
    
    // Configurar callback de progreso
    const progressCallback = options.progressCallback;
    const progressInterval = iterations > 2000 ? Math.max(100, Math.floor(iterations / 100)) : iterations;
    let lastProgressUpdate = 0;
    
    // Ejecutar simulaciones
    for (let i = 0; i < iterations; i++) {
        let total = 0;
        
        // Para cada item, generar una muestra
        for (let j = 0; j < validatedItems.length; j++) {
            const param = parametrosPERT[j];
            let sample;
            
            if (param.isConstant) {
                // Si es constante, usar el valor constante
                sample = param.constantValue;
            } else {
                // Generar muestra usando Beta PERT
                const u = betaRandom(param.alpha, param.beta, rng);
                sample = param.a + (param.b - param.a) * u;
                
                // Validar que la muestra esté en el rango [a, b]
                // (con pequeña tolerancia numérica)
                if (sample < param.a - 1e-10 || sample > param.b + 1e-10) {
                    console.warn(`Muestra fuera de rango en iteración ${i}, item ${j}: ${sample} (rango: [${param.a}, ${param.b}])`);
                    sample = Math.max(param.a, Math.min(param.b, sample)); // Clamp
                }
            }
            
            total += sample;
            
            // Almacenar muestra por item si está habilitado
            if (perItemSamples) {
                perItemSamples[j][i] = sample;
            }
        }
        
        results[i] = total;
        
        // Actualizar progreso
        if (progressCallback && (i - lastProgressUpdate >= progressInterval || i === iterations - 1)) {
            const progress = ((i + 1) / iterations) * 100;
            progressCallback(progress, i + 1, iterations);
            lastProgressUpdate = i;
        }
    }
    
    // Validar resultados
    const minResult = Math.min(...results);
    const maxResult = Math.max(...results);
    
    if (minResult < sumaMinimos - 1e-10 || maxResult > sumaMaximos + 1e-10) {
        console.warn(`Advertencia: resultados fuera del rango esperado. Min: ${minResult} (esperado >= ${sumaMinimos}), Max: ${maxResult} (esperado <= ${sumaMaximos})`);
    }
    
    // Verificar NaN
    const hasNaN = results.some(val => isNaN(val));
    if (hasNaN) {
        throw new Error('Se generaron valores NaN en los resultados. Revisar parámetros de entrada.');
    }
    
    // Calcular estadísticas
    const stats = getStatistics(results);
    
    console.timeEnd('mc');
    
    // Preparar resultado
    const resultado = {
        results,
        stats
    };
    
    if (perItemSamples) {
        resultado.perItemSamples = perItemSamples;
    }
    
    return resultado;
}

