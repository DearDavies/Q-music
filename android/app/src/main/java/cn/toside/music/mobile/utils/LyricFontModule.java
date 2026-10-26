package cn.toside.music.mobile.utils;

import android.graphics.Typeface;
import android.net.Uri;
import android.util.AtomicFile;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.common.assets.ReactFontManager;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import org.json.JSONObject;

/** 歌词字体保存到应用私有目录，不依赖原文件的临时读取权限。 */
public class LyricFontModule extends ReactContextBaseJavaModule {
  private static final int MAX_SIZE = 32 * 1024 * 1024;
  private final File directory;
  private final AtomicFile metadata;

  LyricFontModule(ReactApplicationContext context) {
    super(context);
    directory = new File(context.getFilesDir(), "lyric-font");
    metadata = new AtomicFile(new File(directory, "current.json"));
  }

  @Override public String getName() { return "LyricFontModule"; }

  private WritableMap register(JSONObject info) throws Exception {
    String fileName = info.getString("file");
    if (!fileName.matches("[a-f0-9]{64}\\.font")) throw new IllegalArgumentException();
    File file = new File(directory, fileName);
    if (!file.isFile() || file.length() > MAX_SIZE) throw new IllegalArgumentException();
    Typeface typeface = Typeface.createFromFile(file);
    String family = "qmusic-lyric-" + fileName.substring(0, 64);
    ReactFontManager.getInstance().addCustomFont(family, typeface);
    WritableMap result = Arguments.createMap();
    result.putString("family", family);
    result.putString("name", info.getString("name"));
    return result;
  }

  @ReactMethod public synchronized void load(Promise promise) {
    try {
      if (!metadata.getBaseFile().exists()) { promise.resolve(null); return; }
      promise.resolve(register(new JSONObject(new String(metadata.readFully(), StandardCharsets.UTF_8))));
    } catch (Exception error) {
      promise.reject("font_load", "Unable to load the saved lyric font");
    }
  }

  @ReactMethod public synchronized void importFont(String source, Promise promise) {
    File pending = null;
    try {
      Uri uri = Uri.parse(source);
      String name = uri.getLastPathSegment();
      if (name == null || !name.toLowerCase(Locale.ROOT).matches(".*\\.(ttf|otf)$")) {
        promise.reject("font_invalid", "Choose a TTF or OTF font"); return;
      }
      if (!directory.isDirectory() && !directory.mkdirs()) throw new IllegalStateException();
      pending = File.createTempFile("import-", ".tmp", directory);
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      try (InputStream input = source.startsWith("content://")
          ? getReactApplicationContext().getContentResolver().openInputStream(uri)
          : new FileInputStream(source.startsWith("file://") ? uri.getPath() : source);
          FileOutputStream output = new FileOutputStream(pending)) {
        if (input == null) throw new IllegalArgumentException();
        byte[] buffer = new byte[8192];
        int length;
        long total = 0;
        while ((length = input.read(buffer)) != -1) {
          total += length;
          if (total > MAX_SIZE) { promise.reject("font_too_large", "Font exceeds 32 MB"); return; }
          digest.update(buffer, 0, length);
          output.write(buffer, 0, length);
        }
        output.getFD().sync();
      }
      try (FileInputStream input = new FileInputStream(pending)) {
        byte[] header = new byte[4];
        if (input.read(header) != 4 || !((header[0] == 0 && header[1] == 1 && header[2] == 0 && header[3] == 0)
          || new String(header, StandardCharsets.US_ASCII).equals("OTTO"))) {
          promise.reject("font_invalid", "Invalid TTF or OTF font"); return;
        }
      }
      // 验证新字体后才更新记录，导入失败时继续使用原字体。
      Typeface.createFromFile(pending);
      StringBuilder hash = new StringBuilder();
      for (byte value : digest.digest()) hash.append(String.format(Locale.ROOT, "%02x", value & 255));
      String fileName = hash + ".font";
      File destination = new File(directory, fileName);
      if (!destination.exists() && !pending.renameTo(destination)) throw new IllegalStateException();
      JSONObject info = new JSONObject().put("file", fileName).put("name", name.substring(0, Math.min(name.length(), 120)));
      FileOutputStream stream = null;
      try {
        stream = metadata.startWrite();
        stream.write(info.toString().getBytes(StandardCharsets.UTF_8));
        metadata.finishWrite(stream);
      } catch (Exception error) {
        if (stream != null) metadata.failWrite(stream);
        throw error;
      }
      WritableMap result = register(info);
      // 只保留当前导入字体的私有副本，不触碰用户选择的原文件。
      File[] files = directory.listFiles();
      if (files != null) for (File file : files) {
        if (file.getName().matches("[a-f0-9]{64}\\.font") && !file.equals(destination)) file.delete();
      }
      promise.resolve(result);
    } catch (Exception error) {
      promise.reject("font_import", "Unable to import this font");
    } finally {
      if (pending != null && pending.exists()) pending.delete();
    }
  }
}
