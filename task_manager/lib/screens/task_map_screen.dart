import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' as latlng;
import '../models/task.dart';
import '../services/database_service.dart';
import '../services/location_service.dart';
import 'task_form_screen.dart';

class TaskMapScreen extends StatefulWidget {
  const TaskMapScreen({super.key});

  @override
  State<TaskMapScreen> createState() => _TaskMapScreenState();
}

class _TaskMapScreenState extends State<TaskMapScreen> {
  final MapController _mapController = MapController();
  List<Task> _tasks = [];
  bool _isLoading = true;
  latlng.LatLng? _currentLocation;

  @override
  void initState() {
    super.initState();
    _loadTasksWithLocation();
    _getCurrentLocation();
  }

  Future<void> _getCurrentLocation() async {
    final position = await LocationService.instance.getCurrentLocation();
    if (position != null && mounted) {
      setState(() {
        _currentLocation = latlng.LatLng(position.latitude, position.longitude);
      });
      
      // Mover a câmera para a localização atual
      _mapController.move(_currentLocation!, 15);
    }
  }

  Future<void> _loadTasksWithLocation() async {
    setState(() => _isLoading = true);
    try {
      final allTasks = await DatabaseService.instance.readAll();
      print('📍 Total de tarefas: ${allTasks.length}');
      
      final tasksWithLocation = allTasks.where((task) => task.hasLocation).toList();
      print('📍 Tarefas com localização: ${tasksWithLocation.length}');
      
      for (var task in tasksWithLocation) {
        print('📍 Tarefa: ${task.title} - Lat: ${task.latitude}, Lng: ${task.longitude}');
      }
      
      if (mounted) {
        setState(() {
          _tasks = tasksWithLocation;
          _isLoading = false;
        });
        
        print('📍 Marcadores criados: ${_buildMarkers().length}');
        
        // Ajustar câmera para mostrar todas as tarefas
        if (_tasks.isNotEmpty) {
          Future.delayed(const Duration(milliseconds: 300), () {
            if (mounted) {
              _fitBoundsToMarkers();
            }
          });
        }
      }
    } catch (e) {
      print('❌ Erro ao carregar tarefas: $e');
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro ao carregar tarefas: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _fitBoundsToMarkers() {
    if (_tasks.isEmpty) return;

    final tasksWithLocation = _tasks.where((task) => task.hasLocation).toList();
    if (tasksWithLocation.isEmpty) return;

    double minLat = tasksWithLocation.first.latitude!;
    double maxLat = tasksWithLocation.first.latitude!;
    double minLng = tasksWithLocation.first.longitude!;
    double maxLng = tasksWithLocation.first.longitude!;

    for (final task in tasksWithLocation) {
      if (task.latitude! < minLat) minLat = task.latitude!;
      if (task.latitude! > maxLat) maxLat = task.latitude!;
      if (task.longitude! < minLng) minLng = task.longitude!;
      if (task.longitude! > maxLng) maxLng = task.longitude!;
    }

    // Calcular centro e zoom aproximado
    final centerLat = (minLat + maxLat) / 2;
    final centerLng = (minLng + maxLng) / 2;
    
    // Calcular zoom baseado na distância
    final latDiff = maxLat - minLat;
    final lngDiff = maxLng - minLng;
    final maxDiff = latDiff > lngDiff ? latDiff : lngDiff;
    
    double zoom = 12;
    if (maxDiff > 0) {
      // Ajustar zoom baseado na área
      if (maxDiff > 1) zoom = 10;
      else if (maxDiff > 0.5) zoom = 11;
      else if (maxDiff > 0.1) zoom = 13;
      else if (maxDiff > 0.05) zoom = 14;
      else zoom = 15;
    }

    _mapController.move(
      latlng.LatLng(centerLat, centerLng),
      zoom,
    );
  }

  List<Marker> _buildMarkers() {
    final markers = <Marker>[];
    
    for (final task in _tasks) {
      if (task.hasLocation && task.latitude != null && task.longitude != null) {
        try {
          markers.add(
            Marker(
              point: latlng.LatLng(task.latitude!, task.longitude!),
              width: 40,
              height: 40,
              child: GestureDetector(
                onTap: () => _showTaskDetails(task),
                child: Container(
                  decoration: BoxDecoration(
                    color: task.completed ? Colors.green : Colors.red,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 3),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.3),
                        blurRadius: 6,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Icon(
                    task.completed ? Icons.check : Icons.location_on,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
              ),
            ),
          );
          print('✅ Marcador criado para: ${task.title}');
        } catch (e) {
          print('❌ Erro ao criar marcador para ${task.title}: $e');
        }
      } else {
        print('⚠️ Tarefa ${task.title} sem localização válida');
      }
    }
    
    print('📍 Total de marcadores no mapa: ${markers.length}');
    return markers;
  }

  void _showTaskDetails(Task task) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    task.title,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Icon(
                  task.completed ? Icons.check_circle : Icons.pending,
                  color: task.completed ? Colors.green : Colors.orange,
                ),
              ],
            ),
            if (task.description.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                task.description,
                style: TextStyle(color: Colors.grey[600]),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.location_on, size: 16, color: Colors.blue),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    task.locationName ?? 
                    LocationService.instance.formatCoordinates(
                      task.latitude!,
                      task.longitude!,
                    ),
                    style: TextStyle(color: Colors.grey[700]),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Fechar'),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => TaskFormScreen(task: task),
                      ),
                    ).then((_) => _loadTasksWithLocation());
                  },
                  icon: const Icon(Icons.edit),
                  label: const Text('Editar'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mapa de Tarefas'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.my_location),
            onPressed: _getCurrentLocation,
            tooltip: 'Minha localização',
          ),
          IconButton(
            icon: const Icon(Icons.fit_screen),
            onPressed: _fitBoundsToMarkers,
            tooltip: 'Ajustar visão',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadTasksWithLocation,
            tooltip: 'Atualizar',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _tasks.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.map_outlined,
                        size: 80,
                        color: Colors.grey[300],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Nenhuma tarefa com localização',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                )
              : Stack(
                  children: [
                    FlutterMap(
                      mapController: _mapController,
                      options: MapOptions(
                        initialCenter: _currentLocation ??
                            (_tasks.isNotEmpty 
                                ? latlng.LatLng(
                                    _tasks.first.latitude ?? -23.5505,
                                    _tasks.first.longitude ?? -46.6333,
                                  )
                                : const latlng.LatLng(-23.5505, -46.6333)),
                        initialZoom: 12,
                        onTap: (tapPosition, point) {
                          // Permitir interação com o mapa
                        },
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'com.example.task_manager',
                          maxZoom: 19,
                        ),
                        MarkerLayer(
                          markers: _buildMarkers(),
                        ),
                      ],
                    ),
                    if (_tasks.isNotEmpty)
                      Positioned(
                        top: 16,
                        left: 16,
                        right: 16,
                        child: Card(
                          color: Colors.white.withOpacity(0.9),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                const Icon(Icons.location_on, color: Colors.blue),
                                const SizedBox(width: 8),
                                Text(
                                  '${_tasks.length} tarefa${_tasks.length != 1 ? 's' : ''} no mapa',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const TaskFormScreen(),
            ),
          );
          if (result == true) {
            _loadTasksWithLocation();
          }
        },
        icon: const Icon(Icons.add),
        label: const Text('Nova Tarefa'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
      ),
    );
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }
}
