import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

class NotificationService {
  static final NotificationService instance = NotificationService._init();
  static final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();

  NotificationService._init();

  Future<void> initialize() async {
    // Initialize timezone data
    tz.initializeTimeZones();
    
    // Set local timezone (Brazil)
    final String timeZoneName = 'America/Sao_Paulo';
    tz.setLocalLocation(tz.getLocation(timeZoneName));

    // Android initialization settings
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    // iOS initialization settings
    const DarwinInitializationSettings initializationSettingsIOS =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    // Combined initialization settings
    const InitializationSettings initializationSettings =
        InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );

    // Initialize the plugin
    await _notifications.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) async {
        // Handle notification tap
      },
    );

    // Request permissions for Android 13+
    await _requestPermissions();
  }

  Future<void> _requestPermissions() async {
    // Request permissions for Android
    final androidPlugin = _notifications.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin != null) {
      await androidPlugin.requestNotificationsPermission();
    }

    // Request permissions for iOS
    final iosPlugin = _notifications.resolvePlatformSpecificImplementation<
        IOSFlutterLocalNotificationsPlugin>();
    if (iosPlugin != null) {
      await iosPlugin.requestPermissions(
        alert: true,
        badge: true,
        sound: true,
      );
    }
  }

  Future<void> scheduleNotification({
    required String id,
    required String title,
    required String body,
    required DateTime scheduledTime,
  }) async {
    // Check if the scheduled time is in the future
    if (scheduledTime.isBefore(DateTime.now())) {
      return; // Don't schedule notifications in the past
    }

    // Convert to TZ datetime
    final tz.TZDateTime scheduledDate = tz.TZDateTime.from(
      scheduledTime,
      tz.local,
    );

    // Android notification details
    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      'task_reminders',
      'Lembretes de Tarefas',
      channelDescription: 'Notificações de lembretes para suas tarefas',
      importance: Importance.max,
      priority: Priority.high,
      ticker: 'Lembrete de Tarefa',
      icon: '@mipmap/ic_launcher',
    );

    // iOS notification details
    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    // Combined notification details
    const NotificationDetails notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    // Schedule the notification
    await _notifications.zonedSchedule(
      id.hashCode, // Use task ID hash as notification ID
      title,
      body,
      scheduledDate,
      notificationDetails,
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
    );
  }

  Future<void> cancelNotification(String id) async {
    await _notifications.cancel(id.hashCode);
  }

  Future<void> cancelAllNotifications() async {
    await _notifications.cancelAll();
  }

  Future<List<PendingNotificationRequest>> getPendingNotifications() async {
    return await _notifications.pendingNotificationRequests();
  }
}

