import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/task.dart';

class DatabaseService {
  static final DatabaseService instance = DatabaseService._init();
  static Database? _database;

  DatabaseService._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('tasks.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    final db = await openDatabase(
      path,
      version: 4,
      onCreate: _createDB,
      onUpgrade: _upgradeDB,
    );
    
    // Garantir que todas as colunas existam (migração de segurança)
    await _ensureColumns(db);
    
    return db;
  }

  // Método auxiliar para garantir que todas as colunas existam
  Future<void> _ensureColumns(Database db) async {
    try {
      // Verificar colunas existentes
      final columns = await db.rawQuery('PRAGMA table_info(tasks)');
      final columnNames = columns.map((col) => col['name'] as String).toSet();
      
      // Lista de colunas necessárias (sem PRIMARY KEY ou NOT NULL para ALTER TABLE)
      final requiredColumns = {
        'dueDate': 'TEXT',
        'reminderTime': 'TEXT',
        'photoPath': 'TEXT',
        'completedAt': 'TEXT',
        'completedBy': 'TEXT',
        'latitude': 'REAL',
        'longitude': 'REAL',
        'locationName': 'TEXT',
      };
      
      // Adicionar colunas faltantes (ignorar id pois é PRIMARY KEY)
      for (final entry in requiredColumns.entries) {
        if (!columnNames.contains(entry.key)) {
          print('➕ Adicionando coluna faltante: ${entry.key}');
          try {
            await db.execute(
              'ALTER TABLE tasks ADD COLUMN ${entry.key} ${entry.value}'
            );
            print('✅ Coluna ${entry.key} adicionada com sucesso');
          } catch (e) {
            print('⚠️ Erro ao adicionar coluna ${entry.key}: $e');
          }
        }
      }
    } catch (e) {
      print('⚠️ Erro ao verificar colunas: $e');
      // Não relançar para não quebrar a inicialização
    }
  }

  Future<void> _createDB(Database db, int version) async {
    await db.execute('''
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        completed INTEGER NOT NULL,
        priority TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        dueDate TEXT,
        reminderTime TEXT,
        photoPath TEXT,
        completedAt TEXT,
        completedBy TEXT,
        latitude REAL,
        longitude REAL,
        locationName TEXT
      )
    ''');
  }

  Future<void> _upgradeDB(Database db, int oldVersion, int newVersion) async {
    print('🔄 Atualizando banco de dados da versão $oldVersion para $newVersion');
    
    try {
      // Versão 1 -> 2: Adicionar dueDate e reminderTime
      if (oldVersion < 2) {
        await db.execute('ALTER TABLE tasks ADD COLUMN dueDate TEXT');
        await db.execute('ALTER TABLE tasks ADD COLUMN reminderTime TEXT');
        print('✅ Colunas dueDate e reminderTime adicionadas');
      }
      
      // Versão 2 -> 3: Adicionar photoPath
      if (oldVersion < 3) {
        await db.execute('ALTER TABLE tasks ADD COLUMN photoPath TEXT');
        print('✅ Coluna photoPath adicionada');
      }
      
      // Versão 3 -> 4: Adicionar campos de GPS e completude
      if (oldVersion < 4) {
        await db.execute('ALTER TABLE tasks ADD COLUMN completedAt TEXT');
        await db.execute('ALTER TABLE tasks ADD COLUMN completedBy TEXT');
        await db.execute('ALTER TABLE tasks ADD COLUMN latitude REAL');
        await db.execute('ALTER TABLE tasks ADD COLUMN longitude REAL');
        await db.execute('ALTER TABLE tasks ADD COLUMN locationName TEXT');
        print('✅ Colunas de GPS e completude adicionadas');
      }
      
      print('✅ Banco de dados atualizado com sucesso!');
    } catch (e) {
      print('❌ Erro ao atualizar banco de dados: $e');
      rethrow;
    }
  }

  Future<Task> create(Task task) async {
    final db = await database;
    await db.insert('tasks', task.toMap());
    return task;
  }

  Future<Task?> read(String id) async {
    final db = await database;
    final maps = await db.query(
      'tasks',
      where: 'id = ?',
      whereArgs: [id],
    );

    if (maps.isNotEmpty) {
      return Task.fromMap(maps.first);
    }
    return null;
  }

  Future<List<Task>> readAll() async {
    final db = await database;
    final result = await db.query('tasks');
    final tasks = result.map((map) => Task.fromMap(map)).toList();
    
    // Sort by due date first (overdue first, then upcoming), then by priority, then by creation date
    tasks.sort((a, b) {
      // Tasks with due dates come first
      if (a.dueDate != null && b.dueDate == null) return -1;
      if (a.dueDate == null && b.dueDate != null) return 1;
      
      // Both have due dates - sort by date
      if (a.dueDate != null && b.dueDate != null) {
        final dateComparison = a.dueDate!.compareTo(b.dueDate!);
        if (dateComparison != 0) return dateComparison;
      }
      
      // If same due date or no due dates, sort by priority
      final priorityOrder = {'urgent': 0, 'high': 1, 'medium': 2, 'low': 3};
      final aPriority = priorityOrder[a.priority] ?? 2;
      final bPriority = priorityOrder[b.priority] ?? 2;
      final priorityComparison = aPriority.compareTo(bPriority);
      if (priorityComparison != 0) return priorityComparison;
      
      // Finally sort by creation date (newest first)
      return b.createdAt.compareTo(a.createdAt);
    });
    
    return tasks;
  }

  Future<int> update(Task task) async {
    final db = await database;
    return db.update(
      'tasks',
      task.toMap(),
      where: 'id = ?',
      whereArgs: [task.id],
    );
  }

  Future<int> delete(String id) async {
    final db = await database;
    return await db.delete(
      'tasks',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // Método especial: buscar tarefas por proximidade
  Future<List<Task>> getTasksNearLocation({
    required double latitude,
    required double longitude,
    double radiusInMeters = 1000,
  }) async {
    final allTasks = await readAll();
    return allTasks.where((task) {
      if (!task.hasLocation) return false;
      // Cálculo de distância usando fórmula de Haversine (simplificada)
      final latDiff = (task.latitude! - latitude).abs();
      final lonDiff = (task.longitude! - longitude).abs();
      final distance = ((latDiff * 111000) + (lonDiff * 111000)) / 2;
      return distance <= radiusInMeters;
    }).toList();
  }
  Future close() async {
    final db = await instance.database;
    db.close();
  }
}