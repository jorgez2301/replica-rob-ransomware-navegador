const DIRECTORIO_COPIAS = "_rob_copias_temporales";
const DIRECTORIO_WASM = "_rob_wasm_resultados";

function esAndroidLaboratorio() {
    return /Android/i.test(navigator.userAgent);
}

function calcularVelocidadMiB(tamanoBytes, tiempoMs) {
    const tamanoMiB = tamanoBytes / 1024 / 1024;
    const tiempoSegundos = tiempoMs / 1000;

    if (tiempoSegundos === 0) {
        return 0;
    }

    return Number((tamanoMiB / tiempoSegundos).toFixed(4));
}

function asegurarMemoria(memory, bytesNecesarios) {
    const paginaBytes = 65536;
    const paginasNecesarias = Math.ceil(bytesNecesarios / paginaBytes) + 1;
    const paginasActuales = memory.buffer.byteLength / paginaBytes;

    if (paginasNecesarias > paginasActuales) {
        memory.grow(paginasNecesarias - paginasActuales);
    }
}

async function cargarModuloWebAssembly() {
    const respuesta = await fetch("/webassembly/modulo.wasm");

    if (!respuesta.ok) {
        throw new Error("No se pudo cargar modulo.wasm");
    }

    const bytes = await respuesta.arrayBuffer();
    const modulo = await WebAssembly.instantiate(bytes);

    return modulo.instance.exports;
}

async function escribirArchivo(handle, buffer) {
    const escritor = await handle.createWritable();
    await escritor.write(buffer);
    await escritor.close();
}

export async function cifrarCopiasConWebAssembly(directorio, archivosOriginales) {
    if (esAndroidLaboratorio()) {
        return {
            algoritmo: "WASM-XOR-LAB",
            uso: "comparacion_de_rendimiento",
            estado: "omitido_en_android",
            motivo: "Se omite WebAssembly en Android/Huawei porque el flujo de copias temporales puede provocar InvalidStateError.",
            archivos_procesados: 0,
            tamano_total_bytes: 0,
            tamano_total_mib: 0,
            tiempo_cifrado_ms: null,
            velocidad_cifrado_mib_s: null,
            detalle: []
        };
    }

    const exportsWasm = await cargarModuloWebAssembly();

    const memory = exportsWasm.memory;
    const transform = exportsWasm.transform;

    const directorioCopias = await directorio.getDirectoryHandle(
        DIRECTORIO_COPIAS
    );

    const directorioSalida = await directorio.getDirectoryHandle(
        DIRECTORIO_WASM,
        { create: true }
    );

    let tamanoTotalBytes = 0;
    const detalle = [];

    const inicio = performance.now();

    for (const archivoInfo of archivosOriginales) {
        const copiaHandle = await directorioCopias.getFileHandle(
            archivoInfo.nombre
        );

        const copiaArchivo = await copiaHandle.getFile();
        const bufferOriginal = await copiaArchivo.arrayBuffer();
        const bytesOriginales = new Uint8Array(bufferOriginal);

        asegurarMemoria(memory, bytesOriginales.byteLength);

        let memoria = new Uint8Array(memory.buffer);
        memoria.set(bytesOriginales, 0);

        transform(0, bytesOriginales.byteLength, 0x5a);

        memoria = new Uint8Array(memory.buffer);
        const bytesProcesados = memoria.slice(0, bytesOriginales.byteLength);

        const salidaHandle = await directorioSalida.getFileHandle(
            archivoInfo.nombre + ".wasm",
            { create: true }
        );

        await escribirArchivo(salidaHandle, bytesProcesados);

        tamanoTotalBytes += bytesOriginales.byteLength;

        detalle.push({
            nombre: archivoInfo.nombre,
            archivo_salida: archivoInfo.nombre + ".wasm",
            tamano_bytes: bytesOriginales.byteLength,
            tamano_cifrado_bytes: bytesProcesados.byteLength
        });
    }

    const fin = performance.now();

    const tiempoCifradoMs = Number((fin - inicio).toFixed(4));
    const velocidadCifradoMiBs = calcularVelocidadMiB(
        tamanoTotalBytes,
        tiempoCifradoMs
    );

    return {
        algoritmo: "WASM-XOR-LAB",
        uso: "comparacion_de_rendimiento",
        directorio_origen: DIRECTORIO_COPIAS,
        directorio_salida: DIRECTORIO_WASM,
        archivos_procesados: archivosOriginales.length,
        tamano_total_bytes: tamanoTotalBytes,
        tamano_total_mib: Number((tamanoTotalBytes / 1024 / 1024).toFixed(4)),
        tiempo_cifrado_ms: tiempoCifradoMs,
        velocidad_cifrado_mib_s: velocidadCifradoMiBs,
        detalle: detalle
    };
}

export async function descifrarCopiasConWebAssembly(directorio, archivosOriginales) {
    if (esAndroidLaboratorio()) {
        return {
            algoritmo: "WASM-XOR-LAB",
            uso: "comparacion_de_rendimiento",
            estado: "omitido_en_android",
            motivo: "Se omite WebAssembly en Android/Huawei porque el flujo de copias temporales puede provocar InvalidStateError.",
            archivos_procesados: 0,
            tamano_total_bytes: 0,
            tamano_total_mib: 0,
            tiempo_descifrado_ms: null,
            velocidad_descifrado_mib_s: null,
            detalle: []
        };
    }

    const exportsWasm = await cargarModuloWebAssembly();

    const memory = exportsWasm.memory;
    const transform = exportsWasm.transform;

    const directorioSalida = await directorio.getDirectoryHandle(
        DIRECTORIO_WASM
    );

    let tamanoTotalBytes = 0;
    const detalle = [];

    const inicio = performance.now();

    for (const archivoInfo of archivosOriginales) {
        const wasmHandle = await directorioSalida.getFileHandle(
            archivoInfo.nombre + ".wasm"
        );

        const archivoWasm = await wasmHandle.getFile();
        const bufferCifrado = await archivoWasm.arrayBuffer();
        const bytesCifrados = new Uint8Array(bufferCifrado);

        asegurarMemoria(memory, bytesCifrados.byteLength);

        let memoria = new Uint8Array(memory.buffer);
        memoria.set(bytesCifrados, 0);

        transform(0, bytesCifrados.byteLength, 0x5a);

        memoria = new Uint8Array(memory.buffer);
        const bytesDescifrados = memoria.slice(0, bytesCifrados.byteLength);

        tamanoTotalBytes += bytesCifrados.byteLength;

        detalle.push({
            nombre: archivoInfo.nombre,
            archivo_origen: archivoInfo.nombre + ".wasm",
            tamano_cifrado_bytes: bytesCifrados.byteLength,
            tamano_descifrado_bytes: bytesDescifrados.byteLength
        });
    }

    const fin = performance.now();

    const tiempoDescifradoMs = Number((fin - inicio).toFixed(4));
    const velocidadDescifradoMiBs = calcularVelocidadMiB(
        tamanoTotalBytes,
        tiempoDescifradoMs
    );

    return {
        algoritmo: "WASM-XOR-LAB",
        uso: "comparacion_de_rendimiento",
        directorio_origen: DIRECTORIO_WASM,
        archivos_procesados: archivosOriginales.length,
        tamano_total_bytes: tamanoTotalBytes,
        tamano_total_mib: Number((tamanoTotalBytes / 1024 / 1024).toFixed(4)),
        tiempo_descifrado_ms: tiempoDescifradoMs,
        velocidad_descifrado_mib_s: velocidadDescifradoMiBs,
        detalle: detalle
    };
}
