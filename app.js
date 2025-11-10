// SIM-RISK Web - Módulo de Carga y Cálculo PERT
// Maneja la carga de archivos CSV/Excel y calcula la distribución PERT

// Hacer loadedData accesible globalmente para visualizations.js
window.loadedData = [];
let loadedData = window.loadedData;

// Referencias a elementos del DOM
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const fileInfo = document.getElementById('fileInfo');
const dataSection = document.getElementById('dataSection');
const dataTableBody = document.getElementById('dataTableBody');
const statsInfo = document.getElementById('statsInfo');

// Event listeners
fileInput.addEventListener('change', handleFileSelect);
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('drop', handleDrop);
uploadArea.addEventListener('dragleave', handleDragLeave);

/**
 * Calcula la distribución PERT usando la fórmula: (a + 4m + b) / 6
 * @param {number} minimo - Valor mínimo (a)
 * @param {number} probable - Valor probable (m)
 * @param {number} maximo - Valor máximo (b)
 * @returns {number} Valor de la distribución PERT
 */
function calcularPERT(minimo, probable, maximo) {
    // Validar que los valores sean números válidos
    const a = parseFloat(minimo);
    const m = parseFloat(probable);
    const b = parseFloat(maximo);

    if (isNaN(a) || isNaN(m) || isNaN(b)) {
        return null;
    }

    // Validar que mínimo <= probable <= máximo
    if (a > m || m > b) {
        console.warn('Advertencia: Los valores no cumplen la condición mínimo <= probable <= máximo');
    }

    // Calcular PERT: (a + 4m + b) / 6
    const pert = (a + 4 * m + b) / 6;
    return pert;
}

/**
 * Normaliza los nombres de columnas para hacer la búsqueda case-insensitive
 * @param {string} columnName - Nombre de la columna original
 * @returns {string} Nombre normalizado
 */
function normalizarNombreColumna(columnName) {
    if (!columnName) return '';
    return columnName.trim().toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Eliminar acentos
}

/**
 * Mapea las columnas del archivo a los nombres esperados
 * @param {Object} row - Fila de datos del archivo
 * @returns {Object} Objeto con las columnas normalizadas
 */
function mapearColumnas(row) {
    const columnas = {};
    
    // Buscar cada columna requerida (case-insensitive y sin acentos)
    for (const key in row) {
        const normalized = normalizarNombreColumna(key);
        
        if (normalized === 'ITEM' || normalized === 'ITEM') {
            columnas.item = row[key];
        } else if (normalized === 'DESCRIPCION' || normalized === 'DESCRIPCIÓN') {
            columnas.descripcion = row[key];
        } else if (normalized === 'MINIMO' || normalized === 'MÍNIMO') {
            columnas.minimo = row[key];
        } else if (normalized === 'PROBABLE') {
            columnas.probable = row[key];
        } else if (normalized === 'MAXIMO' || normalized === 'MÁXIMO') {
            columnas.maximo = row[key];
        }
    }
    
    return columnas;
}

/**
 * Procesa los datos cargados y calcula la distribución PERT
 * @param {Array} datos - Array de objetos con los datos del archivo
 */
function procesarDatos(datos) {
    loadedData = datos.map((row, index) => {
        const columnas = mapearColumnas(row);
        
        const minimo = columnas.minimo;
        const probable = columnas.probable;
        const maximo = columnas.maximo;
        
        // Calcular PERT
        const pert = calcularPERT(minimo, probable, maximo);
        
        return {
            item: columnas.item || `Item ${index + 1}`,
            descripcion: columnas.descripcion || '',
            minimo: minimo,
            probable: probable,
            maximo: maximo,
            pert: pert
        };
    });
    
    // Sincronizar con variable global
    window.loadedData = loadedData;
    
    mostrarDatos();
    mostrarEstadisticas();
    
    // Mostrar sección de simulación si hay datos válidos
    const itemsValidos = loadedData.filter(item => item.pert !== null);
    if (itemsValidos.length > 0) {
        const simulationSection = document.getElementById('simulationSection');
        if (simulationSection) {
            simulationSection.style.display = 'block';
        }
    }
}

/**
 * Calcula las sumas de las columnas numéricas
 * @param {Array} dataRows - Array de filas de datos
 * @returns {Object} Objeto con {sumMin, sumProbable, sumMax, sumPert}
 */
function calcularSumas(dataRows) {
    let sumMin = 0;
    let sumProbable = 0;
    let sumMax = 0;
    let sumPert = 0;
    
    dataRows.forEach(fila => {
        const minimo = parseFloat(fila.minimo);
        const probable = parseFloat(fila.probable);
        const maximo = parseFloat(fila.maximo);
        const pert = fila.pert !== null ? parseFloat(fila.pert) : 0;
        
        if (!isNaN(minimo)) sumMin += minimo;
        if (!isNaN(probable)) sumProbable += probable;
        if (!isNaN(maximo)) sumMax += maximo;
        if (!isNaN(pert)) sumPert += pert;
    });
    
    return { sumMin, sumProbable, sumMax, sumPert };
}

/**
 * Muestra los datos en la tabla
 */
function mostrarDatos() {
    dataTableBody.innerHTML = '';
    
    // Formatear números para mostrar
    const formatoNumero = (valor) => {
        if (valor === null || valor === undefined || valor === '') return '-';
        const num = parseFloat(valor);
        return isNaN(num) ? valor : num.toLocaleString('es-PE', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    };
    
    // Filtrar filas que no sean totales (por si el CSV tiene una fila TOTAL)
    const dataRows = loadedData.filter(fila => {
        const itemStr = String(fila.item || '').toUpperCase().trim();
        return itemStr !== 'TOTAL' && itemStr !== 'TOTALS' && itemStr !== '';
    });
    
    // Mostrar filas de datos
    dataRows.forEach((fila, index) => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${fila.item || '-'}</td>
            <td>${fila.descripcion || '-'}</td>
            <td class="number">${formatoNumero(fila.minimo)}</td>
            <td class="number">${formatoNumero(fila.probable)}</td>
            <td class="number">${formatoNumero(fila.maximo)}</td>
            <td class="number pert-value">${fila.pert !== null ? formatoNumero(fila.pert) : 'Error'}</td>
        `;
        
        dataTableBody.appendChild(tr);
    });
    
    // Calcular y mostrar fila de totales
    const totals = calcularSumas(dataRows);
    window.totalsData = totals; // Guardar globalmente para uso en simulación
    
    const totalsRow = document.createElement('tr');
    totalsRow.className = 'totals-row';
    totalsRow.innerHTML = `
        <td><strong>TOTAL</strong></td>
        <td><strong>SUMA DE TODOS LOS ITEMS</strong></td>
        <td class="number"><strong>${formatoNumero(totals.sumMin)}</strong></td>
        <td class="number"><strong>${formatoNumero(totals.sumProbable)}</strong></td>
        <td class="number"><strong>${formatoNumero(totals.sumMax)}</strong></td>
        <td class="number pert-value"><strong>${formatoNumero(totals.sumPert)}</strong></td>
    `;
    
    dataTableBody.appendChild(totalsRow);
    
    dataSection.style.display = 'block';
}

/**
 * Muestra estadísticas básicas de los datos
 */
function mostrarEstadisticas() {
    const totalItems = loadedData.length;
    const itemsConPERT = loadedData.filter(fila => fila.pert !== null).length;
    const itemsSinPERT = totalItems - itemsConPERT;
    
    const valoresPERT = loadedData
        .map(fila => fila.pert)
        .filter(valor => valor !== null);
    
    let estadisticas = {
        total: totalItems,
        validos: itemsConPERT,
        invalidos: itemsSinPERT
    };
    
    if (valoresPERT.length > 0) {
        const suma = valoresPERT.reduce((acc, val) => acc + val, 0);
        const promedio = suma / valoresPERT.length;
        const minimo = Math.min(...valoresPERT);
        const maximo = Math.max(...valoresPERT);
        
        estadisticas.promedio = promedio;
        estadisticas.minimo = minimo;
        estadisticas.maximo = maximo;
        estadisticas.suma = suma;
    }
    
    const formatoNumero = (num) => {
        return num.toLocaleString('es-ES', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    };
    
    let html = '<div class="stats-grid">';
    html += `<div class="stat-item"><span class="stat-label">Total de items:</span><span class="stat-value">${estadisticas.total}</span></div>`;
    html += `<div class="stat-item"><span class="stat-label">Items válidos:</span><span class="stat-value">${estadisticas.validos}</span></div>`;
    
    if (estadisticas.invalidos > 0) {
        html += `<div class="stat-item warning"><span class="stat-label">Items con error:</span><span class="stat-value">${estadisticas.invalidos}</span></div>`;
    }
    
    if (estadisticas.promedio !== undefined) {
        html += `<div class="stat-item"><span class="stat-label">Suma PERT:</span><span class="stat-value">${formatoNumero(estadisticas.suma)}</span></div>`;
        html += `<div class="stat-item"><span class="stat-label">Promedio PERT:</span><span class="stat-value">${formatoNumero(estadisticas.promedio)}</span></div>`;
        html += `<div class="stat-item"><span class="stat-label">Mínimo PERT:</span><span class="stat-value">${formatoNumero(estadisticas.minimo)}</span></div>`;
        html += `<div class="stat-item"><span class="stat-label">Máximo PERT:</span><span class="stat-value">${formatoNumero(estadisticas.maximo)}</span></div>`;
    }
    
    html += '</div>';
    statsInfo.innerHTML = html;
}

/**
 * Maneja la selección de archivo mediante el input
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        cargarArchivo(file);
    }
}

/**
 * Maneja el arrastre de archivos sobre el área de carga
 */
function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('drag-over');
}

/**
 * Maneja cuando se suelta el archivo en el área de carga
 */
function handleDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const file = event.dataTransfer.files[0];
    if (file) {
        cargarArchivo(file);
    }
}

/**
 * Maneja cuando se sale del área de arrastre
 */
function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('drag-over');
}

/**
 * Carga y procesa el archivo seleccionado
 * @param {File} file - Archivo a cargar
 */
function cargarArchivo(file) {
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();
    
    // Mostrar información del archivo
    fileInfo.innerHTML = `
        <p><strong>Archivo:</strong> ${fileName}</p>
        <p><strong>Tamaño:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
    `;
    fileInfo.style.display = 'block';
    
    // Mostrar indicador de carga
    uploadArea.classList.add('loading');
    
    if (fileExtension === 'csv') {
        cargarCSV(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        cargarExcel(file);
    } else {
        alert('Formato de archivo no soportado. Por favor, use archivos CSV o Excel (.xlsx, .xls)');
        uploadArea.classList.remove('loading');
    }
}

/**
 * Carga un archivo CSV usando PapaParse
 * @param {File} file - Archivo CSV
 */
function cargarCSV(file) {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: function(results) {
            uploadArea.classList.remove('loading');
            
            if (results.errors.length > 0) {
                console.warn('Errores al parsear CSV:', results.errors);
            }
            
            if (results.data && results.data.length > 0) {
                procesarDatos(results.data);
            } else {
                alert('El archivo CSV está vacío o no contiene datos válidos.');
            }
        },
        error: function(error) {
            uploadArea.classList.remove('loading');
            alert('Error al leer el archivo CSV: ' + error.message);
            console.error('Error PapaParse:', error);
        }
    });
}

/**
 * Carga un archivo Excel usando SheetJS
 * @param {File} file - Archivo Excel
 */
function cargarExcel(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Obtener la primera hoja
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convertir a JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                defval: '',
                raw: false 
            });
            
            uploadArea.classList.remove('loading');
            
            if (jsonData && jsonData.length > 0) {
                procesarDatos(jsonData);
            } else {
                alert('El archivo Excel está vacío o no contiene datos válidos.');
            }
        } catch (error) {
            uploadArea.classList.remove('loading');
            alert('Error al leer el archivo Excel: ' + error.message);
            console.error('Error SheetJS:', error);
        }
    };
    
    reader.onerror = function() {
        uploadArea.classList.remove('loading');
        alert('Error al leer el archivo.');
    };
    
    reader.readAsArrayBuffer(file);
}

