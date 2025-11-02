import 'package:uuid/uuid.dart';

class Task {
  final String id;
  final String title;
  final String description;
  final bool completed;
  final String priority;
  final DateTime createdAt;
  final DateTime? dueDate;
  final DateTime? reminderTime;

  // CÂMERA
  final String? photoPath;
  // SENSORES
  final DateTime? completedAt;
  final String? completedBy;      // 'manual', 'shake'
  // GPS
  final double? latitude;
  final double? longitude;
  final String? locationName;


  Task({
    String? id,
    required this.title,
    this.description = '',
    this.completed = false,
    this.photoPath,
    this.completedAt,
    this.completedBy,
    this.latitude,
    this.longitude,
    this.locationName,
    this.priority = 'medium',
    DateTime? createdAt,
    this.dueDate,
    this.reminderTime,
  })  : id = id ?? const Uuid().v4(),
        createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'completed': completed ? 1 : 0,
      'priority': priority,
      'createdAt': createdAt.toIso8601String(),
      'dueDate': dueDate?.toIso8601String(),
      'reminderTime': reminderTime?.toIso8601String(),
      'photoPath': photoPath,
      'completedAt': completedAt?.toIso8601String(),
      'completedBy': completedBy,
      'latitude': latitude,
      'longitude': longitude,
      'locationName': locationName,
    };
  }

  factory Task.fromMap(Map<String, dynamic> map) {
    return Task(
      id: map['id'],
      title: map['title'],
      description: map['description'] ?? '',
      completed: map['completed'] == 1,
      priority: map['priority'] ?? 'medium',
      createdAt: DateTime.parse(map['createdAt']),
      dueDate: map['dueDate'] != null ? DateTime.parse(map['dueDate']) : null,
      reminderTime: map['reminderTime'] != null ? DateTime.parse(map['reminderTime']) : null,
      photoPath: map['photoPath'],
      completedAt: map['completedAt'] != null ? DateTime.parse(map['completedAt']) : null,
      completedBy: map['completedBy'],
      latitude: map['latitude'] != null ? (map['latitude'] as num).toDouble() : null,
      longitude: map['longitude'] != null ? (map['longitude'] as num).toDouble() : null,
      locationName: map['locationName'] != null ? map['locationName'] as String : null,
    );
  }

  Task copyWith({
    String? title,
    String? description,
    bool? completed,
    String? priority,
    DateTime? dueDate,
    DateTime? reminderTime,
    bool clearDueDate = false,
    bool clearReminderTime = false,
    String? photoPath,
    DateTime? completedAt,
    String? completedBy,
    double? latitude,
    double? longitude,
    String? locationName,
  }) {
    return Task(
      id: id,
      title: title ?? this.title,
      description: description ?? this.description,
      completed: completed ?? this.completed,
      priority: priority ?? this.priority,
      createdAt: createdAt,
      dueDate: clearDueDate ? null : (dueDate ?? this.dueDate),
      reminderTime: clearReminderTime ? null : (reminderTime ?? this.reminderTime),
      photoPath: photoPath ?? this.photoPath,
      completedAt: completedAt ?? this.completedAt,
      completedBy: completedBy ?? this.completedBy,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      locationName: locationName ?? this.locationName,
    );
  }
  
  bool get isOverdue {
    if (dueDate == null || completed) return false;
    return DateTime.now().isAfter(dueDate!);
  }

  bool get hasLocation {
    return latitude != null && longitude != null;
  }

  bool get hasPhoto {
    return photoPath != null && photoPath!.isNotEmpty;
  }

  bool get wasCompletedByShake {
    return completed && completedBy == 'shake';
  }
}