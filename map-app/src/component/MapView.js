import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Draw } from 'ol/interaction';
import { Style, Stroke, Fill } from 'ol/style';
import Modal from 'react-modal';
import { FaDrawPolygon } from "react-icons/fa";
import { IoAnalyticsOutline } from "react-icons/io5";
import { getDistance } from 'ol/sphere';

Modal.setAppElement('#root');

const MapView = () => {
    const mapRef = useRef();
    const [map, setMap] = useState(null);
    const [drawMode, setDrawMode] = useState(null);
    const [coordinates, setCoordinates] = useState([]);
    const [distances, setDistances] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [waypoints, setWaypoints] = useState([]);
    const [activeDropdown, setActiveDropdown] = useState(null); // Tracks active dropdown

    useEffect(() => {
        const vectorSource = new VectorSource();

        const vectorLayer = new VectorLayer({
            source: vectorSource,
            style: new Style({
                stroke: new Stroke({ color: 'blue', width: 2 }),
                fill: new Fill({ color: 'rgba(0, 0, 255, 0.1)' }),
            }),
        });

        const initialMap = new Map({
            target: mapRef.current,
            layers: [
                new TileLayer({
                    source: new OSM(),
                }),
                vectorLayer,
            ],
            view: new View({
                center: [78.9629, 20.5937], // Center on India
                zoom: 5,
                projection: 'EPSG:4326',
            }),
        });

        setMap(initialMap);
        return () => initialMap.setTarget(null);
    }, []);

    useEffect(() => {
        if (!map || !drawMode) return;

        const vectorSource = map.getLayers().array_[1].getSource();

        const drawInteraction = new Draw({
            source: vectorSource,
            type: drawMode,
        });

        drawInteraction.on('drawstart', (event) => {
            setIsModalOpen(true); // Open modal when drawing starts
            const geometry = event.feature.getGeometry();
            geometry.on('change', () => updateCoordinates(geometry)); // Update in real-time
        });

        drawInteraction.on('drawend', () => {
            setDrawMode(null);
        });

        map.addInteraction(drawInteraction);

        return () => map.removeInteraction(drawInteraction);
    }, [map, drawMode]);

    const updateCoordinates = (geometry) => {
        const coords = geometry.getCoordinates();

        if (geometry.getType() === 'Polygon') {
            const rings = coords[0]; // Outer ring
            setCoordinates(rings);
            const newWaypoints = rings.map((coord, index) => ({
                waypoint: String(index + 1).padStart(2, '0'),
                coordinates: `(${coord[0].toFixed(8)}, ${coord[1].toFixed(8)})`,
            }));
            setWaypoints(newWaypoints);
        } else if (geometry.getType() === 'LineString') {
            setCoordinates(coords);
            const newWaypoints = coords.map((coord, index) => ({
                waypoint: String(index + 1).padStart(2, '0'),
                coordinates: `(${coord[0].toFixed(8)}, ${coord[1].toFixed(8)})`,
            }));
            setWaypoints(newWaypoints);
        }
    };

    const handlePolygonInsertion = (index, position) => {
        setDrawMode("Polygon"); // Enable Polygon drawing
        const vectorSource = map.getLayers().array_[1].getSource(); // Access the vector source

        map.once("drawend", (event) => {
            const polygonGeometry = event.feature.getGeometry();
            const polygonCoordinates = polygonGeometry.getCoordinates()[0]; // Outer ring

            // Add the drawn polygon to the map
            vectorSource.addFeature(event.feature);

            // Update waypoints with the new polygon connection
            const updatedWaypoints = [...waypoints];
            const polygonConnection = {
                waypoint: `P${index + 1}`,
                coordinates: `(${polygonCoordinates[0][0].toFixed(8)}, ${polygonCoordinates[0][1].toFixed(8)})`,
            };

            if (position === "before") {
                updatedWaypoints.splice(index, 0, polygonConnection);
            } else if (position === "after") {
                updatedWaypoints.splice(index + 1, 0, polygonConnection);
            }

            setWaypoints(updatedWaypoints);
            setDrawMode(null); // Exit draw mode
            setIsModalOpen(true); // Reopen modal to show updates
        });
    };

    const toggleDropdown = (index) => {
        setActiveDropdown(activeDropdown === index ? null : index);
    };

    const closeDropdown = () => {
        setActiveDropdown(null);
    };

    return (
        <div style={{ position: 'relative', height: '100vh', width: '100%' }} onClick={closeDropdown}>
            <div ref={mapRef} style={{ height: '100%', width: '100%' }}></div>

            <div style={{ position: 'absolute', top: 10, left: 40, zIndex: 1000 }}>
                <button
                    className='bg-blue-900 inline-flex gap-2 text-white px-3 py-2 rounded-md'
                    onClick={() => setDrawMode('LineString')}
                    style={{ margin: '5px' }}
                >
                    <IoAnalyticsOutline size={20} /> Draw LineString
                </button>
                <button
                    className='bg-blue-900 text-white gap-2 inline-flex px-3 py-2 rounded-md'
                    onClick={() => setDrawMode('Polygon')}
                    style={{ margin: '5px' }}
                >
                    <FaDrawPolygon size={20} /> Draw Polygon
                </button>
                <button
                    className='bg-red-700 text-white gap-2 inline-flex px-3 py-2 rounded-md'
                    onClick={() => {
                        const vectorSource = map.getLayers().array_[1].getSource();
                        vectorSource.clear();
                        setCoordinates([]);
                        setWaypoints([]);
                        setDistances([]);
                        setIsModalOpen(false);
                    }}
                    style={{ margin: '5px' }}
                >
                    Clear
                </button>
            </div>

            {isModalOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: '10%',
                        right: '2%',
                        width: '320px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e0e0e0',
                        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
                        borderRadius: '12px',
                        padding: '20px',
                        zIndex: 2000,
                        fontFamily: 'Arial, sans-serif',
                    }}
                >
                    <h2 className='text-sm' style={{ marginBottom: '16px', color: '#333' }}>Drawing Details</h2>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className='overflow-y-auto'>
                        {waypoints.map((wp, index) => (
                            <li key={index} style={{ position: 'relative', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span  className='text-sm'  style={{  color: '#555' }}>
                                        {wp.waypoint}: <span style={{ fontWeight: 'bold' }}>{wp.coordinates}</span>
                                    </span>
                                    <button
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '6px',
                                            
                                            color: '#777',
                                            transition: 'color 0.3s',
                                        }}

                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleDropdown(index);
                                        }}
                                        onMouseEnter={(e) => (e.target.style.color = '#333')}
                                        onMouseLeave={(e) => (e.target.style.color = '#777')}
                                        className='text-sm' 
                                    >
                                        &#8942;
                                    </button>

                                </div>
                                {activeDropdown === index && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '100%',
                                            right: 0,
                                            background: '#fff',
                                            border: '1px solid #ddd',
                                            borderRadius: '5px',
                                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                            zIndex: 3000,
                                            width: '200px',
                                        }}
                                    >
                                        <button
                                            style={{
                                                display: 'block',
                                                padding: '12px',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                border: 'none',
                                                background: 'none',
                                                color: '#333',
                                                transition: 'background-color 0.3s',
                                            }}
                                            onClick={() => handlePolygonInsertion(index, 'before')}
                                            onMouseEnter={(e) => (e.target.style.backgroundColor = '#f0f0f0')}
                                            onMouseLeave={(e) => (e.target.style.backgroundColor = 'transparent')}
                                            className='text-sm' 
                                        >
                                            Insert Polygon Before
                                        </button>
                                        <button
                                            style={{
                                                display: 'block',
                                                padding: '12px',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                border: 'none',
                                                background: 'none',
                                                color: '#333',
                                                transition: 'background-color 0.3s',
                                            }}
                                            onClick={() => handlePolygonInsertion(index, 'after')}
                                            onMouseEnter={(e) => (e.target.style.backgroundColor = '#f0f0f0')}
                                            onMouseLeave={(e) => (e.target.style.backgroundColor = 'transparent')}
                                            className='text-sm' 
                                        >
                                            Insert Polygon After
                                        </button>
                                    </div>
                                )}
                              
                            </li>
                        ))}
                          <button className='bg-blue-800 text-white p-2 rounded-md'>Generated Data</button>
                    </ul>
                </div>
            )}

        </div>
    );
};

export default MapView;
