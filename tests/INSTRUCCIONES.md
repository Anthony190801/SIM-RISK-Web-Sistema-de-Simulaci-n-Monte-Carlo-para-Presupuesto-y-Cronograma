# Instrucciones para Ejecutar Tests de Simulación Monte Carlo

## Opción 1: Ejecutar en el Navegador (Recomendado)

1. Abre el archivo `tests/run_mc_test.html` en tu navegador web
2. La simulación se ejecutará automáticamente al cargar la página
3. Verás los resultados en la página:
   - Validaciones automáticas
   - Estadísticas completas
   - Logs de consola
4. Los resultados también estarán disponibles en la consola del navegador (F12)

## Opción 2: Ejecutar con Node.js (Generar JSON)

1. Asegúrate de tener Node.js instalado
2. Abre una terminal en la raíz del proyecto
3. Ejecuta:
   ```bash
   node tests/generate_output_node.js
   ```
4. El archivo `tests/output_sample.json` se generará automáticamente

## Validaciones Automáticas

El test verifica:
- ✓ Longitud de resultados = 5000 iteraciones
- ✓ Mínimo >= suma de todos los mínimos
- ✓ Máximo <= suma de todos los máximos
- ✓ Sin valores NaN en los resultados

## Criterios de Aceptación

- **Tiempo de ejecución**: < 10 segundos para 5000 iteraciones
- **Precisión**: Los resultados deben estar dentro del rango esperado
- **Estadísticas**: Percentiles 5% y 95% deben ser consistentes con la distribución

## Estructura de Salida

El archivo `output_sample.json` contiene:
```json
{
  "stats": {
    "min": número,
    "max": número,
    "mean": número,
    "median": número,
    "mode": número,
    "sd": número,
    "skewness": número,
    "kurtosis": número,
    "percentile5": número,
    "percentile50": número,
    "percentile95": número,
    "ic90_halfWidth": número
  },
  "elapsed_ms": número
}
```

## Notas

- La simulación usa una semilla fija (12345) para reproducibilidad
- Los datos de prueba se basan en `ejemplo_datos.csv`
- Todos los cálculos se realizan en el cliente (navegador o Node.js)

