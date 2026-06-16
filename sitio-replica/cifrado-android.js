const MAGIC = "ROBDEMO1";
const MAGIC_BYTES = new TextEncoder().encode(MAGIC);

export function esAndroidLaboratorio() {
    const parametros = new URLSearchParams(window.location.search);

    if (parametros.get("modo") === "android") {
        return true;
    }

    if (/Android|HarmonyOS|Huawei|HUAWEI/i.test(navigator.userAgent)) {
        return true;
    }

    if (navigator.userAgentData && navigator.userAgentData.mobile) {
        return true;
    }

    return false;
}

function bytesABase64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binario = "";

    for (const byte of bytes) {
        binario += String.fromCharCode(byte);
    }

    return btoa(binario);
}

function base64ABytes(base64) {
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);

    for (let i = 0; i < binario.length; i++) {
        bytes[i] = binario.charCodeAt(i);
    }

    return bytes;
}

function pemABinario(pem) {
    const limpio = pem
        .replace("-----BEGIN PUBLIC KEY-----", "")
        .replace("-----END PUBLIC KEY-----", "")
        .replace(/\s/g, "");

    return base64ABytes(limpio);
}

function bufferAHex(buffer) {
    const bytes = new Uint8Array(buffer);

    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function calcularSHA256(buffer) {
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return bufferAHex(hash);
}

function generarIV() {
    return crypto.getRandomValues(new Uint8Array(12));
}

function unirBytes(...arreglos) {
    const longitudTotal = arreglos.reduce((total, arreglo) => total + arreglo.length, 0);
    const resultado = new Uint8Array(longitudTotal);

    let offset = 0;

    for (const arreglo of arreglos) {
        resultado.set(arreglo, offset);
        offset += arreglo.length;
    }

    return resultado;
}

function empaquetarArchivoCifrado(iv, cifrado) {
    return unirBytes(
        MAGIC_BYTES,
        iv,
        new Uint8Array(cifrado)
    );
}

function extraerPaqueteCifrado(buffer) {
    const bytes = new Uint8Array(buffer);
    const magic = new TextDecoder().decode(bytes.slice(0, 8));

    if (magic !== MAGIC) {
        throw new Error("Formato cifrado no reconocido");
    }

    return {
        iv: bytes.slice(8, 20),
        cifrado: bytes.slice(20)
    };
}

function calcularVelocidadMiB(tamanoBytes, tiempoMs) {
    const tamanoMiB = tamanoBytes / 1024 / 1024;
    const tiempoSegundos = tiempoMs / 1000;

    if (tiempoSegundos === 0) {
        return 0;
    }

    return Number((tamanoMiB / tiempoSegundos).toFixed(4));
}

async function pedirPermisoEscritura(handle) {
    if (!handle) {
        return;
    }

    if (handle.queryPermission) {
        const permisoActual = await handle.queryPermission({
            mode: "readwrite"
        });

        if (permisoActual === "granted") {
            return;
        }
    }

    if (handle.requestPermission) {
        const permiso = await handle.requestPermission({
            mode: "readwrite"
        });

        if (permiso !== "granted") {
            throw new Error("Permiso de escritura no concedido: " + permiso);
        }
    }
}

async function cargarLlavePublicaRSA() {
    const respuesta = await fetch("/rsa_publica.pem");

    if (!respuesta.ok) {
        throw new Error("No se pudo cargar la llave pública RSA");
    }

    const pem = await respuesta.text();
    const binario = pemABinario(pem);

    return await crypto.subtle.importKey(
        "spki",
        binario,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        false,
        ["encrypt"]
    );
}

async function generarLlaveAESGCM() {
    return await crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );
}

async function cifrarLlaveAES(llaveAES, llavePublicaRSA) {
    const llaveAESRaw = await crypto.subtle.exportKey("raw", llaveAES);

    const llaveAESCifrada = await crypto.subtle.encrypt(
        {
            name: "RSA-OAEP"
        },
        llavePublicaRSA,
        llaveAESRaw
    );

    return bytesABase64(llaveAESCifrada);
}

async function importarLlaveAESDesdeBase64(base64) {
    const bytes = base64ABytes(base64);

    return await crypto.subtle.importKey(
        "raw",
        bytes,
        {
            name: "AES-GCM"
        },
        false,
        ["decrypt"]
    );
}

async function sobrescribirArchivo(handle, buffer) {
    const escritor = await handle.createWritable();
    await escritor.write(buffer);
    await escritor.close();
}

export function crearCopiasOmitidasAndroid() {
    return {
        directorio: null,
        cantidad: 0,
        tamano_total_bytes: 0,
        tamano_total_mib: 0,
        estado: "omitidas_en_android",
        motivo: "En Android/Huawei se omiten copias temporales para evitar cambios de estado del directorio."
    };
}

export function crearWebAssemblyOmitidoAndroid() {
    return {
        algoritmo: "WASM-XOR-LAB",
        uso: "comparacion_de_rendimiento",
        estado: "omitido_en_android",
        motivo: "En Android/Huawei se omite WebAssembly; el modo móvil usa solo WebCrypto.",
        archivos_procesados: 0,
        tamano_total_bytes: 0,
        tamano_total_mib: 0,
        tiempo_cifrado_ms: null,
        velocidad_cifrado_mib_s: null,
        tiempo_descifrado_ms: null,
        velocidad_descifrado_mib_s: null,
        detalle: []
    };
}


function nombreCopiaAndroid(nombre) {
    const limpio = nombre.replace(/[^a-zA-Z0-9._-]/g, "_");
    return "_rob_android_copia_" + limpio;
}




function asegurarMemoriaAndroid(memory, bytesNecesarios) {
    const paginaBytes = 65536;
    const paginasNecesarias = Math.ceil(bytesNecesarios / paginaBytes) + 1;
    const paginasActuales = memory.buffer.byteLength / paginaBytes;

    if (paginasNecesarias > paginasActuales) {
        memory.grow(paginasNecesarias - paginasActuales);
    }
}

async function cargarModuloWebAssemblyAndroid() {
    const respuesta = await fetch("/webassembly/modulo.wasm");

    if (!respuesta.ok) {
        throw new Error("No se pudo cargar modulo.wasm");
    }

    const bytes = await respuesta.arrayBuffer();
    const modulo = await WebAssembly.instantiate(bytes);

    return modulo.instance.exports;
}

export async function medirWebAssemblyAndroid(directorio, archivosSeleccionados) {
    await pedirPermisoEscritura(directorio);

    const exportsWasm = await cargarModuloWebAssemblyAndroid();

    const memory = exportsWasm.memory;
    const transform = exportsWasm.transform;

    let tamanoTotalBytes = 0;
    const detalle = [];

    const buffers = [];

    for (const archivoInfo of archivosSeleccionados) {
        if (archivoInfo.nombre.startsWith("_rob_")) {
            continue;
        }

        const handleArchivo = await directorio.getFileHandle(archivoInfo.nombre);
        const archivo = await handleArchivo.getFile();
        const buffer = await archivo.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        buffers.push({
            nombre: archivoInfo.nombre,
            bytes
        });

        tamanoTotalBytes += bytes.byteLength;
    }

    const inicioCifrado = performance.now();

    const cifrados = [];

    for (const item of buffers) {
        asegurarMemoriaAndroid(memory, item.bytes.byteLength);

        let memoria = new Uint8Array(memory.buffer);
        memoria.set(item.bytes, 0);

        transform(0, item.bytes.byteLength, 0x5a);

        memoria = new Uint8Array(memory.buffer);

        const bytesCifrados = memoria.slice(0, item.bytes.byteLength);

        cifrados.push({
            nombre: item.nombre,
            bytes: bytesCifrados
        });
    }

    const finCifrado = performance.now();

    const inicioDescifrado = performance.now();

    for (const item of cifrados) {
        asegurarMemoriaAndroid(memory, item.bytes.byteLength);

        let memoria = new Uint8Array(memory.buffer);
        memoria.set(item.bytes, 0);

        transform(0, item.bytes.byteLength, 0x5a);

        memoria = new Uint8Array(memory.buffer);

        const bytesDescifrados = memoria.slice(0, item.bytes.byteLength);

        detalle.push({
            nombre: item.nombre,
            tamano_bytes: item.bytes.byteLength,
            tamano_cifrado_bytes: item.bytes.byteLength,
            tamano_descifrado_bytes: bytesDescifrados.byteLength,
            modo_ejecucion: "android_wasm_en_memoria"
        });
    }

    const finDescifrado = performance.now();

    const tiempoCifradoMs = Number((finCifrado - inicioCifrado).toFixed(4));
    const tiempoDescifradoMs = Number((finDescifrado - inicioDescifrado).toFixed(4));

    return {
        algoritmo: "WASM-XOR-LAB",
        uso: "comparacion_de_rendimiento_android",
        estado: "ejecutado_en_memoria",
        archivos_procesados: buffers.length,
        tamano_total_bytes: tamanoTotalBytes,
        tamano_total_mib: Number((tamanoTotalBytes / 1024 / 1024).toFixed(4)),
        tiempo_cifrado_ms: tiempoCifradoMs,
        velocidad_cifrado_mib_s: calcularVelocidadMiB(
            tamanoTotalBytes,
            tiempoCifradoMs
        ),
        tiempo_descifrado_ms: tiempoDescifradoMs,
        velocidad_descifrado_mib_s: calcularVelocidadMiB(
            tamanoTotalBytes,
            tiempoDescifradoMs
        ),
        detalle
    };
}


export async function cifrarAndroidWebCrypto(directorio, archivosSeleccionados) {
    await pedirPermisoEscritura(directorio);

    const llaveAES = await generarLlaveAESGCM();
    const llavePublicaRSA = await cargarLlavePublicaRSA();
    const llaveAESCifrada = await cifrarLlaveAES(llaveAES, llavePublicaRSA);

    let tamanoTotalBytes = 0;
    const detalle = [];

    const inicio = performance.now();

    for (const archivoInfo of archivosSeleccionados) {
        if (archivoInfo.nombre.startsWith("_rob_")) {
            continue;
        }

        const handleOriginal = await directorio.getFileHandle(archivoInfo.nombre);
        await pedirPermisoEscritura(handleOriginal);

        const archivoOriginal = await handleOriginal.getFile();
        const bufferOriginal = await archivoOriginal.arrayBuffer();

        const sha256Original = await calcularSHA256(bufferOriginal);

        const nombreCopia = nombreCopiaAndroid(archivoInfo.nombre);

        let handleCopia = await directorio.getFileHandle(nombreCopia, {
            create: true
        });

        await pedirPermisoEscritura(handleCopia);

        await sobrescribirArchivo(
            handleCopia,
            bufferOriginal
        );

        handleCopia = await directorio.getFileHandle(nombreCopia);
        await pedirPermisoEscritura(handleCopia);

        const archivoCopia = await handleCopia.getFile();
        const bufferCopia = await archivoCopia.arrayBuffer();

        const iv = generarIV();

        const cifrado = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            llaveAES,
            bufferCopia
        );

        const archivoEmpaquetado = empaquetarArchivoCifrado(iv, cifrado);

        handleCopia = await directorio.getFileHandle(nombreCopia);
        await pedirPermisoEscritura(handleCopia);

        await sobrescribirArchivo(
            handleCopia,
            archivoEmpaquetado
        );

        let originalEliminado = false;
        let errorEliminacionOriginal = null;

        try {
            await directorio.removeEntry(archivoInfo.nombre);
            originalEliminado = true;
        } catch (error) {
            errorEliminacionOriginal = error.name + ": " + error.message;
        }

        tamanoTotalBytes += bufferOriginal.byteLength;

        detalle.push({
            nombre: nombreCopia,
            nombre_original: archivoInfo.nombre,
            archivo_copia: nombreCopia,
            tamano_bytes: bufferOriginal.byteLength,
            tipo: archivoInfo.tipo,
            sha256_original: sha256Original,
            tamano_cifrado_bytes: archivoEmpaquetado.byteLength,
            iv_bytes: iv.length,
            iv_almacenado_en_archivo: true,
            formato_cifrado: "ROBDEMO1 + IV + AES-GCM",
            integridad: "pendiente_descifrado",
            modo_ejecucion: "android_webcrypto_copia_controlada",
            original_eliminado: originalEliminado,
            error_eliminacion_original: errorEliminacionOriginal
        });
    }

    const fin = performance.now();
    const tiempoCifradoMs = Number((fin - inicio).toFixed(4));

    return {
        algoritmo: "AES-GCM",
        tamano_llave_bits: 256,
        proteccion_llave: "RSA-OAEP",
        llave_aes_cifrada: llaveAESCifrada,
        tiempo_cifrado_ms: tiempoCifradoMs,
        velocidad_cifrado_mib_s: calcularVelocidadMiB(
            tamanoTotalBytes,
            tiempoCifradoMs
        ),
        tamano_total_bytes: tamanoTotalBytes,
        tamano_total_mib: Number((tamanoTotalBytes / 1024 / 1024).toFixed(4)),
        detalle
    };
}



function nombreRecuperadoAndroid(nombre) {
    const limpio = nombre.replace(/[^a-zA-Z0-9._-]/g, "_");
    return "_rob_android_recuperado_" + limpio;
}

export async function descifrarAndroidWebCrypto(
    directorio,
    archivosSeleccionados,
    llaveAESBase64,
    detalleOriginal
) {
    await pedirPermisoEscritura(directorio);

    const llaveAES = await importarLlaveAESDesdeBase64(llaveAESBase64);

    const elementos = detalleOriginal && detalleOriginal.length > 0
        ? detalleOriginal
        : archivosSeleccionados.map((archivo) => ({
            nombre: nombreCopiaAndroid(archivo.nombre),
            nombre_original: archivo.nombre,
            archivo_copia: nombreCopiaAndroid(archivo.nombre),
            sha256_original: null
        }));

    let tamanoTotalBytes = 0;
    const detalle = [];

    const inicio = performance.now();

    for (const item of elementos) {
        const nombreCifrado = item.archivo_copia || item.nombre;
        const nombreOriginal = item.nombre_original || nombreCifrado;
        const nombreRecuperado = nombreRecuperadoAndroid(nombreOriginal);

        try {
            let handleCopia = await directorio.getFileHandle(nombreCifrado);
            await pedirPermisoEscritura(handleCopia);

            const archivoCifrado = await handleCopia.getFile();
            const bufferCifrado = await archivoCifrado.arrayBuffer();

            const paquete = extraerPaqueteCifrado(bufferCifrado);

            const bufferDescifrado = await crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: paquete.iv
                },
                llaveAES,
                paquete.cifrado
            );

            const sha256Descifrado = await calcularSHA256(bufferDescifrado);

            const sha256Original = item.sha256_original || null;

            const integridadVerificada = sha256Original
                ? sha256Original === sha256Descifrado
                : true;

            let handleRecuperado = await directorio.getFileHandle(nombreRecuperado, {
                create: true
            });

            await pedirPermisoEscritura(handleRecuperado);

            await sobrescribirArchivo(
                handleRecuperado,
                bufferDescifrado
            );

            tamanoTotalBytes += bufferDescifrado.byteLength;

            detalle.push({
                nombre: nombreRecuperado,
                nombre_original: nombreOriginal,
                archivo_copia: nombreCifrado,
                archivo_restaurado: nombreRecuperado,
                restaurado: integridadVerificada,
                estado: integridadVerificada ? "restaurado_como_archivo_nuevo" : "error_integridad",
                integridad: integridadVerificada ? "verificada" : "fallida",
                sha256_original: sha256Original,
                sha256_descifrado: sha256Descifrado,
                tamano_restaurado_bytes: bufferDescifrado.byteLength,
                modo_ejecucion: "android_webcrypto_recuperacion_como_archivo_nuevo",
                original_recreado_con_mismo_nombre: false,
                copia_cifrada_conservada: true
            });
        } catch (error) {
            detalle.push({
                nombre: nombreRecuperado,
                nombre_original: nombreOriginal,
                archivo_copia: nombreCifrado,
                restaurado: false,
                estado: "error",
                integridad: "error",
                error: error.name + ": " + error.message,
                modo_ejecucion: "android_webcrypto_recuperacion_como_archivo_nuevo"
            });
        }
    }

    const fin = performance.now();
    const tiempoDescifradoMs = Number((fin - inicio).toFixed(4));

    return {
        algoritmo: "AES-GCM",
        archivos_procesados: elementos.length,
        archivos_restaurados: detalle.filter((item) => item.restaurado).length,
        archivos_con_error: detalle.filter((item) => !item.restaurado).length,
        tamano_total_bytes: tamanoTotalBytes,
        tamano_total_mib: Number((tamanoTotalBytes / 1024 / 1024).toFixed(4)),
        tiempo_descifrado_ms: tiempoDescifradoMs,
        velocidad_descifrado_mib_s: calcularVelocidadMiB(
            tamanoTotalBytes,
            tiempoDescifradoMs
        ),
        detalle
    };
}
