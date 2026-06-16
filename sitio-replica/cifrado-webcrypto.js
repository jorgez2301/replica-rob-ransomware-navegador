const MAGIC = "ROBDEMO1";
const MAGIC_BYTES = new TextEncoder().encode(MAGIC);

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

export async function cifrarYSobrescribirArchivos(archivosSeleccionados, directorio = null) {
    const llaveAES = await generarLlaveAESGCM();
    const llavePublicaRSA = await cargarLlavePublicaRSA();
    const llaveAESCifrada = await cifrarLlaveAES(llaveAES, llavePublicaRSA);

    let tamanoTotalBytes = 0;
    const detalle = [];

    const inicio = performance.now();

    for (const archivoInfo of archivosSeleccionados) {
        const archivo = await archivoInfo.handle.getFile();
        const bufferOriginal = await archivo.arrayBuffer();

        const sha256Original = await calcularSHA256(bufferOriginal);
        const iv = generarIV();

        const cifrado = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            llaveAES,
            bufferOriginal
        );

        const archivoEmpaquetado = empaquetarArchivoCifrado(iv, cifrado);

        await sobrescribirArchivo(
            archivoInfo.handle,
            archivoEmpaquetado
        );

        tamanoTotalBytes += bufferOriginal.byteLength;

        detalle.push({
            nombre: archivoInfo.nombre,
            tamano_bytes: bufferOriginal.byteLength,
            tipo: archivoInfo.tipo,
            sha256_original: sha256Original,
            tamano_cifrado_bytes: archivoEmpaquetado.byteLength,
            iv_bytes: iv.length,
            iv_almacenado_en_archivo: true,
            formato_cifrado: "ROBDEMO1 + IV + AES-GCM",
            integridad: "pendiente_descifrado"
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

export async function descifrarYRestaurarArchivos(
    archivosSeleccionados,
    llaveAESBase64,
    detalleOriginal,
    directorio = null
) {
    const llaveAES = await importarLlaveAESDesdeBase64(llaveAESBase64);

    const mapaOriginal = new Map();

    for (const item of detalleOriginal || []) {
        mapaOriginal.set(item.nombre, item);
    }

    let tamanoTotalBytes = 0;
    const detalle = [];

    const inicio = performance.now();

    for (const archivoInfo of archivosSeleccionados) {
        try {
            const archivoCifrado = await archivoInfo.handle.getFile();
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

            const original = mapaOriginal.get(archivoInfo.nombre);
            const sha256Original = original?.sha256_original || null;

            const integridadVerificada = sha256Original
                ? sha256Original === sha256Descifrado
                : true;

            await sobrescribirArchivo(
                archivoInfo.handle,
                bufferDescifrado
            );

            tamanoTotalBytes += bufferDescifrado.byteLength;

            detalle.push({
                nombre: archivoInfo.nombre,
                restaurado: integridadVerificada,
                estado: integridadVerificada ? "restaurado" : "error_integridad",
                integridad: integridadVerificada ? "verificada" : "fallida",
                sha256_original: sha256Original,
                sha256_descifrado: sha256Descifrado,
                tamano_restaurado_bytes: bufferDescifrado.byteLength
            });
        } catch (error) {
            detalle.push({
                nombre: archivoInfo.nombre,
                restaurado: false,
                estado: "error",
                integridad: "error",
                error: error.message
            });
        }
    }

    const fin = performance.now();
    const tiempoDescifradoMs = Number((fin - inicio).toFixed(4));

    return {
        algoritmo: "AES-GCM",
        archivos_procesados: archivosSeleccionados.length,
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
