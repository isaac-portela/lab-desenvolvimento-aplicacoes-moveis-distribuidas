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

    return await openDatabase(
      path,
      version: 2,
      onCreate: _createDB,
      onUpgrade: _upgradeDB,
    );
  }

  Future<void> _createDB(Database db, int version) async {
    await db.execute('''
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        completed INTEGER NOT NULL,
        priority TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        dueDate TEXT,
        reminderTime TEXT
      )
    ''');
  }

  Future<void> _upgradeDB(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      // Add dueDate and reminderTime columns
      await db.execute('ALTER TABLE tasks ADD COLUMN dueDate TEXT');
      await db.execute('ALTER TABLE tasks ADD COLUMN reminderTime TEXT');
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
}