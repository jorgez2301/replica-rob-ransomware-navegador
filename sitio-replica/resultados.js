export async function verificarBackend() {
    try {
        const respuesta = await fetch("/api/estado");
        return respuesta.ok;
    } catch (error) {
        return false;
    }
}

export async function enviarRegistroResultado(registro) {
    const respuesta = await fetch("/api/resultados", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(registro)
    });

    if (!respuesta.ok) {
        throw new Error("No se pudo guardar el resultado");
    }

    return await respuesta.json();
}

export async function obtenerResultados() {
    const respuesta = await fetch("/api/resultados");

    if (!respuesta.ok) {
        throw new Error("No se pudieron obtener los resultados");
    }

    return await respuesta.json();
}

export async function pagarRescate(idAtaque) {
    const respuesta = await fetch("/api/rescate/pagar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id_ataque: idAtaque
        })
    });

    if (!respuesta.ok) {
        throw new Error("No se pudo confirmar el pago simulado");
    }

    return await respuesta.json();
}

export async function finalizarRescate(idAtaque, resultadoDescifrado) {
    const respuesta = await fetch("/api/rescate/finalizar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id_ataque: idAtaque,
            resultado_descifrado: resultadoDescifrado
        })
    });

    if (!respuesta.ok) {
        throw new Error("No se pudo guardar el resultado de restauración");
    }

    return await respuesta.json();
}
