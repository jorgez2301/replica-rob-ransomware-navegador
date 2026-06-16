const DIRECTORIO_COPIAS = "_rob_copias_temporales";
const DIRECTORIO_WASM = "_rob_wasm_resultados";

function esAndroidLaboratorio() {
    return /Android/i.test(navigator.userAgent);
}

export function apiArchivosDisponible() {
    return "showDirectoryPicker" in window;
}

export async function seleccionarArchivosDeCarpeta() {
    const archivos = [];

    const directorio = await window.showDirectoryPicker({
        mode: "readwrite"
    });

    for await (const [nombre, entrada] of directorio.entries()) {
        if (entrada.kind !== "file") {
            continue;
        }

        const archivo = await entrada.getFile();

        archivos.push({
            nombre: nombre,
            tamano: archivo.size,
            tipo: archivo.type || "desconocido",
            handle: entrada
        });
    }

    return {
        directorio,
        archivos
    };
}

export async function crearCopiasTemporales(directorio, archivos) {
    if (esAndroidLaboratorio()) {
        return {
            directorio: DIRECTORIO_COPIAS,
            cantidad: 0,
            tamano_total_bytes: 0,
            tamano_total_mib: 0,
            estado: "omitidas_en_android",
            motivo: "Se omiten copias temporales en Android/Huawei para evitar InvalidStateError al cambiar el estado del directorio."
        };
    }

    const directorioCopias = await directorio.getDirectoryHandle(
        DIRECTORIO_COPIAS,
        { create: true }
    );

    let cantidadCopias = 0;
    let tamanoCopiasBytes = 0;

    for (const archivoInfo of archivos) {
        const archivoOriginal = await archivoInfo.handle.getFile();
        const bufferOriginal = await archivoOriginal.arrayBuffer();

        const copiaHandle = await directorioCopias.getFileHandle(
            archivoInfo.nombre,
            { create: true }
        );

        const escritor = await copiaHandle.createWritable();
        await escritor.write(bufferOriginal);
        await escritor.close();

        cantidadCopias++;
        tamanoCopiasBytes += bufferOriginal.byteLength;
    }

    return {
        directorio: DIRECTORIO_COPIAS,
        cantidad: cantidadCopias,
        tamano_total_bytes: tamanoCopiasBytes,
        tamano_total_mib: Number((tamanoCopiasBytes / 1024 / 1024).toFixed(4))
    };
}

export async function eliminarDirectoriosTemporales(directorio) {
    const directorios = [
        DIRECTORIO_COPIAS,
        DIRECTORIO_WASM
    ];

    const eliminados = [];

    for (const nombreDirectorio of directorios) {
        try {
            await directorio.removeEntry(nombreDirectorio, {
                recursive: true
            });

            eliminados.push(nombreDirectorio);
        } catch (error) {
            // Si no existe o no se puede borrar, se ignora para no romper el flujo.
        }
    }

    return eliminados;
}

export function calcularTamanoTotal(archivos) {
    return archivos.reduce((total, archivo) => total + archivo.tamano, 0);
}

export function prepararDetalleArchivos(archivos) {
    return archivos.map((archivo) => ({
        nombre: archivo.nombre,
        tamano_bytes: archivo.tamano,
        tipo: archivo.tipo
    }));
}
