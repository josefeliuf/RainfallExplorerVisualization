const width_map = 300;
const height_map = 600;
const width_chart = 900;
const height_chart = 400;
const margin = {
    top: 40,
    bottom: 40,
    right: 70,
    left: 70,
};

let estaciones_seleccionadas = []
let activeCircles = []
let escalaX;
let escalaY;
let proyeccion;
let transformacion;


const svg_1 = d3.select('.map-container')
                .append('svg')
                .attr('width', width_map)
                .attr('height', height_map);

const svg_2 = d3.select(".line-chart-container")
                .append("svg")
                .attr('width', width_chart)
                .attr('height', height_chart + margin.top + margin.bottom);

const map = svg_1.append('g')
                 .attr('id', 'map-container')
                 .attr('translate', `translate(${margin.left}, ${margin.top})`)
map
    .append("clipPath")
    .attr("id", "clip")
    .append("rect")
    .attr("width", width_map)
    .attr("height", height_map);

map.attr("clip-path", "url(#clip)")

const regionsContainer = map.append("g").attr("id", "regiones")
const stationsContainer = map.append("g").attr("id", "estaciones")

const selectContainer = d3.select('.select')

const selectorEstaciones = selectContainer
                                .append("select")
                                .attr("class", "selector");

const btnSeleccionar = selectContainer
                                .append("button")
                                .text("Seleccionar")

const chart = svg_2.append("g")
                    .attr('id', 'line-chart-container')
                    .attr('transform', `translate(${margin.left}, ${margin.top - 15})`);

const contenedorEjex = svg_2.append("g")
                                .attr("class", "eje")
                                .attr('transform', `translate(${margin.left}, ${height_chart + margin.bottom})`);

const contenedorEjey = svg_2.append("g")
                                .attr("class", "eje")
                                .attr('transform', `translate(${margin.left}, ${margin.top - 15})`);

const colorScale = d3.scaleOrdinal()

async function loadData() {
    const estaciones = await d3.json("datos/estaciones.json")
    const datosTopo = await d3.json("datos/regiones.json")
    const regiones = topojson.feature(datosTopo, datosTopo.objects.regiones)

    return {estaciones, regiones};
}

loadData().then(({estaciones, regiones}) => {

    proyeccion = d3.geoMercator().fitSize([width_map, height_map], regiones);
    const caminosGeo = d3.geoPath().projection(proyeccion);
    
    initSelectorEstaciones(estaciones)
    joinRegions(regiones, caminosGeo);
    joinStations(estaciones, proyeccion);
})

function initSelectorEstaciones(estaciones) {
    selectorEstaciones.selectAll("option")
                        .data(estaciones)
                        .join("option")
                        .attr("value", (d) => d.nombre)
                        .text((d) => d.nombre);

    selectorEstaciones
                    .on("change", (e) => {
                        const valorActual = selectorEstaciones.node().value;
                        handleEstacionZoom(valorActual)
                    })

    btnSeleccionar
                .on("click", (e) => {
                    onBtnSeleccionarClicked(estaciones)
                })
}

function onBtnSeleccionarClicked(estaciones) {
    const valorActual = selectorEstaciones.node().value;
    if (!estaciones_seleccionadas.includes(valorActual)) {
        if (estaciones_seleccionadas.length < 5) {
            estaciones_seleccionadas.push(valorActual)
            createLineChart(estaciones, estaciones_seleccionadas)
        } else {
            console.log('No puedes añadir más estaciones al gráfico, estaciones selecionadas: ' + estaciones_seleccionadas.length)
        }
    } else {
        console.log("La estación ya está seleccionada")
    }

}


function handleEstacionZoom(estacion) {
    console.log("handleZoomToCircle when a station is selected, station: " + estacion)
    // let circle = stationsContainer.select()
    // const transformacion = d3.zoomIndentity.scale(4).translate()

}

function getMaxAttribute(precipitacionesEstaciones) {
    let maxAttrY = 0
    precipitacionesEstaciones.forEach(estacion => {
        let max = d3.max(estacion.precipitaciones, (d) => d.valor)
        if (max > maxAttrY) {
            maxAttrY = max
        }
    });
    return maxAttrY
}

function createLineChart(estaciones, estaciones_seleccionadas) {

    const precipitacionesEstaciones = estaciones.filter((estacion) => estaciones_seleccionadas.includes(estacion.nombre));

    //define colorScale for lines
    colorScale.domain(estaciones_seleccionadas).range(d3.schemePaired);
    
    let maxAttrY = getMaxAttribute(precipitacionesEstaciones)

    escalaX = d3
                .scaleBand()
                .domain(estaciones[0].precipitaciones.map((d) => d.fecha))
                .range([0, width_chart - margin.right])

    escalaY = d3
                .scaleLinear()
                .domain([0, maxAttrY])
                .range([height_chart, 0])

    let ejeX = d3.axisBottom(escalaX).tickValues(escalaX.domain().filter(function(_,i){return !(i%3);}));
    let ejeY = d3.axisLeft(escalaY)

    contenedorEjex.transition().call(ejeX)
    contenedorEjey.transition().call(ejeY)
    
    contenedorEjex
                .transition()
                .duration(1000)
                .call(ejeX)
                .selectAll("text")
                .attr("opacity", 1);

    contenedorEjey
                .transition()
                .duration(1000)
                .call(ejeY)
                .selectAll("text")
                .attr("opacity", 1);

    const line = d3.line()
        .curve(d3.curveBasis)
        .x((d) => escalaX(d.fecha))
        .y((d) => escalaY(d.valor))

    chart.selectAll("path")
        .data(precipitacionesEstaciones, (d) => d.nombre)
        .join(
            (enter) =>
                enter
                    .append("path")
                    .attr("d", (d) => line(generadorLineas(d)))
                    .attr("stroke", colorScale)
                    .transition()
                    .duration(1000)
                    .attr("stroke-width", 2),
            (update) =>
                update
                    .transition()
                    .duration(1000)
                    .attr("d", (d) => line(generadorLineas(d))),
            (exit) =>
                exit
                    .transition()
                    .duration(1000)
                    .attr("stroke-width", 0)
                    .remove()
        )
        .attr("class", "linea")
        .attr("fill", "none")
        .attr("id", (d) => d.nombre)
}

function generadorLineas(d) {
    return d.precipitaciones
}

function joinRegions(regiones, caminosGeo) {

    console.log(regiones)

    regionsContainer
        .selectAll("path")
        .data(regiones.features)
        .enter()
        .append("path")
        .attr("d", caminosGeo)
        .attr("stroke", "#ccc")
        .attr("stroke-width", 0.3)
        .attr("fill", "white");
}

function joinStations(estaciones, proyeccion) {

    console.log(estaciones)

    stationsContainer
        .selectAll("circle")
        .data(estaciones, (d) => d.nombre)
        .join(
            (enter) =>
                enter
                    .append("circle")
                    .attr("class", "estacion")
                    .attr("id", (d) => d.nombre)
                    .attr("cx", (d) => proyeccion([d.longitud, d.latitud])[0])
                    .attr("cy", (d) => proyeccion([d.longitud, d.latitud])[1])
                    .attr("r", 4)
                    .attr("fill", "black"),
            (update) =>
                update
                    .attr("id", (d) => d.nombre)
                    .attr("cx", (d) => proyeccion([d.longitud, d.latitud])[0])
                    .attr("cy", (d) => proyeccion([d.longitud, d.latitud])[1])
                    .attr("r", 4),
            (exit) => 
                exit.remove()
        )
        .on("mouseenter", (i, d) => {
            handleMouseEnter(i, d)
        })
        .on("mouseleave", (i, d) => {
            handleMouseLeave(i, d)
        })
        .on("click", (i, d) => {
            handleCircleClicked(i, d)
        })
}

const handleCircleClicked = (i, d) => {
    if (activeCircles.includes(d.nombre)) {
        // is already active, remove from chart
        handleCircleActive(i, d)
    } else {
        // not active, add it to the chart
        handleCircleNotActive(i, d)
    }
}

function handleCircleActive(i, d) {
    console.log("removing circle from active list")
    const index = activeCircles.indexOf(d.nombre)
    activeCircles.splice(index, 1)
}

function handleCircleNotActive(i, d) {
    if (!estaciones_seleccionadas.includes(d.nombre)) {
        if (estaciones_seleccionadas.length < 5) {
            console.log("adding circle to active list")
            activeCircles.push(d.nombre)
        }
    }
}

const handleMouseEnter = (i, d) => {
    stationsContainer.append("text")
                        .attr("id", "label")
                        .attr("transform", transformacion)
                        .attr("x", proyeccion([d.longitud, d.latitud])[0])
                        .attr("y", proyeccion([d.longitud, d.latitud])[1] - 10)
                        .attr("font-family", "sans-serif")
                        .attr("font-size", 10)
                        .attr("text-anchor", "middle")
                        .text(d.nombre)
}

const handleMouseLeave = (i, d) => {
    var text = document.querySelectorAll('#label');
    text.forEach((txt) => {
        txt.style.visibility = "hidden"
    })
}

const manejadorZoom = (evento) => {
    transformacion = evento.transform;

    regionsContainer.selectAll("path")
        .attr("transform", transformacion)

    stationsContainer.selectAll("circle")
        .attr("transform", transformacion)
        .attr("r", 4 - Math.log2(transformacion.k * 1.15))

    stationsContainer.selectAll("text")
        .attr("transform", transformacion)
        .attr("font-size", 10 - transformacion.k)
    
}

const zoom = d3
        .zoom()
        .extent([
            [0, 0],
            [width_map, height_map],
        ])
        .translateExtent([
            [0, 0],
            [width_map, height_map],
        ])
        .scaleExtent([1, 10])
        .on("zoom", manejadorZoom);

svg_1.call(zoom)