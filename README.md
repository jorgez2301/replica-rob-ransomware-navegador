# Réplica controlada de RøB: ransomware sobre navegadores modernos

## Descripción general

Este proyecto corresponde a una réplica académica y controlada del artículo **Ransomware Over Modern Web Browsers: A Novel Strain and a New Defense Mechanism**. La práctica demuestra cómo una aplicación web puede solicitar permisos sobre una carpeta local mediante la **File System Access API**, cifrar archivos de prueba desde el navegador y posteriormente restaurarlos en un entorno de laboratorio.

La implementación no tiene fines maliciosos. Solo debe ejecutarse en un entorno controlado, con archivos sintéticos o de prueba, y no debe usarse sobre información real del usuario.

## Tecnologías utilizadas

* Docker Compose
* Nginx
* dnsmasq
* Node.js / Express
* File System Access API
* WebCrypto API
* WebAssembly
* Navegador Chrome o Chromium

## Estructura del proyecto

```text
replica-rob/
├── sitio-replica/
│   ├── index.html
│   ├── estilos.css
│   ├── principal.js
│   ├── acceso-archivos.js
│   ├── cifrado-webcrypto.js
│   ├── cifrado-webassembly.js
│   ├── resultados.js
│   ├── rsa_publica.pem
│   └── webassembly/
│       └── modulo.wasm
│
├── servicio-resultados/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
│
├── dnsmasq/
│   └── dnsmasq.conf
│
├── resultados/
│   └── resultados.json
│
├── compose.yaml
├── ver-metricas.js
└── README.md
```

## Requisitos previos

El servidor debe contar con:

* Docker instalado
* Docker Compose instalado
* Node.js instalado para consultar métricas desde consola
* Red de laboratorio configurada entre servidor y cliente
* Navegador Chrome o Chromium en el cliente

## Configuración de red usada

En esta réplica se utilizó la siguiente dirección para el servidor:

```text
10.0.2.3
```

El dominio local usado por el laboratorio fue:

```text
labconviertepdf.com
```

El contenedor `dnsmasq` resuelve ese dominio hacia la IP del servidor:

```text
labconviertepdf.com -> 10.0.2.3
```

## Ejecución del proyecto

Desde el servidor, entrar al directorio del proyecto:

```bash
cd ~/replica-rob
```

Levantar los contenedores:

```bash
sudo docker compose up -d
```

Verificar que los contenedores estén activos:

```bash
sudo docker ps
```

Deben aparecer los siguientes contenedores:

```text
nginx-replica-rob
dnsmasq-rob
backend-resultados
```

## Verificación del servidor

Probar que Nginx responde por HTTPS:

```bash
curl -vk https://10.0.2.3
```

Probar que el DNS local resuelve correctamente:

```bash
dig @10.0.2.3 labconviertepdf.com A +short
```

La respuesta esperada es:

```text
10.0.2.3
```

## Configuración del cliente

En el cliente se debe usar como DNS la IP del servidor:

```text
nameserver 10.0.2.3
```

Después se puede verificar la resolución del dominio con:

```bash
dig labconviertepdf.com A +short
```

La respuesta esperada es:

```text
10.0.2.3
```

También se puede probar conectividad directa al servidor:

```bash
curl -vk https://10.0.2.3
```

## Acceso a la aplicación

Desde el navegador Chrome o Chromium del cliente, abrir:

```text
https://labconviertepdf.com
```

Como el certificado es de laboratorio, el navegador puede mostrar una advertencia de seguridad. Para la práctica se acepta la excepción del certificado.

## Flujo de la prueba

1. Abrir la página web de la réplica.
2. Presionar el botón **Seleccionar carpeta**.
3. Elegir una carpeta que contenga archivos de prueba.
4. Conceder permisos de acceso desde el navegador.
5. Presionar **Convertir a PDF**.
6. La aplicación cifra los archivos de prueba.
7. Se muestra una nota de rescate simulada.
8. Presionar **Pagar 0.05 BTC-DEMO**.
9. Presionar **Recuperar archivos**.
10. La aplicación restaura los archivos usando la llave controlada del laboratorio.

## Consulta de resultados

Los resultados se almacenan en:

```text
resultados/resultados.json
```

Para consultar un resumen desde consola:

```bash
node ver-metricas.js --archivo resultados/resultados.json
```

Para consultar el detalle de un registro específico:

```bash
node ver-metricas.js --archivo resultados/resultados.json --id ID_DEL_REGISTRO
```

Ejemplo:

```bash
node ver-metricas.js --archivo resultados/resultados.json --id 3950c7b0
```

## Reinicio de servicios

Para reiniciar los contenedores principales:

```bash
sudo docker restart nginx-replica-rob dnsmasq-rob backend-resultados
```

También puede usarse:

```bash
sudo docker compose restart
```

## Apagado del proyecto

Para detener los contenedores:

```bash
sudo docker compose down
```

Para volver a iniciar:

```bash
sudo docker compose up -d
```

## Limitaciones conocidas

* La réplica depende de navegadores basados en Chromium.
* La File System Access API requiere permisos explícitos del usuario.
* La aplicación debe ejecutarse en HTTPS o en un contexto seguro.
* No se puede acceder libremente a rutas críticas del sistema.
* El cifrado de archivos grandes puede fallar si el navegador no tiene suficiente memoria.
* La versión actual procesa cada archivo completo en memoria.
* Para archivos cercanos o superiores a 1 GiB se recomienda implementar cifrado por fragmentos.
* No se evaluó detección con antivirus, EDR o soluciones comerciales de seguridad.

## Advertencia ética

Este proyecto es únicamente académico. Debe ejecutarse solo en un entorno controlado y con archivos de prueba. No debe utilizarse para afectar equipos, archivos o usuarios reales.
