# Ajustes para Coincidir con @Risk

## Diferencias Identificadas y Correcciones Aplicadas

### 1. ✅ Cálculo de Percentiles (CORREGIDO)

**Problema:** Estábamos usando `Math.floor(n * 0.05)` que no usa interpolación.

**Solución:** Ahora usamos interpolación lineal, igual que @Risk:
```javascript
const index = p * (n - 1);
const lower = Math.floor(index);
const upper = Math.ceil(index);
const weight = index - lower;
return sorted[lower] * (1 - weight) + sorted[upper] * weight;
```

### 2. ✅ Mejora en Cálculo de Moda (MEJORADO)

**Problema:** El histograma para calcular la moda usaba bins muy grandes.

**Solución:** Ahora usamos bins más finos para mejor precisión:
```javascript
const binSize = (max - min) / Math.min(100, Math.ceil(Math.sqrt(n)));
```

### 3. Fórmula Beta PERT (VERIFICADA)

La fórmula que usamos es la estándar:
- `alpha = 1 + 4 * (m - a) / (b - a)`
- `beta = 1 + 4 * (b - m) / (b - a)`

Esta es la fórmula correcta y coincide con @Risk.

### 4. Generación de Números Aleatorios

Usamos:
- **Xorshift32** para PRNG uniforme (con semilla)
- **Marsaglia-Tsang** para distribución Gamma
- **Beta = G1 / (G1 + G2)** donde G1 ~ Gamma(alpha,1) y G2 ~ Gamma(beta,1)

Este método es estándar y debería coincidir con @Risk.

## Posibles Diferencias Restantes

### A. Método de Muestreo de @Risk

@Risk podría usar:
- Un método diferente para generar Beta (aunque el método Gamma es estándar)
- Optimizaciones internas que no conocemos

### B. Número de Iteraciones

Asegúrate de usar **10,000 iteraciones** (como en las imágenes de @Risk) para comparar resultados.

### C. Precisión Numérica

Las diferencias pequeñas (< 0.1%) pueden deberse a:
- Precisión de punto flotante
- Orden de operaciones
- Redondeo intermedio

### D. Semilla del Generador Aleatorio

@Risk podría usar una semilla diferente o un generador diferente. Para comparar exactamente, necesitarías:
1. Conocer la semilla que usa @Risk
2. Usar el mismo generador de números aleatorios

## Recomendaciones

1. **Usa 10,000 iteraciones** para comparar con @Risk
2. **Verifica que los datos de entrada sean exactamente iguales** (sin espacios, mismos decimales)
3. **Compara estadísticas principales** (media, desviación estándar) primero, luego percentiles
4. **Las pequeñas diferencias (< 0.5%) son normales** debido a la naturaleza estocástica de Monte Carlo

## Próximos Pasos

Si las diferencias persisten después de estos ajustes:

1. Verificar que @Risk esté usando distribución PERT (no otra variante)
2. Comparar los parámetros alpha y beta calculados para cada item
3. Verificar si @Risk tiene alguna configuración especial (lambda parameter, etc.)
4. Comparar resultados item por item para identificar dónde está la diferencia

## Nota sobre Precisión

En simulaciones Monte Carlo, es normal tener pequeñas variaciones entre ejecuciones, incluso con la misma semilla, si:
- El generador de números aleatorios es diferente
- El orden de operaciones es diferente
- Hay optimizaciones del compilador/interprete

Las diferencias menores al 1% generalmente se consideran aceptables en simulaciones Monte Carlo.

