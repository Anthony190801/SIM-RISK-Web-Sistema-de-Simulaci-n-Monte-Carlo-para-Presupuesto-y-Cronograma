# SIM-RISK Web

Sistema de Simulación Monte Carlo para Presupuesto y Cronograma - Replica del comportamiento de @Risk en Excel.

## Descripción

SIM-RISK Web es una herramienta web que permite realizar simulaciones Monte Carlo sobre presupuestos y cronogramas, calculando distribuciones PERT y generando análisis estadísticos.

## Características Implementadas

### Módulo de Carga y Cálculo PERT (Fase Actual)

- ✅ Carga de archivos CSV y Excel (.xlsx, .xls)
- ✅ Lectura de columnas: ITEM, DESCRIPCIÓN, MÍNIMO, PROBABLE, MÁXIMO
- ✅ Cálculo automático de la distribución PERT: (a + 4m + b) / 6
- ✅ Visualización de datos en tabla
- ✅ Estadísticas básicas de los datos cargados
- ✅ Interfaz drag & drop para carga de archivos

## Requisitos

- Navegador web moderno (Chrome, Firefox, Edge, Safari)
- No requiere instalación ni servidor backend
- Funciona completamente en el cliente (HTML, CSS, JavaScript)

## Uso

1. Abre el archivo `index.html` en tu navegador
2. Haz clic en el área de carga o arrastra un archivo CSV/Excel
3. El sistema procesará automáticamente los datos y calculará la distribución PERT
4. Los resultados se mostrarán en la tabla con la columna "Distribución (PERT)" calculada

## Formato del Archivo

El archivo debe contener las siguientes columnas (los nombres son case-insensitive y pueden tener o no acentos):

- **ITEM**: Identificador del item
- **DESCRIPCIÓN**: Descripción del item
- **MÍNIMO**: Valor mínimo (a)
- **PROBABLE**: Valor más probable (m)
- **MÁXIMO**: Valor máximo (b)

### Ejemplo de CSV:

```csv
ITEM,DESCRIPCIÓN,MÍNIMO,PROBABLE,MÁXIMO
1,Desarrollo Frontend,10,15,20
2,Desarrollo Backend,20,25,35
3,Testing,5,8,12
```

## Fórmula PERT

La distribución PERT se calcula usando la fórmula:

```
PERT = (Mínimo + 4 × Probable + Máximo) / 6
```

Donde:
- **Mínimo (a)**: Valor optimista
- **Probable (m)**: Valor más probable
- **Máximo (b)**: Valor pesimista

## Librerías Utilizadas

- **PapaParse** (v5.4.1): Para parsear archivos CSV
- **SheetJS (XLSX)** (v0.18.5): Para leer archivos Excel

## Módulos Implementados

### ✅ Módulo 1: Carga de Archivos y Cálculo PERT
- Carga de archivos CSV y Excel
- Cálculo automático de distribución PERT
- Visualización de datos en tabla

### ✅ Módulo 2: Simulación Monte Carlo
- Función `runMonteCarlo()` con distribución Beta PERT
- Generador de números aleatorios con semilla (Xorshift32)
- Algoritmo Marsaglia-Tsang para distribución Gamma
- Estadísticas completas (min, max, mean, median, mode, sd, skewness, kurtosis, percentiles)
- Validaciones automáticas
- Rendimiento optimizado (< 10s para 10,000 iteraciones)
- Ver `tests/run_mc_test.html` para pruebas

## Próximas Fases

- [ ] Histograma con percentiles (5%-90%-5%)
- [ ] Tabla estadística lateral
- [ ] Gráfico tipo Tornado con contribución a la varianza
- [ ] Integración de visualizaciones con Chart.js

## Notas Técnicas

- Las simulaciones de hasta 10,000 iteraciones deben completarse en menos de 10 segundos
- La interfaz es simple y limpia, sin sistema de login
- Todo el procesamiento se realiza en el cliente (navegador)

