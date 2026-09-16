import sys

path = sys.argv[1]

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

permissions = [
    '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
    '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '<uses-permission android:name="android.permission.WAKE_LOCK" />',
]

for perm in permissions:
    if perm not in content:
        content = content.replace('</manifest>', '    ' + perm + '\n</manifest>')

service_block = '''
        <service
            android:name=".PlaybackService"
            android:foregroundServiceType="mediaPlayback"
            android:exported="false" />
'''

if 'android:name=".PlaybackService"' not in content:
    content = content.replace('</application>', service_block + '    </application>')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("AndroidManifest.xml patched.")