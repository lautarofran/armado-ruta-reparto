// Inicialización mapa
const map = L.map('map').setView([-34.6037, -58.3816], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Array global de direcciones con marcadores
let direcciones = []; // {id, texto, lat, lng, marcador}

// Función para agregar dirección y marcador
function agregarDireccion(textoOriginal, lat, lng, labelMostrado = null) {
    const id = Date.now() + Math.random(); // id único
    const texto = labelMostrado || textoOriginal;

    const marcador = L.marker([lat, lng]).addTo(map).bindPopup(texto);

    // Si no hay direcciones, agregamos como inicio
    if (direcciones.length === 0) {
        direcciones.push({ id, texto, lat, lng, marcador }); // inicio
    } else {
        // Si hay al menos 1 dirección, insertamos antes del destino para no reemplazar destino
        if (direcciones.length === 1) {
            // Solo inicio está, agregamos destino
            direcciones.push({ id, texto, lat, lng, marcador });
        } else {
            // Hay inicio y destino, insertamos antes del último (destino)
            direcciones.splice(direcciones.length - 1, 0, { id, texto, lat, lng, marcador });
        }
    }

    actualizarListado();
    map.setView([lat, lng], 13);
}

// Actualizar listado en HTML
function actualizarListado() {
    const lista = document.getElementById("lista-direcciones");
    lista.innerHTML = "";

    direcciones.forEach((dir, index) => {
        const div = document.createElement("div");
        div.className = "item-direccion";
        div.dataset.id = dir.id;

        if (index === 0 || index === direcciones.length - 1) {
            div.classList.add("no-drag"); // evita mover inicio y destino con drag
        }

        let etiqueta = "";

        if (index === 0) {
            etiqueta = `<strong>Inicio:</strong>`;
        } else if (index === direcciones.length - 1) {
            etiqueta = `<strong>Destino:</strong>`;
        } else {
            etiqueta = `<strong>${index}.</strong>`;
        }

        div.innerHTML = `
            <span class="etiqueta">${etiqueta}</span>
            <input type="text" value="${dir.texto}" />
            <button class="btn-eliminar" title="Eliminar">Eliminar</button>
            <span class="handle" title="Arrastrar para mover">⇅</span>
        `;

        // Cambiar dirección
        div.querySelector("input").addEventListener("change", async (e) => {
            await modificarDireccion(dir.id, e.target.value);
        });

        // Eliminar dirección
        div.querySelector(".btn-eliminar").addEventListener("click", () => {
            eliminarDireccion(dir.id);
        });

        lista.appendChild(div);
    });
}


// Modificar dirección con geocodificación
async function modificarDireccion(id, nuevoTexto) {
    const dir = direcciones.find(d => d.id === id);
    if (!dir) return;

    const coords = await geocodificarDireccion(nuevoTexto);
    if (!coords) {
        alert("No se encontró la dirección");
        actualizarListado(); // Para resetear input al valor original
        return;
    }

    dir.texto = nuevoTexto;
    dir.lat = coords.lat;
    dir.lng = coords.lng;

    dir.marcador.setLatLng([coords.lat, coords.lng]);
    dir.marcador.bindPopup(nuevoTexto);
    dir.marcador.openPopup();

    actualizarListado();
    map.setView([coords.lat, coords.lng], 13);
}

// Eliminar dirección
function eliminarDireccion(id) {
    const index = direcciones.findIndex(d => d.id === id);
    if (index === -1) return;

    map.removeLayer(direcciones[index].marcador);
    direcciones.splice(index, 1);
    actualizarListado();
}

// Geocodificar con Nominatim
function geocodificarDireccion(direccion) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ", Buenos Aires")}&addressdetails=1`;

    return fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    label: data[0].display_name // dirección completa
                };
            } else {
                return null;
            }
        }).catch(() => null);
}

// Agregar punto desde input
async function agregarPunto() {
    const input = document.getElementById('direccion');
    const valor = input.value.trim();
    if (!valor) return alert("Ingresá una dirección o coordenadas");

    let lat, lng, label = null;

    if (valor.includes(',')) {
        // Coordenadas manuales
        const partes = valor.split(',');
        lat = parseFloat(partes[0]);
        lng = parseFloat(partes[1]);

        if (isNaN(lat) || isNaN(lng)) {
            alert("Coordenadas inválidas");
            return;
        }

        label = `${lat}, ${lng}`;
    } else {
        // Geocodificar dirección
        const coords = await geocodificarDireccion(valor);
        if (!coords) return alert("No se encontró la dirección");
        lat = coords.lat;
        lng = coords.lng;
        label = coords.label;
    }

    agregarDireccion(valor, lat, lng, label);
    input.value = "";
}

// Cargar puntos desde archivo JSON (con geocodificación)
document.getElementById("archivoJson").addEventListener("change", function (e) {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = async function (event) {
        try {
            const datos = JSON.parse(event.target.result);

            for (const punto of datos) {
                const coords = await geocodificarDireccion(punto.texto);
                if (coords) {
                    agregarDireccion(punto.texto, coords.lat, coords.lng, coords.label);
                } else {
                    console.warn("No se pudo geocodificar:", punto.texto);
                }
            }

        } catch (err) {
            console.error("Error al procesar archivo:", err);
            alert("Archivo JSON inválido");
        }
    };
    lector.readAsText(archivo);
});

// SortableJS para bloquear mover primer y último item (inicio y destino)
new Sortable(document.getElementById('lista-direcciones'), {
    animation: 150,
    handle: '.handle',
    filter: '.no-drag', // clase para bloquear drag
    onMove: function (evt) {
        // Bloquear mover primer o último elemento
        if (evt.related.classList.contains('no-drag')) return false;
        if (evt.dragged.classList.contains('no-drag')) return false;
        return true;
    },
    onEnd: function (evt) {
        // Cambiar orden en array direcciones pero solo de los que pueden moverse
        // Evitamos mover inicio y destino, que tienen clase no-drag
        if (
            evt.oldIndex === 0 || evt.oldIndex === direcciones.length - 1 ||
            evt.newIndex === 0 || evt.newIndex === direcciones.length - 1
        ) {
            // No permitimos mover inicio ni destino
            actualizarListado();
            return;
        }

        const item = direcciones.splice(evt.oldIndex, 1)[0];
        direcciones.splice(evt.newIndex, 0, item);
    }
});

// Función para calcular ruta optimizada con puntos fijos inicio y fin
async function calcularRuta() {
    if (direcciones.length < 3) {
        alert("Necesitás al menos tres puntos: partida, uno o más intermedios y llegada.");
        return;
    }

    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjkwZDRjYzMyZDJhMjQ2MjVhZWQwZDg4NTY1MTVlZGMyIiwiaCI6Im11cm11cjY0In0="; // Cambiá por tu API key válida
    const start = [direcciones[0].lng, direcciones[0].lat]; // primer punto fijo
    const end = [direcciones[direcciones.length - 1].lng, direcciones[direcciones.length - 1].lat]; // último punto fijo

    // jobs: puntos intermedios con id
    const jobs = direcciones
        .slice(1, direcciones.length - 1)
        .map((d, i) => ({ id: i + 1, location: [d.lng, d.lat] }));

    const vehicles = [{
        id: 1,
        profile: "driving-car",
        start: start,
        end: end
    }];

    const payload = { jobs, vehicles, options: { geometry: true } };

    try {
        // Primero: optimizar orden con /optimization
        const res = await fetch("https://api.openrouteservice.org/optimization", {
            method: "POST",
            headers: {
                "Authorization": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!data?.routes?.[0]) {
            alert("No se pudo calcular ruta optimizada.");
            return;
        }

        // Extraer orden de jobs optimizados
        const ordenJobs = data.routes[0].steps
            .filter(s => s.type === "job")
            .map(s => s.job - 1);

        // Reconstruir arreglo direcciones respetando inicio y fin
        const nuevaOrden = [];
        nuevaOrden.push(direcciones[0]); // inicio fijo
        ordenJobs.forEach(idx => {
            nuevaOrden.push(direcciones[idx + 1]);
        });
        nuevaOrden.push(direcciones[direcciones.length - 1]); // fin fijo

        direcciones = nuevaOrden;
        actualizarListado();

        // Obtener coords en nuevo orden para dibujar ruta
        const coords = direcciones.map(d => [d.lng, d.lat]);

        // Obtener ruta detallada con /v2/directions/driving-car
        const dirRes = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
            method: "POST",
            headers: {
                "Authorization": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ coordinates: coords })
        });

        const dirData = await dirRes.json();

        if (!dirData?.features?.length) {
            alert("No se pudo obtener la ruta.");
            return;
        }

        // Dibujar la ruta
        if (window.rutaLayer) map.removeLayer(window.rutaLayer);
        window.rutaLayer = L.geoJSON(dirData).addTo(map);

        map.fitBounds(window.rutaLayer.getBounds());

        // Mostrar distancia y duración
        const distanciaKm = (dirData.features[0].properties.summary.distance / 1000).toFixed(2);
        const duracionMin = (dirData.features[0].properties.summary.duration / 60).toFixed(1);

        document.getElementById("resumenRuta").innerText =
            `🛣️ Distancia total: ${distanciaKm} km 
             ⏱️ Tiempo estimado: ${duracionMin} minutos`;

    } catch (e) {
        console.error(e);
        alert("Error calculando ruta optimizada.");
    }
}

