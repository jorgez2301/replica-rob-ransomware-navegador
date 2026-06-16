#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

function obtenerArgumento(nombre) {
  const indice = args.indexOf(nombre);
  if (indice === -1) return null;
  return args[indice + 1] || null;
}

const archivoJson =
  obtenerArgumento("--archivo") ||
  process.env.RESULTADOS_JSON ||
  "./resultados/resultados.json";

const idBuscado = obtenerArgumento("--id");

function valor(v, defecto = "-") {
  return v === undefined || v === null || v === "" ? defecto : v;
}

function numero(v, decimales = 2) {
  if (v === undefined || v === null || v === "" || Number.isNaN(Number(v))) {
    return "-";
  }
  return Number(v).toFixed(decimales);
}

function fecha(valorFecha) {
  if (!valorFecha) return "-";

  const f = new Date(valorFecha);
  if (Number.isNaN(f.getTime())) return valorFecha;

  return f.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function textoBooleano(v) {
  if (v === true) return "si";
  if (v === false) return "no";
  return "-";
}

function obtener(obj, rutas, defecto = undefined) {
  for (const ruta of rutas) {
    const partes = ruta.split(".");
    let actual = obj;

    for (const parte of partes) {
      if (actual === undefined || actual === null) {
        actual = undefined;
        break;
      }
      actual = actual[parte];
    }

    if (actual !== undefined && actual !== null && actual !== "") {
      return actual;
    }
  }

  return defecto;
}

function esRegistro(v) {
  return (
    v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    (
      v.id_ataque ||
      v.id_prueba ||
      v.id ||
      v.uuid ||
      v.cliente ||
      v.archivos ||
      v.llave ||
      v.webcrypto ||
      v.webassembly ||
      v.resultados_webcrypto ||
      v.resultados_webassembly ||
      v.rescate
    )
  );
}

function extraerRegistros(datos) {
  if (Array.isArray(datos)) {
    return datos;
  }

  if (!datos || typeof datos !== "object") {
    return [];
  }

  const camposPosibles = [
    "registros",
    "ataques",
    "resultados",
    "sesiones",
    "items",
    "data"
  ];

  for (const campo of camposPosibles) {
    const valorCampo = datos[campo];

    if (Array.isArray(valorCampo)) {
      return valorCampo;
    }

    if (valorCampo && typeof valorCampo === "object") {
      const valores = Object.values(valorCampo).filter(esRegistro);
      if (valores.length > 0) {
        return valores;
      }
    }
  }

  if (esRegistro(datos)) {
    return [datos];
  }

  const valoresDirectos = Object.values(datos).filter(esRegistro);
  if (valoresDirectos.length > 0) {
    return valoresDirectos;
  }

  return [];
}

function cargarResultados(rutaArchivo) {
  const rutaAbsoluta = path.resolve(rutaArchivo);

  if (!fs.existsSync(rutaAbsoluta)) {
    console.error(`No existe el archivo: ${rutaAbsoluta}`);
    process.exit(1);
  }

  const contenido = fs.readFileSync(rutaAbsoluta, "utf8");

  try {
    const datos = JSON.parse(contenido);
    const registros = extraerRegistros(datos);

    if (!Array.isArray(registros) || registros.length === 0) {
      console.error("No se encontraron registros reconocibles en el JSON.");
      console.error("Llaves principales encontradas:");

      if (datos && typeof datos === "object" && !Array.isArray(datos)) {
        console.error(Object.keys(datos).join(", "));
      } else {
        console.error("El JSON principal es un arreglo vacio o un valor no esperado.");
      }

      process.exit(1);
    }

    return registros;
  } catch (error) {
    console.error("El archivo no tiene formato JSON valido.");
    console.error(error.message);
    process.exit(1);
  }
}

function idAtaque(r) {
  return obtener(r, [
    "id_ataque",
    "id_prueba",
    "id",
    "uuid"
  ]);
}

function recortarId(id) {
  if (!id) return "-";
  return String(id).substring(0, 8);
}

function cliente(r) {
  return obtener(r, [
    "cliente",
    "cliente_laboratorio"
  ], {});
}

function archivos(r) {
  return obtener(r, [
    "archivos",
    "directorio_prueba"
  ], {});
}

function llave(r) {
  return obtener(r, [
    "llave",
    "cifrado"
  ], {});
}

function webcrypto(r) {
  return obtener(r, [
    "webcrypto",
    "webCrypto",
    "resultados_webcrypto",
    "metricas.webcrypto"
  ], {});
}

function webassembly(r) {
  return obtener(r, [
    "webassembly",
    "webAssembly",
    "resultados_webassembly",
    "metricas.webassembly"
  ], {});
}

function rescate(r) {
  return obtener(r, [
    "rescate",
    "rescate_simulado"
  ], {});
}

function cantidadArchivos(r) {
  const a = archivos(r);

  return obtener(a, [
    "cantidad",
    "cantidad_archivos",
    "total_archivos"
  ], obtener(r, [
    "cantidad_archivos",
    "total_archivos"
  ]));
}

function tamanoBytes(r) {
  const a = archivos(r);

  return obtener(a, [
    "tamano_total_bytes",
    "total_bytes",
    "bytes"
  ], obtener(r, [
    "tamano_total_bytes",
    "total_bytes",
    "bytes"
  ]));
}

function tamanoMiB(r) {
  const a = archivos(r);

  const mib = obtener(a, [
    "tamano_total_mib",
    "total_mib",
    "mib"
  ], obtener(r, [
    "tamano_total_mib",
    "total_mib",
    "mib"
  ]));

  if (mib !== undefined && mib !== null && mib !== "") {
    return mib;
  }

  const bytes = tamanoBytes(r);
  if (bytes !== undefined && bytes !== null && !Number.isNaN(Number(bytes))) {
    return Number(bytes) / (1024 * 1024);
  }

  return undefined;
}

function tiempoCifrado(obj) {
  return obtener(obj, [
    "tiempo_cifrado_ms",
    "cifrado_ms",
    "tiempo_ms",
    "ms_cifrado"
  ]);
}

function tiempoDescifrado(obj) {
  return obtener(obj, [
    "tiempo_descifrado_ms",
    "descifrado_ms",
    "ms_descifrado"
  ]);
}

function velocidadCifrado(obj) {
  return obtener(obj, [
    "velocidad_cifrado_mib_s",
    "mib_s_cifrado",
    "velocidad_mib_s"
  ]);
}

function velocidadDescifrado(obj) {
  return obtener(obj, [
    "velocidad_descifrado_mib_s",
    "mib_s_descifrado"
  ]);
}

function imprimirTabla(registros) {
  if (registros.length === 0) {
    console.log("No hay registros guardados.");
    return;
  }

  const filas = registros.map((r) => {
    const wc = webcrypto(r);
    const wa = webassembly(r);
    const res = rescate(r);

    return {
      id: recortarId(idAtaque(r)),
      fecha: fecha(obtener(r, ["fecha_inicio", "inicio", "timestamp", "fecha"])),
      estado: valor(obtener(r, ["estado", "status"])),
      archivos: valor(cantidadArchivos(r)),
      mib: numero(tamanoMiB(r)),
      wc_cif_ms: valor(tiempoCifrado(wc)),
      wc_mibs: numero(velocidadCifrado(wc)),
      wasm_cif_ms: valor(tiempoCifrado(wa)),
      wasm_mibs: numero(velocidadCifrado(wa)),
      wc_des_ms: valor(tiempoDescifrado(wc)),
      wasm_des_ms: valor(tiempoDescifrado(wa)),
      pago: textoBooleano(obtener(res, ["pago", "pago_simulado"]))
    };
  });

  const encabezados = [
    ["ID", "id"],
    ["FECHA", "fecha"],
    ["ESTADO", "estado"],
    ["ARCH", "archivos"],
    ["MiB", "mib"],
    ["WC CIF(ms)", "wc_cif_ms"],
    ["WC MiB/s", "wc_mibs"],
    ["WASM CIF(ms)", "wasm_cif_ms"],
    ["WASM MiB/s", "wasm_mibs"],
    ["WC DES(ms)", "wc_des_ms"],
    ["WASM DES(ms)", "wasm_des_ms"],
    ["PAGO", "pago"]
  ];

  const anchos = encabezados.map(([titulo, clave]) => {
    const maxDato = Math.max(...filas.map((fila) => String(fila[clave]).length));
    return Math.max(titulo.length, maxDato) + 2;
  });

  const lineaEncabezado = encabezados
    .map(([titulo], i) => titulo.padEnd(anchos[i]))
    .join("");

  const separador = anchos
    .map((ancho) => "-".repeat(ancho - 2).padEnd(ancho))
    .join("");

  console.log(lineaEncabezado);
  console.log(separador);

  for (const fila of filas) {
    const linea = encabezados
      .map(([, clave], i) => String(fila[clave]).padEnd(anchos[i]))
      .join("");

    console.log(linea);
  }
}

function imprimirDetalle(r) {
  const c = cliente(r);
  const a = archivos(r);
  const l = llave(r);
  const wc = webcrypto(r);
  const wa = webassembly(r);
  const res = rescate(r);

  console.log(`ID ataque: ${valor(idAtaque(r))}`);
  console.log(`Fecha inicio: ${fecha(obtener(r, ["fecha_inicio", "inicio", "timestamp", "fecha"]))}`);
  console.log(`Fecha fin: ${fecha(obtener(r, ["fecha_fin", "fin"]))}`);
  console.log(`Estado: ${valor(obtener(r, ["estado", "status"]))}`);
  console.log("");

  console.log("Cliente:");
  console.log(`  Agente usuario: ${valor(obtener(c, ["agente_usuario", "user_agent"]))}`);
  console.log(`  Navegador: ${valor(obtener(c, ["navegador", "browser"]))}`);
  console.log(`  Plataforma: ${valor(obtener(c, ["plataforma", "platform"]))}`);
  console.log("");

  console.log("Archivos:");
  console.log(`  Cantidad: ${valor(cantidadArchivos(r))}`);
  console.log(`  Tamano total bytes: ${valor(tamanoBytes(r))}`);
  console.log(`  Tamano total MiB: ${numero(tamanoMiB(r))}`);
  console.log("");

  console.log("Llave:");
  console.log(`  Algoritmo: ${valor(obtener(l, ["algoritmo", "algoritmo_datos"]))}`);
  console.log(`  Tamano llave bits: ${valor(obtener(l, ["tamano_llave_bits", "bits"]))}`);
  console.log(`  Proteccion llave: ${valor(obtener(l, ["proteccion_llave", "metodo_proteccion_llave"]))}`);
  console.log(`  Llave AES cifrada: ${obtener(l, ["llave_aes_cifrada", "clave_aes_cifrada"]) ? "guardada" : "-"}`);
  console.log("");

  console.log("WebCrypto:");
  console.log(`  Tiempo cifrado ms: ${valor(tiempoCifrado(wc))}`);
  console.log(`  Velocidad cifrado MiB/s: ${numero(velocidadCifrado(wc))}`);
  console.log(`  Tiempo descifrado ms: ${valor(tiempoDescifrado(wc))}`);
  console.log(`  Velocidad descifrado MiB/s: ${numero(velocidadDescifrado(wc))}`);
  console.log("");

  console.log("WebAssembly:");
  console.log(`  Tiempo cifrado ms: ${valor(tiempoCifrado(wa))}`);
  console.log(`  Velocidad cifrado MiB/s: ${numero(velocidadCifrado(wa))}`);
  console.log(`  Tiempo descifrado ms: ${valor(tiempoDescifrado(wa))}`);
  console.log(`  Velocidad descifrado MiB/s: ${numero(velocidadDescifrado(wa))}`);
  console.log("");

  console.log("Rescate:");
  console.log(`  Nota mostrada: ${textoBooleano(obtener(res, ["nota_mostrada"]))}`);
  console.log(`  Pago: ${textoBooleano(obtener(res, ["pago", "pago_simulado"]))}`);
  console.log(`  Descifrado habilitado: ${textoBooleano(obtener(res, ["descifrado_habilitado"]))}`);
}

const registros = cargarResultados(archivoJson);

if (idBuscado) {
  const registro = registros.find((r) => {
    const id = idAtaque(r);
    if (!id) return false;
    return id === idBuscado || String(id).startsWith(idBuscado);
  });

  if (!registro) {
    console.error(`No se encontro ningun registro con id_ataque: ${idBuscado}`);
    process.exit(1);
  }

  imprimirDetalle(registro);
} else {
  imprimirTabla(registros);
}
