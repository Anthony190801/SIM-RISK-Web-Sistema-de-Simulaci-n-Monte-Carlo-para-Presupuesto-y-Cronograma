# Instrucciones para Probar Visualizaciones

## Prueba Rápida

1. Abre el archivo `tests/run_visuals.html` en tu navegador
2. La simulación se ejecutará automáticamente al cargar la página
3. Verás:
   - **Histograma** con 3 regiones coloreadas (izquierda roja, centro azul, derecha naranja)
   - **Panel estadístico** lateral con todas las métricas
   - **Gráfico Tornado** mostrando contribución a la varianza por item

## Prueba Completa desde la Aplicación Principal

1. Abre `index.html` en tu navegador
2. Carga un archivo CSV o Excel con los datos (puedes usar `ejemplo_datos.csv`)
3. Una vez cargados los datos, verás la sección "Simulación Monte Carlo"
4. Configura el número de iteraciones (por defecto 5000)
5. Opcionalmente, especifica el número de bins para el histograma
6. Haz clic en "Ejecutar Simulación"
7. Espera a que se complete la simulación (verás el progreso en el botón)
8. Los gráficos se generarán automáticamente

## Características Interactivas

### Histograma
- **3 regiones coloreadas**: 
  - Rojo: valores ≤ Izquierda X (percentil 5% por defecto)
  - Azul: valores entre Izquierda X y Derecha X (percentil 95%)
  - Naranja: valores ≥ Derecha X
- **Líneas verticales** marcando los percentiles con valores numéricos
- **Responsive**: se adapta al tamaño de la ventana

### Panel Estadístico
- Muestra todas las métricas calculadas:
  - Mínimo, Máximo, Media, Moda, Mediana
  - Desviación Estándar, Asimetría, Curtosis
  - IC 90% (± half-width)
  - Iteraciones, Errores, Filtrados
  - Izquierda X (editable), Izquierda P (calculado), Derecha X

### Control Izquierda X
- Edita el valor de "Izquierda X" en el panel lateral
- El histograma se actualiza automáticamente (< 200ms)
- "Izquierda P" se recalcula mostrando el porcentaje de valores ≤ Izquierda X
- Las regiones del histograma se recolorean según el nuevo valor

### Gráfico Tornado
- Muestra la contribución a la varianza de cada item
- Items ordenados por contribución descendente
- Hover sobre las barras muestra:
  - Nombre del item
  - Porcentaje de contribución
  - Varianza del item
- Muestra la suma total de contribuciones (debe ser ≈ 100%)

## Validaciones

El test verifica:
- ✓ Histograma se renderiza correctamente con 3 regiones
- ✓ Panel estadístico muestra todos los valores correctos
- ✓ Tornado muestra items ordenados
- ✓ Suma de contribuciones ≈ 100%
- ✓ Actualización de Izquierda X es rápida (< 200ms)

## Notas Técnicas

- La simulación usa `perItemSamples: true` para calcular el Tornado
- Los resultados se cachean para actualizaciones rápidas del histograma
- Chart.js se usa para ambos gráficos (histograma y tornado)
- El número de bins se calcula automáticamente usando √n si no se especifica

## Solución de Problemas

Si el histograma no se muestra:
- Verifica que Chart.js se haya cargado correctamente
- Abre la consola del navegador (F12) para ver errores
- Asegúrate de que la simulación se haya completado

Si el Tornado no aparece:
- Verifica que `perItemSamples: true` esté en las opciones de simulación
- Asegúrate de que hay al menos 2 items en los datos

Si Izquierda X no actualiza:
- Verifica que el valor esté dentro del rango [mínimo, máximo]
- Revisa la consola para errores de JavaScript

