package com.k.ikasumi;

import android.content.Intent;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

@CapacitorPlugin(name = "Playback")
public class PlaybackPlugin extends Plugin {

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private int pendingLastIndex = -1;

    @PluginMethod
    public void start(PluginCall call) {
        String title = call.getString("title", "小説リーダー");
        String text = call.getString("text", "読み上げ中…");
        Intent intent = new Intent(getContext(), PlaybackService.class);
        intent.putExtra("title", title);
        intent.putExtra("text", text);
        getContext().startForegroundService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), PlaybackService.class);
        getContext().stopService(intent);
        if (tts != null) tts.stop();
        call.resolve();
    }

    @PluginMethod
    public void speakQueue(PluginCall call) {
        JSArray texts = call.getArray("texts");
        float rate = (float) call.getDouble("rate", 1.0);
        if (texts == null || texts.length() == 0) {
            call.resolve();
            return;
        }
        ensureTts(() -> enqueueAll(texts, rate));
        call.resolve();
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        if (tts != null) tts.stop();
        call.resolve();
    }

    private interface Ready { void run(); }

    private void ensureTts(Ready onReady) {
        if (ttsReady && tts != null) { onReady.run(); return; }
        tts = new TextToSpeech(getContext(), status -> {
            if (status == TextToSpeech.SUCCESS) {
                tts.setLanguage(Locale.JAPAN);
                ttsReady = true;
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        JSObject data = new JSObject();
                        data.put("id", utteranceId);
                        notifyListeners("utteranceStart", data);
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        try {
                            int idx = Integer.parseInt(utteranceId);
                            if (idx == pendingLastIndex) {
                                notifyListeners("queueDone", new JSObject());
                            }
                        } catch (NumberFormatException ignored) {}
                    }

                    @Override
                    public void onError(String utteranceId) {
                        JSObject data = new JSObject();
                        data.put("id", utteranceId);
                        notifyListeners("utteranceError", data);
                    }
                });
                onReady.run();
            }
        });
    }

    private void enqueueAll(JSArray texts, float rate) {
        if (tts == null) return;
        tts.setSpeechRate(rate);
        tts.stop();
        int count = texts.length();
        pendingLastIndex = count - 1;
        for (int i = 0; i < count; i++) {
            try {
                String t = texts.getString(i);
                tts.speak(t, TextToSpeech.QUEUE_ADD, new Bundle(), String.valueOf(i));
            } catch (Exception ignored) {}
        }
    }
}