package com.k.ikasumi;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

public class PlaybackService extends Service {

  public static final String CHANNEL_ID = "ikasumi_playback_channel";
  public static final int NOTIFICATION_ID = 4201;

  public static final String ACTION_START = "com.k.ikasumi.action.START";
  public static final String ACTION_STOP = "com.k.ikasumi.action.STOP";
  public static final String EXTRA_TITLE = "title";
  public static final String EXTRA_TEXT = "text";

  private PowerManager.WakeLock wakeLock;

  @Override
  public void onCreate() {
    super.onCreate();
    createChannelIfNeeded();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      stopSelfSafely();
      return START_NOT_STICKY;
    }

    String title = "小説リーダー";
    String text = "読み上げ中…";
    if (intent != null) {
      if (intent.hasExtra(EXTRA_TITLE)) title = intent.getStringExtra(EXTRA_TITLE);
      if (intent.hasExtra(EXTRA_TEXT)) text = intent.getStringExtra(EXTRA_TEXT);
    }

    Notification notification = buildNotification(title, text);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      );
    } else {
      startForeground(NOTIFICATION_ID, notification);
    }

    acquireWakeLockIfNeeded();
    return START_STICKY;
  }

  private Notification buildNotification(String title, String text) {
    Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent contentIntent = null;
    if (openIntent != null) {
      openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      int flags = PendingIntent.FLAG_UPDATE_CURRENT;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        flags |= PendingIntent.FLAG_IMMUTABLE;
      }
      contentIntent = PendingIntent.getActivity(this, 0, openIntent, flags);
    }

    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(getApplicationInfo().icon)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE);

    if (contentIntent != null) builder.setContentIntent(contentIntent);
    return builder.build();
  }

  private void createChannelIfNeeded() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
        NotificationChannel channel = new NotificationChannel(
          CHANNEL_ID, "読み上げ再生中", NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("バックグラウンド読み上げ中に表示される通知です");
        nm.createNotificationChannel(channel);
      }
    }
  }

  private void acquireWakeLockIfNeeded() {
    if (wakeLock != null && wakeLock.isHeld()) return;
    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
    if (pm != null) {
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ikasumi:playbackWakeLock");
      wakeLock.setReferenceCounted(false);
      wakeLock.acquire(6 * 60 * 60 * 1000L); // 最大6時間で自動解放（安全弁）
    }
  }

  private void releaseWakeLock() {
    if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    wakeLock = null;
  }

  private void stopSelfSafely() {
    releaseWakeLock();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(Service.STOP_FOREGROUND_REMOVE);
    } else {
      stopForeground(true);
    }
    stopSelf();
  }

  @Override
  public void onDestroy() {
    releaseWakeLock();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) { return null; }
}