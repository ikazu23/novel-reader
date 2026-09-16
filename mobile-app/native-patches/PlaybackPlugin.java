package com.k.ikasumi;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
  name = "Playback",
  permissions = {
    @Permission(strings = { android.Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
  }
)
public class PlaybackPlugin extends Plugin {

  @PluginMethod
  public void start(PluginCall call) {
    if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
      requestPermissionForAlias("notifications", call, "notificationPermsCallback");
      return;
    }
    startInternal(call);
  }

  @PermissionCallback
  private void notificationPermsCallback(PluginCall call) {
    startInternal(call);
  }

  private void startInternal(PluginCall call) {
    String title = call.getString("title", "小説リーダー");
    String text = call.getString("text", "読み上げ中…");

    Intent intent = new Intent(getContext(), PlaybackService.class);
    intent.setAction(PlaybackService.ACTION_START);
    intent.putExtra(PlaybackService.EXTRA_TITLE, title);
    intent.putExtra(PlaybackService.EXTRA_TEXT, text);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      getContext().startForegroundService(intent);
    } else {
      getContext().startService(intent);
    }

    JSObject ret = new JSObject();
    ret.put("started", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void stop(PluginCall call) {
    Intent intent = new Intent(getContext(), PlaybackService.class);
    intent.setAction(PlaybackService.ACTION_STOP);
    getContext().startService(intent);

    JSObject ret = new JSObject();
    ret.put("stopped", true);
    call.resolve(ret);
  }
}